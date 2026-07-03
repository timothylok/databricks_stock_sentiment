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
          domain={[-0.5, 0.5]}
          tick={{ fill: "#71717a", fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: number) => v.toFixed(1)}
        />
        <ReferenceLine y={0} stroke="#3f3f46" strokeDasharray="3 3" />
        <Tooltip
          contentStyle={{
            background: "#09090b",
            border: "1px solid #27272a",
            borderRadius: 8,
            fontSize: 12,
          }}
          labelStyle={{ color: "#a1a1aa", marginBottom: 4 }}
          formatter={(value: number) => [
            `${value >= 0 ? "+" : ""}${value.toFixed(4)}`,
            "Sentiment",
          ]}
        />
        <Line
          type="monotone"
          dataKey="avg_compound"
          stroke="#34d399"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, fill: "#34d399", strokeWidth: 0 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
