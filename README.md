# Barathon

Le site pour noter les bars entre potes : on ouvre le lien depuis le bar, on choisit le bar autour de soi (ou on le cherche, ou on l'ajoute à la main), on note le lieu, la bière et la soirée, et la carte se colore. Pas de comptes : un prénom ou un pseudo suffit. Le site n'est pas indexé par les moteurs de recherche.

Spécification produit et technique : [SPEC.md](SPEC.md). Plan du code pour les contributeurs : [ARCHITECTURE.md](ARCHITECTURE.md).

## Stack

- SvelteKit (Svelte 5, TypeScript) avec `@sveltejs/adapter-node`
- SQLite via `better-sqlite3` (mode WAL, migrations au démarrage)
- Carte : MapLibre GL JS et tuiles OpenFreeMap. Recherche de bars : Photon (données OpenStreetMap)
- Tests : Vitest

## Lancer en local

Il faut Node 22.12 ou plus récent (la prod tourne sous Node 24).

```sh
npm install
npm run dev          # http://localhost:5173
```

La base est créée toute seule dans `./data/barathon.db` (dossier ignoré par git). En dev, sans `ADMIN_PASSWORD`, le mot de passe de `/admin` est `dev` (un avertissement s'affiche dans la console).

La vitrine des composants est sur http://localhost:5173/dev/components (dev uniquement).

Pour tester la version de prod :

```sh
npm run build
ADMIN_PASSWORD=test ORIGIN=http://localhost:3000 node build   # http://localhost:3000
```

## Variables d'environnement

| Variable | Rôle | Défaut |
|---|---|---|
| `PORT` | Port HTTP | `3000` |
| `HOST` | Interface d'écoute | `0.0.0.0` |
| `ORIGIN` | URL publique du site. SvelteKit s'en sert pour refuser les formulaires venus d'ailleurs (CSRF) | aucun, obligatoire avec `node build` |
| `DATA_DIR` | Dossier de la base SQLite (`barathon.db`) | `./data` |
| `ADMIN_PASSWORD` | Mot de passe de `/admin` | obligatoire en prod (le serveur refuse de démarrer sans) ; `dev` en développement |
| `ADDRESS_HEADER`, `XFF_DEPTH` | Lire l'IP du visiteur derrière le proxy (`X-Forwarded-For`, `1`), pour la limite anti-spam. Les IP ne sont jamais stockées | aucun |
| `TZ` | Fuseau du serveur | `Europe/Paris` en prod ; les dates des passages sont toujours calculées à l'heure de Paris |

## Scripts

| Commande | Effet |
|---|---|
| `npm run dev` | Serveur de développement |
| `npm run build` | Build de prod dans `build/` |
| `npm start` | Lance `node build` |
| `npm test` | Tests Vitest (une passe, sans watch) |
| `npm run check` | Vérification TypeScript et Svelte (svelte-check) |
| `node scripts/backup.mjs <fichier>` | Copie cohérente de `${DATA_DIR}/barathon.db` vers `<fichier>`, même site allumé |

## Tests

```sh
npm test
```

Ils couvrent le calcul des notes, la validation du formulaire, les jetons d'auteur, la limite de débit, la session admin, le regroupement des pseudos, la base (sur SQLite en mémoire), le fournisseur de recherche (Photon simulé) et la fusion des résultats avec nos bars.

## Déploiement

Voir [deploy/README.md](deploy/README.md).
