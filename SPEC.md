# Barathon — spec v1

Site pour noter les bars entre potes. URL : https://barathon.jimmydore.fr — dépôt public `JimmyDore/barathon`.

## Produit

### Public et usage
- Entre potes, lien partagé. Non indexé : `<meta name="robots" content="noindex">`, `robots.txt` en `Disallow: /`, en-tête `X-Robots-Tag: noindex`.
- Mobile-first (on note depuis le bar). Interface en français, tutoiement, ton décontracté.
- Pas de comptes. Champ « Prénom ou pseudo » obligatoire, texte libre, mémorisé dans le navigateur (localStorage, lecture/écriture dans un try/catch).

### Une note = un passage
Un passage = une personne, un bar, une date (par défaut aujourd'hui, fuseau Europe/Paris, modifiable). On peut noter le même bar plusieurs fois.

Formulaire :

| Bloc | Critère | Valeur |
|---|---|---|
| Lieu | Beauté | 1–5, facultatif |
| Lieu | Emplacement | 1–5, facultatif |
| Lieu | Terrasse | « pas de terrasse » **ou** 1–5, facultatif |
| Bière | Choix de bières | 1–5, facultatif |
| Bière | Qualité de la bière | 1–5, facultatif |
| Moment | La soirée | 1–5, **obligatoire** |
| — | Ambiances | multi-choix dans une liste fixe : chill, festif, bruyant, cosy, dansant, match/sport, afterwork, date, jeux |
| — | Mon humeur | 😫 😕 😐 🙂 🤩 (1–5), facultatif. Affichée à côté du passage, **jamais comptée** dans les notes |
| — | Prix de la pinte | libellé « pinte 50 cl, en € », facultatif, stocké en centimes |
| — | Commentaire | texte court (≤ 280 caractères), facultatif |

Les critères facultatifs ont un état « pas testé » (null). Gros boutons tactiles pour les notes.

### Calcul des notes
- Pour un bar : chaque critère = moyenne de ses valeurs renseignées sur tous les passages. Bloc = moyenne des critères renseignés du bloc. Note du bar = moyenne des blocs non vides (Lieu, Bière, Moment pèsent pareil).
- Terrasse : « pas de terrasse » n'entre dans aucune moyenne. La fiche bar affiche si le bar a une terrasse (majorité des passages qui l'ont renseignée), et c'est un filtre.
- Pour un passage seul : même formule sur ce passage.
- L'humeur n'entre dans aucun calcul.

