#!/bin/bash
set -euo pipefail

app_dir=${RIVNOS_APP_DIR:-/var/www/rivnos}
env_file=${RIVNOS_ENV_FILE:-$app_dir/.env.production}
job=${1:-}

if [[ ! -f "$env_file" ]]; then
  echo "Environment file not found: $env_file" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$env_file"
set +a

secret=${CRON_SECRET:-${VERCEL_CRON_SECRET:-}}
if [[ -z "$secret" ]]; then
  echo "CRON_SECRET is not configured" >&2
  exit 1
fi

case "$job" in
  daily) path="/api/cron/daily" ;;
  daily-retry-15) path="/api/cron/daily-retry-15" ;;
  daily-retry-30) path="/api/cron/daily-retry-30" ;;
  weekly) path="/api/cron/weekly" ;;
  report-sync) path="/api/cron/avito-report-sync" ;;
  cache-warmup) path="/api/cron/avito-cache-warmup" ;;
  crm-dialogs-sync) path="/api/cron/avito-crm-dialogs-sync?limit=3&days=1&maxChats=20" ;;
  client-test)
    client_code=${2:-}
    if [[ ! "$client_code" =~ ^[A-Za-z0-9_-]+$ ]]; then
      echo "A valid client code is required for client-test" >&2
      exit 1
    fi
    path="/api/cron/avito-client-test?clientCode=$client_code"
    ;;
  chat-preview)
    chat_id=${2:-}
    if [[ ! "$chat_id" =~ ^-?[0-9]+$ ]]; then
      echo "A valid Telegram chat_id is required for chat-preview" >&2
      exit 1
    fi
    path="/api/cron/avito-client-test?chatId=$chat_id&preview=true"
    ;;
  account-weekly-preview|account-weekly-send)
    account_name=${2:-}
    if [[ -z "$account_name" ]]; then
      echo "An Avito account name is required for $job" >&2
      exit 1
    fi
    encoded_account_name=$(python3 -c 'import sys, urllib.parse; print(urllib.parse.quote(sys.argv[1], safe=""))' "$account_name")
    if [[ "$job" == "account-weekly-preview" ]]; then
      path="/api/cron/avito-client-test?accountName=$encoded_account_name&reportType=weekly&preview=true"
    else
      path="/api/cron/avito-client-test?accountName=$encoded_account_name&reportType=weekly&send=true"
    fi
    ;;
  *)
    echo "Unknown job: $job" >&2
    exit 1
    ;;
esac

lock_name=$job
if [[ "$job" == daily* ]]; then
  lock_name=daily
fi

if command -v flock >/dev/null 2>&1; then
  exec 9>"/var/lock/rivnos-avito-$lock_name.lock"
  if ! flock -n 9; then
    echo "Skipped overlapping job: $job"
    exit 0
  fi
fi

curl \
  --fail-with-body \
  --silent \
  --show-error \
  --connect-timeout 5 \
  --max-time 420 \
  -H "Authorization: Bearer $secret" \
  "http://127.0.0.1:3000$path"
echo
