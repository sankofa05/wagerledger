export function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-3xl bg-black/25 border border-white/10 p-5 shadow-soft">
      <div className="text-sm font-medium text-white/80">{title}</div>
      <div className="mt-3 text-white/90">{children}</div>
    </div>
  );
}

export function Pill({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "good" | "bad" }) {
  const cls =
    tone === "good"
      ? "bg-white text-black"
      : tone === "bad"
      ? "bg-white/10 text-white"
      : "bg-white/10 text-white/90";
  return <span className={`text-xs px-2 py-1 rounded-full ${cls}`}>{children}</span>;
}
