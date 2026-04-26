# CRM lead webhook

Endpoint:

```text
POST /api/crm/leads
```

Auth:

```text
Authorization: Bearer <CRM_WEBHOOK_SECRET>
```

If `CRM_WEBHOOK_SECRET` is not configured yet, the endpoint also accepts `CRON_SECRET` / `VERCEL_CRON_SECRET`.

Body example:

```json
{
  "workspaceId": "workspace_uuid",
  "sourceKind": "tilda",
  "sourceName": "Tilda",
  "title": "Заявка с формы",
  "clientName": "Иван",
  "phone": "+79990000000",
  "telegram": "@username",
  "serviceAmount": 50000,
  "budget": 150000,
  "description": "Комментарий клиента",
  "nextContactAt": "2026-04-26T12:00:00.000Z"
}
```

Behavior:

- Finds or creates CRM source by `sourceKind`.
- Creates a deal in the first active sales pipeline stage.
- Applies CRM assignment rules by source if no responsible manager is passed manually.
- Returns `dealId`, `sourceId`, `pipelineId`, `stageId` and assigned manager ids.
