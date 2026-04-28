# CRM integrations

## Tilda

Use this URL in Tilda form webhook settings:

```text
https://rivn-dashboard.vercel.app/api/crm/tilda?workspaceId=WORKSPACE_ID&secret=CRM_WEBHOOK_SECRET
```

The endpoint accepts JSON, `multipart/form-data` and `application/x-www-form-urlencoded`.

Common fields are mapped automatically:

- `name`, `Name`, `Имя` -> client name
- `phone`, `Phone`, `Телефон` -> phone
- `telegram`, `Telegram`, `tg` -> Telegram
- `serviceAmount`, `Стоимость услуги` -> service amount
- `budget`, `Бюджет` -> budget

All extra fields are added to the deal description.

## Telegram CRM

Use a separate sales bot or test bot with this webhook:

```text
https://rivn-dashboard.vercel.app/api/crm/telegram?workspaceId=WORKSPACE_ID&secret=CRM_WEBHOOK_SECRET
```

This endpoint creates or updates a CRM conversation by Telegram chat id and creates a CRM deal when the dialog is new.

Important: do not replace the existing Avito Reports bot webhook with this URL. The reports bot is used for chat linking and daily/weekly reports.

## Yandex Direct: generic webhook

Use this URL for advertising lead forwarding from forms, quizzes, Roistat/Albato/Make, or another connector:

```text
https://rivn-dashboard.vercel.app/api/crm/yandex-direct?workspaceId=WORKSPACE_ID&secret=CRM_WEBHOOK_SECRET
```

Recommended fields:

- `name` / `clientName` / `Имя`
- `phone` / `tel` / `Телефон`
- `telegram` / `tg`
- `utm_campaign` / `campaign`
- `utm_term` / `keyword`
- `budget`
- `serviceAmount`

The endpoint creates a CRM deal with `sourceKind = yandex_direct`, so assignment rules can route these leads separately from Avito, Tilda, or Telegram.

## Yandex Direct: Leads API auto sync

Yandex Direct Leads API is a pull integration: RIVN OS regularly asks Yandex Direct for new leads and creates CRM deals. The route is:

```text
https://rivn-dashboard.vercel.app/api/cron/yandex-direct-leads?secret=CRON_SECRET
```

What it does:

- checks every active row in `crm_yandex_direct_integrations`;
- requests new leads from Yandex Direct `Leads.get`;
- creates a CRM deal with `sourceKind = yandex_direct`;
- saves the imported lead in `crm_yandex_direct_imports`;
- skips duplicates by `integration_id + external_lead_id`;
- updates `last_synced_at` for the integration.

Required SQL:

```text
docs/yandex-direct-leads-sync.sql
```

Example integration row:

```sql
insert into public.crm_yandex_direct_integrations (
  workspace_id,
  name,
  oauth_token,
  client_login,
  turbo_page_ids,
  is_active
) values (
  'WORKSPACE_ID',
  'Яндекс Директ',
  'YANDEX_OAUTH_TOKEN',
  null,
  array[123456789]::bigint[],
  true
);
```

Use `client_login` only when the token belongs to an agency account and requests must be made for a specific advertiser.

Deployment note: this document is safe to update when a new Vercel deployment needs to be triggered without changing runtime code.