### Choisir le bar (écran « Noter un bar »)
1. **Autour de moi** : si la géolocalisation est autorisée, les 5 bars les plus proches dans un rayon de ~200 m (OSM + nos bars déjà en base, dédoublonnés), en un tap.
2. **Recherche** : Photon (https://photon.komoot.io), autocomplétion avec debounce, biaisée autour de la position (ou du centre de la carte). Types retenus : `amenity` = bar, pub, cafe, biergarten, nightclub, restaurant. Nos bars en base (y compris ajoutés à la main) apparaissent aussi dans les résultats.
3. **Bar introuvable** : on saisit le nom ; une épingle est posée à la position du téléphone, déplaçable sur une carte avant de valider (si la géoloc est refusée, l'épingle part du centre de la carte). Avant de créer, si un bar en base est à moins de 50 m : « Il y a déjà *X* à 30 m, c'est pas celui-là ? ».

La recherche et le « autour de moi » sont isolés derrière un module fournisseur (`search provider`) pour pouvoir passer plus tard à Geoapify ou Google en ne touchant qu'un fichier. Nos bars ont notre propre id + `source` (`osm` | `manual`) + `source_id` (ex. `node/123456`).

### Pages
- **Accueil `/`** : carte plein écran (MapLibre GL JS + tuiles OpenFreeMap, style sombre), une pastille par bar colorée selon sa note. Bouton flottant « Noter un bar ». Bascule carte ⇄ classement (liste des bars triée par note). Filtres : terrasse, ambiances, prix max de la pinte. Carte centrée sur la position de l'utilisateur, sinon sur la zone Nantes – La Roche-sur-Yon (~46.95, -1.50, zoom 9). Mention « © OpenStreetMap contributors » visible.
- **Fiche bar** : nom, adresse, notes par bloc et globale, ambiances les plus citées, prix moyen de la pinte, terrasse, liste des passages (pseudo, date, note du passage, humeur, commentaire). Bouton « Noter ce bar ».
- **Barathoniens** : classement des pseudos (nombre de bars distincts, puis nombre de passages). Page par pseudo : ses passages. Les pseudos sont regroupés sans tenir compte de la casse, des espaces autour ni des accents.
- **Admin `/admin`** : connexion par mot de passe (`ADMIN_PASSWORD`), cookie httpOnly signé. Modifier/supprimer n'importe quel passage, renommer/déplacer/supprimer un bar, fusionner deux bars (les passages de A passent sur B, A est supprimé).

### Corrections par l'auteur
À la création d'un passage, le serveur renvoie un jeton secret ; le navigateur le garde (localStorage). Avec ce jeton, l'auteur peut modifier ou supprimer son passage depuis ce navigateur. Le serveur ne stocke que le hash du jeton.

### Anti-spam
Champ piège invisible (si rempli, on fait semblant d'accepter et on jette). Limite de créations par IP en mémoire (ex. 20 passages / 10 min). Les IP ne sont jamais stockées en base.

### Style
Fond ardoise sombre, ambre bière en couleur d'accent, gros boutons tactiles, petite animation à la validation d'une note (mousse / pinte qui se remplit). Thème clair automatique si le téléphone est en clair (`prefers-color-scheme`). Doit tenir à 360 px de large sans scroll horizontal.

### Hors périmètre v1
Soirée barathon (regrouper les bars d'une nuit, trajet), prix happy hour, photos, comptes, multi-langue.

## Technique

- SvelteKit (TypeScript) + `@sveltejs/adapter-node`, Node 24.
- SQLite via `better-sqlite3`, fichier `${DATA_DIR}/barathon.db`, mode WAL, migrations appliquées au démarrage.
- Carte : MapLibre GL JS + OpenFreeMap. Recherche : Photon. Autour de moi : Photon `/reverse` filtré ou Overpass, selon ce qui est le plus rapide et fiable.
- Tests : Vitest (`npm test`) — au minimum calcul des notes, validation du formulaire, jetons, limite de débit. `npm run check` (svelte-check) sans erreur.

## Contrat de déploiement

| Élément | Valeur |
|---|---|
| Build | `npm ci && npm run build` → dossier `build/` |
| Démarrage | `node build` |
| Variables | `PORT=3000`, `HOST=0.0.0.0`, `ORIGIN=https://barathon.jimmydore.fr`, `DATA_DIR=/data`, `ADMIN_PASSWORD`, `ADDRESS_HEADER=X-Forwarded-For`, `XFF_DEPTH=1`, `TZ=Europe/Paris` |
| Santé | `GET /health` → 200 `{"ok":true}` |
| Container | `barathon-web`, réseau Docker externe `ravetycoon_default`, aucun port publié, utilisateur `node` (uid 1000) |
| Données | `/root/barathon-data` monté sur `/data` |
| Proxy | Caddy de RaveTycoon : `barathon.jimmydore.fr { reverse_proxy barathon-web:3000 }` |
| CI/CD | GitHub Actions sur push `main` : tests → SSH `root@77.42.23.215` → clone/pull dans `/root/barathon` → `docker compose up -d --build` → check `https://barathon.jimmydore.fr/health` |
| Sauvegarde | chaque nuit, snapshot cohérent de la base puis rclone vers R2 `hetzner-backups/barathon/<date>/`, rétention 365 jours, Slack en cas d'échec |
