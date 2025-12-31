"use client";

import { useEffect, useMemo, useState } from "react";
import { MarketSeries } from "@/lib/types";
import { Card, Pill } from "@/components/ui";
import { MarketChart } from "@/components/market-chart";

type ApiResponse = { updatedAt: string; series: MarketSeries[] };

export default function MarketPage() {
  const [data, setData] = useState<ApiResponse | null>(null);

  useEffect(() => {
    fetch("/api/market")
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData(null));
  }, []);

  const totals = useMemo(() => {
    if (!data?.series?.length) return [];
    return data.series.map((s) => {
      const last = s.points[s.points.length - 1]?.value ?? 0;
      const first = s.points[0]?.value ?? 0;
      const delta = first ? ((last - first) / first) * 100 : 0;
      return { id: s.id, label: s.label, last, delta };
    });
  }, [data]);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold">Observatoire marché</h2>
        <p className="text-white/70 max-w-3xl">
          V1 : dataset “sample” pour la structure. Ensuite on branche les sources publiques (ANJ, UKGC, Nevada…),
          et on ajoute des pages par pays + filtres.
        </p>
        {data?.updatedAt && (
          <div className="text-xs text-white/55">
            Dernière mise à jour (sample) : {new Date(data.updatedAt).toLocaleString("fr-FR")}
          </div>
        )}
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {totals.map((t) => (
          <Card key={t.id} title={t.label}>
            <div className="flex items-baseline justify-between gap-3">
              <div className="text-3xl font-semibold">{Math.round(t.last)}</div>
              <Pill tone={t.delta >= 0 ? "good" : "bad"}>
                {t.delta >= 0 ? "+" : ""}{t.delta.toFixed(1)}%
              </Pill>
            </div>
            <p className="text-xs text-white/55 mt-2">
              (index pédagogique)
            </p>
          </Card>
        ))}
      </div>

      <Card title="Tendance (sample)">
        <MarketChart series={data?.series ?? []} />
      </Card>

      <div className="text-sm text-white/65 space-y-2">
        <p className="font-medium text-white/75">Idées d’upgrade :</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Page “Sources” + téléchargement des datasets (CSV/Excel/PDF)</li>
          <li>Import : transformer les fichiers ANJ/UKGC en JSON (ETL)</li>
          <li>Filtres : période, pays, segment, métriques (GGY/GGR, joueurs, etc.)</li>
        </ul>
      </div>
    </div>
  );
}
