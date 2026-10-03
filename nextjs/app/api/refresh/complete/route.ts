import { NextRequest, NextResponse } from "next/server"
import { revalidateTag } from "next/cache"
import { sendAlert } from "@/lib/alert"
import { VALID_TICKERS } from "@/lib/databricks"

const HOST   = process.env.DATABRICKS_HOST!
const TOKEN  = process.env.DATABRICKS_TOKEN!
const JOB_ID = process.env.DATABRICKS_JOB_ID!
const SECRET = process.env.CRON_SECRET!

// The 7:00am trigger's run should be ~30 min old at 7:30am; anything older
// means no new run happened today.
const MAX_RUN_AGE_MS = 6 * 60 * 60 * 1000

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
    const run = await getRun(run_id)
    const state = run?.state
    if (!state) {
      await sendAlert(`🚨 **refresh/complete**: Could not fetch run state for run_id ${run_id}`)
      return NextResponse.json({ error: "Could not fetch run state" }, { status: 502 })
    }
    // If today's trigger never produced a run, the latest run is an old success —
    // invalidating would just re-cache whatever the dashboard renders now.
    if (run.start_time != null && Date.now() - run.start_time > MAX_RUN_AGE_MS) {
      const started = new Date(run.start_time).toISOString()
      console.warn(`[refresh/complete] Latest run ${run_id} started ${started} — stale, skipping cache invalidation`)
      await sendAlert(`🚨 **refresh/complete**: Latest run ${run_id} started ${started} — no new run today, cache not invalidated`)
      return NextResponse.json({ ok: false, run_id, stale: true, started }, { status: 200 })
    }
    if (state !== "SUCCESS") {
      console.warn(`[refresh/complete] Run ${run_id} state: ${state} — skipping cache invalidation`)
      await sendAlert(`🚨 **refresh/complete**: Run ${run_id} finished with state ${state} — cache not invalidated`)
      return NextResponse.json({ ok: false, run_id, state }, { status: 200 })
    }
  }

  revalidateTag("sentiment", "default")
  console.log("[refresh/complete] ISR cache invalidated")

  // revalidateTag only marks pages stale: the next visit to each page still gets the
  // old copy and starts the rebuild. Visit every page now so real visitors see fresh data.
  const origin = req.nextUrl.origin
  const paths = ["/", ...[...VALID_TICKERS].map((t) => `/ticker/${t}`)]
  await Promise.allSettled(paths.map((p) => fetch(`${origin}${p}`, { cache: "no-store" })))
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

async function getRun(run_id: number): Promise<{ state: string | null; start_time: number | null } | null> {
  const res = await fetch(`${HOST}/api/2.1/jobs/runs/get?run_id=${run_id}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  })
  if (!res.ok) return null
  const data = await res.json()
  return {
    // result_state is only present once the run is terminal
    state:      data?.state?.result_state ?? data?.state?.life_cycle_state ?? null,
    start_time: data?.start_time ?? null,
  }
}

function authorize(req: NextRequest): boolean {
  const auth = req.headers.get("authorization") ?? ""
  return Boolean(SECRET) && auth === `Bearer ${SECRET}`
}
