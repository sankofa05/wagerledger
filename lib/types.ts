export type MarketPoint = {
  date: string;      // YYYY-MM
  value: number;     // metric value
};

export type MarketSeries = {
  id: "FR_ONLINE" | "UK_ONLINE" | "NV_REVENUE";
  label: string;
  unit: string;
  points: MarketPoint[];
  sourceNote: string;
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
