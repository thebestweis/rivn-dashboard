#!/bin/sh
set -eu

script_dir=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
# shellcheck disable=SC1091
. "$script_dir/common.sh"

require_command docker
require_shadow
[ -f "$RIVN_PLATFORM_SHADOW_ROOT/.restore-complete" ] || die \
  "Shadow data is not restored. Starting an empty platform stack is refused."

log "Starting isolated shadow Supabase"
compose up -d --wait
compose ps

log "Shadow API: $RIVN_PLATFORM_SHADOW_SUPABASE_URL"
log "No production service was restarted"
