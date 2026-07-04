import { NextRequest, NextResponse } from "next/server"
import { revalidateTag } from "next/cache"
import { sendAlert } from "@/lib/alert"

const HOST   = process.env.DATABRICKS_HOST!
const TOKEN  = process.env.DATABRICKS_TOKEN!
const JOB_ID = process.env.DATABRICKS_JOB_ID!
const SECRET = process.env.CRON_SECRET!

// Called by cron-job.org at 7:30am NZT — 30 min after /api/refresh fires the job.
// Verifies the run succeeded before invalidating the ISR cache so we never
// surface a page re-render against half-written Delta tables.
//
// cron-job.org can't forward /api/refresh's run_id into this call (it's a
// separate, statically-scheduled job with no way to chain the response), so
// run_id is normally absent — we look up the job's most recent run instead.
// Body (optional): { "run_id": 12345 } — still honored if ever passed explicitly.
// Header: Authorization: Bearer <CRON_SECRET>
export async function POST(req: NextRequest) {
  if (!authorize(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const run_id: number | undefined = body?.run_id ?? (await getLatestRunId())

  if (run_id != null) {
    const state = await getRunState(run_id)
    if (!state) {
      await sendAlert(`🚨 **refresh/complete**: Could not fetch run state for run_id ${run_id}`)
      return NextResponse.json({ error: "Could not fetch run state" }, { status: 502 })
    }
    if (state !== "SUCCESS") {
      console.warn(`[refresh/complete] Run ${run_id} state: ${state} — skipping cache invalidation`)
      await sendAlert(`🚨 **refresh/complete**: Run ${run_id} finished with state ${state} — cache not invalidated`)
      return NextResponse.json({ ok: false, run_id, state }, { status: 200 })
    }
  }

  revalidateTag("sentiment", "default")
  console.log("[refresh/complete] ISR cache invalidated")
  return NextResponse.json({ ok: true, run_id: run_id ?? null })
}

async function getLatestRunId(): Promise<number | undefined> {
  const res = await fetch(`${HOST}/api/2.1/jobs/runs/list?job_id=${JOB_ID}&limit=1`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  })
  if (!res.ok) return undefined
  const data = await res.json()
  return data?.runs?.[0]?.run_id
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
