# Déploiement de Barathon

Production : https://barathon.jimmydore.fr, sur le VPS Hetzner `77.42.23.215`
(alias SSH `hetzner`), à côté des autres stacks Docker.

## Comment ça marche

Chaque push sur `main` lance `.github/workflows/deploy.yml` :

1. **test** : `npm ci`, `npm run check`, `npm test` sur Node 24.
2. **deploy** (si les tests passent) :
   - vérifie que `ADMIN_PASSWORD` est présent et ne contient ni antislash ni
     retour à la ligne ;
   - se connecte en SSH à `root@77.42.23.215` avec la clé `DEPLOY_SSH_KEY` ;
   - clone le dépôt public en HTTPS dans `/root/barathon` (ou `git fetch` +
     `git checkout -B main origin/main` s'il existe déjà) ;
   - écrit `/root/barathon/.env` (mode 600, `ADMIN_PASSWORD` seulement) en
     l'envoyant par stdin SSH ;
   - crée `/root/barathon-data` (uid 1000, mode 700) puis
     `docker compose up -d --build` et `docker image prune -f` ;
   - si les secrets R2 sont là, écrit `/root/.barathon-backup.env` et installe
     `/etc/cron.d/barathon-backup` ; sinon, supprime les deux.
3. **health** : attend jusqu'à 150 s que `https://barathon.jimmydore.fr/health`
   réponde 200.

Le conteneur `barathon-web` (image construite par `deploy/Dockerfile`) écoute
sur le port 3000 sans le publier. Il rejoint le réseau Docker externe
`ravetycoon_default`, où le Caddy partagé le trouve par son nom. Les autres
variables (`ORIGIN`, `DATA_DIR=/data`, `ADDRESS_HEADER`, `XFF_DEPTH`, `TZ`…)
sont dans `docker-compose.yml`.

Pour redéployer sans nouveau commit : onglet Actions, « Deploy to Hetzner »,
« Run workflow » (ou `gh workflow run deploy.yml -R JimmyDore/barathon`).

## Secrets GitHub Actions

| Secret | Rôle |
|---|---|
| `DEPLOY_SSH_KEY` | clé privée SSH dédiée (`~/.ssh/deploy_barathon`, commentaire `github-actions-barathon`) ; sa clé publique doit être dans `/root/.ssh/authorized_keys` sur le serveur |
| `DEPLOY_KNOWN_HOSTS` | sortie de `ssh-keyscan -t ed25519,rsa,ecdsa 77.42.23.215` |
| `ADMIN_PASSWORD` | mot de passe de `/admin` (ni antislash ni retour à la ligne) |
| `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | accès au bucket Cloudflare R2 `hetzner-backups` (les mêmes que credit-ado) |
| `SLACK_WEBHOOK_URL` | alerte Slack si une sauvegarde échoue (facultatif) |

Sans les trois secrets R2, le déploiement marche mais les sauvegardes sont
désactivées.

## Ce qui vit hors de ce dépôt

- **DNS** : enregistrement A `barathon.jimmydore.fr → 77.42.23.215` chez IONOS.
- **Reverse proxy / TLS** : la route
  `barathon.jimmydore.fr { reverse_proxy barathon-web:3000 }` est dans
  `deploy/Caddyfile` du dépôt **RaveTycoon**. On la modifie là-bas (commit +
  push, le déploiement de RaveTycoon recrée Caddy), jamais à la main sur le
  serveur : un Caddyfile cassé coupe tous les sites du VPS. Valider avant de
  pousser :
  `docker run --rm -v "$PWD/deploy/Caddyfile:/etc/caddy/Caddyfile:ro" caddy:2-alpine caddy validate --config /etc/caddy/Caddyfile`.
- **Sur le serveur** : `/root/barathon/.env`, `/root/barathon-data/` (la base
  `barathon.db`), `/root/.barathon-backup.env`, `/etc/cron.d/barathon-backup`,
  `/var/log/barathon-backup.log`.

## Sauvegardes

Tous les jours à 02:30 (heure du serveur), `deploy/backup.sh` :

1. demande au conteneur un snapshot cohérent :
   `docker exec barathon-web node scripts/backup.mjs /data/snapshot.db` ;
2. l'envoie avec rclone (conteneur éphémère) vers
   `r2:hetzner-backups/barathon/<AAAAMMJJ_HHMMSS>/barathon.db` ;
3. supprime les sauvegardes de plus de 365 jours sous `barathon/` ;
4. supprime le snapshot local.

Slack n'est prévenu qu'en cas d'échec. Lancer une sauvegarde à la main et lire
les logs :

```sh
ssh hetzner /root/barathon/deploy/backup.sh
ssh hetzner tail -n 50 /var/log/barathon-backup.log
```

## Restaurer une sauvegarde

Sur le serveur (`ssh hetzner`) :

```sh
ENV=/root/.barathon-backup.env

# 1. Lister les sauvegardes et choisir une date
docker run --rm --env-file $ENV rclone/rclone:1 lsd r2:hetzner-backups/barathon

# 2. La télécharger
D=20260918_023000   # à adapter
mkdir -p /root/barathon-restore
docker run --rm --env-file $ENV -v /root/barathon-restore:/restore \
  rclone/rclone:1 copy "r2:hetzner-backups/barathon/$D/" /restore/

# 3. Arrêter l'app et mettre la base actuelle de côté
cd /root/barathon
docker compose stop barathon-web
mkdir -p /root/barathon-data/avant-restauration
mv /root/barathon-data/barathon.db* /root/barathon-data/avant-restauration/

# 4. Mettre la sauvegarde en place (propriétaire uid 1000) et redémarrer
install -o 1000 -g 1000 -m 600 /root/barathon-restore/barathon.db /root/barathon-data/barathon.db
docker compose start barathon-web
curl -fsS https://barathon.jimmydore.fr/health
```

Quand tout est vérifié, supprimer `/root/barathon-restore` et
`/root/barathon-data/avant-restauration`.

## Mot de passe admin

Il est rangé dans le trousseau macOS (session) :

```sh
security find-generic-password -s barathon-admin -w
```

Pour le changer : générer un nouveau mot de passe, le mettre dans le trousseau
(`security add-generic-password -a admin -s barathon-admin -w "$PW" -U`), dans
le secret (`gh secret set ADMIN_PASSWORD -R JimmyDore/barathon`), puis relancer
le workflow.
