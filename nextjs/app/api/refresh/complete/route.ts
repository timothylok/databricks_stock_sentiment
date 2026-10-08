import { NextRequest, NextResponse } from "next/server"
import { revalidateTag } from "next/cache"

const SECRET = process.env.CRON_SECRET!

// Called by the last step of the daily-refresh GitHub Actions workflow, after the
// pipeline has written fresh rows to D1. Invalidates the ISR cache; pages rebuild
// from D1 on the next visit. A failed pipeline never reaches this step.
// Header: Authorization: Bearer <CRON_SECRET>
export async function POST(req: NextRequest) {
  if (!authorize(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  revalidateTag("sentiment", "default")
  console.log("[refresh/complete] ISR cache invalidated")
  return NextResponse.json({ ok: true })
}

function authorize(req: NextRequest): boolean {
  const auth = req.headers.get("authorization") ?? ""
  return Boolean(SECRET) && auth === `Bearer ${SECRET}`
}
