#!/usr/bin/env bash
# Sauvegarde nocturne de la base barathon vers Cloudflare R2.
#
# Lancé par /etc/cron.d/barathon-backup (installé par la CI seulement si les
# secrets R2 sont présents). Rien n'est installé sur l'hôte : rclone tourne
# dans un conteneur éphémère, configuré par les variables RCLONE_CONFIG_R2_*
# du fichier $BACKUP_ENV_FILE.
#
#   1. snapshot cohérent de la base SQLite, pris DANS le conteneur par
#      `node scripts/backup.mjs` (API backup de SQLite : pas de copie d'un
#      fichier WAL à moitié écrit)
#   2. copie du snapshot vers r2:$R2_BUCKET/$R2_PREFIX/<YYYYMMDD_HHMMSS>/barathon.db
#   3. supprime les objets de plus de 365 jours sous ce préfixe uniquement
#   4. supprime le snapshot local (même en cas d'échec)
#
# Logs sur stdout/stderr (le cron les redirige). Message Slack uniquement
# en cas d'échec.
set -euo pipefail

CONTAINER="${CONTAINER:-barathon-web}"
DATA_DIR="${DATA_DIR:-/root/barathon-data}"
BACKUP_ENV_FILE="${BACKUP_ENV_FILE:-/root/.barathon-backup.env}"
R2_BUCKET="${R2_BUCKET:-hetzner-backups}"
R2_PREFIX="${R2_PREFIX:-barathon}"
RCLONE_IMAGE="rclone/rclone:1"
RETENTION="365d"
# /data dans le conteneur == $DATA_DIR sur l'hôte.
SNAPSHOT_NAME="snapshot.db"

DATE="$(date +%Y%m%d_%H%M%S)"
STEP="initialisation"
SLACK_WEBHOOK_URL=""

log() {
  printf '%s %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"
}

cleanup_snapshot() {
  rm -f "$DATA_DIR/$SNAPSHOT_NAME" "$DATA_DIR/$SNAPSHOT_NAME-wal" \
    "$DATA_DIR/$SNAPSHOT_NAME-shm" "$DATA_DIR/$SNAPSHOT_NAME-journal"
}

on_exit() {
  local status=$?
  cleanup_snapshot || true
  if [ "$status" -ne 0 ]; then
    log "ÉCHEC de la sauvegarde (étape : $STEP, code $status)" >&2
    if [ -n "$SLACK_WEBHOOK_URL" ]; then
      local text="❌ Sauvegarde barathon échouée sur hetzner (étape : $STEP, code $status, $DATE)"
      curl -fsS -X POST -H 'Content-type: application/json' \
        --data "{\"text\":\"$text\"}" "$SLACK_WEBHOOK_URL" \
        || log "Notification Slack impossible" >&2
    else
      log "SLACK_WEBHOOK_URL absent : pas de notification" >&2
    fi
  fi
  exit "$status"
}
trap on_exit EXIT

fail() {
  log "$*" >&2
  exit 1
}

STEP="lecture de la configuration"
[ -r "$BACKUP_ENV_FILE" ] || fail "Fichier $BACKUP_ENV_FILE illisible"
# Lecture littérale (même sémantique que `docker --env-file`), sans exécuter
# le fichier.
SLACK_WEBHOOK_URL="$(sed -n 's/^SLACK_WEBHOOK_URL=//p' "$BACKUP_ENV_FILE" | tail -n 1)"

STEP="vérifications"
case "$R2_BUCKET" in
  '' | */*) fail "R2_BUCKET invalide : '$R2_BUCKET'" ;;
esac
# Le préfixe ne doit jamais être vide : la purge viserait tout le bucket.
case "$R2_PREFIX" in
  '' | /* | */) fail "R2_PREFIX invalide : '$R2_PREFIX'" ;;
esac
[ -d "$DATA_DIR" ] || fail "Dossier de données $DATA_DIR introuvable"
[ "$(docker inspect -f '{{.State.Running}}' "$CONTAINER" 2>/dev/null)" = "true" ] \
  || fail "Conteneur $CONTAINER arrêté ou introuvable"

REMOTE="r2:$R2_BUCKET/$R2_PREFIX"

STEP="snapshot"
cleanup_snapshot
log "Snapshot de la base dans $CONTAINER:/data/$SNAPSHOT_NAME"
docker exec "$CONTAINER" node scripts/backup.mjs "/data/$SNAPSHOT_NAME"
[ -s "$DATA_DIR/$SNAPSHOT_NAME" ] || fail "Snapshot $DATA_DIR/$SNAPSHOT_NAME absent ou vide"

STEP="copie"
log "Copie du snapshot vers $REMOTE/$DATE/barathon.db"
docker run --rm --env-file "$BACKUP_ENV_FILE" \
  -v "$DATA_DIR/$SNAPSHOT_NAME:/snapshot/barathon.db:ro" \
  "$RCLONE_IMAGE" copyto /snapshot/barathon.db "$REMOTE/$DATE/barathon.db"

STEP="purge"
# --use-server-modtime : l'âge est celui de l'upload, pas le mtime du fichier
# source.
log "Purge des objets de plus de $RETENTION sous $REMOTE"
docker run --rm --env-file "$BACKUP_ENV_FILE" \
  "$RCLONE_IMAGE" delete "$REMOTE" --min-age "$RETENTION" --use-server-modtime
docker run --rm --env-file "$BACKUP_ENV_FILE" \
  "$RCLONE_IMAGE" rmdirs "$REMOTE" --leave-root

STEP="terminé"
log "Sauvegarde OK : $REMOTE/$DATE/barathon.db"
