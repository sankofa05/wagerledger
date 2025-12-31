# CasinoScope (starter)

Un starter **Next.js + Tailwind + Recharts** pour un site "mix" :
- **Observatoire marché** (dashboards à partir de données publiques)
- **Tracker perso** (journal de sessions + stats), stocké localement

## Démarrage

```bash
npm install
npm run dev
```

Puis ouvre http://localhost:3000

## Où brancher des données publiques

Cette V1 sert un **jeu de données exemple** via `/api/market`.

Pour faire de la vraie data :
- soit tu mets un job d’import (CSV/Excel/PDF -> JSON)
- soit tu ajoutes une page “Sources” + téléchargements
- soit tu fais une ingestion manuelle (upload CSV côté navigateur)

## Disclaimer

Ce projet est orienté **data/éducation** et **suivi responsable**.
Aucune promesse de gains, aucune “prédiction”.
