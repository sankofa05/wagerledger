"use client";

import { MarketSeries } from "@/lib/types";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend
} from "recharts";

export function MarketChart({ series }: { series: MarketSeries[] }) {
  const merged = mergeSeries(series);

  if (!merged.length) {
    return <div className="text-sm text-white/60">Aucune donnée.</div>;
  }

  return (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={merged}>
          <XAxis dataKey="date" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip />
          <Legend />
          {series.map((s) => (
            <Line
              key={s.id}
              type="monotone"
              dataKey={s.id}
              dot={false}
              strokeWidth={2}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
      <p className="text-xs text-white/55 mt-3">
        Astuce : remplace l’API sample par un import ETL (CSV/Excel/PDF → JSON).
      </p>
    </div>
  );
}

function mergeSeries(series: MarketSeries[]) {
  const allDates = Array.from(new Set(series.flatMap((s) => s.points.map((p) => p.date)))).sort();
  return allDates.map((date) => {
    const row: any = { date };
    for (const s of series) {
      const p = s.points.find((x) => x.date === date);
      row[s.id] = p?.value ?? null;
    }
    return row;
  });
}
