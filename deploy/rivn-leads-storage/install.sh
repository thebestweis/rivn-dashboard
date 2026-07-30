#!/bin/sh
set -eu

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
env_file="$script_dir/.env"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is not installed." >&2
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "Docker Compose v2 is not installed." >&2
  exit 1
fi

if [ ! -f "$env_file" ]; then
  node "$script_dir/../../scripts/rivn-leads-generate-storage-env.mjs" \
    --output "$env_file"
fi

chmod 600 "$env_file"

docker compose \
  --env-file "$env_file" \
  -f "$script_dir/docker-compose.yml" \
  config >/dev/null

docker compose \
  --env-file "$env_file" \
  -f "$script_dir/docker-compose.yml" \
  up -d

"$script_dir/verify.sh"
