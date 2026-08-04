#!/bin/sh
set -eu

script_dir=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
# shellcheck disable=SC1091
. "$script_dir/common.sh"

require_command docker

[ -n "${RIVN_PLATFORM_SOURCE_DB_URL:-}" ] || die \
  "Set RIVN_PLATFORM_SOURCE_DB_URL to the Supabase Session Pooler connection string"

case "$RIVN_PLATFORM_SOURCE_DB_URL" in
  *'[YOUR-PASSWORD]'*|*'%5BYOUR-PASSWORD%5D'*|*'<YOUR-PASSWORD>'*)
    die "Replace the password placeholder in the Session Pooler connection string"
    ;;
esac

export RIVN_PLATFORM_SOURCE_DB_URL

log "Checking the source database connection without exporting data"
if ! docker run --rm --network host \
  -e RIVN_PLATFORM_SOURCE_DB_URL \
  -e PGCONNECT_TIMEOUT=15 \
  postgres:17-alpine \
  sh -c 'exec psql "$RIVN_PLATFORM_SOURCE_DB_URL" -X -v ON_ERROR_STOP=1 -Atq' <<'SQL'
SELECT 'connection=ok';
SELECT 'public_tables=' || count(*) FROM pg_tables WHERE schemaname = 'public';
SELECT 'auth_users=' || count(*) FROM auth.users;
SQL
then
  die "Source database connection failed. Verify Session Pooler port 5432 and the database password"
fi

log "Source database connection is ready for export"
