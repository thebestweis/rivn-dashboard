# Avito Reports standalone storage

Avito Reports shares the PostgreSQL/PostgREST stack deployed for RIVN Leads,
but uses an independent application switch. Platform auth, workspaces, projects,
and CRM data remain in the platform database.

## Safe cutover order

1. Deploy the code while `AVITO_REPORTS_STORAGE_MODE` is unset. The application
   continues using Supabase.
2. On the worker/storage server, upgrade the standalone schema:

   ```bash
   cd /var/www/rivnos
   git pull
   npm ci
   sh deploy/rivn-leads-storage/install.sh
   ```

3. Copy and verify the Avito tables while Supabase is reachable:

   ```bash
   cd /var/www/rivnos
   npm run avito:storage:migrate
   npm run avito:storage:migrate -- --apply
   ```

   The first command is a dry run. The apply command refuses the cutover if any
   source and target row counts differ. If the Supabase project is restricted,
   extraction cannot run through its API. In that case use a direct database
   connection/export from Supabase before switching, or recreate account
   configuration in the new storage. Do not enable standalone mode with an
   empty `avito_report_clients` table.

4. On the main server add to `.env.production`:

   ```dotenv
   AVITO_REPORTS_STORAGE_MODE=standalone
   AVITO_REPORTS_DATABASE_URL=http://127.0.0.1:3101
   AVITO_REPORTS_DATABASE_SERVICE_KEY=<same service key as the storage stack>
   AVITO_TELEGRAM_DELIVERY_MODE=queue
   ```

   Port `3101` is the local end of the existing secure tunnel to the
   worker/storage server. Do not expose PostgREST publicly.

5. On the worker/storage server add to `.env.production`:

   ```dotenv
   AVITO_REPORTS_STORAGE_MODE=standalone
   AVITO_REPORTS_DATABASE_URL=http://127.0.0.1:3001
   AVITO_REPORTS_DATABASE_SERVICE_KEY=<service key from deploy/rivn-leads-storage/.env>
   AVITO_TELEGRAM_DELIVERY_MODE=queue
   ```

6. Build and restart the main application, then restart the Telegram delivery
   worker with updated environment variables.

7. Install the VPS cron schedule on the main server:

   ```bash
   cd /var/www/rivnos
   bash deploy/avito-reports/install-cron.sh
   ```

8. Verify storage and run one bounded report:

   ```bash
   curl -fsS http://127.0.0.1:3101/health
   bash deploy/avito-reports/run-cron.sh cache-warmup
   bash deploy/avito-reports/run-cron.sh daily
   tail -n 100 /var/log/rivnos-avito-reports.log
   ```

   A report for one client can be tested without a browser session:

   ```bash
   bash deploy/avito-reports/run-cron.sh client-test <client_code>
   ```

   To build a real report without sending it to Telegram, run a preview by
   chat ID. The completed Telegram HTML is returned in `results[].preview`:

   ```bash
   bash deploy/avito-reports/run-cron.sh chat-preview <telegram_chat_id>
   ```

## Rollback

Set `AVITO_REPORTS_STORAGE_MODE=supabase`, rebuild/restart the main application,
and restart `avito-telegram-worker --update-env`. The standalone database is
left intact for investigation and no platform or CRM tables are moved.
