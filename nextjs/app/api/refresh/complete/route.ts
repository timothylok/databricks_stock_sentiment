import { NextRequest, NextResponse } from "next/server"
import { revalidateTag } from "next/cache"

const HOST   = process.env.DATABRICKS_HOST!
const TOKEN  = process.env.DATABRICKS_TOKEN!
const SECRET = process.env.CRON_SECRET!

// Called by cron-job.org at 7:30am NZT — 30 min after /api/refresh fires the job.
// Verifies the run succeeded before invalidating the ISR cache so we never
// surface a page re-render against half-written Delta tables.
//
// cron-job.org call: POST /api/refresh/complete
// Body (optional): { "run_id": 12345 }
// Header: Authorization: Bearer <CRON_SECRET>
export async function POST(req: NextRequest) {
  if (!authorize(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // If run_id was forwarded, verify the run actually succeeded before invalidating.
  const body = await req.json().catch(() => ({}))
  const run_id: number | undefined = body?.run_id

  if (run_id != null) {
    const state = await getRunState(run_id)
    if (!state) {
      return NextResponse.json({ error: "Could not fetch run state" }, { status: 502 })
    }
    if (state !== "SUCCESS") {
      console.warn(`[refresh/complete] Run ${run_id} state: ${state} — skipping cache invalidation`)
      return NextResponse.json({ ok: false, run_id, state }, { status: 200 })
    }
  }

  revalidateTag("sentiment", "default")
  console.log("[refresh/complete] ISR cache invalidated")
  return NextResponse.json({ ok: true, run_id: run_id ?? null })
}

async function getRunState(run_id: number): Promise<string | null> {
  const res = await fetch(`${HOST}/api/2.1/jobs/runs/get?run_id=${run_id}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  })
  if (!res.ok) return null
  const data = await res.json()
  // result_state is only present once the run is terminal
  return data?.state?.result_state ?? data?.state?.life_cycle_state ?? null
}

function authorize(req: NextRequest): boolean {
  const auth = req.headers.get("authorization") ?? ""
  return Boolean(SECRET) && auth === `Bearer ${SECRET}`
}
