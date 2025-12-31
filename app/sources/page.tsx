import { Card } from "@/components/ui";

type Source = {
  title: string;
  org: string;
  what: string;
  notes: string;
};

const sources: Source[] = [
  {
    title: "France — ANJ",
    org: "Autorité nationale des jeux",
    what: "Rapports + open data (marché, segments, tendances).",
    notes: "À brancher : datasets data.gouv + dates de MAJ + métriques (PBJ/GGR, joueurs, etc.).",
  },
  {
    title: "UK — Gambling Commission",
    org: "UK Gambling Commission",
    what: "Industry statistics + publications périodiques.",
    notes: "À brancher : fichiers publiés + normalisation mensuel/trimestriel.",
  },
  {
    title: "USA — Nevada Gaming Control Board",
    org: "Nevada GCB",
    what: "Monthly revenue reports.",
    notes: "À brancher : séries mensuelles + comparaisons YoY.",
  },
];

export default function SourcesPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold">Sources</h2>
        <p className="text-white/70 max-w-3xl">
          Datasets et rapports publics utilisés pour la partie “Market”.
          <br />
          Public data sources powering the market dashboard.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {sources.map((s) => (
          <Card key={s.title} title={s.title}>
            <div className="space-y-2 text-sm">
              <p className="text-white/80">
                <span className="text-white/60">Org :</span> {s.org}
              </p>
              <p className="text-white/80">
                <span className="text-white/60">Contenu :</span> {s.what}
              </p>
              <p className="text-white/60">{s.notes}</p>
            </div>
          </Card>
        ))}
      </div>

      <Card title="Disclaimer">
        <p className="text-sm text-white/70">
          Ce site est orienté data/éducation et suivi responsable. Aucune promesse de gains, aucune “prédiction”.
        </p>
      </Card>
    </div>
  );
}
