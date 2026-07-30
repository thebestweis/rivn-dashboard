#!/bin/sh
set -eu

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
env_file="$script_dir/.env"
dump_file=${RIVN_LEADS_MIGRATION_DUMP:-/var/backups/rivn-leads/source-migration.dump}

if [ -z "${RIVN_LEADS_SOURCE_DATABASE_URL:-}" ]; then
  echo "RIVN_LEADS_SOURCE_DATABASE_URL is required." >&2
  exit 1
fi

if [ ! -f "$env_file" ]; then
  echo "Missing $env_file" >&2
  exit 1
fi

case "$dump_file" in
  /var/backups/rivn-leads/*|/opt/rivn-leads-backups/*) ;;
  *)
    echo "Refusing unsupported migration dump path: $dump_file" >&2
    exit 1
    ;;
esac

set -a
. "$env_file"
set +a

tables="
public.rivn_leads_reader_accounts
public.rivn_leads_source_chat_categories
public.rivn_leads_source_chats
public.rivn_leads_projects
public.rivn_leads_project_source_chats
public.rivn_leads_keywords
public.rivn_leads_stop_words
public.rivn_leads_special_chat_requests
public.rivn_leads_telegram_messages
public.rivn_leads_leads
public.rivn_leads_blocked_authors
public.rivn_leads_processed_messages
public.rivn_leads_delivery_logs
public.rivn_leads_daily_reports
public.rivn_leads_audit_logs
"

target_rows=$(
  docker compose \
    --env-file "$env_file" \
    -f "$script_dir/docker-compose.yml" \
    exec -T postgres \
    psql \
    --username "$POSTGRES_USER" \
    --dbname "$POSTGRES_DB" \
    --tuples-only \
    --no-align \
    --command="
      select sum(row_count)
      from (
        select count(*) as row_count from public.rivn_leads_reader_accounts
        union all select count(*) from public.rivn_leads_projects
        union all select count(*) from public.rivn_leads_source_chats
        union all select count(*) from public.rivn_leads_keywords
        union all select count(*) from public.rivn_leads_leads
      ) counts;
    "
)

if [ "${target_rows:-0}" != "0" ]; then
  echo "Target storage is not empty. Refusing direct restore." >&2
  exit 1
fi

mkdir -p "$(dirname "$dump_file")"
chmod 700 "$(dirname "$dump_file")"
umask 077
temporary="$dump_file.tmp"
rm -f "$temporary"

set -- pg_dump \
  --dbname "$RIVN_LEADS_SOURCE_DATABASE_URL" \
  --format custom \
  --data-only \
  --no-owner \
  --no-privileges

for table in $tables; do
  set -- "$@" --table "$table"
done

docker compose \
  --env-file "$env_file" \
  -f "$script_dir/docker-compose.yml" \
  exec -T postgres \
  "$@" > "$temporary"

mv "$temporary" "$dump_file"

docker compose \
  --env-file "$env_file" \
  -f "$script_dir/docker-compose.yml" \
  exec -T postgres \
  pg_restore \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  --data-only \
  --no-owner \
  --no-privileges \
  --disable-triggers \
  --exit-on-error < "$dump_file"

"$script_dir/verify.sh"
echo "Direct PostgreSQL migration completed: $dump_file"
