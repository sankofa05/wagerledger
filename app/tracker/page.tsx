"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Card, Pill } from "@/components/ui";
import { Session } from "@/lib/types";
import { loadSessions, saveSessions } from "@/lib/storage";
import { uid, toNumberSafe, clamp } from "@/lib/utils";
import { SessionChart } from "@/components/session-chart";

const games: Session["game"][] = ["Roulette", "Blackjack", "Slots", "Poker", "Autre"];

type WindowDays = 7 | 30;

type Limits = {
  maxLoss7d: number;      // perte max (en €) sur 7 jours
  maxLoss30d: number;     // perte max (en €) sur 30 jours
  maxMinutes7d: number;   // temps max (en minutes) sur 7 jours
  maxMinutes30d: number;  // temps max (en minutes) sur 30 jours
};

const LIMITS_KEY = "wagerledger.limits.v1";

function loadLimits(): Limits {
  if (typeof window === "undefined") {
    return { maxLoss7d: 0, maxLoss30d: 0, maxMinutes7d: 0, maxMinutes30d: 0 };
  }
  try {
    const raw = window.localStorage.getItem(LIMITS_KEY);
    if (!raw) return { maxLoss7d: 0, maxLoss30d: 0, maxMinutes7d: 0, maxMinutes30d: 0 };
    const p = JSON.parse(raw) as Partial<Limits>;
    return {
      maxLoss7d: toNumberSafe(p.maxLoss7d ?? 0),
      maxLoss30d: toNumberSafe(p.maxLoss30d ?? 0),
      maxMinutes7d: toNumberSafe(p.maxMinutes7d ?? 0),
      maxMinutes30d: toNumberSafe(p.maxMinutes30d ?? 0),
    };
  } catch {
    return { maxLoss7d: 0, maxLoss30d: 0, maxMinutes7d: 0, maxMinutes30d: 0 };
  }
}

function saveLimits(l: Limits) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LIMITS_KEY, JSON.stringify(l));
}

function parseISODate(dateStr: string): Date | null {
  // dateStr attendu: YYYY-MM-DD
  const d = new Date(`${dateStr}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function computeStats(list: Session[]) {
  const totalBuyIn = list.reduce((a, s) => a + s.buyIn, 0);
  const totalCashOut = list.reduce((a, s) => a + s.cashOut, 0);
  const pnl = totalCashOut - totalBuyIn;
  const roi = totalBuyIn ? (pnl / totalBuyIn) * 100 : 0;
  const minutes = list.reduce((a, s) => a + s.durationMinutes, 0);
  return { totalBuyIn, totalCashOut, pnl, roi, minutes, count: list.length };
}

function toCsvExcelFriendly(sessions: Session[]) {
  // Excel FR aime souvent ";" + BOM UTF-8 + ligne "sep=;"
  const sep = ";";
  const header = ["date", "venue", "game", "buyIn", "cashOut", "durationMinutes", "notes"];

  const esc = (v: unknown) => {
    const str = String(v ?? "");
    // CSV standard: on quote tout + double quotes échappées
    return `"${str.replace(/"/g, '""')}"`;
  };

  const rows = sessions.map((s) => [
    s.date,
    s.venue,
    s.game,
    s.buyIn,
    s.cashOut,
    s.durationMinutes,
    s.notes ?? "",
  ]);

  const csv =
    ["sep=" + sep, header.map(esc).join(sep), ...rows.map((r) => r.map(esc).join(sep))].join("\n");

  return "\uFEFF" + csv; // BOM
}

