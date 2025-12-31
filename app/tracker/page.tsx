"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Card, Pill } from "@/components/ui";
import { Session } from "@/lib/types";
import { loadSessions, saveSessions } from "@/lib/storage";
import { uid, toNumberSafe, clamp } from "@/lib/utils";
import { SessionChart } from "@/components/session-chart";

const games: Session["game"][] = ["Roulette", "Blackjack", "Slots", "Poker", "Autre"];

// --------------------
// Limits (local only)
// --------------------
type Limits = {
  enable7d: boolean;
  enable30d: boolean;

  budget7d: number;
  time7dHours: number;
  stopLoss7d: number;

  budget30d: number;
  time30dHours: number;
  stopLoss30d: number;
};

const LIMITS_KEY = "wagerledger.limits.v1";

const defaultLimits: Limits = {
  enable7d: true,
  enable30d: false,

  budget7d: 0,
  time7dHours: 0,
  stopLoss7d: 0,

  budget30d: 0,
  time30dHours: 0,
  stopLoss30d: 0,
};

function loadLimits(): Limits {
  if (typeof window === "undefined") return defaultLimits;
  try {
    const raw = window.localStorage.getItem(LIMITS_KEY);
    if (!raw) return defaultLimits;
    const parsed = JSON.parse(raw);
    return { ...defaultLimits, ...(parsed as Partial<Limits>) };
  } catch {
    return defaultLimits;
  }
}

function saveLimits(l: Limits) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LIMITS_KEY, JSON.stringify(l));
}

// --------------------
// Date helpers (rolling days)
// --------------------
const MS_DAY = 24 * 60 * 60 * 1000;

function utcDayNumberFromISO(iso: string): number {
  const parts = iso.split("-").map((x) => Number(x));
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return NaN;
  const [y, m, d] = parts;
  return Math.floor(Date.UTC(y, m - 1, d) / MS_DAY);
}

function todayUtcDayNumber(): number {
  const now = new Date();
  return Math.floor(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) / MS_DAY);
}

function isWithinLastDays(iso: string, days: number): boolean {
  const day = utcDayNumberFromISO(iso);
  if (!Number.isFinite(day)) return false;
  const today = todayUtcDayNumber();
  const diff = today - day;
  return diff >= 0 && diff < days;
}

// --------------------
// Status helpers
// --------------------
type LimitTone = "good" | "neutral" | "bad";
type GlobalTone = "ok" | "alert" | "limit";

function toneFromFraction(f: number): LimitTone {
  if (!Number.isFinite(f)) return "neutral";
  if (f >= 1) return "bad";
  if (f >= 0.8) return "neutral";
  return "good";
}

function labelFromTone(t: LimitTone) {
  if (t === "good") return "OK";
  if (t === "bad") return "LIMIT";
  return "ALERT";
}

function fmtEUR(n: number) {
  const sign = n < 0 ? "-" : "";
  const v = Math.abs(n);
  return `${sign}${v.toFixed(0)}€`;
}

function fmtH(hours: number) {
  return `${hours.toFixed(1)}h`;
}

function ProgressRow({
  label,
  currentLabel,
  limitLabel,
  tone,
  frac,
}: {
  label: string;
  currentLabel: string;
  limitLabel: string;
  tone: LimitTone;
  frac: number | null;
}) {
  const pct = frac === null ? 0 : clamp(frac, 0, 1) * 100;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm text-white/85">{label}</div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-white/70">
            {currentLabel} / {limitLabel}
          </span>
          <Pill tone={tone}>{labelFromTone(tone)}</Pill>
        </div>
      </div>

      {frac === null ? (
        <div className="text-xs text-white/55">Limite désactivée (0).</div>
      ) : (
        <div className="h-2 rounded-full bg-white/10 overflow-hidden">
          <div className="h-2 bg-white/30" style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  );
}

// --------------------
// CSV parsing (simple & robust enough for our export)
// --------------------
function parseCsvLine(line: string): string[] {
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

    if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
      continue;
    }

    cur += ch;
  }
  out.push(cur);
  return out;
}

function normalizeGame(v: string): Session["game"] {
  const s = (v || "").trim().toLowerCase();
  if (s.includes("roulette")) return "Roulette";
  if (s.includes("blackjack")) return "Blackjack";
  if (s.includes("slot")) return "Slots";
  if (s.includes("poker")) return "Poker";
  return "Autre";
}

