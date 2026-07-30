#!/bin/sh
set -eu

psql \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  --set=ON_ERROR_STOP=1 \
  --set=postgrest_password="$POSTGREST_DB_PASSWORD" \
  --file=/docker-entrypoint-initdb.d/01-schema.sql.template
