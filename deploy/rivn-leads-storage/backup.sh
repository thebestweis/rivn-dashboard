#!/bin/sh
set -eu

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
env_file="$script_dir/.env"
backup_dir=${RIVN_LEADS_BACKUP_DIR:-/var/backups/rivn-leads}
retention_days=${RIVN_LEADS_BACKUP_RETENTION_DAYS:-14}

case "$backup_dir" in
  /var/backups/rivn-leads|/opt/rivn-leads-backups) ;;
  *)
    echo "Refusing unsupported backup directory: $backup_dir" >&2
    exit 1
    ;;
esac

if [ ! -f "$env_file" ]; then
  echo "Missing $env_file" >&2
  exit 1
fi

set -a
. "$env_file"
set +a

mkdir -p "$backup_dir"
chmod 700 "$backup_dir"
umask 077

timestamp=$(date -u +%Y%m%dT%H%M%SZ)
temporary="$backup_dir/.rivn-leads-$timestamp.dump.tmp"
destination="$backup_dir/rivn-leads-$timestamp.dump"

docker compose \
  --env-file "$env_file" \
  -f "$script_dir/docker-compose.yml" \
  exec -T postgres \
  pg_dump \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  --format custom \
  --no-owner \
  --no-privileges > "$temporary"

mv "$temporary" "$destination"
find "$backup_dir" -maxdepth 1 -type f -name 'rivn-leads-*.dump' \
  -mtime "+$retention_days" -delete

if [ -n "${RIVN_LEADS_BACKUP_REMOTE:-}" ]; then
  rsync -az -- "$destination" "$RIVN_LEADS_BACKUP_REMOTE"
fi

echo "Backup created: $destination"
