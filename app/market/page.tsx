"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MarketSeries } from "@/lib/types";
import { Card, Pill } from "@/components/ui";
import { MarketChart } from "@/components/market-chart";
import { toNumberSafe, uid } from "@/lib/utils";

type ApiResponse = { updatedAt: string; series: MarketSeries[] };

const LOCAL_KEY = "wagerledger.market.v1";

function loadLocalMarket(): ApiResponse | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LOCAL_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.series)) return null;
    return parsed as ApiResponse;
  } catch {
    return null;
  }
}

function saveLocalMarket(data: ApiResponse) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LOCAL_KEY, JSON.stringify(data));
}

function clearLocalMarket() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(LOCAL_KEY);
}

function normalizeMonth(raw: string): string {
  const s = String(raw ?? "").trim();
  if (!s) return "";

  // "2024-01-15" => "2024-01"
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 7);
  // "2024-01" => ok
  if (/^\d{4}-\d{2}$/.test(s)) return s;
  // "2024/01" => "2024-01"
  if (/^\d{4}\/\d{2}$/.test(s)) return s.replace("/", "-");
  // "01/2024" => "2024-01"
  if (/^\d{2}\/\d{4}$/.test(s)) {
    const [mm, yyyy] = s.split("/");
    return `${yyyy}-${mm}`;
  }
  // fallback: return as-is (chart will show it)
  return s;
}

function detectSeparator(line: string): string {
  const candidates = [",", ";", "\t"];
  let best = ",";
  let bestCount = -1;
  for (const c of candidates) {
    const count = line.split(c).length - 1;
    if (count > bestCount) {
      bestCount = count;
      best = c;
    }
  }
  return best;
}

function splitCsvLine(line: string, sep: string): string[] {
  // Parse CSV simple avec quotes ("...")
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (!inQuotes && ch === sep) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out.map((x) => x.trim());
}

function parseCsvToSeries(text: string): MarketSeries[] {
  const raw = text.replace(/^\uFEFF/, ""); // BOM
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (!lines.length) return [];

  // Support "sep=;" (Excel)
  let sep = detectSeparator(lines[0]);
  if (/^sep=./i.test(lines[0])) {
    sep = lines[0].slice(4, 5);
    lines.shift();
  }
  if (!lines.length) return [];

  const header = splitCsvLine(lines[0], sep).map((h) => h.toLowerCase());
  const rows = lines.slice(1);

  const idxDate = header.findIndex((h) => ["date", "month", "period", "periode"].includes(h));
  if (idxDate === -1) {
    throw new Error("CSV: colonne 'date' introuvable");
  }

  const idxValue = header.findIndex((h) => ["value", "valeur", "amount"].includes(h));
  const idxSeries = header.findIndex((h) => ["series", "serie", "id", "metric"].includes(h));
  const idxLabel = header.findIndex((h) => ["label", "name", "nom"].includes(h));
  const idxUnit = header.findIndex((h) => ["unit", "unite"].includes(h));
  const idxSource = header.findIndex((h) => ["source", "sourcenote", "note"].includes(h));

  // Format LONG: date, series, value (+ optional label/unit/source)
  const isLong = idxSeries !== -1 && idxValue !== -1;

  // Format WIDE: date, SERIES_A, SERIES_B...
  const isWide = !isLong && header.length >= 2;

  if (isLong) {
    const map = new Map<string, MarketSeries>();

    for (const line of rows) {
      const cols = splitCsvLine(line, sep);
      const date = normalizeMonth(cols[idxDate] ?? "");
      const sid = String(cols[idxSeries] ?? "").trim();
      const value = toNumberSafe(cols[idxValue] ?? "");
      if (!date || !sid) continue;

      const existing = map.get(sid);
      const label = idxLabel !== -1 ? String(cols[idxLabel] ?? "").trim() : "";
      const unit = idxUnit !== -1 ? String(cols[idxUnit] ?? "").trim() : "";
      const sourceNote = idxSource !== -1 ? String(cols[idxSource] ?? "").trim() : "";

      if (!existing) {
        map.set(sid, {
          id: sid,
          label: label || sid,
          unit: unit || "value",
          sourceNote: sourceNote || "",
          points: [{ date, value }],
        });
      } else {
        if (label && existing.label === sid) existing.label = label;
        if (unit && existing.unit === "value") existing.unit = unit;
        if (sourceNote && !existing.sourceNote) existing.sourceNote = sourceNote;
        existing.points.push({ date, value });
      }
    }

    const series = Array.from(map.values()).map((s) => {
      const dedup = new Map<string, number>();
      for (const p of s.points) dedup.set(p.date, p.value);
      const points = Array.from(dedup.entries())
        .map(([date, value]) => ({ date, value }))
        .sort((a, b) => a.date.localeCompare(b.date));
      return { ...s, points };
    });

    return series.sort((a, b) => a.label.localeCompare(b.label));
  }

  if (isWide) {
    const ids = header
      .map((h, i) => ({ h, i }))
      .filter((x) => x.i !== idxDate)
      .map((x) => x.h)
      .filter((h) => h);

    const seriesMap = new Map<string, MarketSeries>();
    for (const id of ids) {
      seriesMap.set(id, { id, label: id, unit: "value", sourceNote: "", points: [] });
    }

    for (const line of rows) {
      const cols = splitCsvLine(line, sep);
      const date = normalizeMonth(cols[idxDate] ?? "");
      if (!date) continue;

      for (let i = 0; i < header.length; i++) {
        if (i === idxDate) continue;
        const sid = header[i];
        const rawVal = cols[i] ?? "";
        if (rawVal === "" || rawVal === null || rawVal === undefined) continue;
        const v = toNumberSafe(rawVal);
        const s = seriesMap.get(sid);
        if (s) s.points.push({ date, value: v });
      }
    }

    const series = Array.from(seriesMap.values()).map((s) => {
      const dedup = new Map<string, number>();
      for (const p of s.points) dedup.set(p.date, p.value);
      const points = Array.from(dedup.entries())
        .map(([date, value]) => ({ date, value }))
        .sort((a, b) => a.date.localeCompare(b.date));
      return { ...s, id: s.id.toUpperCase(), label: s.label.toUpperCase(), points };
    });

    return series.sort((a, b) => a.label.localeCompare(b.label));
  }

  throw new Error("CSV non reconnu. Utilise soit LONG (date,series,value) soit WIDE (date, SERIES_A, SERIES_B, ...)");
}

