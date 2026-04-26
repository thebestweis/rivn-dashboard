# CRM dialog webhook

Endpoint: `POST /api/crm/dialogs`

Auth: pass one of these secrets as `Authorization: Bearer <secret>`, `x-rivn-secret`, or `?secret=`:

- `CRM_WEBHOOK_SECRET`
- `CRON_SECRET`
- `VERCEL_CRON_SECRET`

## Payload

```json
{
  "workspaceId": "workspace_uuid",
  "channel": "avito",
  "avitoUserId": "123456789",
  "externalDialogId": "avito_chat_id",
  "externalMessageId": "avito_message_id",
  "sourceKind": "avito",
  "sourceName": "Avito",
  "title": "Диалог Avito",
  "clientName": "Иван",
  "phone": "+79990000000",
  "telegram": "@username",
  "body": "Здравствуйте, хочу уточнить условия",
  "senderType": "client",
  "createdAt": "2026-04-26T09:00:00.000Z"
}
```

## Behavior

- If the conversation already exists, the endpoint adds the message to the same CRM deal.
- If the conversation is new, the endpoint creates a CRM deal in the first active sales stage, attaches the conversation and saves the first message.
- If `externalMessageId` was already saved, the endpoint returns `duplicate: true` and does not create a second message.
- Assignment rules are applied by `sourceKind`.
- For Avito, the saved conversation key becomes `avito_user_id:chat_id`, so CRM can send replies back to the correct Avito account.

## Avito webhook

Public URL for Avito Messenger notifications:

```text
https://rivn-dashboard.vercel.app/api/avito/messenger/webhook
```

Register it in Avito Messenger API:

```http
POST https://api.avito.ru/messenger/v3/webhook
Authorization: Bearer AVITO_ACCESS_TOKEN
Content-Type: application/json

{
  "url": "https://rivn-dashboard.vercel.app/api/avito/messenger/webhook"
}
```

In the product UI this is now available in `/avito-reports`: open a connected
project, expand the Avito account and click "Подключить диалоги".

CRM replies are sent back to Avito through:

```http
POST https://api.avito.ru/messenger/v1/accounts/{user_id}/chats/{chat_id}/messages
```
