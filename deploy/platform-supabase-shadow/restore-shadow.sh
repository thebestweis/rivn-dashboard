#!/bin/sh
set -eu

script_dir=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
# shellcheck disable=SC1091
. "$script_dir/common.sh"

require_command docker
require_command sha256sum
require_shadow

[ $# -eq 1 ] || die "Usage: restore-shadow.sh /absolute/path/to/source-dump"
dump_dir=$(CDPATH='' cd -- "$1" 2>/dev/null && pwd) || die "Source dump directory does not exist"

for file in EXPORT_COMPLETE SHA256SUMS roles.sql schema.sql data.sql source-counts.txt; do
  [ -f "$dump_dir/$file" ] || die "Missing source dump file: $file"
done

if [ -f "$RIVN_PLATFORM_SHADOW_ROOT/.restore-complete" ]; then
  die "Shadow database was already restored. Recreate a fresh shadow before importing again."
fi

(
  cd "$dump_dir"
  sha256sum -c SHA256SUMS
)

log "Starting only the isolated shadow database"
compose up -d --wait db

public_tables=$(compose exec -T db psql -U postgres -d postgres -X -Atc \
  "select count(*) from pg_tables where schemaname = 'public' and tablename <> 'spatial_ref_sys';")
auth_users=0
auth_users_exists=$(compose exec -T db psql -U postgres -d postgres -X -Atc \
  "select to_regclass('auth.users') is not null;")

if [ "$auth_users_exists" = "t" ]; then
  auth_users=$(compose exec -T db psql -U postgres -d postgres -X -Atc \
    "select count(*) from auth.users;")
fi

existing_rows=$((public_tables + auth_users))

[ "$existing_rows" = "0" ] || die \
  "Shadow database is not empty (guard value: $existing_rows); import refused"

log "Restoring roles, schema, application data, and Auth users"
{
  cat "$dump_dir/roles.sql"
  cat "$dump_dir/schema.sql"
  printf '\nSET session_replication_role = replica;\n'
  cat "$dump_dir/data.sql"
} | compose exec -T db psql \
  --single-transaction \
  --variable ON_ERROR_STOP=1 \
  --username postgres \
  --dbname postgres

target_counts=$(mktemp)
trap 'rm -f "$target_counts"' EXIT HUP INT TERM

compose exec -T db psql \
  --username postgres \
  --dbname postgres \
  -X \
  -v ON_ERROR_STOP=1 \
  -f - < "$script_dir/source-counts.sql" > "$target_counts"

LC_ALL=C sort -o "$target_counts" "$target_counts"

if ! diff -u "$dump_dir/source-counts.txt" "$target_counts"; then
  die "Source and shadow row counts differ; full stack was not started"
fi

umask 077
{
  printf 'source_dump=%s\n' "$dump_dir"
  printf 'restored_at=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
} > "$RIVN_PLATFORM_SHADOW_ROOT/.restore-complete"
chmod 600 "$RIVN_PLATFORM_SHADOW_ROOT/.restore-complete"

log "Row counts match. Starting the complete isolated shadow stack"
compose up -d --wait

trap - EXIT HUP INT TERM
rm -f "$target_counts"

log "Shadow restore completed and verified"
log "Production configuration was not changed"
