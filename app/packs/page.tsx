// app/packs/page.tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "SESSION LAB — Packs",
  description: "Packs one-shot (PDF / XLSX / JSON) pour Session Lab.",
};

type Pack = {
  name: string;
  subtitle: string;
  badge?: string;
  description: string;
  includes: string[];
  files: { label: string; href: string }[];
};

const packs: Pack[] = [
  {
    name: "SESSION LAB — Essentials",
    subtitle: "Guide PDF (sobre, pro, neutre)",
    badge: "One-shot",
    description:
      "Un pack court et clair pour cadrer le suivi, l’approche variance, et une méthode propre (sans promesse, sans bullshit).",
    includes: [
      "Structure de journal de sessions",
      "Principes de variance & discipline",
      "Checklist pré / post-session",
      "Exemples d’usage (responsable)",
    ],
    files: [{ label: "Télécharger le PDF", href: "/packs/SESSION_LAB_Essentials.pdf" }],
  },
  {
    name: "Session Journal Template",
    subtitle: "Template Excel (XLSX)",
    badge: "One-shot",
    description:
      "Un tableau prêt à l’emploi pour logger tes sessions (date, buy-in, cash-out, durée, notes) + champs propres pour l’analyse.",
    includes: [
      "Colonnes clean & lisibles",
      "Prêt à importer/exporter",
      "Compatible Excel / Google Sheets",
    ],
    files: [{ label: "Télécharger le XLSX", href: "/packs/sessionlab-journal-template.xlsx" }],
  },
  {
    name: "Presets v1",
    subtitle: "JSON (présélections / stratégies)",
    badge: "Beta",
    description:
      "Une base de presets pour tester des approches (flat / progressions) dans le simulateur — uniquement pour l’entraînement.",
    includes: [
      "Presets prêts à importer",
      "Structure stable (v1)",
      "Pensé pour le mode “Strategy”",
    ],
    files: [{ label: "Télécharger le JSON", href: "/packs/sessionlab-presets-v1.json" }],
  },
];

function PackCard({ pack }: { pack: Pack }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-black/30 backdrop-blur px-6 py-5 shadow-soft">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-white">{pack.name}</h2>
          <p className="text-sm text-white/70 mt-1">{pack.subtitle}</p>
        </div>

        {pack.badge ? (
          <span className="text-xs px-2.5 py-1 rounded-full border border-white/15 text-white/75 bg-white/5">
            {pack.badge}
          </span>
        ) : null}
      </div>

      <p className="text-sm text-white/70 mt-4 leading-relaxed">{pack.description}</p>

      <div className="mt-4">
        <div className="text-xs uppercase tracking-wide text-white/50">Inclus</div>
        <ul className="mt-2 space-y-1.5">
          {pack.includes.map((x) => (
            <li key={x} className="text-sm text-white/75 flex gap-2">
              <span className="text-white/40">•</span>
              <span>{x}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {pack.files.map((f) => (
          <a
            key={f.href}
            href={f.href}
            className="inline-flex items-center justify-center rounded-2xl px-4 py-2 text-sm font-medium bg-white text-black hover:bg-white/90 transition"
          >
            {f.label}
          </a>
        ))}
      </div>
    </div>
  );
}

export default function PacksPage() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <div className="text-xs uppercase tracking-wide text-white/60">Packs</div>
        <h1 className="text-3xl font-semibold text-white">SESSION LAB — one-shot packs</h1>
        <p className="text-white/70 max-w-3xl">
          Téléchargements directs (PDF / XLSX / JSON). Sobre, pro, neutre.
          <span className="text-white/60"> Aucun conseil de jeu, aucun “edge”.</span>
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        {packs.map((p) => (
          <PackCard key={p.name} pack={p} />
        ))}
      </div>

      <div className="rounded-3xl border border-white/10 bg-black/20 px-6 py-5 text-sm text-white/70">
        <div className="font-medium text-white/85">Note</div>
        <p className="mt-1">
          Tout est destiné à l’éducation / au suivi responsable. Le simulateur et les presets sont là pour visualiser la
          variance et tester des idées sans argent réel.
        </p>
      </div>
    </div>
  );
}
