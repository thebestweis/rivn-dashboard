#!/bin/sh
set -eu

script_dir=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
# shellcheck disable=SC1091
. "$script_dir/common.sh"

require_command curl
require_command docker
require_command git
require_command openssl
require_command jq

docker compose version >/dev/null 2>&1 || die "Docker Compose v2 is required"

if [ -f "$shadow_marker" ]; then
  log "Shadow Supabase is already prepared at $RIVN_PLATFORM_SHADOW_ROOT"
  compose config >/dev/null
  exit 0
fi

sh "$script_dir/preflight.sh"

[ ! -e "$RIVN_PLATFORM_SHADOW_ROOT" ] || die \
  "$RIVN_PLATFORM_SHADOW_ROOT already exists without a RIVN shadow marker"

remote_tag_object=$(git ls-remote \
  https://github.com/supabase/supabase.git \
  "refs/tags/$RIVN_PLATFORM_SUPABASE_REF" | awk 'NR == 1 {print $1}')

[ "$remote_tag_object" = "$RIVN_PLATFORM_SUPABASE_TAG_OBJECT" ] || die \
  "Pinned Supabase tag object does not match the expected value"

remote_commit=$(git ls-remote \
  https://github.com/supabase/supabase.git \
  "refs/tags/$RIVN_PLATFORM_SUPABASE_REF^{}" | awk 'NR == 1 {print $1}')

[ "$remote_commit" = "$RIVN_PLATFORM_SUPABASE_COMMIT" ] || die \
  "Pinned Supabase tag does not resolve to the expected commit"

parent_dir=$(dirname "$RIVN_PLATFORM_SHADOW_ROOT")
project_name=$(basename "$RIVN_PLATFORM_SHADOW_ROOT")
mkdir -p "$parent_dir"

setup_script=$(mktemp)
trap 'rm -f "$setup_script"' EXIT HUP INT TERM

curl -fsSL \
  "https://raw.githubusercontent.com/supabase/supabase/$RIVN_PLATFORM_SUPABASE_SETUP_COMMIT/docker/setup.sh" \
  -o "$setup_script"

log "Preparing official Supabase $RIVN_PLATFORM_SUPABASE_REF"
(
  cd "$parent_dir"
  sh "$setup_script" \
    --project-dir "$project_name" \
    --skip-deps \
    --ref "$RIVN_PLATFORM_SUPABASE_REF" \
    --yes
)

set_env() {
  key=$1
  value=$2
  escaped=$(printf '%s' "$value" | sed 's/[&|]/\\&/g')

  if grep -q "^${key}=" "$shadow_env"; then
    sed -i "s|^${key}=.*$|${key}=${escaped}|" "$shadow_env"
  else
    printf '%s=%s\n' "$key" "$value" >> "$shadow_env"
  fi
}

set_env SUPABASE_PUBLIC_URL "$RIVN_PLATFORM_SHADOW_SUPABASE_URL"
set_env API_EXTERNAL_URL "$RIVN_PLATFORM_SHADOW_SUPABASE_URL/auth/v1"
set_env SITE_URL "$RIVN_PLATFORM_SHADOW_APP_URL"
set_env ADDITIONAL_REDIRECT_URLS "$RIVN_PLATFORM_SHADOW_APP_URL/**"
set_env KONG_HTTP_PORT "$RIVN_PLATFORM_SHADOW_SUPABASE_PORT"
set_env KONG_HTTPS_PORT "$RIVN_PLATFORM_SHADOW_SUPABASE_HTTPS_PORT"
set_env SHADOW_POSTGRES_PORT "$RIVN_PLATFORM_SHADOW_DB_PORT"
set_env SHADOW_POOLER_PORT "$RIVN_PLATFORM_SHADOW_POOLER_PORT"
set_env POOLER_TENANT_ID rivn-platform-shadow
set_env STUDIO_DEFAULT_ORGANIZATION "RIVN OS Shadow"
set_env STUDIO_DEFAULT_PROJECT "RIVN OS Migration Test"
set_env DISABLE_SIGNUP true
set_env ENABLE_PHONE_SIGNUP false

umask 077
{
  printf 'mode=shadow\n'
  printf 'setup_commit=%s\n' "$RIVN_PLATFORM_SUPABASE_SETUP_COMMIT"
  printf 'supabase_ref=%s\n' "$RIVN_PLATFORM_SUPABASE_REF"
  printf 'supabase_tag_object=%s\n' "$RIVN_PLATFORM_SUPABASE_TAG_OBJECT"
  printf 'supabase_commit=%s\n' "$RIVN_PLATFORM_SUPABASE_COMMIT"
  printf 'prepared_at=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
} > "$shadow_marker"

chmod 600 "$shadow_env" "$shadow_marker"
compose config >/dev/null

log "Prepared without starting containers"
log "API will listen only on 127.0.0.1:$RIVN_PLATFORM_SHADOW_SUPABASE_PORT"
log "Production configuration was not changed"
