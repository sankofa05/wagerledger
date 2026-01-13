"use client";

import React, { useMemo, useState } from "react";

type Wheel = "EU" | "US";
type Outcome = number | "00";

type BetKind =
  | "straight"
  | "dozen"
  | "column"
  | "evenmoney"
  | "split"
  | "corner"
  | "street"
  | "sixline";

type Bet = {
  id: string;
  kind: BetKind;
  label: string;
  stake: number;
  payout: number;
  wins: (o: Outcome, wheel: Wheel) => boolean;
};

const RED_SET = new Set<number>([
  1, 3, 5, 7, 9, 12, 14, 16, 18,
  19, 21, 23, 25, 27, 30, 32, 34, 36,
]);

function colorOf(o: Outcome): "red" | "black" | "green" {
  if (o === 0 || o === "00") return "green";
  return RED_SET.has(o) ? "red" : "black";
}

function formatOutcome(o: Outcome) {
  return o === "00" ? "00" : String(o);
}

function clampInt(n: number, min: number, max: number) {
  if (Number.isNaN(n)) return min;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

function wheelNumbers(wheel: Wheel): Outcome[] {
  if (wheel === "EU") return [0, ...Array.from({ length: 36 }, (_, i) => i + 1)];
  return [0, "00", ...Array.from({ length: 36 }, (_, i) => i + 1)];
}

function randomSpin(wheel: Wheel): Outcome {
  const arr = wheelNumbers(wheel);
  return arr[Math.floor(Math.random() * arr.length)];
}

function splitId(a: number, b: number) {
  const x = Math.min(a, b);
  const y = Math.max(a, b);
  return `split:${x}-${y}`;
}
function cornerId(nums: number[]) {
  const s = [...nums].sort((a, b) => a - b);
  return `corner:${s.join("-")}`;
}
function streetId(start: number) {
  return `street:${start}`;
}
function sixLineId(start: number) {
  return `six:${start}`;
}

function makeStraight(n: Outcome, stake: number): Bet {
  return {
    id: `n:${n}`,
    kind: "straight",
    label: n === "00" ? "00 (plein)" : `${n} (plein)`,
    stake,
    payout: 35,
    wins: (o) => o === n,
  };
}

function makeDozen(which: 1 | 2 | 3, stake: number): Bet {
  const start = (which - 1) * 12 + 1;
  const end = which * 12;
  const label =
    which === 1 ? `1ère douzaine (1–12)` :
    which === 2 ? `2ème douzaine (13–24)` :
    `3ème douzaine (25–36)`;
  return {
    id: `dozen:${which}`,
    kind: "dozen",
    label,
    stake,
    payout: 2,
    wins: (o) => typeof o === "number" && o >= start && o <= end,
  };
}

function makeColumn(which: 1 | 2 | 3, stake: number): Bet {
  return {
    id: `col:${which}`,
    kind: "column",
    label: `Colonne ${which} (2:1)`,
    stake,
    payout: 2,
    wins: (o) => {
      if (typeof o !== "number" || o === 0) return false;
      const mod = o % 3;
      if (which === 1) return mod === 1;
      if (which === 2) return mod === 2;
      return mod === 0;
    },
  };
}

function makeEvenMoney(
  which: "red" | "black" | "odd" | "even" | "low" | "high",
  stake: number
): Bet {
  const labelMap: Record<typeof which, string> = {
    red: "Rouge",
    black: "Noir",
    odd: "Impair",
    even: "Pair",
    low: "1–18 (Manque)",
    high: "19–36 (Passe)",
  };
  return {
    id: `even:${which}`,
    kind: "evenmoney",
    label: labelMap[which],
    stake,
    payout: 1,
    wins: (o) => {
      if (o === 0 || o === "00") return false;
      if (typeof o !== "number") return false;
      if (which === "red") return colorOf(o) === "red";
      if (which === "black") return colorOf(o) === "black";
      if (which === "odd") return o % 2 === 1;
      if (which === "even") return o % 2 === 0;
      if (which === "low") return o >= 1 && o <= 18;
      return o >= 19 && o <= 36;
    },
  };
}

function makeSplit(a: number, b: number, stake: number): Bet {
  const id = splitId(a, b);
  const x = Math.min(a, b);
  const y = Math.max(a, b);
  return {
    id,
    kind: "split",
    label: `Split ${x}/${y}`,
    stake,
    payout: 17,
    wins: (o) => typeof o === "number" && (o === x || o === y),
  };
}

function makeCorner(nums: number[], stake: number): Bet {
  const id = cornerId(nums);
  const s = [...nums].sort((a, b) => a - b);
  return {
    id,
    kind: "corner",
    label: `Corner ${s.join("-")}`,
    stake,
    payout: 8,
    wins: (o) => typeof o === "number" && s.includes(o),
  };
}

// Street = 3 numéros (11:1). start = 1,4,7,...,34
function makeStreet(start: number, stake: number): Bet {
  const id = streetId(start);
  const nums = [start, start + 1, start + 2];
  return {
    id,
    kind: "street",
    label: `Street ${nums.join("-")}`,
    stake,
    payout: 11,
    wins: (o) => typeof o === "number" && nums.includes(o),
  };
}

// Six-line = 6 numéros (5:1). start = 1,4,...,31
function makeSixLine(start: number, stake: number): Bet {
  const id = sixLineId(start);
  const nums = [start, start + 1, start + 2, start + 3, start + 4, start + 5];
  return {
    id,
    kind: "sixline",
    label: `Six-line ${start}-${start + 5}`,
    stake,
    payout: 5,
    wins: (o) => typeof o === "number" && o >= start && o <= start + 5,
  };
}

function calcNetForOutcome(bets: Bet[], outcome: Outcome, wheel: Wheel) {
  let net = 0;
  for (const b of bets) {
    net += b.wins(outcome, wheel) ? b.stake * b.payout : -b.stake;
  }
  return net;
}

function longestStreak<T>(arr: T[], eq: (a: T, b: T) => boolean) {
  let best = 0;
  let bestVal: T | null = null;
  let cur = 0;
  let curVal: T | null = null;

  for (const v of arr) {
    if (curVal !== null && eq(v, curVal)) cur += 1;
    else {
      curVal = v;
      cur = 1;
    }
    if (cur > best) {
      best = cur;
      bestVal = curVal;
    }
  }
  return { best, bestVal };
}

/**
 * Layout officiel (comme ton image)
 * Row 0: 3,6,9..36
 * Row 1: 2,5,8..35
 * Row 2: 1,4,7..34
 */
function numAt(row: 0 | 1 | 2, col: number): number {
  if (row === 0) return 3 * (col + 1);
  if (row === 1) return 3 * col + 2;
  return 3 * col + 1;
}

export default function CasinoRouletteLab() {
  const [wheel, setWheel] = useState<Wheel>("EU");
  const [spinsTarget, setSpinsTarget] = useState<number>(200);
  const [chip, setChip] = useState<number>(5);

  const [betsMap, setBetsMap] = useState<Record<string, Bet>>({});
  const bets = useMemo(() => Object.values(betsMap), [betsMap]);

  const [history, setHistory] = useState<Outcome[]>([]);
  const [pnlSeries, setPnlSeries] = useState<number[]>([]);
  const pnl = pnlSeries.length ? pnlSeries[pnlSeries.length - 1] : 0;

  function upsertBet(newBet: Bet, delta: number) {
    setBetsMap((prev) => {
      const existing = prev[newBet.id];
      const nextStake = (existing?.stake ?? 0) + delta;
      const clone = { ...prev };
      if (nextStake <= 0) {
        delete clone[newBet.id];
        return clone;
      }
      clone[newBet.id] = { ...(existing ?? newBet), stake: nextStake };
      return clone;
    });
  }

  function addById(id: string, delta: number) {
    if (id.startsWith("n:")) {
      const raw = id.slice(2);
      const n: Outcome = raw === "00" ? "00" : Number(raw);
      upsertBet(makeStraight(n, 0), delta);
      return;
    }
    if (id.startsWith("dozen:")) {
      const which = Number(id.slice(6)) as 1 | 2 | 3;
      upsertBet(makeDozen(which, 0), delta);
      return;
    }
    if (id.startsWith("col:")) {
      const which = Number(id.slice(4)) as 1 | 2 | 3;
      upsertBet(makeColumn(which, 0), delta);
      return;
    }
    if (id.startsWith("even:")) {
      const which = id.slice(5) as "red" | "black" | "odd" | "even" | "low" | "high";
      upsertBet(makeEvenMoney(which, 0), delta);
      return;
    }
    if (id.startsWith("split:")) {
      const raw = id.slice(6);
      const [a, b] = raw.split("-").map((x) => Number(x));
      upsertBet(makeSplit(a, b, 0), delta);
      return;
    }
    if (id.startsWith("corner:")) {
      const raw = id.slice(7);
      const nums = raw.split("-").map((x) => Number(x));
      upsertBet(makeCorner(nums, 0), delta);
      return;
    }
    if (id.startsWith("street:")) {
      const start = Number(id.slice(7));
      upsertBet(makeStreet(start, 0), delta);
      return;
    }
    if (id.startsWith("six:")) {
      const start = Number(id.slice(4));
      upsertBet(makeSixLine(start, 0), delta);
      return;
    }
  }

  function onPlace(id: string, isRemove: boolean) {
    addById(id, isRemove ? -chip : chip);
  }

  function clearBets() {
    setBetsMap({});
  }

  function resetRun() {
    setHistory([]);
    setPnlSeries([]);
  }

  function spinOnce() {
    const o = randomSpin(wheel);
    const net = calcNetForOutcome(bets, o, wheel);
    setHistory((h) => [...h, o]);
    setPnlSeries((s) => {
      const prev = s.length ? s[s.length - 1] : 0;
      return [...s, prev + net];
    });
  }

  function simulateN() {
    const n = clampInt(spinsTarget, 1, 20000);
    const outs: Outcome[] = [];
    const pnlArr: number[] = [];
    let cum = 0;
    for (let i = 0; i < n; i++) {
      const o = randomSpin(wheel);
      outs.push(o);
      cum += calcNetForOutcome(bets, o, wheel);
      pnlArr.push(cum);
    }
    setHistory(outs);
    setPnlSeries(pnlArr);
  }

  const chipOptions = [1, 2, 5, 10, 25, 50, 100];

  const totalStakePerSpin = useMemo(
    () => bets.reduce((s, b) => s + b.stake, 0),
    [bets]
  );

  const colors = useMemo(() => history.map(colorOf), [history]);
  const longestColor = useMemo(
    () => longestStreak(colors, (a, b) => a === b),
    [colors]
  );
  const lastSpins = history.slice(-24).reverse();

  function feltCellClassByNumber(n: number) {
    const c = colorOf(n);
    if (c === "green") return "bg-emerald-500/35 hover:bg-emerald-500/45 text-emerald-50";
    if (c === "red") return "bg-red-600/35 hover:bg-red-600/45 text-red-50";
    return "bg-zinc-950/45 hover:bg-zinc-900/50 text-white/95";
  }

  function MiniChip({ amount }: { amount: number }) {
    return (
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="px-2 py-1 rounded-full bg-black/55 border border-white/25 backdrop-blur text-[11px] font-semibold">
          {amount}
        </div>
      </div>
    );
  }

  const houseEdge = wheel === "EU" ? "2.70%" : "5.26%";

  // --- Hotspots splits/corners sur la grille 12x3 ---
  const splitHotspots = useMemo(() => {
    const hs: Array<{
      id: string;
      leftPct: number;
      topPct: number;
      orient: "betweenCols" | "betweenRows";
      title: string;
    }> = [];

    // splits entre colonnes (barres verticales)
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 11; col++) {
        const a = numAt(row as 0 | 1 | 2, col);
        const b = numAt(row as 0 | 1 | 2, col + 1);
        hs.push({
          id: splitId(a, b),
          leftPct: ((col + 1) / 12) * 100,
          topPct: ((row + 0.5) / 3) * 100,
          orient: "betweenCols",
          title: `Split ${Math.min(a, b)}/${Math.max(a, b)}`,
        });
      }
    }

    // splits entre lignes (barres horizontales)
    for (let col = 0; col < 12; col++) {
      // entre row 0 et 1
      {
        const a = numAt(0, col);
        const b = numAt(1, col);
        hs.push({
          id: splitId(a, b),
          leftPct: ((col + 0.5) / 12) * 100,
          topPct: (1 / 3) * 100,
          orient: "betweenRows",
          title: `Split ${Math.min(a, b)}/${Math.max(a, b)}`,
        });
      }
      // entre row 1 et 2
      {
        const a = numAt(1, col);
        const b = numAt(2, col);
        hs.push({
          id: splitId(a, b),
          leftPct: ((col + 0.5) / 12) * 100,
          topPct: (2 / 3) * 100,
          orient: "betweenRows",
          title: `Split ${Math.min(a, b)}/${Math.max(a, b)}`,
        });
      }
    }

    return hs;
  }, []);

  const cornerHotspots = useMemo(() => {
    const hs: Array<{ id: string; leftPct: number; topPct: number; title: string }> = [];

    const addCorner = (rTop: 0 | 1, rBottom: 1 | 2, col: number) => {
      const nums = [
        numAt(rTop, col),
        numAt(rTop, col + 1),
        numAt(rBottom, col),
        numAt(rBottom, col + 1),
      ];
      const id = cornerId(nums);
      const sorted = [...nums].sort((a, b) => a - b).join("-");
      const topPct = rTop === 0 ? (1 / 3) * 100 : (2 / 3) * 100;
      hs.push({
        id,
        leftPct: ((col + 1) / 12) * 100,
        topPct,
        title: `Corner ${sorted}`,
      });
    };

    for (let col = 0; col < 11; col++) {
      addCorner(0, 1, col);
      addCorner(1, 2, col);
    }

    return hs;
  }, []);

  // ✅ Streets (12) + Six-lines (11) sur la ligne basse du bloc 1-36
  const streetHotspots = useMemo(() => {
    return Array.from({ length: 12 }, (_, col) => {
      const start = 3 * col + 1; // 1,4,7,...,34
      return {
        id: streetId(start),
        leftPct: ((col + 0.5) / 12) * 100,
        topPct: 100, // ligne du bas du bloc numbers
        title: `Street ${start}-${start + 2}`,
      };
    });
  }, []);

  const sixLineHotspots = useMemo(() => {
    return Array.from({ length: 11 }, (_, col) => {
      const start = 3 * col + 1; // 1,4,...,31
      return {
        id: sixLineId(start),
        leftPct: ((col + 1) / 12) * 100, // entre 2 streets
        topPct: 100,
        title: `Six-line ${start}-${start + 5}`,
      };
    });
  }, []);

  const houseFeltBg =
    "radial-gradient(900px 520px at 30% 20%, rgba(255,215,120,0.16), transparent 62%)," +
    "radial-gradient(900px 520px at 85% 15%, rgba(120,255,200,0.10), transparent 60%)," +
    "linear-gradient(180deg, rgba(10,55,35,0.95), rgba(6,18,12,0.98))";

  const lastSpinsUI = lastSpins;

  return (
    <div className="min-h-screen">
      <div className="max-w-6xl mx-auto px-4 py-10">
        <div className="mb-6">
          <div className="flex items-center gap-2 text-xs text-white/60">
            <span className="px-2 py-1 rounded-full border border-white/15 bg-white/5">
              CASINO LAB
            </span>
            <span className="ml-auto text-white/50">
              House edge (even-money):{" "}
              <span className="text-amber-200">{houseEdge}</span>
            </span>
          </div>

          <h1 className="mt-3 text-4xl md:text-5xl font-semibold tracking-tight">
            Roulette Simulator{" "}
            <span className="text-white/40">— table officielle</span>
          </h1>
          <p className="mt-2 text-white/65 max-w-3xl">
            Clique sur les cases pour les <b>pleins</b>. <b>Splits</b> = clic sur les barres.{" "}
            <b>Corners</b> = clic sur les points. <b>Streets</b> / <b>Six-lines</b> = clic sur la ligne basse (sous 1–36).
            <span className="text-white/55"> (Shift+clic = retirer)</span>
          </p>
        </div>

        {/* Controls */}
        <div className="rounded-3xl border border-white/10 bg-black/25 backdrop-blur p-5 shadow-[0_20px_80px_rgba(0,0,0,0.35)]">
          <div className="grid md:grid-cols-12 gap-3 items-end">
            <div className="md:col-span-4">
              <div className="text-sm font-medium">Wheel</div>
              <div className="mt-2 inline-flex rounded-2xl border border-white/15 bg-white/5 p-1">
                <button
                  onClick={() => setWheel("EU")}
                  className={`px-4 py-2 rounded-2xl text-sm transition ${
                    wheel === "EU"
                      ? "bg-amber-300 text-black"
                      : "text-white/80 hover:bg-white/5"
                  }`}
                >
                  European (0)
                </button>
                <button
                  onClick={() => setWheel("US")}
                  className={`px-4 py-2 rounded-2xl text-sm transition ${
                    wheel === "US"
                      ? "bg-amber-300 text-black"
                      : "text-white/80 hover:bg-white/5"
                  }`}
                >
                  American (0+00)
                </button>
              </div>
            </div>

            <div className="md:col-span-3">
              <div className="text-sm font-medium">Nombre de spins</div>
              <input
                value={spinsTarget}
                onChange={(e) =>
                  setSpinsTarget(clampInt(Number(e.target.value), 1, 20000))
                }
                className="mt-2 w-full rounded-2xl bg-black/30 border border-white/10 px-4 py-3 outline-none focus:border-white/25"
                inputMode="numeric"
              />
              <div className="mt-1 text-[11px] text-white/50">1 → 20 000</div>
            </div>

            <div className="md:col-span-3">
              <div className="text-sm font-medium">Jeton</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {[1, 2, 5, 10, 25, 50, 100].map((v) => (
                  <button
                    key={v}
                    onClick={() => setChip(v)}
                    className={`px-3 py-2 rounded-2xl border text-sm transition ${
                      chip === v
                        ? "bg-white text-black border-white"
                        : "border-white/15 text-white/80 hover:bg-white/5"
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
              <div className="mt-1 text-[11px] text-white/50">
                Clic = ajoute • Shift+clic = retire
              </div>
            </div>

            <div className="md:col-span-2 flex gap-2 justify-end">
              <button
                onClick={simulateN}
                className="w-full md:w-auto px-5 py-3 rounded-2xl bg-amber-300 text-black font-semibold shadow"
              >
                Simuler
              </button>
              <button
                onClick={() => {
                  resetRun();
                  clearBets();
                }}
                className="w-full md:w-auto px-4 py-3 rounded-2xl border border-white/15 hover:bg-white/5"
              >
                Reset
              </button>
            </div>
          </div>
        </div>

        {/* Main */}
        <div className="mt-8 grid lg:grid-cols-12 gap-6">
          {/* Felt table */}
          <div className="lg:col-span-7">
            <div
              className="rounded-[28px] border border-white/10 overflow-hidden shadow-[0_30px_120px_rgba(0,0,0,0.45)]"
              style={{ background: houseFeltBg }}
            >
              <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
                <div className="text-sm font-medium">Tapis (layout officiel)</div>
                <div className="text-xs text-white/55">
                  Mise/spin:{" "}
                  <span className="text-white/85 font-semibold">
                    {totalStakePerSpin.toFixed(0)}€
                  </span>
                </div>
              </div>

              <div className="p-5">
                <div className="rounded-3xl border border-white/15 bg-black/15 overflow-hidden">
                  {/* Top area: 0 | numbers(12x3) | 2to1 */}
                  <div className="flex">
                    {/* Left 0/00 column */}
                    <div className="w-[84px] border-r border-white/15">
                      {wheel === "EU" ? (
                        <button
                          onClick={(e) => onPlace("n:0", e.shiftKey)}
                          className="relative w-full h-[168px] flex items-center justify-center text-3xl font-semibold bg-emerald-500/35 hover:bg-emerald-500/45 text-emerald-50"
                          title="0"
                        >
                          0
                          {betsMap["n:0"]?.stake ? (
                            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                              <div className="px-2 py-1 rounded-full bg-black/55 border border-white/25 backdrop-blur text-[11px] font-semibold">
                                {betsMap["n:0"]!.stake}
                              </div>
                            </div>
                          ) : null}
                        </button>
                      ) : (
                        <div className="h-[168px] flex flex-col">
                          <button
                            onClick={(e) => onPlace("n:0", e.shiftKey)}
                            className="relative flex-1 flex items-center justify-center text-2xl font-semibold bg-emerald-500/35 hover:bg-emerald-500/45 text-emerald-50 border-b border-white/15"
                            title="0"
                          >
                            0
                            {betsMap["n:0"]?.stake ? <MiniChip amount={betsMap["n:0"]!.stake} /> : null}
                          </button>
                          <button
                            onClick={(e) => onPlace("n:00", e.shiftKey)}
                            className="relative flex-1 flex items-center justify-center text-2xl font-semibold bg-emerald-500/35 hover:bg-emerald-500/45 text-emerald-50"
                            title="00"
                          >
                            00
                            {betsMap["n:00"]?.stake ? <MiniChip amount={betsMap["n:00"]!.stake} /> : null}
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Numbers grid area (relative for hotspots) */}
                    <div className="relative flex-1">
                      <div className="grid grid-cols-12">
                        {/* row 0 */}
                        {Array.from({ length: 12 }, (_, col) => {
                          const n = numAt(0, col);
                          const id = `n:${n}`;
                          const stake = betsMap[id]?.stake ?? 0;
                          return (
                            <button
                              key={`r0-${id}`}
                              onClick={(e) => onPlace(id, e.shiftKey)}
                              className={`relative h-14 border-b border-r border-white/10 last:border-r-0 flex items-center justify-center font-semibold ${feltCellClassByNumber(n)}`}
                              title={`Plein ${n}`}
                            >
                              {n}
                              {stake > 0 ? <MiniChip amount={stake} /> : null}
                            </button>
                          );
                        })}

                        {/* row 1 */}
                        {Array.from({ length: 12 }, (_, col) => {
                          const n = numAt(1, col);
                          const id = `n:${n}`;
                          const stake = betsMap[id]?.stake ?? 0;
                          return (
                            <button
                              key={`r1-${id}`}
                              onClick={(e) => onPlace(id, e.shiftKey)}
                              className={`relative h-14 border-b border-r border-white/10 last:border-r-0 flex items-center justify-center font-semibold ${feltCellClassByNumber(n)}`}
                              title={`Plein ${n}`}
                            >
                              {n}
                              {stake > 0 ? <MiniChip amount={stake} /> : null}
                            </button>
                          );
                        })}

                        {/* row 2 */}
                        {Array.from({ length: 12 }, (_, col) => {
                          const n = numAt(2, col);
                          const id = `n:${n}`;
                          const stake = betsMap[id]?.stake ?? 0;
                          return (
                            <button
                              key={`r2-${id}`}
                              onClick={(e) => onPlace(id, e.shiftKey)}
                              className={`relative h-14 border-r border-white/10 last:border-r-0 flex items-center justify-center font-semibold ${feltCellClassByNumber(n)}`}
                              title={`Plein ${n}`}
                            >
                              {n}
                              {stake > 0 ? <MiniChip amount={stake} /> : null}
                            </button>
                          );
                        })}
                      </div>

                      {/* SPLITS */}
                      {splitHotspots.map((h) => {
                        const stake = betsMap[h.id]?.stake ?? 0;
                        const sizeClass =
                          h.orient === "betweenCols"
                            ? "w-6 h-10 rounded-full"
                            : "w-10 h-6 rounded-full";

                        return (
                          <button
                            key={h.id}
                            onClick={(e) => onPlace(h.id, e.shiftKey)}
                            title={h.title}
                            className={`absolute ${sizeClass} -translate-x-1/2 -translate-y-1/2 border border-white/25 bg-amber-300/18 hover:bg-amber-300/28 transition`}
                            style={{ left: `${h.leftPct}%`, top: `${h.topPct}%` }}
                          >
                            {stake > 0 ? <MiniChip amount={stake} /> : null}
                          </button>
                        );
                      })}

                      {/* CORNERS */}
                      {cornerHotspots.map((h) => {
                        const stake = betsMap[h.id]?.stake ?? 0;
                        return (
                          <button
                            key={h.id}
                            onClick={(e) => onPlace(h.id, e.shiftKey)}
                            title={h.title}
                            className="absolute w-7 h-7 rounded-full -translate-x-1/2 -translate-y-1/2 border border-white/25 bg-white/10 hover:bg-white/18 transition"
                            style={{ left: `${h.leftPct}%`, top: `${h.topPct}%` }}
                          >
                            {stake > 0 ? <MiniChip amount={stake} /> : null}
                          </button>
                        );
                      })}

                      {/* ✅ STREETS (12) */}
                      {streetHotspots.map((h) => {
                        const stake = betsMap[h.id]?.stake ?? 0;
                        return (
                          <button
                            key={h.id}
                            onClick={(e) => onPlace(h.id, e.shiftKey)}
                            title={h.title}
                            className="absolute w-16 h-5 rounded-full -translate-x-1/2 -translate-y-1/2 border border-white/25 bg-emerald-300/12 hover:bg-emerald-300/18 transition"
                            style={{ left: `${h.leftPct}%`, top: `${h.topPct}%` }}
                          >
                            {stake > 0 ? <MiniChip amount={stake} /> : null}
                          </button>
                        );
                      })}

                      {/* ✅ SIX-LINES (11) */}
                      {sixLineHotspots.map((h) => {
                        const stake = betsMap[h.id]?.stake ?? 0;
                        return (
                          <button
                            key={h.id}
                            onClick={(e) => onPlace(h.id, e.shiftKey)}
                            title={h.title}
                            className="absolute w-20 h-4 rounded-full -translate-x-1/2 -translate-y-1/2 border border-white/25 bg-white/8 hover:bg-white/12 transition"
                            style={{ left: `${h.leftPct}%`, top: `${h.topPct}%` }}
                          >
                            {stake > 0 ? <MiniChip amount={stake} /> : null}
                          </button>
                        );
                      })}
                    </div>

                    {/* Right 2to1 column */}
                    <div className="w-[84px] border-l border-white/15">
                      {([
                        { row: 0, colId: "col:3" },
                        { row: 1, colId: "col:2" },
                        { row: 2, colId: "col:1" },
                      ] as const).map(({ row, colId }) => {
                        const stake = betsMap[colId]?.stake ?? 0;
                        return (
                          <button
                            key={`2to1-${row}`}
                            onClick={(e) => onPlace(colId, e.shiftKey)}
                            className="relative w-full h-14 border-b border-white/10 last:border-b-0 bg-white/6 hover:bg-white/10 transition flex items-center justify-center font-semibold text-white/90"
                            title={`${colId} (2:1)`}
                          >
                            2 to 1
                            {stake > 0 ? <MiniChip amount={stake} /> : null}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Dozens */}
                  <div className="flex border-t border-white/15">
                    <div className="w-[84px]" />
                    <div className="flex-1 grid grid-cols-12">
                      {[
                        { id: "dozen:1", label: "1st12", span: 4 },
                        { id: "dozen:2", label: "2nd12", span: 4 },
                        { id: "dozen:3", label: "3rd12", span: 4 },
                      ].map((d) => {
                        const stake = betsMap[d.id]?.stake ?? 0;
                        return (
                          <button
                            key={d.id}
                            onClick={(e) => onPlace(d.id, e.shiftKey)}
                            className="relative h-12 bg-emerald-400/10 hover:bg-emerald-400/16 transition border-r border-white/10 last:border-r-0 flex items-center justify-center font-semibold text-white/90"
                            style={{ gridColumn: `span ${d.span}` }}
                          >
                            {d.label}
                            {stake > 0 ? <MiniChip amount={stake} /> : null}
                          </button>
                        );
                      })}
                    </div>
                    <div className="w-[84px]" />
                  </div>

                  {/* Even money */}
                  <div className="flex border-t border-white/15">
                    <div className="w-[84px]" />
                    <div className="flex-1 grid grid-cols-12">
                      {[
                        { id: "even:low", label: "1to18", span: 2, bg: "bg-emerald-400/10 hover:bg-emerald-400/16" },
                        { id: "even:even", label: "EVEN", span: 2, bg: "bg-emerald-400/10 hover:bg-emerald-400/16" },
                        { id: "even:red", label: "RED", span: 2, bg: "bg-red-600/25 hover:bg-red-600/32" },
                        { id: "even:black", label: "BLACK", span: 2, bg: "bg-zinc-950/35 hover:bg-zinc-900/40" },
                        { id: "even:odd", label: "ODD", span: 2, bg: "bg-emerald-400/10 hover:bg-emerald-400/16" },
                        { id: "even:high", label: "19to36", span: 2, bg: "bg-emerald-400/10 hover:bg-emerald-400/16" },
                      ].map((b) => {
                        const stake = betsMap[b.id]?.stake ?? 0;
                        return (
                          <button
                            key={b.id}
                            onClick={(e) => onPlace(b.id, e.shiftKey)}
                            className={`relative h-12 transition border-r border-white/10 last:border-r-0 flex items-center justify-center font-semibold text-white/90 ${b.bg}`}
                            style={{ gridColumn: `span ${b.span}` }}
                          >
                            {b.label}
                            {stake > 0 ? <MiniChip amount={stake} /> : null}
                          </button>
                        );
                      })}
                    </div>
                    <div className="w-[84px]" />
                  </div>

                  {/* Actions */}
                  <div className="p-3 bg-black/10 border-t border-white/10 flex gap-2 justify-end">
                    <button
                      onClick={spinOnce}
                      className="px-4 py-2 rounded-2xl border border-white/15 hover:bg-white/5 text-sm"
                    >
                      Spin (1)
                    </button>
                    <button
                      onClick={resetRun}
                      className="px-4 py-2 rounded-2xl border border-white/15 hover:bg-white/5 text-sm"
                    >
                      Reset run
                    </button>
                    <button
                      onClick={clearBets}
                      className="px-4 py-2 rounded-2xl border border-white/15 hover:bg-white/5 text-sm"
                    >
                      Clear bets
                    </button>
                  </div>
                </div>

                <div className="mt-3 text-xs text-white/55">
                  Splits <b>17:1</b> • Corners <b>8:1</b> • Streets <b>11:1</b> • Six-lines <b>5:1</b>
                </div>
              </div>
            </div>
          </div>

          {/* Right panel */}
          <div className="lg:col-span-5 space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-3xl border border-white/10 bg-black/25 backdrop-blur p-4">
                <div className="text-xs text-white/60">P&L cumulé</div>
                <div className="mt-1 text-3xl font-semibold">
                  {pnl >= 0 ? "+" : ""}
                  {pnl.toFixed(0)}€
                </div>
                <div className="mt-1 text-xs text-white/55">Spins: {history.length}</div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-black/25 backdrop-blur p-4">
                <div className="text-xs text-white/60">Longest color streak</div>
                <div className="mt-1 text-3xl font-semibold">
                  {String(longestColor.bestVal ?? "-")} × {longestColor.best}
                </div>
                <div className="mt-1 text-xs text-white/55">Green casse les séries</div>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-black/25 backdrop-blur p-5">
              <div className="text-sm font-medium">Derniers spins</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {lastSpinsUI.length === 0 ? (
                  <div className="text-sm text-white/55">Aucun spin.</div>
                ) : (
                  lastSpinsUI.map((o, idx) => {
                    const c = colorOf(o);
                    const ring =
                      c === "red"
                        ? "border-red-500/45"
                        : c === "black"
                        ? "border-white/15"
                        : "border-emerald-400/45";
                    const bg =
                      c === "red"
                        ? "bg-red-500/15"
                        : c === "black"
                        ? "bg-black/35"
                        : "bg-emerald-500/15";
                    return (
                      <div
                        key={idx}
                        className={`w-10 h-10 rounded-full border ${ring} ${bg} flex items-center justify-center text-sm font-semibold`}
                        title={c}
                      >
                        {formatOutcome(o)}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-black/25 backdrop-blur p-5">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">Bets actifs</div>
                <div className="text-xs text-white/55">
                  Total/spin:{" "}
                  <span className="text-white/85 font-semibold">
                    {totalStakePerSpin.toFixed(0)}€
                  </span>
                </div>
              </div>

              <div className="mt-3 space-y-2 max-h-[420px] overflow-auto pr-1">
                {bets.length === 0 ? (
                  <div className="text-sm text-white/55">
                    Pose des jetons sur le tapis (pleins/splits/corners/streets/six-lines).
                  </div>
                ) : (
                  bets
                    .slice()
                    .sort((a, b) => b.stake - a.stake)
                    .map((b) => (
                      <div
                        key={b.id}
                        className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2 flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">{b.label}</div>
                          <div className="text-[11px] text-white/55">
                            {b.kind} • payout {b.payout}:1
                          </div>
                        </div>
                        <div className="text-sm font-semibold">{b.stake.toFixed(0)}€</div>
                      </div>
                    ))
                )}
              </div>

              <div className="mt-3 text-xs text-white/55">
                Shift+clic pour retirer.
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 text-xs text-white/45">
          ⚠️ Simulateur RNG : aucun “edge”, juste la variance.
        </div>
      </div>
    </div>
  );
}