export default function TrackerPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [windowDays, setWindowDays] = useState<WindowDays>(30);

  const [limits, setLimits] = useState<Limits>({
    maxLoss7d: 0,
    maxLoss30d: 0,
    maxMinutes7d: 0,
    maxMinutes30d: 0,
  });

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [form, setForm] = useState<Omit<Session, "id">>({
    date: new Date().toISOString().slice(0, 10),
    venue: "",
    game: "Roulette",
    buyIn: 100,
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

  const filteredSessions = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = new Date(today);
    start.setDate(start.getDate() - (windowDays - 1));

    return sessions.filter((s) => {
      const d = parseISODate(s.date);
      return d ? d >= start : false;
    });
  }, [sessions, windowDays]);

  const statsWindow = useMemo(() => computeStats(filteredSessions), [filteredSessions]);
  const statsAll = useMemo(() => computeStats(sessions), [sessions]);

  function addSession() {
    const next: Session = {
      id: uid("sess"),
      date: form.date,
      venue: form.venue.trim() || "—",
      game: form.game,
      buyIn: clamp(toNumberSafe(form.buyIn), 0, 10_000_000),
      cashOut: clamp(toNumberSafe(form.cashOut), 0, 10_000_000),
      durationMinutes: clamp(toNumberSafe(form.durationMinutes), 0, 60 * 24),
      notes: form.notes?.trim() || "",
    };
    setSessions((prev) => [next, ...prev]);
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
    const csv = toCsvExcelFriendly(sessions);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "wagerledger-sessions.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function clickImport() {
    fileInputRef.current?.click();
  }

  function handleImportFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const raw = String(reader.result ?? "");
        const parsed = JSON.parse(raw);

        if (!Array.isArray(parsed)) {
          alert("JSON invalide : on attend un tableau de sessions.");
          return;
        }

        const cleaned: Session[] = parsed
          .map((x: any) => {
            if (!x) return null;
            const date = typeof x.date === "string" ? x.date : "";
            const venue = typeof x.venue === "string" ? x.venue : "—";
            const game = (typeof x.game === "string" ? x.game : "Autre") as Session["game"];
            const buyIn = toNumberSafe(x.buyIn);
            const cashOut = toNumberSafe(x.cashOut);
            const durationMinutes = toNumberSafe(x.durationMinutes);
            const notes = typeof x.notes === "string" ? x.notes : "";
            if (!date) return null;

            return {
              id: typeof x.id === "string" && x.id ? x.id : uid("sess"),
              date,
              venue,
              game: (games.includes(game) ? game : "Autre") as Session["game"],
              buyIn: clamp(buyIn, 0, 10_000_000),
              cashOut: clamp(cashOut, 0, 10_000_000),
              durationMinutes: clamp(durationMinutes, 0, 60 * 24),
              notes,
            } as Session;
          })
          .filter(Boolean) as Session[];

        const replace = window.confirm(
          `Import JSON: ${cleaned.length} sessions détectées.\n\nOK = Remplacer tout\nAnnuler = Fusionner (ajouter)`
        );

        if (replace) {
          setSessions(cleaned);
        } else {
          // merge simple: concat + unique par id
          setSessions((prev) => {
            const map = new Map<string, Session>();
            [...cleaned, ...prev].forEach((s) => map.set(s.id, s));
            return Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date));
          });
        }

        alert("Import terminé ✅");
      } catch (e) {
        alert("Impossible de lire ce JSON. Vérifie le fichier.");
      }
    };
    reader.readAsText(file);
  }

  const rg = useMemo(() => {
    const maxLoss = windowDays === 7 ? limits.maxLoss7d : limits.maxLoss30d;
    const maxMinutes = windowDays === 7 ? limits.maxMinutes7d : limits.maxMinutes30d;

    const lossNow = Math.max(0, -(statsWindow.pnl)); // si pnl < 0 => perte
    const minutesNow = statsWindow.minutes;

    const lossRatio = maxLoss > 0 ? lossNow / maxLoss : 0;
    const timeRatio = maxMinutes > 0 ? minutesNow / maxMinutes : 0;

    const worstRatio = Math.max(lossRatio, timeRatio);

    const limitState: null | "near" | "limit" =
      worstRatio >= 1 ? "limit" : worstRatio >= 0.8 ? "near" : null;

    const reason =
      lossRatio >= timeRatio
        ? { kind: "loss" as const, ratio: lossRatio, max: maxLoss, cur: lossNow }
        : { kind: "time" as const, ratio: timeRatio, max: maxMinutes, cur: minutesNow };

    const title =
      limitState === "limit"
        ? "Limit reached — prends une pause."
        : "Approche d’une limite — garde le contrôle.";

    const detail =
      reason.kind === "loss"
        ? `Perte ${windowDays}j: ${Math.round(reason.cur)}€ / ${Math.round(reason.max)}€`
        : `Temps ${windowDays}j: ${(reason.cur / 60).toFixed(1)}h / ${(reason.max / 60).toFixed(1)}h`;

    return { limitState, title, detail };
  }, [limits, statsWindow.minutes, statsWindow.pnl, windowDays]);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-2xl font-semibold">Tracker — sessions</h2>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setWindowDays(7)}
              className={`text-xs px-3 py-2 rounded-2xl border border-white/20 hover:bg-white/5 ${
                windowDays === 7 ? "bg-white text-black" : ""
              }`}
            >
              7 jours
            </button>
            <button
              onClick={() => setWindowDays(30)}
              className={`text-xs px-3 py-2 rounded-2xl border border-white/20 hover:bg-white/5 ${
                windowDays === 30 ? "bg-white text-black" : ""
              }`}
            >
              30 jours
            </button>
          </div>
        </div>

        <p className="text-white/70 max-w-3xl">
          Journal perso pour suivre ton <span className="text-white/85">temps</span>, ton <span className="text-white/85">P&L</span> et tes habitudes.
          Données stockées localement (dans ton navigateur).
        </p>

        {rg.limitState ? (
          <div
            className={`rounded-3xl border p-4 ${
              rg.limitState === "limit"
                ? "border-white/25 bg-white/10"
                : "border-white/15 bg-black/20"
            }`}
          >
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="text-sm font-medium">{rg.title}</div>
              <Pill tone={rg.limitState === "limit" ? "bad" : "neutral"}>{rg.detail}</Pill>
            </div>
            <div className="text-xs text-white/60 mt-2">
              (Optionnel) Ajuste tes limites ci-dessous. Le but est le suivi responsable, pas la “prédiction”.
            </div>
          </div>
        ) : null}

        <div className="text-xs text-white/55">
          Vue actuelle : <span className="text-white/75">{windowDays} jours</span> • All-time P&L :{" "}
          <span className="text-white/75">{statsAll.pnl.toFixed(0)}€</span>
        </div>
      </div>

      <div className="grid md:grid-cols-5 gap-4">
        <Card title={`Total buy-in (${windowDays}j)`}>
          <div className="text-2xl font-semibold">{statsWindow.totalBuyIn.toFixed(0)}€</div>
          <div className="text-xs text-white/60 mt-1">{statsWindow.count} session(s)</div>
        </Card>

        <Card title={`Total cash-out (${windowDays}j)`}>
          <div className="text-2xl font-semibold">{statsWindow.totalCashOut.toFixed(0)}€</div>
        </Card>

        <Card title={`P&L net (${windowDays}j)`}>
          <div className="flex items-center justify-between gap-3">
            <div className="text-2xl font-semibold">{statsWindow.pnl.toFixed(0)}€</div>
            <Pill tone={statsWindow.pnl >= 0 ? "good" : "bad"}>
              {statsWindow.roi >= 0 ? "+" : ""}
              {statsWindow.roi.toFixed(1)}%
            </Pill>
          </div>
        </Card>

        <Card title={`Temps (${windowDays}j)`}>
          <div className="text-2xl font-semibold">{(statsWindow.minutes / 60).toFixed(1)}h</div>
        </Card>

        <Card title="Export / Import">
          <div className="flex flex-col gap-2">
            <button
              onClick={exportJson}
              className="text-xs px-3 py-2 rounded-2xl border border-white/20 hover:bg-white/5"
            >
              Export JSON
            </button>
            <button
              onClick={exportCsv}
              className="text-xs px-3 py-2 rounded-2xl border border-white/20 hover:bg-white/5"
            >
              Export CSV (Excel)
            </button>
            <button
              onClick={clickImport}
              className="text-xs px-3 py-2 rounded-2xl border border-white/20 hover:bg-white/5"
            >
              Import JSON
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleImportFile(f);
                // reset pour pouvoir ré-importer le même fichier
                e.currentTarget.value = "";
              }}
            />
          </div>
        </Card>
      </div>

      <Card title="Limits (optional) — responsible settings">
        <div className="grid md:grid-cols-4 gap-3">
          <div>
            <label className="text-xs text-white/60">Perte max 7 jours (€)</label>
            <input
              inputMode="numeric"
              value={limits.maxLoss7d}
              onChange={(e) => setLimits({ ...limits, maxLoss7d: clamp(toNumberSafe(e.target.value), 0, 10_000_000) })}
              className="mt-1 w-full rounded-xl bg-black/30 border border-white/10 px-3 py-2"
              placeholder="0 = désactivé"
            />
          </div>

          <div>
            <label className="text-xs text-white/60">Perte max 30 jours (€)</label>
            <input
              inputMode="numeric"
              value={limits.maxLoss30d}
              onChange={(e) => setLimits({ ...limits, maxLoss30d: clamp(toNumberSafe(e.target.value), 0, 10_000_000) })}
              className="mt-1 w-full rounded-xl bg-black/30 border border-white/10 px-3 py-2"
              placeholder="0 = désactivé"
            />
          </div>

          <div>
            <label className="text-xs text-white/60">Temps max 7 jours (min)</label>
            <input
              inputMode="numeric"
              value={limits.maxMinutes7d}
              onChange={(e) => setLimits({ ...limits, maxMinutes7d: clamp(toNumberSafe(e.target.value), 0, 60 * 24 * 365) })}
              className="mt-1 w-full rounded-xl bg-black/30 border border-white/10 px-3 py-2"
              placeholder="0 = désactivé"
            />
          </div>

          <div>
            <label className="text-xs text-white/60">Temps max 30 jours (min)</label>
            <input
              inputMode="numeric"
              value={limits.maxMinutes30d}
              onChange={(e) => setLimits({ ...limits, maxMinutes30d: clamp(toNumberSafe(e.target.value), 0, 60 * 24 * 365) })}
              className="mt-1 w-full rounded-xl bg-black/30 border border-white/10 px-3 py-2"
              placeholder="0 = désactivé"
            />
          </div>
        </div>

        <div className="text-xs text-white/55 mt-3">
          Conseil : commence simple (ex: perte max 7j + temps max 7j). Le tracker est là pour garder une vision lucide.
        </div>
      </Card>

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
              placeholder='Ex: Lyon Part-Dieu (ou "online")'
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
      </Card>

      <Card title={`Évolution (P&L cumulé) — ${windowDays} jours`}>
        <SessionChart sessions={filteredSessions} />
      </Card>

      <Card title={`Historique — ${windowDays} jours`}>
        <div className="space-y-3">
          {filteredSessions.length === 0 ? (
            <p className="text-sm text-white/60">Aucune session sur cette période.</p>
          ) : (
            filteredSessions.map((s) => {
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
