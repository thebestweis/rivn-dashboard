#!/bin/sh
set -eu

script_dir=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
# shellcheck disable=SC1091
. "$script_dir/common.sh"

require_command find
require_command sha256sum

latest_dump=$(find "$RIVN_PLATFORM_SOURCE_BACKUP_ROOT" \
  -mindepth 2 \
  -maxdepth 2 \
  -type f \
  -name EXPORT_COMPLETE \
  -printf '%h\n' 2>/dev/null | LC_ALL=C sort | tail -n 1)

[ -n "$latest_dump" ] || die \
  "No completed source export was found under $RIVN_PLATFORM_SOURCE_BACKUP_ROOT"

for file in EXPORT_COMPLETE SHA256SUMS roles.sql schema.sql data.sql source-counts.txt; do
  [ -f "$latest_dump/$file" ] || die "Completed export is missing $file"
done

log "Verifying source export checksums"
(
  cd "$latest_dump"
  sha256sum -c SHA256SUMS
)

table_count=$(awk -F '|' 'NF == 3 {count += 1} END {print count + 0}' \
  "$latest_dump/source-counts.txt")
public_table_count=$(awk -F '|' '$1 == "public" {count += 1} END {print count + 0}' \
  "$latest_dump/source-counts.txt")
auth_users=$(awk -F '|' '$1 == "auth" && $2 == "users" {print $3}' \
  "$latest_dump/source-counts.txt" | tail -n 1)

[ "$table_count" -gt 0 ] || die "Source export contains no countable tables"
[ "$public_table_count" -gt 0 ] || die "Source export contains no public tables"
[ -n "$auth_users" ] || die "Source export contains no auth.users count"
[ "$auth_users" -gt 0 ] || die "Source export contains zero Auth users"

printf 'source_dump=%s\n' "$latest_dump"
printf 'counted_tables=%s\n' "$table_count"
printf 'public_tables=%s\n' "$public_table_count"
printf 'auth_users=%s\n' "$auth_users"
du -sh "$latest_dump"

log "Source export is complete and ready for shadow restore"
