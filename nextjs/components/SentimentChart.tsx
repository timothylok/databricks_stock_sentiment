"use client"

import {
  LineChart, Line, XAxis, YAxis,
  Tooltip, ReferenceLine, ResponsiveContainer,
} from "recharts"
import type { DailyPoint } from "@/lib/databricks"

export function SentimentChart({ data }: { data: DailyPoint[] }) {
  if (data.length === 0) {
    return <p className="text-zinc-500 text-sm">No trend data yet.</p>
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
        <XAxis
          dataKey="date"
          tick={{ fill: "#71717a", fontSize: 11 }}
          tickFormatter={(d: string) => d.slice(5)}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          domain={[-1, 1]}
          tick={{ fill: "#71717a", fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: number) => v.toFixed(1)}
        />
        <ReferenceLine y={0} stroke="var(--chart-ref)" strokeDasharray="3 3" />
        <Tooltip
          contentStyle={{
            background: "var(--tooltip-bg)",
            border: "1px solid var(--tooltip-border)",
            borderRadius: 8,
            fontSize: 12,
          }}
          labelStyle={{ color: "var(--tooltip-label)", marginBottom: 4 }}
          formatter={(value) => {
            const v = Number(value)
            return [`${v >= 0 ? "+" : ""}${v.toFixed(4)}`, "Sentiment"]
          }}
        />
        <Line
          type="monotone"
          dataKey="avg_compound"
          stroke="var(--chart-line)"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, fill: "var(--chart-line)", strokeWidth: 0 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
