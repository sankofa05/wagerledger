import Link from "next/link";

export const metadata = {
  title: "Pack Essentials — SESSION LAB",
  description: "Téléchargements du pack Essentials (PDF + XLSX + JSON).",
};

const downloads = [
  {
    title: "Guide PDF — SESSION LAB Essentials",
    href: "/packs/SESSION_LAB_Essentials.pdf",
    desc: "Le guide (structure, discipline, checklists).",
  },
  {
    title: "Template Excel — Journal de sessions",
    href: "/packs/sessionlab-journal-template.xlsx",
    desc: "Template Sessions + Stats (P&L, ROI, drawdown, etc.).",
  },
  {
    title: "Presets JSON — SessionLab Presets v1",
    href: "/packs/sessionlab-presets-v1.json",
    desc: "Presets à importer (Essentials/Trainer/Pro).",
  },
];

export default function PackEssentialsDownloads() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <div className="text-xs tracking-widest uppercase text-white/60">SESSION LAB</div>
        <h1 className="text-3xl md:text-5xl font-semibold">
          Essentials <span className="text-white/70">— Downloads</span>
        </h1>
        <p className="text-white/70 max-w-2xl">
          Page de livraison (mode test). Prochaine étape : protéger cette page derrière paiement.
        </p>
      </div>

      <div className="grid gap-4">
        {downloads.map((d) => (
          <div
            key={d.href}
            className="rounded-3xl border border-white/10 bg-black/20 p-6 backdrop-blur"
          >
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="space-y-1">
                <div className="text-lg font-semibold">{d.title}</div>
                <div className="text-sm text-white/65">{d.desc}</div>
                <div className="text-xs text-white/45">{d.href}</div>
              </div>

              <a
                href={d.href}
                download
                className="px-4 py-2 rounded-2xl bg-yellow-300 text-black font-medium hover:bg-yellow-200"
              >
                Télécharger
              </a>
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-3 flex-wrap">
        <Link
          href="/packs"
          className="px-4 py-2 rounded-2xl border border-white/15 text-white/80 hover:bg-white/5"
        >
          ← Retour Packs
        </Link>
        <Link
          href="/"
          className="px-4 py-2 rounded-2xl bg-white text-black font-medium hover:bg-white/90"
        >
          Aller au simulateur
        </Link>
      </div>

      <div className="text-xs text-white/55">
        Disclaimer : contenu éducatif & simulation. Aucune promesse de gain.
      </div>
    </div>
  );
}
