# Avito Telegram delivery worker

Use this when the main RIVN OS server cannot reach `api.telegram.org`.

## Main RIVN OS server

The main server should generate Avito reports and put Telegram delivery into the database queue.

Add to `/var/www/rivnos/.env.production`:

```txt
AVITO_TELEGRAM_DELIVERY_MODE=queue
```

Deploy and restart the web app:

```bash
cd /var/www/rivnos
git pull
npm ci
npm run build
pm2 restart rivnos --update-env
```

## Telegram-capable server

The second server must have network access to `https://api.telegram.org`.

Deploy the same repository there and make sure `/var/www/rivnos/.env.production` contains:

```txt
NEXT_PUBLIC_SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
TELEGRAM_BOT_TOKEN=...
AVITO_TELEGRAM_WORKER_ENABLED=true
```

Start only the Avito Telegram worker:

```bash
cd /var/www/rivnos
git pull
npm ci
AVITO_TELEGRAM_WORKER_ENABLED=true pm2 start ecosystem.config.cjs --only avito-telegram-worker
pm2 save
pm2 logs avito-telegram-worker --lines 100
```

If the site and RIVN Leads are already managed by the same ecosystem file on this server, you can restart the ecosystem with the env flag:

```bash
cd /var/www/rivnos
AVITO_TELEGRAM_WORKER_ENABLED=true pm2 start ecosystem.config.cjs
pm2 save
```

## Test

1. On the main server, open `/avito-reports` and click test report.
2. The UI should say that the report was queued for Telegram delivery.
3. On the second server:

```bash
pm2 logs avito-telegram-worker --lines 100
```

You should see `Avito report delivered`.

In Supabase, `avito_report_logs.status` should move:

```txt
telegram_pending -> telegram_processing -> success
```
