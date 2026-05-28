# Avito Reports Cron Runbook

## Production schedule

Daily reports should run at 09:00 Moscow time.

Vercel cron uses UTC, so the Vercel schedule is:

```json
{
  "path": "/api/cron/daily",
  "schedule": "0 6 * * *"
}
```

Weekly reports should run at 10:00 Moscow time on Mondays:

```json
{
  "path": "/api/cron/weekly",
  "schedule": "0 7 * * 1"
}
```

## Manual test

Use this only for testing:

```txt
https://rivnos.ru/api/cron/daily?secret=CRON_SECRET&force=1
```

`force=1` bypasses the duplicate protection and sends the report again for the same period.

## Safe retry

Use this for production retries:

```txt
https://rivnos.ru/api/cron/daily?secret=CRON_SECRET
```

This does not bypass duplicate protection. If one client already received a successful daily report, they will be skipped. If another client failed, the retry can still send their report.

## Recommended reliable setup

Do not use repeated same-day Vercel cron time changes for testing on Hobby plans. Hobby cron can have hourly precision and is limited for frequent testing.

For reliable production delivery, keep Vercel cron as a fallback and add an external scheduler with normal, non-force calls:

- 03:00-08:50 MSK, every 2 minutes: `/api/cron/avito-cache-warmup?secret=CRON_SECRET`
- 03:00-08:50 MSK, every 2 minutes: `/api/cron/avito-report-sync?secret=CRON_SECRET`
- 09:00 MSK: `/api/cron/daily?secret=CRON_SECRET`
- 09:15 MSK: `/api/cron/daily?secret=CRON_SECRET`
- 09:30 MSK: `/api/cron/daily?secret=CRON_SECRET`
- After 09:00, every 10-15 minutes until stable: `/api/cron/avito-report-sync?secret=CRON_SECRET`

Because duplicate protection is checked per client and period, retries should not duplicate successful reports.

`/api/cron/avito-cache-warmup` prepares Avito data before users receive reports. It processes only one Avito account per call and skips accounts that already have a good snapshot for the period.
`/api/cron/avito-report-sync` retries accounts that got a partial or suspicious snapshot. It also processes only one account per call and schedules the next attempt about 90 seconds later.

Reports at 09:00 first reuse prepared snapshots from the database. If a good snapshot already exists, the report does not call Avito again for that account.

The project also has Vercel retry routes:

```json
{
  "path": "/api/cron/daily-retry-15",
  "schedule": "15 6 * * *"
},
{
  "path": "/api/cron/daily-retry-30",
  "schedule": "30 6 * * *"
}
```

These routes call the same daily report without `force=1`.

## What to check if reports do not arrive

1. Vercel Runtime Logs should contain `[cron:daily] started`.
2. If there is no `[cron:daily] started`, the scheduler did not call the endpoint.
3. If there is `[cron:daily] started`, check `[avito:daily-report] clients loaded`.
4. Check `avito_report_logs` for the target `period_start` and `report_type = daily`.
5. If one client succeeded and another failed, run the safe retry URL without `force`.
