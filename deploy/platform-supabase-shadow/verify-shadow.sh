#!/bin/sh
set -eu

script_dir=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
# shellcheck disable=SC1091
. "$script_dir/common.sh"

require_command curl
require_command jq
require_shadow
[ -f "$RIVN_PLATFORM_SHADOW_ROOT/.restore-complete" ] || die \
  "Shadow data restore has not completed"

anon_key=$(shadow_env_value ANON_KEY)
service_key=$(shadow_env_value SERVICE_ROLE_KEY)

[ -n "$anon_key" ] || die "Shadow ANON_KEY is missing"
[ -n "$service_key" ] || die "Shadow SERVICE_ROLE_KEY is missing"

log "Checking isolated Auth API"
curl -fsS \
  -H "apikey: $anon_key" \
  -H "Authorization: Bearer $anon_key" \
  "$RIVN_PLATFORM_SHADOW_SUPABASE_URL/auth/v1/settings" \
  >/dev/null

log "Checking isolated PostgREST API"
curl -fsS \
  -H "apikey: $service_key" \
  -H "Authorization: Bearer $service_key" \
  "$RIVN_PLATFORM_SHADOW_SUPABASE_URL/rest/v1/" \
  >/dev/null

auth_users=$(compose exec -T db psql -U postgres -d postgres -X -Atc \
  "select count(*) from auth.users;")
public_tables=$(compose exec -T db psql -U postgres -d postgres -X -Atc \
  "select count(*) from pg_tables where schemaname = 'public';")

printf 'auth_users=%s\n' "$auth_users"
printf 'public_tables=%s\n' "$public_tables"

if [ "${1:-}" = "--login" ]; then
  [ -t 0 ] || die "Interactive terminal is required for --login"

  printf 'Existing RIVN OS email: '
  read -r login_email
  printf 'Password: '
  stty -echo
  read -r login_password
  stty echo
  printf '\n'

  payload=$(jq -nc \
    --arg email "$login_email" \
    --arg password "$login_password" \
    '{email: $email, password: $password}')

  response_file=$(mktemp)
  trap 'rm -f "$response_file"' EXIT HUP INT TERM
  chmod 600 "$response_file"

  http_code=$(curl -sS \
    -o "$response_file" \
    -w '%{http_code}' \
    -H "apikey: $anon_key" \
    -H "Content-Type: application/json" \
    -X POST \
    --data "$payload" \
    "$RIVN_PLATFORM_SHADOW_SUPABASE_URL/auth/v1/token?grant_type=password")

  unset login_password payload

  [ "$http_code" = "200" ] || {
    jq -r '.msg // .message // .error_description // "Shadow login failed"' "$response_file" >&2
    exit 1
  }

  access_token=$(jq -er '.access_token' "$response_file")
  curl -fsS \
    -H "apikey: $anon_key" \
    -H "Authorization: Bearer $access_token" \
    "$RIVN_PLATFORM_SHADOW_SUPABASE_URL/auth/v1/user" \
    | jq -e --arg email "$login_email" '.email == $email' \
    >/dev/null

  unset access_token
  rm -f "$response_file"
  trap - EXIT HUP INT TERM
  log "Existing user login works in shadow Auth"
fi

log "Shadow verification passed"
