"use client";

import React, { useMemo, useState } from "react";

type Wheel = "EU" | "US";
type SpotKind = "straight" | "split" | "corner" | "dozen" | "outside" | "column";

type RectU = { x: number; y: number; w: number; h: number }; // units in a 14 (cols) x 5 (rows) board
type Spot = {
  id: string;
  kind: SpotKind;
  label: string;
  numbers: number[]; // EU: 0..36, US: 0..36 + 37 as "00"
  payout: number; // net payout ratio (e.g. split = 17)
  rect: RectU; // click area
  anchor: { x: number; y: number }; // anchor point in units (chip center)
};

const RED_NUMBERS = new Set<number>([
  1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36,
]);

function colorOf(n: number, wheel: Wheel): "red" | "black" | "green" {
  if (n === 0 || (wheel === "US" && n === 37)) return "green";
  return RED_NUMBERS.has(n) ? "red" : "black";
}

function formatOutcome(n: number, wheel: Wheel) {
  if (wheel === "US" && n === 37) return "00";
  return String(n);
}

function randInt(maxExclusive: number) {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0] % maxExclusive;
}

// Layout helpers (numbers grid = 12 columns (1..12) and 3 rows (0..2), plus 0-column and 2to1-column)
function numAt(col: number, row: number) {
  // col: 1..12
  // row 0: 3,6,9..36 ; row 1: 2,5,8..35 ; row 2: 1,4,7..34
  const i = col; // 1..12
  if (row === 0) return 3 * i;
  if (row === 1) return 3 * i - 1;
  return 3 * i - 2;
}

function range(a: number, b: number) {
  const out: number[] = [];
  for (let i = a; i <= b; i++) out.push(i);
  return out;
}

function pctX(u: number) {
  return `${(u / 14) * 100}%`;
}
function pctY(u: number) {
  return `${(u / 5) * 100}%`;
}

function styleFromRect(r: RectU): React.CSSProperties {
  return {
    left: pctX(r.x),
    top: pctY(r.y),
    width: pctX(r.w),
    height: pctY(r.h),
  };
}

