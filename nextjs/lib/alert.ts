const WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL

// Best-effort failure alert — never throws, so a broken webhook can't take down
// the refresh/complete routes themselves.
// Identical messages are sent at most once an hour per server instance, so a broken
// D1 doesn't post on every page visit.
const lastSent = new Map<string, number>()
const DEDUPE_MS = 60 * 60 * 1000

export async function sendAlert(message: string) {
  if (!WEBHOOK_URL) return
  const now = Date.now()
  if (now - (lastSent.get(message) ?? 0) < DEDUPE_MS) return
  lastSent.set(message, now)
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
