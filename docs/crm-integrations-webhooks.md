# CRM integrations

Этот документ описывает, как заявки попадают в CRM. Основной принцип: все внешние каналы создают сделки через единый CRM-вход, поэтому источник заявки и правила распределения менеджерам работают одинаково.

## Tilda

Ссылку для Tilda нужно брать в интерфейсе:

```text
/crm/integrations -> блок Tilda -> Скопировать webhook
```

Форма может отправлять `JSON`, `multipart/form-data` или `application/x-www-form-urlencoded`.

Основные поля определяются автоматически:

- `name`, `Name`, `Имя` -> имя клиента
- `phone`, `Phone`, `Телефон` -> телефон
- `telegram`, `Telegram`, `tg` -> Telegram
- `serviceAmount`, `Стоимость услуги` -> стоимость услуги
- `budget`, `Бюджет`, `Рекламный бюджет` -> бюджет

Все дополнительные поля попадают в описание сделки.

## Telegram CRM

Отдельный CRM webhook для Telegram также нужно брать в интерфейсе:

```text
/crm/integrations -> блок Telegram -> Скопировать webhook
```

Этот endpoint создаёт или обновляет CRM-диалог по Telegram chat id. Если диалог новый, RIVN OS создаёт сделку и применяет правила распределения менеджерам.

Важно: не заменять этим URL webhook бота Avito-отчётов. Бот отчётов используется для привязки бесед и daily/weekly отчётов.

## Yandex Direct: generic webhook

Webhook для внешних форм, квизов, Roistat, Albato, Make и похожих сервисов берётся здесь:

```text
/crm/integrations -> блок Яндекс Директ -> Скопировать webhook
```

Рекомендуемые поля:

- `name` / `clientName` / `Имя`
- `phone` / `tel` / `Телефон`
- `telegram` / `tg`
- `utm_campaign` / `campaign`
- `utm_term` / `keyword`
- `budget`
- `serviceAmount`

Сделка создаётся с `sourceKind = yandex_direct`, поэтому правила распределения могут направлять такие заявки отдельно от Avito, Tilda или Telegram.

## Yandex Direct: Leads API auto sync

Подключение больше не нужно делать SQL-запросом вручную.

Нормальный путь:

1. Открыть `/crm/integrations`.
2. В блоке Яндекс Директ вставить OAuth-токен.
3. Если аккаунт агентский, указать `Client-Login`.
4. Нажать `Найти турбо-страницы`.
5. Выбрать нужные страницы.
6. Нажать `Сохранить подключение`.
7. Нажать `Проверить подключение`.

RIVN OS сам сохранит `workspace_id`, токен, логин клиента и выбранные турбо-страницы в `crm_yandex_direct_integrations`.

Маршрут синхронизации:

```text
https://rivn-dashboard.vercel.app/api/cron/yandex-direct-leads?secret=CRON_SECRET
```

Что делает синхронизация:

- берёт активные строки из `crm_yandex_direct_integrations`;
- запрашивает новые заявки через Yandex Direct `Leads.get`;
- создаёт сделку в CRM с источником `yandex_direct`;
- применяет правила распределения менеджерам;
- сохраняет импорт в `crm_yandex_direct_imports`;
- пропускает дубли по `integration_id + external_lead_id`;
- обновляет `last_synced_at`.

SQL-схема лежит здесь:

```text
docs/yandex-direct-leads-sync.sql
```

Ручной SQL insert нужен только для аварийной настройки, когда интерфейс недоступен.