function buildTemplateCsv() {
  // Long format template
  const sep = ";";
  const header = ["date", "series", "value", "label", "unit", "source"].join(sep);
  const rows = [
    ["2024-01", "FR_ONLINE", "100", "France — online", "index", "ANJ (exemple)"].join(sep),
    ["2024-02", "FR_ONLINE", "104", "France — online", "index", "ANJ (exemple)"].join(sep),
    ["2024-01", "UK_ONLINE", "100", "UK — online", "index", "UKGC (exemple)"].join(sep),
    ["2024-02", "UK_ONLINE", "101", "UK — online", "index", "UKGC (exemple)"].join(sep),
  ];
  return "\uFEFF" + ["sep=;", header, ...rows].join("\n");
}

export default function MarketPage() {
  const [sample, setSample] = useState<ApiResponse | null>(null);
  const [local, setLocal] = useState<ApiResponse | null>(null);
  const [mode, setMode] = useState<"sample" | "local">("sample");

  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");

  const importJsonRef = useRef<HTMLInputElement | null>(null);
  const importCsvRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    // local first
    const localData = loadLocalMarket();
    setLocal(localData);
    if (localData?.series?.length) {
      setMode("local");
      setSelected(localData.series.map((s) => s.id));
    }
  }, []);

  useEffect(() => {
    fetch("/api/market")
      .then((r) => r.json())
      .then((d: ApiResponse) => {
        setSample(d);
        // default selection for sample if nothing selected
        setSelected((prev) => (prev.length ? prev : d?.series?.map((s) => s.id) ?? []));
      })
      .catch(() => setSample(null));
  }, []);

  const activeData = mode === "local" ? local : sample;
  const allSeries = activeData?.series ?? [];

  const filteredList = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return allSeries;
    return allSeries.filter((s) => {
      const hay = `${s.id} ${s.label} ${s.unit} ${(s.sourceNote ?? "")}`.toLowerCase();
      return hay.includes(qq);
    });
  }, [allSeries, q]);

  const dateOptions = useMemo(() => {
    const set = new Set<string>();
    for (const s of allSeries) {
      for (const p of s.points) set.add(p.date);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [allSeries]);

  useEffect(() => {
    // init range if empty
    if (!dateOptions.length) return;
    setFrom((v) => v || dateOptions[0]);
    setTo((v) => v || dateOptions[dateOptions.length - 1]);
  }, [dateOptions]);

  const activeSeries = useMemo(() => {
    const sset = new Set(selected);
    const list = allSeries.filter((s) => sset.has(s.id));

    // sécurité si user choisit un range inversé
    const f = from || "";
    const t = to || "";
    const f0 = f && t && f > t ? t : f;
    const t0 = f && t && f > t ? f : t;

    const inRange = (d: string) => {
      if (f0 && d < f0) return false;
      if (t0 && d > t0) return false;
      return true;
    };

    return list.map((s) => ({
      ...s,
      points: s.points.filter((p) => inRange(p.date)),
    }));
  }, [allSeries, from, selected, to]);

  const cards = useMemo(() => {
    return activeSeries.map((s) => {
      const pts = s.points;
      const first = pts[0]?.value ?? 0;
      const last = pts[pts.length - 1]?.value ?? 0;
      const delta = first ? ((last - first) / first) * 100 : 0;
      return {
        id: s.id,
        label: s.label,
        unit: s.unit,
        first,
        last,
        delta,
        points: pts.length,
      };
    });
  }, [activeSeries]);

  function toggleSelect(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function selectAllFiltered() {
    setSelected((prev) => {
      const set = new Set(prev);
      for (const s of filteredList) set.add(s.id);
      return Array.from(set);
    });
  }

  function clearSelection() {
    setSelected([]);
  }

  function downloadTemplateCsv() {
    const csv = buildTemplateCsv();
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "market-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportLocalJson() {
    const d = local;
    if (!d) {
      alert("Aucun dataset local à exporter.");
      return;
    }
    const blob = new Blob([JSON.stringify(d, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "market-dataset.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  function importJsonFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const raw = String(reader.result ?? "");
        const parsed = JSON.parse(raw);
        let series: MarketSeries[] = [];

        if (Array.isArray(parsed)) {
          series = parsed as MarketSeries[];
        } else if (parsed && Array.isArray(parsed.series)) {
          series = parsed.series as MarketSeries[];
        } else {
          throw new Error("bad json");
        }

        const cleaned = series
          .map((s: any) => {
            const id = String(s.id ?? "").trim() || uid("SER");
            const label = String(s.label ?? id);
            const unit = String(s.unit ?? "value");
            const sourceNote = String(s.sourceNote ?? "");
            const points = Array.isArray(s.points)
              ? s.points
                  .map((p: any) => ({
                    date: normalizeMonth(p?.date ?? ""),
                    value: toNumberSafe(p?.value ?? 0),
                  }))
                  .filter((p: any) => p.date)
                  .sort((a: any, b: any) => a.date.localeCompare(b.date))
              : [];
            return { id, label, unit, sourceNote, points } as MarketSeries;
          })
          .filter((s) => s.points.length > 0);

        const next: ApiResponse = { updatedAt: new Date().toISOString(), series: cleaned };
        saveLocalMarket(next);
        setLocal(next);
        setMode("local");
        setSelected(cleaned.map((s) => s.id));
        alert(`Import JSON OK — ${cleaned.length} séries.`);
      } catch {
        alert("Import JSON impossible. Format attendu: {updatedAt, series:[...]} ou directement [series].");
      }
    };
    reader.readAsText(file);
  }

  function importCsvFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const raw = String(reader.result ?? "");
        const series = parseCsvToSeries(raw);
        if (!series.length) throw new Error("empty");
        const next: ApiResponse = { updatedAt: new Date().toISOString(), series };
        saveLocalMarket(next);
        setLocal(next);
        setMode("local");
        setSelected(series.map((s) => s.id));
        alert(`Import CSV OK — ${series.length} séries.`);
      } catch (e: any) {
        alert(`Import CSV impossible.\n\n${e?.message ?? "Erreur"}`);
      }
    };
    reader.readAsText(file);
  }

  function resetLocal() {
    const ok = window.confirm("Supprimer le dataset local (importé) ?\n\nOK = oui, on revient au sample.");
    if (!ok) return;
    clearLocalMarket();
    setLocal(null);
    setMode("sample");
    setSelected(sample?.series?.map((s) => s.id) ?? []);
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-2xl font-semibold">Market Observatory</h2>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setMode("sample")}
              className={`text-xs px-3 py-2 rounded-2xl border border-white/20 hover:bg-white/5 ${
                mode === "sample" ? "bg-white text-black" : ""
              }`}
            >
              Sample API
            </button>
            <button
              onClick={() => setMode("local")}
              disabled={!local?.series?.length}
              className={`text-xs px-3 py-2 rounded-2xl border border-white/20 hover:bg-white/5 disabled:opacity-40 ${
                mode === "local" ? "bg-white text-black" : ""
              }`}
            >
              Local dataset
            </button>
          </div>
        </div>

        <p className="text-white/70 max-w-3xl">
          V1 : import <span className="text-white/85">CSV / JSON</span> côté navigateur, stockage local. Ensuite on
          branche des pipelines (ETL) vers les sources publiques (ANJ, UKGC, Nevada…).
        </p>

        <div className="text-xs text-white/55">
          Mode: <span className="text-white/75">{mode}</span>
          {activeData?.updatedAt ? (
            <>
              {" "}• Updated:{" "}
              <span className="text-white/75">{new Date(activeData.updatedAt).toLocaleString("fr-FR")}</span>
            </>
          ) : null}
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <Card title="Import / Export">
          <div className="flex flex-col gap-2">
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => importJsonRef.current?.click()}
                className="text-xs px-3 py-2 rounded-2xl border border-white/20 hover:bg-white/5"
              >
                Import JSON
              </button>
              <button
                onClick={() => importCsvRef.current?.click()}
                className="text-xs px-3 py-2 rounded-2xl border border-white/20 hover:bg-white/5"
              >
                Import CSV
              </button>
            </div>

            <div className="flex gap-2 flex-wrap">
              <button
                onClick={downloadTemplateCsv}
                className="text-xs px-3 py-2 rounded-2xl border border-white/20 hover:bg-white/5"
              >
                Download CSV template
              </button>
              <button
                onClick={exportLocalJson}
                className="text-xs px-3 py-2 rounded-2xl border border-white/20 hover:bg-white/5"
              >
                Export local JSON
              </button>
            </div>

            <button
              onClick={resetLocal}
              className="text-xs px-3 py-2 rounded-2xl border border-white/20 hover:bg-white/5"
            >
              Reset local dataset
            </button>

            <p className="text-xs text-white/55">
              CSV support: <span className="text-white/75">LONG</span> (date, series, value) or{" "}
              <span className="text-white/75">WIDE</span> (date, FR_ONLINE, UK_ONLINE…)
            </p>
          </div>

          <input
            ref={importJsonRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) importJsonFile(f);
              e.currentTarget.value = "";
            }}
          />

          <input
            ref={importCsvRef}
            type="file"
            accept="text/csv,.csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) importCsvFile(f);
              e.currentTarget.value = "";
            }}
          />
        </Card>

        <Card title="Series selector">
          <div className="space-y-3">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search id / label / source…"
              className="w-full rounded-xl bg-black/30 border border-white/10 px-3 py-2 text-sm"
            />

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={selectAllFiltered}
                className="text-xs px-3 py-2 rounded-2xl border border-white/20 hover:bg-white/5"
              >
                Select all (filtered)
              </button>
              <button
                onClick={clearSelection}
                className="text-xs px-3 py-2 rounded-2xl border border-white/20 hover:bg-white/5"
              >
                Clear
              </button>
              <Pill>{selected.length} selected</Pill>
            </div>

            <div className="max-h-44 overflow-auto pr-1 space-y-2">
              {filteredList.map((s) => (
                <label key={s.id} className="flex items-start gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selected.includes(s.id)}
                    onChange={() => toggleSelect(s.id)}
                    className="mt-1"
                  />
                  <span>
                    <span className="text-white/85 font-medium">{s.label}</span>
                    <span className="text-white/55"> — {s.id}</span>
                    {s.unit ? <span className="text-white/45"> • {s.unit}</span> : null}
                  </span>
                </label>
              ))}
              {filteredList.length === 0 ? <div className="text-sm text-white/60">No match.</div> : null}
            </div>
          </div>
        </Card>

        <Card title="Date range">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-white/60">From</label>
                <select
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="mt-1 w-full rounded-xl bg-black/30 border border-white/10 px-3 py-2 text-sm"
                >
                  {dateOptions.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-white/60">To</label>
                <select
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="mt-1 w-full rounded-xl bg-black/30 border border-white/10 px-3 py-2 text-sm"
                >
                  {dateOptions.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <p className="text-xs text-white/55">
              Tip: normalize your dates to <span className="text-white/75">YYYY-MM</span> for clean monthly series.
            </p>
          </div>
        </Card>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {cards.map((c) => (
          <Card key={c.id} title={c.label}>
            <div className="flex items-baseline justify-between gap-3">
              <div>
                <div className="text-3xl font-semibold">{Math.round(c.last)}</div>
                <div className="text-xs text-white/60 mt-1">
                  {c.points} pts • {c.unit}
                </div>
              </div>
              <Pill tone={c.delta >= 0 ? "good" : "bad"}>
                {c.delta >= 0 ? "+" : ""}
                {c.delta.toFixed(1)}%
              </Pill>
            </div>
          </Card>
        ))}
        {cards.length === 0 ? <div className="text-sm text-white/60">Select at least one series.</div> : null}
      </div>

      <Card title="Trend chart">
        <MarketChart series={activeSeries} />
      </Card>

      <div className="text-sm text-white/65 space-y-2">
        <p className="font-medium text-white/75">Next upgrades (B → C roadmap) :</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Pages by country + filters (segment, metric, regulator)</li>
          <li>ETL scripts (CSV/Excel/PDF → normalized JSON) + versioning</li>
          <li>Public “Sources” page + citations + download links</li>
        </ul>
      </div>
    </div>
  );
}