function clampInt(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function buildSpots(): Spot[] {
  const spots: Spot[] = [];

  // --- Straight bets (0 and 1..36) ---
  // 0 cell spans 3 rows, col 0
  spots.push({
    id: "straight:0",
    kind: "straight",
    label: "0",
    numbers: [0],
    payout: 35,
    rect: { x: 0, y: 0, w: 1, h: 3 },
    anchor: { x: 0.5, y: 1.5 },
  });

  // numbers grid: x = col (1..12), y = row (0..2)
  for (let row = 0; row <= 2; row++) {
    for (let col = 1; col <= 12; col++) {
      const n = numAt(col, row);
      spots.push({
        id: `straight:${n}`,
        kind: "straight",
        label: String(n),
        numbers: [n],
        payout: 35,
        rect: { x: col, y: row, w: 1, h: 1 },
        anchor: { x: col + 0.5, y: row + 0.5 },
      });
    }
  }

  // --- Column bets "2 to 1" (right side col 13) ---
  // Each row corresponds to that row's 12 numbers
  for (let row = 0; row <= 2; row++) {
    const nums: number[] = [];
    for (let col = 1; col <= 12; col++) nums.push(numAt(col, row));
    spots.push({
      id: `column:${row}`,
      kind: "column",
      label: "2 to 1",
      numbers: nums,
      payout: 2,
      rect: { x: 13, y: row, w: 1, h: 1 },
      anchor: { x: 13.5, y: row + 0.5 },
    });
  }

  // --- Dozens row (y=3, across the 12 cols) ---
  const dozen1 = range(1, 12);
  const dozen2 = range(13, 24);
  const dozen3 = range(25, 36);
  spots.push({
    id: "dozen:1",
    kind: "dozen",
    label: "1st 12",
    numbers: dozen1,
    payout: 2,
    rect: { x: 1, y: 3, w: 4, h: 1 },
    anchor: { x: 3, y: 3.5 },
  });
  spots.push({
    id: "dozen:2",
    kind: "dozen",
    label: "2nd 12",
    numbers: dozen2,
    payout: 2,
    rect: { x: 5, y: 3, w: 4, h: 1 },
    anchor: { x: 7, y: 3.5 },
  });
  spots.push({
    id: "dozen:3",
    kind: "dozen",
    label: "3rd 12",
    numbers: dozen3,
    payout: 2,
    rect: { x: 9, y: 3, w: 4, h: 1 },
    anchor: { x: 11, y: 3.5 },
  });

  // --- Outside row (y=4, each spans 2 cols) ---
  // 1-18, EVEN, RED, BLACK, ODD, 19-36
  spots.push({
    id: "out:low",
    kind: "outside",
    label: "1 to 18",
    numbers: range(1, 18),
    payout: 1,
    rect: { x: 1, y: 4, w: 2, h: 1 },
    anchor: { x: 2, y: 4.5 },
  });
  spots.push({
    id: "out:even",
    kind: "outside",
    label: "EVEN",
    numbers: range(1, 36).filter((n) => n % 2 === 0),
    payout: 1,
    rect: { x: 3, y: 4, w: 2, h: 1 },
    anchor: { x: 4, y: 4.5 },
  });
  spots.push({
    id: "out:red",
    kind: "outside",
    label: "RED",
    numbers: range(1, 36).filter((n) => RED_NUMBERS.has(n)),
    payout: 1,
    rect: { x: 5, y: 4, w: 2, h: 1 },
    anchor: { x: 6, y: 4.5 },
  });
  spots.push({
    id: "out:black",
    kind: "outside",
    label: "BLACK",
    numbers: range(1, 36).filter((n) => !RED_NUMBERS.has(n)),
    payout: 1,
    rect: { x: 7, y: 4, w: 2, h: 1 },
    anchor: { x: 8, y: 4.5 },
  });
  spots.push({
    id: "out:odd",
    kind: "outside",
    label: "ODD",
    numbers: range(1, 36).filter((n) => n % 2 === 1),
    payout: 1,
    rect: { x: 9, y: 4, w: 2, h: 1 },
    anchor: { x: 10, y: 4.5 },
  });
  spots.push({
    id: "out:high",
    kind: "outside",
    label: "19 to 36",
    numbers: range(19, 36),
    payout: 1,
    rect: { x: 11, y: 4, w: 2, h: 1 },
    anchor: { x: 12, y: 4.5 },
  });

  // --- SPLITS + CORNERS over the 1..36 grid ---
  // Hotspot sizes in units (tuned for "clickable but precise")
  const vSplitW = 0.18; // vertical line between columns
  const vSplitH = 0.72;
  const hSplitW = 0.72; // horizontal line between rows
  const hSplitH = 0.18;
  const cornerS = 0.22;

  // Vertical splits (between adjacent columns within same row): (col,row) with (col+1,row)
  for (let row = 0; row <= 2; row++) {
    for (let col = 1; col <= 11; col++) {
      const a = numAt(col, row);
      const b = numAt(col + 1, row);
      const xLine = col + 1; // boundary between col and col+1
      const yTop = row + (1 - vSplitH) / 2;

      spots.push({
        id: `split:${Math.min(a, b)}-${Math.max(a, b)}`,
        kind: "split",
        label: `${a}/${b}`,
        numbers: [a, b],
        payout: 17,
        rect: { x: xLine - vSplitW / 2, y: yTop, w: vSplitW, h: vSplitH },
        anchor: { x: xLine, y: row + 0.5 },
      });
    }
  }

  // Horizontal splits (between adjacent rows within same column): (col,row) with (col,row+1)
  for (let row = 0; row <= 1; row++) {
    for (let col = 1; col <= 12; col++) {
      const a = numAt(col, row);
      const b = numAt(col, row + 1);
      const yLine = row + 1; // boundary between row and row+1
      const xLeft = col + (1 - hSplitW) / 2;

      spots.push({
        id: `split:${Math.min(a, b)}-${Math.max(a, b)}`,
        kind: "split",
        label: `${a}/${b}`,
        numbers: [a, b],
        payout: 17,
        rect: { x: xLeft, y: yLine - hSplitH / 2, w: hSplitW, h: hSplitH },
        anchor: { x: col + 0.5, y: yLine },
      });
    }
  }

  // Corners (4 numbers): intersection between (col,row) and (col+1,row+1)
  for (let row = 0; row <= 1; row++) {
    for (let col = 1; col <= 11; col++) {
      const n1 = numAt(col, row);
      const n2 = numAt(col + 1, row);
      const n3 = numAt(col, row + 1);
      const n4 = numAt(col + 1, row + 1);
      const x = col + 1;
      const y = row + 1;

      const nums = [n1, n2, n3, n4].sort((a, b) => a - b);
      spots.push({
        id: `corner:${nums.join("-")}`,
        kind: "corner",
        label: "corner",
        numbers: nums,
        payout: 8,
        rect: { x: x - cornerS / 2, y: y - cornerS / 2, w: cornerS, h: cornerS },
        anchor: { x, y },
      });
    }
  }

  return spots;
}

type BetState = Record<string, number>; // spotId -> amount

function computeNetForSpin(outcome: number, wheel: Wheel, spots: Spot[], bets: BetState) {
  // US "00" is outcome 37; it only hits if a bet explicitly includes 37 (we don't add 00 on the felt here yet)
  let net = 0;
  for (const s of spots) {
    const amt = bets[s.id] ?? 0;
    if (!amt) continue;

    const win = s.numbers.includes(outcome);
    if (win) net += amt * s.payout;
    else net -= amt;
  }
  return net;
}

function sumStake(bets: BetState) {
  return Object.values(bets).reduce((a, b) => a + b, 0);
}

function Chip({
  value,
  active,
  onClick,
}: {
  value: number;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        "relative rounded-full select-none",
        "transition-transform duration-150",
        active ? "scale-105" : "hover:scale-105",
      ].join(" ")}
      style={{
        width: "clamp(34px, 4.2vw, 48px)",
        height: "clamp(34px, 4.2vw, 48px)",
      }}
      title={`${value}€`}
    >
      <div className="absolute inset-0 rounded-full bg-gradient-to-b from-white/25 to-black/25" />
      <div className="absolute inset-[3px] rounded-full border border-white/25 bg-black/35" />
      <div className="absolute inset-[7px] rounded-full border border-white/15 bg-black/40" />
      <div className="absolute inset-0 flex items-center justify-center font-semibold text-white">
        {value}
      </div>
      {active ? (
        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[10px] px-2 py-0.5 rounded-full bg-amber-400 text-black font-semibold shadow">
          selected
        </div>
      ) : null}
    </button>
  );
}

