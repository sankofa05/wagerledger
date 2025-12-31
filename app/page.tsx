import Link from "next/link";
import { Card } from "@/components/ui";

export default function Home() {
  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <p className="text-xs uppercase tracking-widest text-white/60">
  Market & Sessions
</p>

<h1 className="text-3xl md:text-5xl font-semibold leading-tight">
  WagerLedger — market data + session tracking.
</h1>

<p className="text-white/70 max-w-2xl">
  A market observatory built on public datasets + a personal session ledger (time, buy-in, cash-out, P&L).
  <br />
  Un observatoire “marché” + un registre de sessions, avec une approche responsable.
</p>

        
        <div className="flex gap-3">
          <Link
            href="/market"
            className="px-4 py-2 rounded-2xl bg-white text-black font-medium shadow-soft"
          >
            Voir le dashboard marché
          </Link>
          <Link
            href="/tracker"
            className="px-4 py-2 rounded-2xl border border-white/20 text-white/90 hover:bg-white/5"
          >
            Ouvrir le tracker
          </Link>
        </div>
      </section>

      <section className="grid md:grid-cols-3 gap-4">
        <Card title="Marché (public)">
          Import JSON/CSV + graphiques. V1 embarque un dataset “sample” (API route), prêt à être remplacé.
        </Card>
        <Card title="Tracker (local)">
          Sessions stockées dans ton navigateur (localStorage). Export JSON possible ensuite.
        </Card>
        <Card title="Responsable">
          Focus statistiques, pas de “prédiction”. Ajoute limites, temps de jeu, alertes et messages RG.
        </Card>
      </section>

      <section className="text-sm text-white/65 space-y-2">
        <p className="font-medium text-white/75">Prochaine étape (facile) :</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Ajouter un import CSV (ANJ/UKGC) et un export CSV/JSON du tracker</li>
          <li>Ajouter un onglet “Sources” + pages par pays + filtres</li>
          <li>Déployer sur Vercel en 2 clics</li>
        </ul>
      </section>
    </div>
  );
}
