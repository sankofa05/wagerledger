"use client";

import { Session } from "@/lib/types";
import { useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer
} from "recharts";

export function SessionChart({ sessions }: { sessions: Session[] }) {
  const data = useMemo(() => {
    const sorted = [...sessions].sort((a, b) => a.date.localeCompare(b.date));
    let cum = 0;
    return sorted.map((s) => {
      cum += (s.cashOut - s.buyIn);
      return { date: s.date, pnl: cum };
    });
  }, [sessions]);

  if (!data.length) return <div className="text-sm text-white/60">Ajoute ta première session pour voir la courbe.</div>;

  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <XAxis dataKey="date" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip />
          <Line type="monotone" dataKey="pnl" dot={false} strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
      <p className="text-xs text-white/55 mt-3">
        P&L cumulé = cash‑out − buy‑in, additionné au fil du temps.
      </p>
    </div>
  );
}
