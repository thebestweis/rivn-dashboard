# RIVN OS platform: shadow migration from hosted Supabase

This runbook builds and tests a complete self-hosted copy of the RIVN OS
platform database and Auth service. It does not switch production.

## Safety boundaries

- Hosted Supabase remains unchanged.
- `supabase.rivnos.ru`, nginx, DNS, `.env.production`, and PM2 `rivnos` are not
  modified by these scripts.
- Shadow Supabase binds only to `127.0.0.1`.
- Shadow Next.js uses `.next-shadow` and port `3300`; the production `.next`
  build and port `3000` remain untouched.
- There is intentionally no production cutover script in this phase.
- RIVN Leads and Avito Reports use the cloned database in shadow mode, not the
  current standalone production storage.

## Prerequisites

Run the read-only preflight on both servers and use the one with enough spare
resources. Do not place the shadow stack next to production merely because the
repository is already there. Docker Compose v2, Git, OpenSSL, jq, curl, Node.js,
and npm are required.

```bash
cd /var/www/rivnos
sh deploy/platform-supabase-shadow/preflight.sh
```

The script refuses installation below 4 GB of currently available RAM, 2 CPU
cores, or 40 GB of available disk, and checks every shadow port. Supabase
recommends 8 GB+ RAM, 4 CPU cores, and 80 GB+ SSD. If neither existing server
has that spare capacity, use a separate database server rather than risking the
main RIVN OS or Telegram workers.

If resources pass but Docker is missing, install it from Docker's official apt
repository without touching PM2 or nginx:

```bash
sh deploy/platform-supabase-shadow/install-docker.sh
sh deploy/platform-supabase-shadow/preflight.sh
```

The installer refuses to remove conflicting container packages automatically.

Copy the non-secret configuration only when defaults need to be changed:

```bash
cd /var/www/rivnos
cp deploy/platform-supabase-shadow/config.env.example \
  deploy/platform-supabase-shadow/config.env
```

The default isolated listeners are:

```text
Shadow Supabase API: 127.0.0.1:18000
Shadow Postgres:     127.0.0.1:15432
Shadow pooler:       127.0.0.1:16543
Shadow RIVN OS:      127.0.0.1:3300
```

## 1. Prepare the isolated stack

```bash
cd /var/www/rivnos
sh deploy/platform-supabase-shadow/prepare.sh
```

This uses an immutable official setup script to download the stable Supabase
self-hosted release pinned in `config.env.example`, generates fresh secrets under
`/opt/rivn-platform-supabase-shadow/.env`, and validates Compose. It does not
start containers.

Check that the production app is still listening on port `3000` and no shadow
port is public:

```bash
ss -lntp | grep -E ':3000|:3300|:18000|:15432|:16543'
```

## 2. Obtain the hosted database connection string

In the hosted Supabase dashboard, open the project and use **Connect** to copy
the Session Pooler connection string. Replace the password placeholder with the
database password. Percent-encode special characters in the password, as
required by the Supabase CLI. Do not send this value in chat and do not put it
in the repository or `.env.production`.

The provider's HTTP `402` restriction can block REST and Auth while direct
Postgres still works. The export command below is the definitive check.

## 3. Export the hosted project

Use a temporary shell variable on the main server:

```bash
cd /var/www/rivnos
export RIVN_PLATFORM_SOURCE_DB_URL='postgresql://...'
sh deploy/platform-supabase-shadow/export-source.sh
unset RIVN_PLATFORM_SOURCE_DB_URL
```

The script creates a protected timestamped directory under
`/var/backups/rivn-platform-supabase` containing:

```text
roles.sql
schema.sql
data.sql
source-counts.txt
SHA256SUMS
EXPORT_COMPLETE
```

`auth.users` and password hashes are part of the database export. Storage file
objects are not copied by this phase; the RIVN OS application currently does
not call the Supabase Storage client.

If direct Postgres is also restricted, stop here. Never restore an incomplete
export and never switch production to an empty shadow database.

## 4. Restore and compare every table

Pass the exact protected export directory printed by the previous command:

```bash
sh deploy/platform-supabase-shadow/restore-shadow.sh \
  /var/backups/rivn-platform-supabase/YYYYMMDDTHHMMSSZ
```

The restore script:

1. verifies checksums;
2. starts only the isolated Postgres container;
3. refuses a non-empty target;
4. restores roles, schema, data, and Auth users in one transaction;
5. compares row counts for every `public` table and Auth data table;
6. starts the complete shadow stack only after all counts match.

Any mismatch leaves production unchanged and prevents a successful marker.

## 5. Verify API and a real migrated login

```bash
sh deploy/platform-supabase-shadow/verify-shadow.sh
sh deploy/platform-supabase-shadow/verify-shadow.sh --login
```

The second command asks for an existing RIVN OS email and password without
printing or storing the password. It verifies the migrated password hash
against shadow Auth and does not contact hosted Supabase.

## 6. Build the independent RIVN OS shadow

```bash
sh deploy/platform-supabase-shadow/shadow-app.sh build
pm2 start deploy/platform-supabase-shadow/ecosystem.shadow.config.cjs
pm2 logs rivnos-shadow --lines 30 --nostream
```

The build goes to `.next-shadow`. It does not overwrite `.next` and does not
restart `rivnos`.

From an administrator computer, open an SSH tunnel to both local listeners:

```bash
ssh \
  -L 3300:127.0.0.1:3300 \
  -L 18000:127.0.0.1:18000 \
  root@MAIN_SERVER_IP
```

Then open `http://127.0.0.1:3300/login`. Test login, dashboard, projects,
clients, CRM, payments, payroll, settings, and admin read paths. Do not run
Telegram broadcasts, webhooks, report sends, or destructive actions during the
shadow rehearsal.

## Cutover gate

Production switching is a separate phase and must not begin until all of these
conditions are true:

- source export checksums pass;
- all source and target row counts match;
- an existing account signs in through shadow Auth;
- critical RIVN OS pages load from the shadow database;
- a fresh pre-cutover backup exists on another server;
- SMTP/Auth settings and automated backups are configured;
- a rollback window and a short maintenance window are agreed.

The final cutover will require one last delta-safe export or a brief write
freeze, switching Supabase URL/API keys, rebuilding RIVN OS, and preserving the
hosted project untouched for rollback. Those actions are deliberately absent
from the current scripts.
