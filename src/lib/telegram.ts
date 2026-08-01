const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || ""

export async function notify(message: string) {
  try {
    await fetch(BACKEND_URL + "/api/telegram", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    })
  } catch (e) {
    console.warn("Telegram notification failed:", e)
  }
}

export function formatAddress(addr: string): string {
  return addr.slice(0, 6) + "..." + addr.slice(-4)
}