function PlacedChip({
  amount,
  xU,
  yU,
}: {
  amount: number;
  xU: number;
  yU: number;
}) {
  return (
    <div
      className="absolute z-30 pointer-events-none"
      style={{
        left: pctX(xU),
        top: pctY(yU),
        transform: "translate(-50%, -50%)",
      }}
    >
      <div
        className="rounded-full border border-white/25 bg-black/40 backdrop-blur-sm flex items-center justify-center text-white font-semibold shadow-xl"
        style={{
          width: "clamp(26px, 3.2vw, 36px)",
          height: "clamp(26px, 3.2vw, 36px)",
        }}
      >
        <span className="text-[12px]">{amount}</span>
      </div>
    </div>
  );
}

export default function SimulatorPage() {
  const [wheel, setWheel] = useState<Wheel>("EU");
  const [chip, setChip] = useState<number>(5);
  const [mode, setMode] = useState<"place" | "remove">("place");
  const [bets, setBets] = useState<BetState>({});
  const [spins, setSpins] = useState<number>(200);
  const [lastOutcomes, setLastOutcomes] = useState<number[]>([]);
  const [pnl, setPnl] = useState<number>(0);

  const spots = useMemo(() => buildSpots(), []);

  const stake = useMemo(() => sumStake(bets), [bets]);

  function placeOnSpot(s: Spot) {
    setBets((prev) => {
      const next = { ...prev };
      const cur = next[s.id] ?? 0;
      if (mode === "place") next[s.id] = cur + chip;
      else next[s.id] = Math.max(0, cur - chip);

      if (next[s.id] === 0) delete next[s.id];
      return next;
    });
  }

  function resetBets() {
    setBets({});
    setPnl(0);
    setLastOutcomes([]);
  }

  function spinOnce() {
    const out =
      wheel === "EU" ? randInt(37) : randInt(38); // US: 0..37 where 37 = "00"
    setLastOutcomes((prev) => [out, ...prev].slice(0, 24));

    const net = computeNetForSpin(out, wheel, spots, bets);
    setPnl((p) => p + net);
  }

  function simulateMany() {
    const n = clampInt(spins || 0, 1, 20000);
    let localPnl = 0;
    const outs: number[] = [];

    for (let i = 0; i < n; i++) {
      const out = wheel === "EU" ? randInt(37) : randInt(38);
      outs.push(out);
      localPnl += computeNetForSpin(out, wheel, spots, bets);
    }

    setPnl((p) => p + localPnl);
    setLastOutcomes((prev) => [...outs.slice(-24).reverse(), ...prev].slice(0, 24));
  }

  // Visual helpers
  function cellBgForNumber(n: number) {
    if (n === 0) return "bg-emerald-700/90";
    return RED_NUMBERS.has(n) ? "bg-red-700/90" : "bg-neutral-950/90";
  }

  const houseEdge = wheel === "EU" ? 2.70 : 5.26;

  return (
    <div className="min-h-screen text-white">
      {/* premium casino background */}
      <div className="fixed inset-0 -z-10 bg-[#07070a]" />
      <div className="fixed inset-0 -z-10 opacity-90 bg-[radial-gradient(1200px_700px_at_20%_10%,rgba(255,215,120,0.12),transparent_55%),radial-gradient(900px_600px_at_80%_20%,rgba(90,255,170,0.10),transparent_60%),radial-gradient(900px_650px_at_40%_90%,rgba(170,120,255,0.10),transparent_60%)]" />

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        {/* Header */}
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-6 shadow-2xl">
          <div className="flex items-start justify-between gap-6 flex-wrap">
            <div>
              <div className="inline-flex items-center gap-2 text-xs text-white/70">
                <span className="px-2 py-1 rounded-full border border-amber-300/30 bg-amber-300/10">
                  CASINO LAB
                </span>
                <span className="px-2 py-1 rounded-full border border-white/10 bg-white/5">
                  {wheel === "EU" ? "European (0) • 37" : "American (0 + 00) • 38"}
                </span>
              </div>
              <h1 className="mt-3 text-3xl md:text-4xl font-semibold tracking-tight">
                Roulette Simulator{" "}
                <span className="text-white/45">— premium table + bets</span>
              </h1>
              <p className="mt-2 text-white/65 max-w-3xl">
                Placement précis des jetons sur un <span className="text-white/85">vrai tapis</span> (ordre officiel).
                Splits & corners inclus. Tout est{" "}
                <span className="text-white/85">100% aléatoire</span> — aucune prédiction.
              </p>
            </div>

            <div className="text-right">
              <div className="text-xs text-white/60">House edge (even-money)</div>
              <div className="text-lg font-semibold text-amber-200">{houseEdge.toFixed(2)}%</div>
            </div>
          </div>

          {/* Controls */}
          <div className="mt-6 grid md:grid-cols-12 gap-4 items-end">
            <div className="md:col-span-4">
              <div className="text-xs text-white/60 mb-2">Wheel</div>
              <div className="inline-flex rounded-2xl border border-white/10 bg-black/20 p-1">
                <button
                  onClick={() => setWheel("EU")}
                  className={[
                    "px-3 py-2 rounded-xl text-sm transition",
                    wheel === "EU"
                      ? "bg-amber-400 text-black font-semibold"
                      : "text-white/70 hover:text-white",
                  ].join(" ")}
                >
                  European (0)
                </button>
                <button
                  onClick={() => setWheel("US")}
                  className={[
                    "px-3 py-2 rounded-xl text-sm transition",
                    wheel === "US"
                      ? "bg-amber-400 text-black font-semibold"
                      : "text-white/70 hover:text-white",
                  ].join(" ")}
                >
                  American (0+00)
                </button>
              </div>
              <div className="mt-2 text-[11px] text-white/55">
                US: le “00” est simulé, mais pas encore sur le tapis (on l’ajoute ensuite).
              </div>
            </div>

            <div className="md:col-span-4">
              <div className="text-xs text-white/60 mb-2">Chip</div>
              <div className="flex items-center gap-3 flex-wrap">
                {[1, 2, 5, 10, 25, 50, 100].map((v) => (
                  <Chip key={v} value={v} active={chip === v} onClick={() => setChip(v)} />
                ))}
              </div>
            </div>

            <div className="md:col-span-2">
              <div className="text-xs text-white/60 mb-2">Mode</div>
              <div className="inline-flex rounded-2xl border border-white/10 bg-black/20 p-1">
                <button
                  onClick={() => setMode("place")}
                  className={[
                    "px-3 py-2 rounded-xl text-sm transition",
                    mode === "place"
                      ? "bg-emerald-400 text-black font-semibold"
                      : "text-white/70 hover:text-white",
                  ].join(" ")}
                >
                  Place
                </button>
                <button
                  onClick={() => setMode("remove")}
                  className={[
                    "px-3 py-2 rounded-xl text-sm transition",
                    mode === "remove"
                      ? "bg-red-400 text-black font-semibold"
                      : "text-white/70 hover:text-white",
                  ].join(" ")}
                >
                  Remove
                </button>
              </div>
            </div>

            <div className="md:col-span-2 flex gap-2">
              <button
                onClick={spinOnce}
                className="w-full px-4 py-3 rounded-2xl bg-gradient-to-b from-amber-300 to-amber-500 text-black font-semibold shadow-lg hover:brightness-110"
              >
                Spin
              </button>
              <button
                onClick={resetBets}
                className="px-4 py-3 rounded-2xl border border-white/15 bg-white/5 hover:bg-white/10"
              >
                Reset
              </button>
            </div>

            <div className="md:col-span-12">
              <div className="mt-2 rounded-2xl border border-white/10 bg-black/25 px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
                <div className="text-sm text-white/70">
                  Stake: <span className="text-white font-semibold">{stake}€</span> • P&L:{" "}
                  <span className={pnl >= 0 ? "text-emerald-300 font-semibold" : "text-red-300 font-semibold"}>
                    {pnl >= 0 ? "+" : ""}
                    {pnl.toFixed(0)}€
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <div className="text-xs text-white/60 mr-2">Simulate</div>
                  <input
                    value={spins}
                    onChange={(e) => setSpins(parseInt(e.target.value || "0", 10))}
                    className="w-28 rounded-xl bg-black/30 border border-white/10 px-3 py-2 text-sm"
                    inputMode="numeric"
                  />
                  <button
                    onClick={simulateMany}
                    className="px-4 py-2 rounded-2xl border border-white/15 bg-white/5 hover:bg-white/10"
                  >
                    Run
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Felt */}
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-6 shadow-2xl">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="text-sm text-white/70">
              <span className="text-white/85 font-semibold">Tip :</span> les séries longues arrivent au hasard.
              “Ça fait 10 noirs” ne change pas la proba du prochain spin.
            </div>
            <div className="text-xs text-white/60">
              Hover = zones de bet (splits/corners). Click = {mode === "place" ? "ajoute" : "retire"} {chip}€.
            </div>
          </div>

          <div className="mt-5">
            {/* board uses 14x5 unit system -> aspect ratio 14/5 */}
            <div
              className="relative mx-auto rounded-3xl overflow-hidden border border-white/15 shadow-[0_30px_120px_rgba(0,0,0,0.55)]"
              style={{
                width: "min(100%, 980px)",
                aspectRatio: "14 / 5",
                background:
                  "radial-gradient(1200px 600px at 30% 20%, rgba(255,255,255,0.08), transparent 55%), radial-gradient(1000px 600px at 80% 70%, rgba(0,0,0,0.35), transparent 60%), linear-gradient(180deg, rgba(7,45,25,0.95), rgba(5,25,16,0.95))",
              }}
            >
              {/* Subtle felt grain */}
              <div className="absolute inset-0 opacity-[0.18] [background-image:radial-gradient(rgba(255,255,255,0.12)_1px,transparent_1px)] [background-size:10px_10px]" />

              {/* 0 cell */}
              <button
                onClick={() => placeOnSpot(spots.find((s) => s.id === "straight:0")!)}
                className="absolute z-10 flex items-center justify-center font-semibold text-white/95 border border-white/35"
                style={styleFromRect({ x: 0, y: 0, w: 1, h: 3 })}
              >
                <div className="absolute inset-0 bg-emerald-700/90" />
                <div className="relative text-lg">0</div>
              </button>

              {/* number cells */}
              {Array.from({ length: 3 }).map((_, row) =>
                Array.from({ length: 12 }).map((__, idx) => {
                  const col = idx + 1; // 1..12
                  const n = numAt(col, row);
                  const bg = cellBgForNumber(n);
                  const spotId = `straight:${n}`;
                  return (
                    <button
                      key={`${row}-${col}`}
                      onClick={() => placeOnSpot(spots.find((s) => s.id === spotId)!)}
                      className="absolute z-10 flex items-center justify-center font-semibold text-white/95 border border-white/35 hover:brightness-110 transition"
                      style={styleFromRect({ x: col, y: row, w: 1, h: 1 })}
                      title={`Straight ${n}`}
                    >
                      <div className={`absolute inset-0 ${bg}`} />
                      <div className="relative text-sm md:text-base">{n}</div>
                    </button>
                  );
                })
              )}

              {/* 2to1 column buttons */}
              {Array.from({ length: 3 }).map((_, row) => {
                const spotId = `column:${row}`;
                return (
                  <button
                    key={spotId}
                    onClick={() => placeOnSpot(spots.find((s) => s.id === spotId)!)}
                    className="absolute z-10 flex items-center justify-center font-semibold text-white/90 border border-white/35 hover:brightness-110 transition"
                    style={styleFromRect({ x: 13, y: row, w: 1, h: 1 })}
                    title="Column 2 to 1"
                  >
                    <div className="absolute inset-0 bg-emerald-800/85" />
                    <div className="relative text-[11px] md:text-xs">2to1</div>
                  </button>
                );
              })}

              {/* Dozens row */}
              {(["dozen:1", "dozen:2", "dozen:3"] as const).map((id) => {
                const s = spots.find((x) => x.id === id)!;
                return (
                  <button
                    key={id}
                    onClick={() => placeOnSpot(s)}
                    className="absolute z-10 flex items-center justify-center font-semibold text-white/90 border border-white/35 hover:brightness-110 transition"
                    style={styleFromRect(s.rect)}
                    title={s.label}
                  >
                    <div className="absolute inset-0 bg-emerald-900/70" />
                    <div className="relative text-[12px] md:text-sm">{s.label}</div>
                  </button>
                );
              })}

              {/* Outside row */}
              {(["out:low", "out:even", "out:red", "out:black", "out:odd", "out:high"] as const).map((id) => {
                const s = spots.find((x) => x.id === id)!;
                const special =
                  id === "out:red"
                    ? "bg-red-700/85"
                    : id === "out:black"
                    ? "bg-neutral-950/85"
                    : "bg-emerald-900/70";
                return (
                  <button
                    key={id}
                    onClick={() => placeOnSpot(s)}
                    className="absolute z-10 flex items-center justify-center font-semibold text-white/90 border border-white/35 hover:brightness-110 transition"
                    style={styleFromRect(s.rect)}
                    title={s.label}
                  >
                    <div className={`absolute inset-0 ${special}`} />
                    <div className="relative text-[12px] md:text-sm">{s.label}</div>
                  </button>
                );
              })}

              {/* SPLITS + CORNERS hotspots (transparent but highlight on hover) */}
              {spots
                .filter((s) => s.kind === "split" || s.kind === "corner")
                .map((s) => (
                  <button
                    key={s.id}
                    onClick={() => placeOnSpot(s)}
                    className={[
                      "absolute z-20",
                      "bg-transparent",
                      "hover:outline hover:outline-2 hover:outline-amber-300/80",
                      "hover:bg-amber-300/10",
                      "transition",
                    ].join(" ")}
                    style={styleFromRect(s.rect)}
                    title={
                      s.kind === "split"
                        ? `Split ${s.numbers.join("/")}`
                        : `Corner ${s.numbers.join("-")}`
                    }
                  />
                ))}

              {/* Chips */}
              {Object.entries(bets).map(([id, amount]) => {
                if (!amount) return null;
                const spot = spots.find((s) => s.id === id);
                if (!spot) return null;
                return <PlacedChip key={id} amount={amount} xU={spot.anchor.x} yU={spot.anchor.y} />;
              })}
            </div>

            {/* Last outcomes */}
            <div className="mt-5 rounded-2xl border border-white/10 bg-black/25 px-4 py-3">
              <div className="text-xs text-white/60 mb-2">Last spins</div>
              <div className="flex flex-wrap gap-2">
                {lastOutcomes.length === 0 ? (
                  <span className="text-sm text-white/60">Aucun spin encore.</span>
                ) : (
                  lastOutcomes.map((n, i) => {
                    const c = colorOf(n, wheel);
                    const pill =
                      c === "red"
                        ? "bg-red-500/20 border-red-300/30 text-red-100"
                        : c === "black"
                        ? "bg-white/5 border-white/15 text-white/85"
                        : "bg-emerald-500/20 border-emerald-300/30 text-emerald-100";
                    return (
                      <span
                        key={`${n}-${i}`}
                        className={[
                          "px-3 py-1 rounded-full border text-sm",
                          pill,
                        ].join(" ")}
                      >
                        {formatOutcome(n, wheel)}
                      </span>
                    );
                  })
                )}
              </div>
              <div className="mt-2 text-[11px] text-white/50">
                (Prochain upgrade: ajouter la zone “00” sur le tapis US + streets/six-lines + voisins/orphelins.)
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
