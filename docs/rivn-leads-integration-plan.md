# RIVN Leads integration into RIVN OS

## Current state

`I:\RIVN PARS` is a standalone working product. It has:

- Next.js web app;
- NestJS API;
- PostgreSQL + Prisma;
- Redis/BullMQ queues;
- Telegram MTProto reader worker;
- Telegram Bot API delivery worker;
- admin panel for reader accounts, source chats, diagnostics, leads and test ingest.

RIVN OS currently uses:

- Next.js App Router;
- Supabase Auth and Supabase database;
- Next API routes;
- PM2/Nginx production server.

Because the stacks are different, RIVN Leads should be integrated gradually, not copied into RIVN OS in one large step.

## Step 1. Database foundation

Created file:

```txt
docs/rivn-leads-supabase-schema.sql
```

It creates isolated tables with the `rivn_leads_` prefix:

- `rivn_leads_reader_accounts`
- `rivn_leads_source_chat_categories`
- `rivn_leads_source_chats`
- `rivn_leads_projects`
- `rivn_leads_project_source_chats`
- `rivn_leads_keywords`
- `rivn_leads_stop_words`
- `rivn_leads_special_chat_requests`
- `rivn_leads_telegram_messages`
- `rivn_leads_leads`
- `rivn_leads_processed_messages`
- `rivn_leads_delivery_logs`
- `rivn_leads_daily_reports`
- `rivn_leads_audit_logs`

The schema keeps RIVN Leads separate from CRM and Avito reports, so current RIVN OS features are not affected.

## Access model

Global operational tables are available only to `profiles.platform_role = 'super_admin'`:

- reader accounts;
- source chat categories;
- source chats;
- processed messages.

Workspace-level tables are available to active workspace members:

- projects;
- keywords;
- stop words;
- leads;
- delivery logs;
- daily reports.

Management actions are limited to workspace roles:

- `owner`
- `admin`
- `manager`
- `sales_head`

Workers and server API routes should use `SUPABASE_SERVICE_ROLE_KEY`.

## Next step

After the SQL migration is applied in Supabase:

1. Create `/admin-leads` in RIVN OS.
2. Protect it through current super-admin access.
3. Move the RIVN Leads admin UI into RIVN OS design.
4. Create Next API routes for:
   - reader accounts;
   - source chats;
   - categories;
   - projects;
   - keywords;
   - stop words;
   - leads;
   - diagnostics.
5. Adapt Telegram worker and delivery worker to Supabase.
6. Run workers on the server through PM2 as separate processes.

## Step 2. Admin panel and processing core

Created files:

```txt
app/admin-leads/page.tsx
app/api/admin-leads/overview/route.ts
app/api/admin-leads/manage/route.ts
app/api/admin-leads/test-ingest/route.ts
app/api/rivn-leads/ingest/route.ts
app/lib/rivn-leads/text.ts
app/lib/rivn-leads/telegram.ts
app/lib/rivn-leads/processor.ts
```

What is ready:

- `/admin-leads` is available only to the platform super admin.
- The admin can create RIVN Leads projects.
- The admin can add Telegram source chats.
- The admin can connect source chats to projects.
- The admin can add keywords and stop words.
- The admin can update reader account statuses.
- The admin can see latest leads and delivery logs.
- The shared processing core can:
  - normalize message text;
  - match keywords;
  - reject stop-word matches;
  - prevent duplicate Telegram messages;
  - create leads;
  - send leads to Telegram through `TELEGRAM_BOT_TOKEN`;
  - write delivery logs.

Added test flow:

- In `/admin-leads`, a test message can be sent through the same processing core.
- The system creates a lead and tries to deliver it to the configured Telegram chat.

Added future worker endpoint:

- `POST /api/rivn-leads/ingest`
- Protected by `RIVN_LEADS_INGEST_SECRET`, or fallback `CRON_SECRET` / `VERCEL_CRON_SECRET`.
- This endpoint is intended for the migrated Telegram reader worker.

What is not moved yet:

- MTProto reader session generation.
- Continuous Telegram chat reading.
- Redis/BullMQ queues.
- PM2 worker processes.
- Daily RIVN Leads reports.

The next safe step is to adapt the existing Telegram reader worker from `I:\RIVN PARS` so it sends found messages into `/api/rivn-leads/ingest`, instead of writing directly through Prisma.

## Important safety rule

Do not change or stop the existing working `I:\RIVN PARS` product until the RIVN OS version is verified end-to-end:

- reader account connects;
- Telegram chats are scanned;
- new Telegram messages become leads;
- leads are delivered to Telegram;
- admin panel displays diagnostics;
- logs show no duplicate or lost messages.
