import { NextResponse } from "next/server";
import { MarketSeries } from "@/lib/types";

const sample: MarketSeries[] = [
  {
    id: "FR_ONLINE",
    label: "France — marché en ligne (exemple)",
    unit: "index",
    sourceNote: "Exemple pédagogique. Branche ici un import ANJ/data.gouv + tes transformations.",
    points: [
      { date: "2024-01", value: 100 },
      { date: "2024-02", value: 104 },
      { date: "2024-03", value: 98 },
      { date: "2024-04", value: 110 },
      { date: "2024-05", value: 115 },
      { date: "2024-06", value: 112 },
      { date: "2024-07", value: 120 },
      { date: "2024-08", value: 118 },
      { date: "2024-09", value: 125 },
      { date: "2024-10", value: 130 },
      { date: "2024-11", value: 128 },
      { date: "2024-12", value: 135 }
    ],
  },
  {
    id: "UK_ONLINE",
    label: "Royaume‑Uni — online (exemple)",
    unit: "index",
    sourceNote: "Exemple pédagogique. Branche ici UKGC (Industry Statistics / Market overview).",
    points: [
      { date: "2024-01", value: 100 },
      { date: "2024-02", value: 101 },
      { date: "2024-03", value: 103 },
      { date: "2024-04", value: 102 },
      { date: "2024-05", value: 106 },
      { date: "2024-06", value: 108 },
      { date: "2024-07", value: 107 },
      { date: "2024-08", value: 109 },
      { date: "2024-09", value: 111 },
      { date: "2024-10", value: 114 },
      { date: "2024-11", value: 113 },
      { date: "2024-12", value: 116 }
    ],
  },
  {
    id: "NV_REVENUE",
    label: "Nevada — Monthly Revenue (exemple)",
    unit: "index",
    sourceNote: "Exemple pédagogique. Branche ici les Monthly Revenue Reports NGCB.",
    points: [
      { date: "2024-01", value: 100 },
      { date: "2024-02", value: 99 },
      { date: "2024-03", value: 105 },
      { date: "2024-04", value: 107 },
      { date: "2024-05", value: 106 },
      { date: "2024-06", value: 109 },
      { date: "2024-07", value: 111 },
      { date: "2024-08", value: 110 },
      { date: "2024-09", value: 112 },
      { date: "2024-10", value: 115 },
      { date: "2024-11", value: 114 },
      { date: "2024-12", value: 118 }
    ],
  },
];

export async function GET() {
  return NextResponse.json({ updatedAt: new Date().toISOString(), series: sample });
}
