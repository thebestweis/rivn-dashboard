#!/bin/sh
set -eu

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
env_file="$script_dir/.env"

if [ ! -f "$env_file" ]; then
  echo "Missing $env_file" >&2
  exit 1
fi

set -a
. "$env_file"
set +a

base_url=${RIVN_LEADS_DATABASE_URL:-http://127.0.0.1:${RIVN_LEADS_STORAGE_PORT:-3001}}

curl -fsS "$base_url/health"
printf '\n'
curl -fsS \
  -H "apikey: $RIVN_LEADS_DATABASE_SERVICE_KEY" \
  -H "Authorization: Bearer $RIVN_LEADS_DATABASE_SERVICE_KEY" \
  "$base_url/rest/v1/rivn_leads_reader_accounts?select=id&limit=1"
printf '\nRIVN Leads standalone storage is healthy.\n'
