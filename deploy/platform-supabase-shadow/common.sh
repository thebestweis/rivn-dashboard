#!/bin/sh
set -eu

script_dir=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
# shellcheck disable=SC2034
repo_root=$(CDPATH='' cd -- "$script_dir/../.." && pwd)
config_file=${RIVN_PLATFORM_SHADOW_CONFIG:-$script_dir/config.env}

if [ -f "$config_file" ]; then
  # shellcheck disable=SC1090
  . "$config_file"
fi

: "${RIVN_PLATFORM_SHADOW_ROOT:=/opt/rivn-platform-supabase-shadow}"
: "${RIVN_PLATFORM_SHADOW_SUPABASE_PORT:=18000}"
: "${RIVN_PLATFORM_SHADOW_SUPABASE_HTTPS_PORT:=18443}"
: "${RIVN_PLATFORM_SHADOW_DB_PORT:=15432}"
: "${RIVN_PLATFORM_SHADOW_POOLER_PORT:=16543}"
: "${RIVN_PLATFORM_SHADOW_APP_PORT:=3300}"
: "${RIVN_PLATFORM_SHADOW_SUPABASE_URL:=http://127.0.0.1:${RIVN_PLATFORM_SHADOW_SUPABASE_PORT}}"
: "${RIVN_PLATFORM_SHADOW_APP_URL:=http://127.0.0.1:${RIVN_PLATFORM_SHADOW_APP_PORT}}"
: "${RIVN_PLATFORM_SUPABASE_SETUP_COMMIT:=94bc3f8d074307c90c1cf78c50ac5b2a1b48162f}"
: "${RIVN_PLATFORM_SUPABASE_REF:=self-hosted/v0.7.0}"
: "${RIVN_PLATFORM_SUPABASE_TAG_OBJECT:=81dc81654a5ffa77c26ae96003a7791d856a57be}"
: "${RIVN_PLATFORM_SUPABASE_COMMIT:=244301c09ddba21aa963ebea09e712ce89b0401a}"
: "${RIVN_PLATFORM_SUPABASE_CLI_VERSION:=2.111.0}"
: "${RIVN_PLATFORM_SOURCE_BACKUP_ROOT:=/var/backups/rivn-platform-supabase}"

shadow_marker="$RIVN_PLATFORM_SHADOW_ROOT/.rivn-platform-shadow"
shadow_env="$RIVN_PLATFORM_SHADOW_ROOT/.env"
shadow_compose="$RIVN_PLATFORM_SHADOW_ROOT/docker-compose.yml"
shadow_override="$script_dir/docker-compose.shadow.yml"

die() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

log() {
  printf '===> %s\n' "$*"
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || die "$1 is required"
}

require_shadow() {
  [ -f "$shadow_marker" ] || die "Shadow Supabase is not prepared. Run prepare.sh first."
  [ -f "$shadow_env" ] || die "Shadow .env is missing: $shadow_env"
  [ -f "$shadow_compose" ] || die "Shadow docker-compose.yml is missing"
}

shadow_env_value() {
  key=$1
  sed -n "s/^${key}=//p" "$shadow_env" | tail -n 1 | tr -d '\r'
}

compose() {
  require_shadow
  docker compose \
    --env-file "$shadow_env" \
    -f "$shadow_compose" \
    -f "$shadow_override" \
    "$@"
}
