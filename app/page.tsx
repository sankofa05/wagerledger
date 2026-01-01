import Link from "next/link";

type Source = {
  name: string;
  country: string;
  type: "Regulator" | "Data portal" | "Research";
  what: string;
  url: string;
  notes?: string;
};

const SOURCES: Source[] = [
  {
    name: "ANJ — Autorité Nationale des Jeux",
    country: "France",
    type: "Regulator",
    what: "Official regulator publications & reports (FR).",
    url: "https://anj.fr",
    notes: "Start here: publications / rapports / communiqués.",
  },
  {
    name: "UK Gambling Commission (UKGC)",
    country: "United Kingdom",
    type: "Regulator",
    what: "Industry statistics, enforcement updates, compliance info (EN).",
    url: "https://www.gamblingcommission.gov.uk",
    notes: "Look for: statistics / research / industry data.",
  },
  {
    name: "Nevada Gaming Control Board",
    country: "USA (Nevada)",
    type: "Regulator",
    what: "State-level market reporting & public information (EN).",
    url: "https://gaming.nv.gov",
    notes: "Look for: revenue / monthly reports / statistics.",
  },
  {
    name: "New Jersey Division of Gaming Enforcement (DGE)",
    country: "USA (New Jersey)",
    type: "Regulator",
    what: "Public reports & market data (EN).",
    url: "https://www.nj.gov/oag/ge/",
    notes: "Look for: internet gaming / casino reports.",
  },
  {
    name: "MGA — Malta Gaming Authority",
    country: "Malta",
    type: "Regulator",
    what: "Regulatory updates, publications & annual reports (EN).",
    url: "https://www.mga.org.mt",
  },
  {
    name: "Spelinspektionen",
    country: "Sweden",
    type: "Regulator",
    what: "Regulator publications & market info (EN/SE).",
    url: "https://www.spelinspektionen.se",
  },
  {
    name: "OECD Data",
    country: "International",
    type: "Data portal",
    what: "Macro indicators you can correlate with market series (EN).",
    url: "https://data.oecd.org",
    notes: "Optional: useful for context (GDP, inflation, etc.).",
  },
  {
    name: "World Bank Data",
    country: "International",
    type: "Data portal",
    what: "Macro indicators & country series (EN).",
    url: "https://data.worldbank.org",
  },
];

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-white/15 bg-black/20 px-2.5 py-1 text-[11px] text-white/75">
      {children}
    </span>
  );
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-black/20 p-5 shadow-soft">
      <div className="text-sm font-semibold text-white/90">{title}</div>
      <div className="mt-3 text-sm text-white/75">{children}</div>
    </div>
  );
}

export default function SourcesPage() {
  const regulators = SOURCES.filter((s) => s.type === "Regulator");
  const portals = SOURCES.filter((s) => s.type === "Data portal");
  const research = SOURCES.filter((s) => s.type === "Research");

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge>Sources</Badge>
          <Badge>FR/EN</Badge>
          <Badge>Public data</Badge>
        </div>

        <h1 className="text-3xl md:text-5xl font-semibold leading-tight">
          Sources & citations (public) — regulators & data portals
        </h1>

        <p className="max-w-3xl text-white/70">
          Objectif : centraliser des <span className="text-white/85">sources officielles</span> (régulateurs, rapports publics)
          pour alimenter le <span className="text-white/85">Market Observatory</span>.
          <br />
          Goal: keep a clean list of <span className="text-white/85">official sources</span> to support the market dashboard,
          with a responsible approach (no “prediction”, no promise of gains).
        </p>

        <div className="flex flex-wrap gap-3 pt-2">
          <Link
            href="/market"
            className="px-4 py-2 rounded-2xl bg-white text-black font-medium shadow-soft"
          >
            Go to Market
          </Link>
          <Link
            href="/tracker"
            className="px-4 py-2 rounded-2xl border border-white/20 hover:bg-white/5"
          >
            Open Tracker
          </Link>
        </div>
      </div>

      <Card title="How we use sources / Comment on utilise les sources">
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <span className="text-white/85">We only reference public, official sources</span> (regulators, audited publications, public datasets).
          </li>
          <li>
            Chaque série importée dans “Market” doit garder une trace :{" "}
            <span className="text-white/85">source → lien → date/édition → méthode</span>.
          </li>
          <li>
            No forecasting. We focus on descriptive analytics: trends, comparisons, transparency.
          </li>
        </ul>
      </Card>

      <div className="grid gap-4">
        <h2 className="text-xl font-semibold">Regulators (official)</h2>
        <div className="grid md:grid-cols-2 gap-4">
          {regulators.map((s) => (
            <div
              key={s.url}
              className="rounded-3xl border border-white/10 bg-black/20 p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-white/90">
                    {s.name}
                  </div>
                  <div className="mt-1 text-xs text-white/60">
                    {s.country} • {s.type}
                  </div>
                </div>
                <a
                  href={s.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs px-3 py-2 rounded-2xl border border-white/20 hover:bg-white/5"
                >
                  Open
                </a>
              </div>

              <div className="mt-3 text-sm text-white/75">{s.what}</div>
              {s.notes ? (
                <div className="mt-2 text-xs text-white/55">{s.notes}</div>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4">
        <h2 className="text-xl font-semibold">Data portals (context)</h2>
        <div className="grid md:grid-cols-2 gap-4">
          {portals.map((s) => (
            <div
              key={s.url}
              className="rounded-3xl border border-white/10 bg-black/20 p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-white/90">
                    {s.name}
                  </div>
                  <div className="mt-1 text-xs text-white/60">
                    {s.country} • {s.type}
                  </div>
                </div>
                <a
                  href={s.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs px-3 py-2 rounded-2xl border border-white/20 hover:bg-white/5"
                >
                  Open
                </a>
              </div>

              <div className="mt-3 text-sm text-white/75">{s.what}</div>
              {s.notes ? (
                <div className="mt-2 text-xs text-white/55">{s.notes}</div>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      {research.length > 0 ? (
        <div className="grid gap-4">
          <h2 className="text-xl font-semibold">Research (optional)</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {research.map((s) => (
              <div
                key={s.url}
                className="rounded-3xl border border-white/10 bg-black/20 p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold text-white/90">
                      {s.name}
                    </div>
                    <div className="mt-1 text-xs text-white/60">
                      {s.country} • {s.type}
                    </div>
                  </div>
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs px-3 py-2 rounded-2xl border border-white/20 hover:bg-white/5"
                  >
                    Open
                  </a>
                </div>

                <div className="mt-3 text-sm text-white/75">{s.what}</div>
                {s.notes ? (
                  <div className="mt-2 text-xs text-white/55">{s.notes}</div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <Card title="Next upgrades / Prochaines améliorations">
        <ul className="list-disc pl-5 space-y-2">
          <li>
            Add “Sources” tags per imported series in <span className="text-white/85">Market</span> (country, regulator, metric).
          </li>
          <li>
            Create a small “citation block” component: source link + publication date + extraction method.
          </li>
          <li>
            Add a “download links” section per country (PDF/CSV) once you decide exact documents.
          </li>
        </ul>
      </Card>
    </div>
  );
}
