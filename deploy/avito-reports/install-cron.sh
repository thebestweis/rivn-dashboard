#!/bin/bash
set -euo pipefail

app_dir=${RIVNOS_APP_DIR:-/var/www/rivnos}
runner="$app_dir/deploy/avito-reports/run-cron.sh"
cron_file=/etc/cron.d/rivnos-avito-reports
log_file=/var/log/rivnos-avito-reports.log

if [[ ${EUID:-$(id -u)} -ne 0 ]]; then
  echo "Run this installer as root." >&2
  exit 1
fi

if [[ ! -f "$runner" ]]; then
  echo "Cron runner not found: $runner" >&2
  exit 1
fi

chmod 750 "$runner"
touch "$log_file"
chmod 640 "$log_file"

cat >"$cron_file" <<EOF
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
# The server uses UTC. Moscow is UTC+3 year-round.
0 6 * * * root $runner daily >> $log_file 2>&1
15 6 * * * root $runner daily-retry-15 >> $log_file 2>&1
30 6 * * * root $runner daily-retry-30 >> $log_file 2>&1
0 7 * * 1 root $runner weekly >> $log_file 2>&1
*/5 3-5 * * * root $runner cache-warmup >> $log_file 2>&1
*/5 * * * * root $runner report-sync >> $log_file 2>&1
*/15 * * * * root $runner crm-dialogs-sync >> $log_file 2>&1
EOF

chmod 644 "$cron_file"

if command -v systemctl >/dev/null 2>&1; then
  systemctl reload cron 2>/dev/null || systemctl restart cron
fi

echo "Installed $cron_file"
