#!/bin/sh
set -eu

script_dir=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
# shellcheck disable=SC1091
. "$script_dir/common.sh"

require_shadow
[ -f "$repo_root/.env.production" ] || die "$repo_root/.env.production is missing"

set -a
# shellcheck disable=SC1091
. "$repo_root/.env.production"
set +a

export NEXT_DIST_DIR=.next-shadow
export NEXT_PUBLIC_SUPABASE_URL="$RIVN_PLATFORM_SHADOW_SUPABASE_URL"
NEXT_PUBLIC_SUPABASE_ANON_KEY=$(shadow_env_value ANON_KEY)
export NEXT_PUBLIC_SUPABASE_ANON_KEY
export SUPABASE_SERVER_URL="$RIVN_PLATFORM_SHADOW_SUPABASE_URL"
SUPABASE_SERVICE_ROLE_KEY=$(shadow_env_value SERVICE_ROLE_KEY)
export SUPABASE_SERVICE_ROLE_KEY
export NEXT_PUBLIC_APP_URL="$RIVN_PLATFORM_SHADOW_APP_URL"
export NEXT_PUBLIC_BASE_URL="$RIVN_PLATFORM_SHADOW_APP_URL"
export NEXT_PUBLIC_ASSET_HOST=
export RIVN_PLATFORM_SHADOW_MODE=true

# Keep shadow writes inside the cloned platform database.
export RIVN_LEADS_STORAGE_MODE=supabase
export AVITO_REPORTS_STORAGE_MODE=supabase
export AVITO_TELEGRAM_DELIVERY_MODE=queue

case "${1:-}" in
  build)
    cd "$repo_root"
    exec npm run build
    ;;
  start)
    [ -f "$repo_root/.next-shadow/BUILD_ID" ] || die \
      "Shadow application is not built. Run shadow-app.sh build first."
    cd "$repo_root"
    exec ./node_modules/.bin/next start \
      -H 127.0.0.1 \
      -p "$RIVN_PLATFORM_SHADOW_APP_PORT"
    ;;
  *)
    die "Usage: shadow-app.sh build|start"
    ;;
esac