function cleanISODate(v: string): string {
  const s = (v || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return "";
}

// --------------------
// Dedup helpers
// --------------------
type SessionNoId = Omit<Session, "id">;

function toNoId(s: Session): SessionNoId {
  return {
    date: s.date,
    venue: s.venue,
    game: s.game,
    buyIn: s.buyIn,
    cashOut: s.cashOut,
    durationMinutes: s.durationMinutes,
    notes: s.notes ?? "",
  };
}

function keyOf(s: SessionNoId): string {
  return [
    s.date,
    s.venue,
    s.game,
    s.buyIn.toFixed(2),
    s.cashOut.toFixed(2),
    String(s.durationMinutes),
    s.notes ?? "",
  ].join("|");
}

function dedupeNoId(list: SessionNoId[]): SessionNoId[] {
  const seen = new Set<string>();
  const out: SessionNoId[] = [];
  for (const s of list) {
    const k = keyOf(s);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(s);
  }
  return out;
}

// --------------------
// Global banner
// --------------------
function Banner({
  tone,
  title,
  lines,
  onResetLimits,
  onExportJson,
  onExportCsv,
  onImportCsvClick,
  onImportJsonClick,
}: {
  tone: GlobalTone;
  title: string;
  lines: string[];
  onResetLimits: () => void;
  onExportJson: () => void;
  onExportCsv: () => void;
  onImportCsvClick: () => void;
  onImportJsonClick: () => void;
}) {
  const border =
    tone === "limit" ? "border-white/30" : tone === "alert" ? "border-white/20" : "border-white/10";
  const bg = tone === "limit" ? "bg-white/10" : tone === "alert" ? "bg-white/5" : "bg-black/10";

  return (
    <div className={`rounded-2xl border ${border} ${bg} px-4 py-3`}>
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Pill tone={tone === "limit" ? "bad" : tone === "alert" ? "neutral" : "good"}>
              {tone === "limit" ? "LIMIT" : tone === "alert" ? "ALERT" : "OK"}
            </Pill>
            <div className="text-sm font-medium text-white/90">{title}</div>
          </div>

          <ul className="text-sm text-white/75 list-disc pl-5 space-y-0.5">
            {lines.map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ul>

          <div className="text-xs text-white/55">
            Conseil simple : fais une pause, exporte ton historique, et ajuste tes limites si besoin. (No prediction, just
            guardrails.)
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={onImportCsvClick}
            className="text-xs px-3 py-2 rounded-2xl border border-white/20 hover:bg-white/5"
          >
            Import CSV
          </button>
          <button
            onClick={onImportJsonClick}
            className="text-xs px-3 py-2 rounded-2xl border border-white/20 hover:bg-white/5"
          >
            Import JSON
          </button>
          <button
            onClick={onExportCsv}
            className="text-xs px-3 py-2 rounded-2xl border border-white/20 hover:bg-white/5"
          >
            Export CSV
          </button>
          <button
            onClick={onExportJson}
            className="text-xs px-3 py-2 rounded-2xl border border-white/20 hover:bg-white/5"
          >
            Export JSON
          </button>
          <button
            onClick={onResetLimits}
            className="text-xs px-3 py-2 rounded-2xl border border-white/20 hover:bg-white/5"
          >
            Reset limits
          </button>
        </div>
      </div>
    </div>
  );
}

// --------------------
// Page
// --------------------
export default function TrackerPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [limits, setLimits] = useState<Limits>(defaultLimits);

  // Import UI
  const csvRef = useRef<HTMLInputElement | null>(null);
  const jsonRef = useRef<HTMLInputElement | null>(null);
  const [importMode, setImportMode] = useState<"merge" | "replace">("merge");
  const [importMsg, setImportMsg] = useState<string>("");

  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    venue: "",
    game: "Roulette" as Session["game"],
    buyIn: 0,
    cashOut: 0,
    durationMinutes: 60,
    notes: "",
  });

  useEffect(() => {
    setSessions(loadSessions());
    setLimits(loadLimits());
  }, []);

  useEffect(() => {
    saveSessions(sessions);
  }, [sessions]);

  useEffect(() => {
    saveLimits(limits);
  }, [limits]);

  const statsAll = useMemo(() => {
    const totalBuyIn = sessions.reduce((a, s) => a + s.buyIn, 0);
    const totalCashOut = sessions.reduce((a, s) => a + s.cashOut, 0);
    const pnl = totalCashOut - totalBuyIn;
    const roi = totalBuyIn > 0 ? (pnl / totalBuyIn) * 100 : 0;
    const minutes = sessions.reduce((a, s) => a + s.durationMinutes, 0);
    return { totalBuyIn, totalCashOut, pnl, roi, minutes };
  }, [sessions]);

  const period7 = useMemo(() => {
    const list = sessions.filter((s) => isWithinLastDays(s.date, 7));
    const buyIn = list.reduce((a, s) => a + s.buyIn, 0);
    const cashOut = list.reduce((a, s) => a + s.cashOut, 0);
    const pnl = cashOut - buyIn;
    const minutes = list.reduce((a, s) => a + s.durationMinutes, 0);
    return { count: list.length, buyIn, cashOut, pnl, minutes };
  }, [sessions]);

  const period30 = useMemo(() => {
    const list = sessions.filter((s) => isWithinLastDays(s.date, 30));
    const buyIn = list.reduce((a, s) => a + s.buyIn, 0);
    const cashOut = list.reduce((a, s) => a + s.cashOut, 0);
    const pnl = cashOut - buyIn;
    const minutes = list.reduce((a, s) => a + s.durationMinutes, 0);
    return { count: list.length, buyIn, cashOut, pnl, minutes };
  }, [sessions]);

  function addSession() {
    if (!form.date) return;

    const next: Session = {
      id: uid(),
      date: form.date,
      venue: form.venue.trim() || "—",
      game: form.game,
      buyIn: clamp(Number(form.buyIn) || 0, 0, 1_000_000),
      cashOut: clamp(Number(form.cashOut) || 0, 0, 1_000_000),
      durationMinutes: clamp(Number(form.durationMinutes) || 0, 0, 10_000),
      notes: form.notes.trim() || "",
    };

    setSessions((prev) => [next, ...prev]);
    setForm((f) => ({ ...f, venue: "", notes: "" }));
  }

  function remove(id: string) {
    setSessions((prev) => prev.filter((s) => s.id !== id));
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(sessions, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "wagerledger-sessions.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportCsv() {
    const header = ["date", "venue", "game", "buyIn", "cashOut", "durationMinutes", "notes"];
    const rows = sessions.map((s) => [
      s.date,
      s.venue,
      s.game,
      String(s.buyIn),
      String(s.cashOut),
      String(s.durationMinutes),
      (s.notes ?? "").replaceAll('"', '""'),
    ]);

    const csv =
      header.join(",") +
      "\n" +
      rows
        .map((r) =>
          r
            .map((cell) => `"${String(cell).replaceAll("\n", " ").replaceAll("\r", " ")}"`)
            .join(",")
        )
        .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "wagerledger-sessions.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function openImportCsvDialog() {
    setImportMsg("");
    csvRef.current?.click();
  }

  function openImportJsonDialog() {
    setImportMsg("");
    jsonRef.current?.click();
  }

  function applyImported(importedNoId: SessionNoId[]) {
    const cleaned = dedupeNoId(importedNoId);
    if (cleaned.length === 0) {
      setImportMsg("Import: no valid rows found.");
      return;
    }

    if (importMode === "replace") {
      const replaced = cleaned.map((s) => ({ id: uid(), ...s }));
      setSessions(replaced);
      setImportMsg(`Import OK: replaced with ${replaced.length} session(s).`);
      return;
    }

    // merge
    const existingKeys = new Set(sessions.map(toNoId).map(keyOf));
    const toAddNoId = cleaned.filter((s) => !existingKeys.has(keyOf(s)));
    const toAdd = toAddNoId.map((s) => ({ id: uid(), ...s }));
    setSessions((prev) => [...toAdd, ...prev]);
    setImportMsg(`Import OK: added ${toAdd.length} new session(s).`);
  }

  async function handleImportCsv(file: File | null) {
    if (!file) return;

    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
      if (lines.length < 2) {
        setImportMsg("Import CSV failed: file is empty or missing rows.");
        return;
      }

      const header = parseCsvLine(lines[0]).map((h) => h.trim().replaceAll('"', "").toLowerCase());
      const idx = (name: string) => header.indexOf(name);

      const required = ["date", "venue", "game", "buyin", "cashout", "durationminutes", "notes"];
      const missing = required.filter((r) => idx(r) === -1);
      if (missing.length > 0) {
        setImportMsg(`Import CSV failed: missing columns: ${missing.join(", ")}`);
        return;
      }

      const importedNoId: SessionNoId[] = [];

      for (let i = 1; i < lines.length; i++) {
        const cols = parseCsvLine(lines[i]).map((c) => c.trim().replaceAll(/^"|"$/g, ""));
        const date = cleanISODate(cols[idx("date")]);
        if (!date) continue;

        const venue = (cols[idx("venue")] || "—").trim() || "—";
        const game = normalizeGame(cols[idx("game")]);
        const buyIn = clamp(Number(cols[idx("buyin")]) || 0, 0, 1_000_000);
        const cashOut = clamp(Number(cols[idx("cashout")]) || 0, 0, 1_000_000);
        const durationMinutes = clamp(Number(cols[idx("durationminutes")]) || 0, 0, 10_000);
        const notes = (cols[idx("notes")] || "").trim();

        importedNoId.push({ date, venue, game, buyIn, cashOut, durationMinutes, notes });
      }

      if (importedNoId.length === 0) {
        setImportMsg("Import CSV: no valid rows found (date must be YYYY-MM-DD).");
        return;
      }

      applyImported(importedNoId);
    } catch {
      setImportMsg("Import CSV failed: unreadable file or invalid CSV.");
    } finally {
      if (csvRef.current) csvRef.current.value = "";
    }
  }

  async function handleImportJson(file: File | null) {
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      const arr: unknown[] = Array.isArray(data)
        ? data
        : data && typeof data === "object" && Array.isArray((data as any).sessions)
          ? (data as any).sessions
          : [];

      if (!Array.isArray(arr) || arr.length === 0) {
        setImportMsg("Import JSON failed: expected an array of sessions (or { sessions: [...] }).");
        return;
      }

      const importedNoId: SessionNoId[] = [];

      for (const item of arr) {
        if (!item || typeof item !== "object") continue;
        const it: any = item;

        const date = cleanISODate(String(it.date ?? ""));
        if (!date) continue;

        const venue = String(it.venue ?? "—").trim() || "—";
        const game = normalizeGame(String(it.game ?? ""));
        const buyIn = clamp(Number(it.buyIn ?? it.buyin ?? 0) || 0, 0, 1_000_000);
        const cashOut = clamp(Number(it.cashOut ?? it.cashout ?? 0) || 0, 0, 1_000_000);
        const durationMinutes = clamp(Number(it.durationMinutes ?? it.durationminutes ?? 0) || 0, 0, 10_000);
        const notes = String(it.notes ?? "").trim();

        importedNoId.push({ date, venue, game, buyIn, cashOut, durationMinutes, notes });
      }

      if (importedNoId.length === 0) {
        setImportMsg("Import JSON: no valid sessions found (date must be YYYY-MM-DD).");
        return;
      }

      applyImported(importedNoId);
    } catch {
      setImportMsg("Import JSON failed: invalid JSON file.");
    } finally {
      if (jsonRef.current) jsonRef.current.value = "";
    }
  }

  // ---- Status calc for limits
  const status7 = useMemo(() => {
    const enabled = limits.enable7d;
    const budgetLimit = limits.budget7d;
    const timeLimitH = limits.time7dHours;
    const stopLoss = limits.stopLoss7d;

    const hours = period7.minutes / 60;
    const loss = Math.max(0, -period7.pnl);

    const budgetFrac = enabled && budgetLimit > 0 ? period7.buyIn / budgetLimit : null;
    const timeFrac = enabled && timeLimitH > 0 ? hours / timeLimitH : null;
    const lossFrac = enabled && stopLoss > 0 ? loss / stopLoss : null;

    return {
      enabled,
      budget: {
        frac: budgetFrac,
        tone: budgetFrac === null ? "neutral" : toneFromFraction(budgetFrac),
        current: fmtEUR(period7.buyIn),
        limit: budgetLimit > 0 ? fmtEUR(budgetLimit) : "off",
      },
      time: {
        frac: timeFrac,
        tone: timeFrac === null ? "neutral" : toneFromFraction(timeFrac),
        current: fmtH(hours),
        limit: timeLimitH > 0 ? fmtH(timeLimitH) : "off",
      },
      loss: {
        frac: lossFrac,
        tone: lossFrac === null ? "neutral" : toneFromFraction(lossFrac),
        current: fmtEUR(-loss),
        limit: stopLoss > 0 ? fmtEUR(-stopLoss) : "off",
      },
    };
  }, [limits, period7]);

  const status30 = useMemo(() => {
    const enabled = limits.enable30d;
    const budgetLimit = limits.budget30d;
    const timeLimitH = limits.time30dHours;
    const stopLoss = limits.stopLoss30d;

    const hours = period30.minutes / 60;
    const loss = Math.max(0, -period30.pnl);

    const budgetFrac = enabled && budgetLimit > 0 ? period30.buyIn / budgetLimit : null;
    const timeFrac = enabled && timeLimitH > 0 ? hours / timeLimitH : null;
    const lossFrac = enabled && stopLoss > 0 ? loss / stopLoss : null;

    return {
      enabled,
      budget: {
        frac: budgetFrac,
        tone: budgetFrac === null ? "neutral" : toneFromFraction(budgetFrac),
        current: fmtEUR(period30.buyIn),
        limit: budgetLimit > 0 ? fmtEUR(budgetLimit) : "off",
      },
      time: {
        frac: timeFrac,
        tone: timeFrac === null ? "neutral" : toneFromFraction(timeFrac),
        current: fmtH(hours),
        limit: timeLimitH > 0 ? fmtH(timeLimitH) : "off",
      },
      loss: {
        frac: lossFrac,
        tone: lossFrac === null ? "neutral" : toneFromFraction(lossFrac),
        current: fmtEUR(-loss),
        limit: stopLoss > 0 ? fmtEUR(-stopLoss) : "off",
      },
    };
  }, [limits, period30]);

  // ---- Global alert banner
  const banner = useMemo(() => {
    const lines: string[] = [];
    let global: GlobalTone = "ok";

    function consider(periodLabel: "7d" | "30d", metric: string, tone: LimitTone, current: string, limit: string) {
      if (tone === "bad") {
        global = "limit";
        lines.push(`${periodLabel}: ${metric} — LIMIT (${current} / ${limit})`);
      } else if (tone === "neutral" && global !== "limit") {
        global = "alert";
        lines.push(`${periodLabel}: ${metric} — ALERT (${current} / ${limit})`);
      }
    }

    if (status7.enabled) {
      consider("7d", "Budget", status7.budget.tone, status7.budget.current, status7.budget.limit);
      consider("7d", "Temps", status7.time.tone, status7.time.current, status7.time.limit);
      consider("7d", "Stop-loss", status7.loss.tone, status7.loss.current, status7.loss.limit);
    }
    if (status30.enabled) {
      consider("30d", "Budget", status30.budget.tone, status30.budget.current, status30.budget.limit);
      consider("30d", "Temps", status30.time.tone, status30.time.current, status30.time.limit);
      consider("30d", "Stop-loss", status30.loss.tone, status30.loss.current, status30.loss.limit);
    }

    if (lines.length === 0) return null;

    const title =
      global === "limit"
        ? "Limit reached — prends une pause."
        : "Approche d’une limite — garde le contrôle.";

    return { global, title, lines };
  }, [status7, status30]);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold">Tracker perso</h2>
        <p className="text-white/70 max-w-3xl">
          Journal de sessions pour suivre ton <span className="text-white/85">temps</span>, ton{" "}
          <span className="text-white/85">P&amp;L</span>, et garder une vision lucide. Stockage local (dans ton navigateur).
          <br />
          <span className="text-white/60">Not a strategy — just a responsible guardrail.</span>
        </p>
      </div>

      {/* Hidden file inputs */}
      <input
        ref={csvRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => handleImportCsv(e.target.files?.[0] ?? null)}
      />
      <input
        ref={jsonRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={(e) => handleImportJson(e.target.files?.[0] ?? null)}
      />

      {banner ? (
        <Banner
          tone={banner.global}
          title={banner.title}
          lines={banner.lines}
          onResetLimits={() => setLimits(defaultLimits)}
          onExportJson={exportJson}
          onExportCsv={exportCsv}
          onImportCsvClick={openImportCsvDialog}
          onImportJsonClick={openImportJsonDialog}
        />
      ) : null}

      {importMsg ? (
        <div className="rounded-2xl border border-white/10 bg-black/10 px-4 py-3 text-sm text-white/75">
          {importMsg}
        </div>
      ) : null}

      <div className="grid md:grid-cols-4 gap-4">
        <Card title="Total buy-in (all-time)">
          <div className="text-2xl font-semibold">{statsAll.totalBuyIn.toFixed(0)}€</div>
        </Card>
        <Card title="Total cash-out (all-time)">
          <div className="text-2xl font-semibold">{statsAll.totalCashOut.toFixed(0)}€</div>
        </Card>
        <Card title="P&L net (all-time)">
          <div className="flex items-center justify-between gap-3">
            <div className="text-2xl font-semibold">{statsAll.pnl.toFixed(0)}€</div>
            <Pill tone={statsAll.pnl >= 0 ? "good" : "bad"}>
              {statsAll.roi >= 0 ? "+" : ""}
              {statsAll.roi.toFixed(1)}%
            </Pill>
          </div>
        </Card>
        <Card title="Temps (all-time)">
          <div className="text-2xl font-semibold">{(statsAll.minutes / 60).toFixed(1)}h</div>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card title="Limites (responsable)">
          <div className="space-y-4">
            <div className="text-xs text-white/60">
              Mets <span className="text-white/80">0</span> pour désactiver une limite. Les limites sont stockées localement.
            </div>

            <div className="flex items-center justify-between gap-3">
              <label className="text-sm text-white/85 flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={limits.enable7d}
                  onChange={(e) => setLimits((l) => ({ ...l, enable7d: e.target.checked }))}
                />
                Activer limites (7 jours)
              </label>

              <label className="text-sm text-white/85 flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={limits.enable30d}
                  onChange={(e) => setLimits((l) => ({ ...l, enable30d: e.target.checked }))}
                />
                Activer limites (30 jours)
              </label>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="text-sm font-medium text-white/80">7 jours</div>

                <div>
                  <label className="text-xs text-white/60">Budget max (buy-in total, €)</label>
                  <input
                    inputMode="numeric"
                    value={limits.budget7d}
                    onChange={(e) => setLimits((l) => ({ ...l, budget7d: toNumberSafe(e.target.value) }))}
                    className="mt-1 w-full rounded-xl bg-black/30 border border-white/10 px-3 py-2"
                  />
                </div>

                <div>
                  <label className="text-xs text-white/60">Temps max (heures)</label>
                  <input
                    inputMode="numeric"
                    value={limits.time7dHours}
                    onChange={(e) => setLimits((l) => ({ ...l, time7dHours: toNumberSafe(e.target.value) }))}
                    className="mt-1 w-full rounded-xl bg-black/30 border border-white/10 px-3 py-2"
                  />
                </div>

                <div>
                  <label className="text-xs text-white/60">Stop-loss (perte nette max, €)</label>
                  <input
                    inputMode="numeric"
                    value={limits.stopLoss7d}
                    onChange={(e) => setLimits((l) => ({ ...l, stopLoss7d: toNumberSafe(e.target.value) }))}
                    className="mt-1 w-full rounded-xl bg-black/30 border border-white/10 px-3 py-2"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium text-white/80">30 jours</div>

                <div>
                  <label className="text-xs text-white/60">Budget max (buy-in total, €)</label>
                  <input
                    inputMode="numeric"
                    value={limits.budget30d}
                    onChange={(e) => setLimits((l) => ({ ...l, budget30d: toNumberSafe(e.target.value) }))}
                    className="mt-1 w-full rounded-xl bg-black/30 border border-white/10 px-3 py-2"
                  />
                </div>

                <div>
                  <label className="text-xs text-white/60">Temps max (heures)</label>
                  <input
                    inputMode="numeric"
                    value={limits.time30dHours}
                    onChange={(e) => setLimits((l) => ({ ...l, time30dHours: toNumberSafe(e.target.value) }))}
                    className="mt-1 w-full rounded-xl bg-black/30 border border-white/10 px-3 py-2"
                  />
                </div>

                <div>
                  <label className="text-xs text-white/60">Stop-loss (perte nette max, €)</label>
                  <input
                    inputMode="numeric"
                    value={limits.stopLoss30d}
                    onChange={(e) => setLimits((l) => ({ ...l, stopLoss30d: toNumberSafe(e.target.value) }))}
                    className="mt-1 w-full rounded-xl bg-black/30 border border-white/10 px-3 py-2"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-white/55">Import: choisis “Merge” (ajoute) ou “Replace” (remplace tout).</p>
              <div className="flex items-center gap-2">
                <select
                  value={importMode}
                  onChange={(e) => setImportMode(e.target.value as any)}
                  className="text-xs px-3 py-2 rounded-2xl border border-white/20 bg-black/20"
                >
                  <option value="merge">Merge</option>
                  <option value="replace">Replace</option>
                </select>
                <button
                  onClick={openImportCsvDialog}
                  className="text-xs px-3 py-2 rounded-2xl border border-white/20 hover:bg-white/5"
                >
                  Import CSV
                </button>
                <button
                  onClick={openImportJsonDialog}
                  className="text-xs px-3 py-2 rounded-2xl border border-white/20 hover:bg-white/5"
                >
                  Import JSON
                </button>
              </div>
            </div>
          </div>
        </Card>

        <Card title="Alertes & statut (Responsible status)">
          <div className="space-y-5">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium text-white/80">Last 7 days</div>
                <div className="text-xs text-white/60">{period7.count} session(s)</div>
              </div>

              {!status7.enabled ? (
                <div className="text-sm text-white/60">Limites 7 jours désactivées.</div>
              ) : (
                <div className="space-y-3">
                  <ProgressRow
                    label="Budget (buy-in total)"
                    currentLabel={status7.budget.current}
                    limitLabel={status7.budget.limit}
                    tone={status7.budget.tone}
                    frac={status7.budget.frac}
                  />
                  <ProgressRow
                    label="Temps"
                    currentLabel={status7.time.current}
                    limitLabel={status7.time.limit}
                    tone={status7.time.tone}
                    frac={status7.time.frac}
                  />
                  <ProgressRow
                    label="Stop-loss (net loss)"
                    currentLabel={status7.loss.current}
                    limitLabel={status7.loss.limit}
                    tone={status7.loss.tone}
                    frac={status7.loss.frac}
                  />
                </div>
              )}
            </div>

            <div className="h-px bg-white/10" />

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium text-white/80">Last 30 days</div>
                <div className="text-xs text-white/60">{period30.count} session(s)</div>
              </div>

              {!status30.enabled ? (
                <div className="text-sm text-white/60">Limites 30 jours désactivées.</div>
              ) : (
                <div className="space-y-3">
                  <ProgressRow
                    label="Budget (buy-in total)"
                    currentLabel={status30.budget.current}
                    limitLabel={status30.budget.limit}
                    tone={status30.budget.tone}
                    frac={status30.budget.frac}
                  />
                  <ProgressRow
                    label="Temps"
                    currentLabel={status30.time.current}
                    limitLabel={status30.time.limit}
                    tone={status30.time.tone}
                    frac={status30.time.frac}
                  />
                  <ProgressRow
                    label="Stop-loss (net loss)"
                    currentLabel={status30.loss.current}
                    limitLabel={status30.loss.limit}
                    tone={status30.loss.tone}
                    frac={status30.loss.frac}
                  />
                </div>
              )}
            </div>

            <p className="text-xs text-white/55">
              Reminder: ces alertes ne “prédisent” rien. Elles servent juste à garder le contrôle (temps, budget, pertes).
            </p>
          </div>
        </Card>
      </div>

      <Card title="Ajouter une session">
        <div className="grid md:grid-cols-6 gap-3">
          <div className="md:col-span-1">
            <label className="text-xs text-white/60">Date</label>
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              className="mt-1 w-full rounded-xl bg-black/30 border border-white/10 px-3 py-2"
            />
          </div>

          <div className="md:col-span-2">
            <label className="text-xs text-white/60">Lieu / Casino</label>
            <input
              value={form.venue}
              onChange={(e) => setForm({ ...form, venue: e.target.value })}
              placeholder="Ex: Lyon Part-Dieu (ou “online”)"
              className="mt-1 w-full rounded-xl bg-black/30 border border-white/10 px-3 py-2"
            />
          </div>

          <div className="md:col-span-1">
            <label className="text-xs text-white/60">Jeu</label>
            <select
              value={form.game}
              onChange={(e) => setForm({ ...form, game: e.target.value as Session["game"] })}
              className="mt-1 w-full rounded-xl bg-black/30 border border-white/10 px-3 py-2"
            >
              {games.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-1">
            <label className="text-xs text-white/60">Buy-in (€)</label>
            <input
              inputMode="numeric"
              value={form.buyIn}
              onChange={(e) => setForm({ ...form, buyIn: toNumberSafe(e.target.value) })}
              className="mt-1 w-full rounded-xl bg-black/30 border border-white/10 px-3 py-2"
            />
          </div>

          <div className="md:col-span-1">
            <label className="text-xs text-white/60">Cash-out (€)</label>
            <input
              inputMode="numeric"
              value={form.cashOut}
              onChange={(e) => setForm({ ...form, cashOut: toNumberSafe(e.target.value) })}
              className="mt-1 w-full rounded-xl bg-black/30 border border-white/10 px-3 py-2"
            />
          </div>

          <div className="md:col-span-1">
            <label className="text-xs text-white/60">Durée (min)</label>
            <input
              inputMode="numeric"
              value={form.durationMinutes}
              onChange={(e) => setForm({ ...form, durationMinutes: toNumberSafe(e.target.value) })}
              className="mt-1 w-full rounded-xl bg-black/30 border border-white/10 px-3 py-2"
            />
          </div>

          <div className="md:col-span-5">
            <label className="text-xs text-white/60">Notes</label>
            <input
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Ex: humeur, limites, objectifs, etc."
              className="mt-1 w-full rounded-xl bg-black/30 border border-white/10 px-3 py-2"
            />
          </div>

          <div className="md:col-span-1 flex items-end gap-2">
            <button
              onClick={addSession}
              className="w-full px-4 py-2 rounded-2xl bg-white text-black font-medium shadow-soft"
            >
              Ajouter
            </button>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <p className="text-xs text-white/55">Stocké localement. Export/Import disponibles.</p>

          <div className="flex items-center gap-2">
            <select
              value={importMode}
              onChange={(e) => setImportMode(e.target.value as any)}
              className="text-xs px-3 py-2 rounded-2xl border border-white/20 bg-black/20"
            >
              <option value="merge">Merge</option>
              <option value="replace">Replace</option>
            </select>

            <button
              onClick={openImportCsvDialog}
              className="text-xs px-3 py-2 rounded-2xl border border-white/20 hover:bg-white/5"
            >
              Import CSV
            </button>
            <button
              onClick={openImportJsonDialog}
              className="text-xs px-3 py-2 rounded-2xl border border-white/20 hover:bg-white/5"
            >
              Import JSON
            </button>
            <button
              onClick={exportCsv}
              className="text-xs px-3 py-2 rounded-2xl border border-white/20 hover:bg-white/5"
            >
              Export CSV
            </button>
            <button
              onClick={exportJson}
              className="text-xs px-3 py-2 rounded-2xl border border-white/20 hover:bg-white/5"
            >
              Export JSON
            </button>
          </div>
        </div>
      </Card>

      <Card title="Évolution (P&L cumulé)">
        <SessionChart sessions={sessions} />
      </Card>

      <Card title="Historique">
        <div className="space-y-3">
          {sessions.length === 0 ? (
            <p className="text-sm text-white/60">Aucune session encore.</p>
          ) : (
            sessions.map((s) => {
              const pnl = s.cashOut - s.buyIn;
              return (
                <div
                  key={s.id}
                  className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-2"
                >
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-sm font-medium">{s.date}</span>
                    <span className="text-xs text-white/60">{s.venue}</span>
                    <Pill tone={pnl >= 0 ? "good" : "bad"}>
                      {pnl >= 0 ? "+" : ""}
                      {pnl.toFixed(0)}€
                    </Pill>
                    <span className="text-xs text-white/60">
                      {s.game} • {(s.durationMinutes / 60).toFixed(1)}h
                    </span>
                    {s.notes ? <span className="text-xs text-white/60">— {s.notes}</span> : null}
                  </div>

                  <button
                    onClick={() => remove(s.id)}
                    className="text-xs px-3 py-2 rounded-2xl border border-white/20 hover:bg-white/5"
                  >
                    Supprimer
                  </button>
                </div>
              );
            })
          )}
        </div>
      </Card>
    </div>
  );
}
