export type MarketPoint = {
  date: string;      // YYYY-MM
  value: number;     // metric value
};

export type MarketSeries = {
  // ex: "FR_ONLINE", "UK_GGY", "NV_REVENUE" ...
  // string pour permettre l'import CSV/JSON sans recompiler à chaque nouveau dataset.
  id: string;
  label: string;
  unit: string;
  points: MarketPoint[];
  sourceNote?: string;
};

export type Session = {
  id: string;
  date: string; // YYYY-MM-DD
  venue: string;
  game: "Roulette" | "Blackjack" | "Slots" | "Poker" | "Autre";
  buyIn: number;
  cashOut: number;
  durationMinutes: number;
  notes?: string;
};
