# RIVN Leads: migration to standalone storage

This runbook moves only the `rivn_leads_*` tables. RIVN OS authentication,
workspaces, CRM, Avito, and the rest of the application continue using the
existing Supabase project.

## Architecture

- RIVN Leads server (`31.76.126.41`): PostgreSQL 16, PostgREST, and a small
  Nginx gateway in Docker.
- The storage gateway listens only on `127.0.0.1:3001`.
- Main server: persistent SSH tunnel from `127.0.0.1:3101` to the storage
  gateway.
- Both application processes use the same service JWT.
- `RIVN_LEADS_STORAGE_MODE=supabase` remains the default and is the rollback
  switch.

Do not delete the Supabase project or its RIVN Leads tables during the
migration.

## 1. Deploy code without switching storage

On both servers:

```bash
cd /var/www/rivnos
git pull --ff-only origin main
npm ci
```

Do not add `RIVN_LEADS_STORAGE_MODE=standalone` yet.

## 2. Start storage on the RIVN Leads server

Docker Engine with Compose v2 must be installed first.

```bash
cd /var/www/rivnos
chmod 700 deploy/rivn-leads-storage/*.sh
sh deploy/rivn-leads-storage/install.sh
```

The installer creates `deploy/rivn-leads-storage/.env` once, validates the
Compose configuration, starts the containers, and checks authenticated access.
It refuses to overwrite existing secrets.

Check that no public database port is listening:

```bash
ss -lntp | grep -E ':3001|:5432'
```

The expected storage listener is `127.0.0.1:3001`. There must be no public
listener on port `5432`.

## 3. Create the tunnel from the main server

On the main server:

```bash
ssh-keygen -t ed25519 -f /root/.ssh/id_ed25519_rivn_leads -N ""
ssh-copy-id -i /root/.ssh/id_ed25519_rivn_leads.pub root@31.76.126.41
ssh -i /root/.ssh/id_ed25519_rivn_leads root@31.76.126.41 true
```

Install the service:

```bash
cd /var/www/rivnos
cp deploy/rivn-leads-storage/systemd/rivn-leads-storage-tunnel.service.example \
  /etc/systemd/system/rivn-leads-storage-tunnel.service
systemctl daemon-reload
systemctl enable --now rivn-leads-storage-tunnel
curl -fsS http://127.0.0.1:3101/health
```

The last command must return HTTP 200 from the PostgREST readiness endpoint.

## 4. Copy existing data

Copy the value of `RIVN_LEADS_DATABASE_SERVICE_KEY` from
`deploy/rivn-leads-storage/.env` on the RIVN Leads server. Do not send it in
chat or commit it to Git.

On the main server, temporarily export the target connection:

```bash
export RIVN_LEADS_DATABASE_URL=http://127.0.0.1:3101
export RIVN_LEADS_DATABASE_SERVICE_KEY='PASTE_SERVICE_KEY_HERE'
```

Try the read-only dry run:

```bash
cd /var/www/rivnos
npm run leads:storage:migrate
```

If all source and target counts are printed, copy and verify:

```bash
npm run leads:storage:migrate -- --apply
npm run leads:storage:migrate
```

The second command must show equal source and target counts for every table.

### Direct PostgreSQL fallback

Use this only if the Supabase REST API is blocked but the direct database
connection is still available. On the RIVN Leads server:

```bash
cd /var/www/rivnos
export RIVN_LEADS_SOURCE_DATABASE_URL='SUPABASE_DIRECT_DATABASE_URL'
sh deploy/rivn-leads-storage/migrate-from-postgres.sh
unset RIVN_LEADS_SOURCE_DATABASE_URL
```

The script refuses to restore into a non-empty target and keeps a protected
source dump under `/var/backups/rivn-leads`.

If both REST and direct PostgreSQL are disabled by the provider restriction,
the old rows cannot be extracted until access is restored. Do not switch the
workers to an empty database unless starting RIVN Leads from a clean
configuration is intentional.

## 5. Configure both servers

Add to `.env.production` on the RIVN Leads server:

```dotenv
RIVN_LEADS_STORAGE_MODE=standalone
RIVN_LEADS_DATABASE_URL=http://127.0.0.1:3001
RIVN_LEADS_DATABASE_SERVICE_KEY=PASTE_SERVICE_KEY_HERE
```

Add to `.env.production` on the main server:

```dotenv
RIVN_LEADS_STORAGE_MODE=standalone
RIVN_LEADS_DATABASE_URL=http://127.0.0.1:3101
RIVN_LEADS_DATABASE_SERVICE_KEY=PASTE_SERVICE_KEY_HERE
```

Keep the existing Supabase variables. They are still required by the rest of
RIVN OS and provide the rollback path.

## 6. Controlled cutover

First stop only the two RIVN Leads processes:

```bash
pm2 stop rivn-leads-reader rivn-leads-bot
```

Run one final `npm run leads:storage:migrate -- --apply` on the main server,
then restart the application:

```bash
npm run build
pm2 restart rivnos --update-env
```

On the RIVN Leads server:

```bash
pm2 restart rivn-leads-reader rivn-leads-bot --update-env
pm2 logs rivn-leads-reader --lines 30 --nostream
pm2 logs rivn-leads-bot --lines 30 --nostream
npm run leads:diagnose-pipeline
npm run leads:health
```

The worker startup logs and diagnostics must contain:

```text
storageMode=standalone
```

Then verify one real incoming message, one bot command, and the RIVN Leads
admin page.

## 7. Backups

On the RIVN Leads server:

```bash
cp deploy/rivn-leads-storage/systemd/rivn-leads-backup.service \
  /etc/systemd/system/
cp deploy/rivn-leads-storage/systemd/rivn-leads-backup.timer \
  /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now rivn-leads-backup.timer
systemctl start rivn-leads-backup.service
systemctl status rivn-leads-backup.service --no-pager
```

Backups are stored with mode `0600` and retained for 14 days by default. For
server-failure protection, set `RIVN_LEADS_BACKUP_REMOTE` in the service
environment to an SSH/rsync destination on the main server or another host.

## Rollback

Set this on both servers:

```dotenv
RIVN_LEADS_STORAGE_MODE=supabase
```

Then restart `rivnos`, `rivn-leads-reader`, and `rivn-leads-bot` with
`--update-env`. No database deletion or restore is required.
