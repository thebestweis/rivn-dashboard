#!/bin/sh
set -eu

script_dir=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
# shellcheck disable=SC1091
. "$script_dir/common.sh"

require_command docker
require_command npx
require_command sha256sum

[ -n "${RIVN_PLATFORM_SOURCE_DB_URL:-}" ] || die \
  "Set RIVN_PLATFORM_SOURCE_DB_URL to the hosted Supabase direct/session-pooler connection string"

umask 077
timestamp=$(date -u +%Y%m%dT%H%M%SZ)
dump_dir="$RIVN_PLATFORM_SOURCE_BACKUP_ROOT/$timestamp"
mkdir -p "$dump_dir"
chmod 700 "$RIVN_PLATFORM_SOURCE_BACKUP_ROOT" "$dump_dir"

cleanup_failed_export() {
  if [ ! -f "$dump_dir/EXPORT_COMPLETE" ]; then
    printf 'Export did not complete. Partial files remain protected at %s\n' "$dump_dir" >&2
  fi
}
trap cleanup_failed_export EXIT HUP INT TERM

log "Checking direct database access and collecting source counts"
docker run --rm --network host \
  -e RIVN_PLATFORM_SOURCE_DB_URL="$RIVN_PLATFORM_SOURCE_DB_URL" \
  -v "$script_dir/source-counts.sql:/source-counts.sql:ro" \
  postgres:17-alpine \
  sh -c 'psql "$RIVN_PLATFORM_SOURCE_DB_URL" -X -v ON_ERROR_STOP=1 -f /source-counts.sql' \
  > "$dump_dir/source-counts.txt"

LC_ALL=C sort -o "$dump_dir/source-counts.txt" "$dump_dir/source-counts.txt"

log "Exporting hosted Supabase roles"
npx --yes "supabase@$RIVN_PLATFORM_SUPABASE_CLI_VERSION" db dump \
  --db-url "$RIVN_PLATFORM_SOURCE_DB_URL" \
  --file "$dump_dir/roles.sql" \
  --role-only

log "Exporting hosted Supabase schema"
npx --yes "supabase@$RIVN_PLATFORM_SUPABASE_CLI_VERSION" db dump \
  --db-url "$RIVN_PLATFORM_SOURCE_DB_URL" \
  --file "$dump_dir/schema.sql"

log "Exporting hosted Supabase data"
npx --yes "supabase@$RIVN_PLATFORM_SUPABASE_CLI_VERSION" db dump \
  --db-url "$RIVN_PLATFORM_SOURCE_DB_URL" \
  --file "$dump_dir/data.sql" \
  --use-copy \
  --data-only

(
  cd "$dump_dir"
  sha256sum roles.sql schema.sql data.sql source-counts.txt > SHA256SUMS
)

printf 'completed_at=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$dump_dir/EXPORT_COMPLETE"
chmod 600 "$dump_dir"/*
trap - EXIT HUP INT TERM

log "Protected source export completed: $dump_dir"
log "Production Supabase and RIVN OS were not modified"
