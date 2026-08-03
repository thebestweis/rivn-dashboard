#!/bin/sh
set -eu

script_dir=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
# shellcheck disable=SC1091
. "$script_dir/common.sh"

require_command df
require_command getconf
require_command ss
[ -r /proc/meminfo ] || die "/proc/meminfo is unavailable"

cpu_count=$(getconf _NPROCESSORS_ONLN)
available_memory_kb=$(awk '/^MemAvailable:/ {print $2}' /proc/meminfo)

disk_probe=$(dirname "$RIVN_PLATFORM_SHADOW_ROOT")
while [ ! -d "$disk_probe" ]; do
  next_probe=$(dirname "$disk_probe")
  [ "$next_probe" != "$disk_probe" ] || break
  disk_probe=$next_probe
done

available_disk_kb=$(df -Pk "$disk_probe" | awk 'NR == 2 {print $4}')

minimum_memory_kb=$((4 * 1024 * 1024))
recommended_memory_kb=$((8 * 1024 * 1024))
minimum_disk_kb=$((40 * 1024 * 1024))
recommended_disk_kb=$((80 * 1024 * 1024))

printf 'cpu_cores=%s\n' "$cpu_count"
printf 'memory_available_gb=%s\n' "$((available_memory_kb / 1024 / 1024))"
printf 'disk_available_gb=%s\n' "$((available_disk_kb / 1024 / 1024))"

docker_status=missing
if command -v docker >/dev/null 2>&1; then
  if docker compose version >/dev/null 2>&1; then
    docker_status=ready
  else
    docker_status=compose_missing
  fi
fi
printf 'docker=%s\n' "$docker_status"

[ "$cpu_count" -ge 2 ] || die "At least 2 CPU cores are required"
[ "$available_memory_kb" -ge "$minimum_memory_kb" ] || die \
  "At least 4 GB of available RAM is required for the parallel stack"
[ "$available_disk_kb" -ge "$minimum_disk_kb" ] || die \
  "At least 40 GB of available disk is required for the parallel stack"
[ "$docker_status" = "ready" ] || die \
  "Docker Engine with Compose v2 is required after the resource check passes"

if [ "$available_memory_kb" -lt "$recommended_memory_kb" ]; then
  printf 'WARNING: Supabase recommends 8 GB+ RAM for production workloads.\n' >&2
fi

if [ "$available_disk_kb" -lt "$recommended_disk_kb" ]; then
  printf 'WARNING: Supabase recommends 80 GB+ SSD for production workloads.\n' >&2
fi

for port in \
  "$RIVN_PLATFORM_SHADOW_SUPABASE_PORT" \
  "$RIVN_PLATFORM_SHADOW_SUPABASE_HTTPS_PORT" \
  "$RIVN_PLATFORM_SHADOW_DB_PORT" \
  "$RIVN_PLATFORM_SHADOW_POOLER_PORT" \
  "$RIVN_PLATFORM_SHADOW_APP_PORT"; do
  if ss -ltnH "sport = :$port" | grep -q .; then
    die "Port $port is already in use"
  fi
done

log "Resource and port preflight passed"
