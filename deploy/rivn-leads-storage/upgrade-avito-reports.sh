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

docker compose \
  --env-file "$env_file" \
  -f "$script_dir/docker-compose.yml" \
  exec -T postgres \
  psql \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  --set=ON_ERROR_STOP=1 \
  --file=/docker-entrypoint-initdb.d/02-avito-reports.sql.template

echo "Avito Reports schema is ready."
