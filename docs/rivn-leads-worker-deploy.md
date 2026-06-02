# RIVN Leads: запуск worker на сервере

RIVN Leads состоит из двух частей:

- основной сайт и API RIVN OS;
- отдельный `rivn-leads-reader` worker, который постоянно читает Telegram-чаты через reader-аккаунты.

## Что уже можно делать в админке

На странице `/admin-leads` супер-админ может:

- создавать проекты поиска лидов;
- добавлять Telegram-чаты-источники;
- добавлять ключевые слова и стоп-слова;
- создавать reader-аккаунты;
- назначать reader-аккаунты на чаты;
- запускать тестовый входящий лид;
- смотреть последние лиды и ошибки доставки.

Reader-аккаунт хранит Telegram `session string` только в зашифрованном виде.

## Env-переменные

В `.env.production` на сервере должны быть:

```txt
NEXT_PUBLIC_SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
TELEGRAM_BOT_TOKEN=...
TELEGRAM_API_ID=...
TELEGRAM_API_HASH=...
RIVN_LEADS_ENCRYPTION_KEY=...
RIVN_LEADS_INGEST_SECRET=...
RIVN_LEADS_APP_URL=https://rivnos.ru
```

Если `RIVN_LEADS_INGEST_SECRET` не заполнен, worker попробует использовать `CRON_SECRET`.

`RIVN_LEADS_ENCRYPTION_KEY` должен быть ровно 32 байта в utf8 или base64. Этот ключ нужен, чтобы шифровать и расшифровывать Telegram session string.

## Установка зависимости Telegram

После деплоя на сервере нужно выполнить:

```bash
cd /var/www/rivnos
npm install
```

Это подтянет пакет `telegram`, который нужен для чтения Telegram-чатов.

## Как получить Telegram session string

На сервере запусти:

```bash
cd /var/www/rivnos
npm run leads:session
```

Дальше скрипт попросит:

1. телефон reader-аккаунта;
2. код из Telegram;
3. 2FA-пароль, если он включён.

После успешной авторизации скрипт покажет `Session string`. Его нужно скопировать в `/admin-leads` во вкладке `Reader-аккаунты`.

Это не пароль от Telegram. Это техническая сессия reader-аккаунта. После сохранения в RIVN OS она сразу шифруется.

## Запуск через PM2

Если хочешь запустить и сайт, и worker из общего файла:

```bash
cd /var/www/rivnos
pm2 start ecosystem.config.cjs
pm2 save
```

Если основной сайт уже запущен как `rivnos`, можно запустить только worker:

```bash
cd /var/www/rivnos
pm2 start npm --name rivn-leads-reader -- run leads:reader
pm2 save
```

## Проверка

```bash
pm2 status
pm2 logs rivn-leads-reader --lines 100
```

В логах должны быть понятные события:

- `Запускаем RIVN Leads reader worker`;
- `Reader запущен`;
- `Сообщение обработано`.

## Рабочий поток

1. В `/admin-leads` создаётся reader-аккаунт.
2. В reader вставляется Telegram session string.
3. Session string шифруется и сохраняется в Supabase.
4. В `/admin-leads` добавляются чаты-источники.
5. Чаты назначаются на reader-аккаунт.
6. Проекту назначаются чаты, ключевые слова, стоп-слова и Telegram-беседа для доставки.
7. Worker читает новые сообщения.
8. API проверяет сообщение по правилам проекта.
9. Если сообщение похоже на заявку, создаётся лид.
10. Лид отправляется в Telegram-беседу проекта.

## Важно

Worker должен запускаться в одном экземпляре на текущем этапе. Когда будем масштабировать систему на несколько серверов, нужно добавить Redis/DB-lock, чтобы два worker не читали один reader-аккаунт одновременно.
