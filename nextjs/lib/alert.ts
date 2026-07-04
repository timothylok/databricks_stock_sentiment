const WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL

// Best-effort failure alert — never throws, so a broken webhook can't take down
// the refresh/complete routes themselves.
export async function sendAlert(message: string) {
  if (!WEBHOOK_URL) return
  try {
    await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: message }),
    })
  } catch (err) {
    console.error("[alert] Failed to send Discord alert:", err)
  }
}
