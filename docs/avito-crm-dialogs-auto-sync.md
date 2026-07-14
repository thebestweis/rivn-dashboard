# Avito CRM dialogs auto-sync

This endpoint keeps Avito CRM dialogs alive after deploys and short webhook gaps.

Endpoint:

```text
GET /api/cron/avito-crm-dialogs-sync
```

Auth:

```bash
Authorization: Bearer CRON_SECRET
```

What it does:

- loads active Avito report accounts with CRM dialogs enabled;
- registers the current `/api/avito/messenger/webhook` URL in Avito again;
- imports recent Avito chats/messages into CRM;
- relies on `crm_messages.external_id` duplicate protection, so repeated runs are safe.

Run once after every main app deploy:

```bash
curl -fsS \
  -H "Authorization: Bearer $CRON_SECRET" \
  "https://rivnos.ru/api/cron/avito-crm-dialogs-sync"
```

Recommended external scheduler:

```cron
*/5 * * * * curl -fsS -H "Authorization: Bearer CRON_SECRET_VALUE" "https://rivnos.ru/api/cron/avito-crm-dialogs-sync" >/dev/null
```

Optional query params:

```text
limit=50       max Avito accounts per run, hard cap 200
days=2         backfill window, hard cap 14
maxChats=20    recent chats per account, hard cap 100
```

For a heavier recovery run:

```bash
curl -fsS \
  -H "Authorization: Bearer $CRON_SECRET" \
  "https://rivnos.ru/api/cron/avito-crm-dialogs-sync?limit=200&days=7&maxChats=50"
```
