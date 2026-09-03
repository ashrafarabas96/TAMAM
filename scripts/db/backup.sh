#!/usr/bin/env bash
# =====================================================================
# TAMAM — database backup.
#
#   bash scripts/db/backup.sh                       # → ./backups/tamam-<ts>.dump
#   BACKUP_DIR=/var/backups/tamam bash scripts/db/backup.sh
#   BACKUP_S3_BUCKET=tamam-backups bash scripts/db/backup.sh    # also uploads
#
# Uses pg_dump's custom format (-Fc): compressed, parallel-restorable and the
# only format `pg_restore` can filter. RPO/RTO targets and the retention policy
# are documented in docs/OPERATIONS.md.
# =====================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT/apps/api/.env}"
if [ -f "$ENV_FILE" ]; then
  # shellcheck disable=SC1090
  set -a; . "$ENV_FILE"; set +a
fi

DATABASE_URL="${DATABASE_URL:?DATABASE_URL is required}"
BACKUP_DIR="${BACKUP_DIR:-$ROOT/backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
TARGET="$BACKUP_DIR/tamam-$TIMESTAMP.dump"

command -v pg_dump >/dev/null 2>&1 || { echo "pg_dump is not installed" >&2; exit 1; }
mkdir -p "$BACKUP_DIR"

echo "==> Dumping to $TARGET"
# --no-owner/--no-acl keep the dump restorable into a differently-owned database.
pg_dump --format=custom --compress=9 --no-owner --no-acl --file "$TARGET" "$DATABASE_URL"

SIZE="$(du -h "$TARGET" | awk '{print $1}')"
echo "    wrote $SIZE"

echo "==> Verifying the archive is readable"
pg_restore --list "$TARGET" >/dev/null
TABLES="$(pg_restore --list "$TARGET" | grep -c 'TABLE DATA' || true)"
echo "    archive is valid, $TABLES tables with data"

# Fail loudly rather than silently shipping an empty backup.
if [ "$TABLES" -lt 20 ]; then
  echo "ERROR: only $TABLES tables in the dump — refusing to treat this as a good backup" >&2
  exit 1
fi

sha256sum "$TARGET" > "$TARGET.sha256" 2>/dev/null || shasum -a 256 "$TARGET" > "$TARGET.sha256"
echo "    checksum written to $TARGET.sha256"

# ---------------------------------------------------------------- offsite
if [ -n "${BACKUP_S3_BUCKET:-}" ]; then
  echo "==> Uploading to s3://$BACKUP_S3_BUCKET/"
  if command -v aws >/dev/null 2>&1; then
    AWS_ARGS=()
    [ -n "${BACKUP_S3_ENDPOINT:-}" ] && AWS_ARGS+=(--endpoint-url "$BACKUP_S3_ENDPOINT")
    aws "${AWS_ARGS[@]}" s3 cp "$TARGET" "s3://$BACKUP_S3_BUCKET/$(basename "$TARGET")"
    aws "${AWS_ARGS[@]}" s3 cp "$TARGET.sha256" "s3://$BACKUP_S3_BUCKET/$(basename "$TARGET").sha256"
  elif command -v mc >/dev/null 2>&1; then
    mc alias set tamam-backup "${BACKUP_S3_ENDPOINT:?BACKUP_S3_ENDPOINT is required for mc}" "${BACKUP_S3_ACCESS_KEY:?}" "${BACKUP_S3_SECRET_KEY:?}" >/dev/null
    mc cp "$TARGET" "tamam-backup/$BACKUP_S3_BUCKET/"
    mc cp "$TARGET.sha256" "tamam-backup/$BACKUP_S3_BUCKET/"
  else
    echo "ERROR: neither the aws CLI nor mc is available for the offsite copy" >&2
    exit 1
  fi
  echo "    uploaded"
fi

echo "==> Pruning local backups older than $RETENTION_DAYS days"
find "$BACKUP_DIR" -name 'tamam-*.dump*' -type f -mtime "+$RETENTION_DAYS" -print -delete || true

echo "Backup complete: $TARGET"
