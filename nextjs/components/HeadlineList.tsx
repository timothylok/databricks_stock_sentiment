import type { Headline } from "@/lib/databricks"

export function HeadlineList({ headlines }: { headlines: Headline[] }) {
  if (headlines.length === 0) {
    return <p className="text-zinc-500 text-sm">No headlines available.</p>
  }

  return (
    <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
      {headlines.map((h) => (
        <li key={h.article_id} className="py-3 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm text-zinc-800 dark:text-zinc-200 leading-snug">{h.title}</p>
            <p className="text-xs text-zinc-500 mt-1 capitalize">
              {h.source} · {formatDate(h.published_at)}
            </p>
          </div>
          <span
            className={`shrink-0 text-xs font-mono font-medium px-2 py-1 rounded
                        ${scoreStyle(h.compound)}`}
          >
            {h.compound >= 0 ? "+" : ""}
            {h.compound.toFixed(3)}
          </span>
        </li>
      ))}
    </ul>
  )
}

function scoreStyle(c: number): string {
  if (c >= 0.2)   return "bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400"
  if (c <= -0.2)  return "bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400"
  return "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400"
}

function formatDate(ts: string): string {
  // Databricks returns "YYYY-MM-DD HH:MM:SS" with no zone; it's UTC
  const iso = ts.includes("T") ? ts : ts.replace(" ", "T")
  return new Date(iso.endsWith("Z") ? iso : iso + "Z").toLocaleDateString("en-NZ", {
    timeZone: "Pacific/Auckland",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }) + " NZT"
}
