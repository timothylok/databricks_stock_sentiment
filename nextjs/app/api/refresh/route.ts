import { NextRequest, NextResponse } from "next/server"
import { sendAlert } from "@/lib/alert"

const HOST    = process.env.DATABRICKS_HOST!
const TOKEN   = process.env.DATABRICKS_TOKEN!
const JOB_ID  = process.env.DATABRICKS_JOB_ID!
const REPO_ID = process.env.DATABRICKS_REPO_ID!
const SECRET  = process.env.CRON_SECRET!

// Called by cron-job.org at 7:00am NZT.
// Triggers the Databricks ETL job and returns the run_id.
// Does NOT invalidate the ISR cache — that happens via /api/refresh/complete
// once the job finishes (~30 min later), so we never re-cache stale data.
export async function POST(req: NextRequest) {
  if (!authorize(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  await syncRepo()

  const res = await fetch(`${HOST}/api/2.1/jobs/run-now`, {
    method: "POST",
    headers: {
      Authorization:  `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ job_id: Number(JOB_ID) }),
  })

  if (!res.ok) {
    const detail = await res.text()
    console.error("[refresh] Databricks trigger failed:", detail)
    await sendAlert(`🚨 **refresh**: Databricks trigger failed\n${detail}`)
    return NextResponse.json({ error: "Failed to trigger job", detail }, { status: 502 })
  }

  const { run_id } = await res.json()
  console.log(`[refresh] Job triggered — run_id: ${run_id}`)
  return NextResponse.json({ ok: true, run_id })
}

// Syncs the Databricks Repo to the latest commit on main before the job runs,
// so a push to main takes effect on the very next scheduled trigger.
// Best-effort: sync failure doesn't block the trigger, just alerts about it.
async function syncRepo() {
  const res = await fetch(`${HOST}/api/2.0/repos/${REPO_ID}`, {
    method: "PATCH",
    headers: {
      Authorization:  `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ branch: "main" }),
  })

  if (!res.ok) {
    const detail = await res.text()
    console.error("[refresh] Repo sync failed:", detail)
    await sendAlert(`🚨 **refresh**: Databricks repo sync failed\n${detail}`)
  }
}

function authorize(req: NextRequest): boolean {
  const auth = req.headers.get("authorization") ?? ""
  return Boolean(SECRET) && auth === `Bearer ${SECRET}`
}
