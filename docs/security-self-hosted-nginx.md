# Self-hosted security checklist

This project runs through PM2 on port `3000`. Put Nginx in front of it and keep
the Node.js port closed from the public internet.

## Nginx baseline

Replace `rivnos.ru` with the real domain if needed.

```nginx
limit_req_zone $binary_remote_addr zone=rivn_api:10m rate=10r/s;
limit_req_zone $binary_remote_addr zone=rivn_sensitive_api:10m rate=2r/s;
limit_conn_zone $binary_remote_addr zone=rivn_conn:10m;

server {
    listen 80;
    server_name rivnos.ru www.rivnos.ru;
    return 301 https://rivnos.ru$request_uri;
}

server {
    listen 443 ssl http2;
    server_name rivnos.ru;

    client_max_body_size 1m;
    limit_conn rivn_conn 30;

    add_header X-Content-Type-Options nosniff always;
    add_header X-Frame-Options DENY always;
    add_header Referrer-Policy strict-origin-when-cross-origin always;
    add_header X-Robots-Tag "noindex, nofollow" always;

    location ~* ^/(wp-admin|wp-login\.php|xmlrpc\.php|phpmyadmin|\.env|\.git) {
        return 444;
    }

    location ~ ^/api/(avito/test|avito/get-token|avito/get-all-items|telegram/test) {
        return 404;
    }

    location ~ ^/api/(cron|telegram/webhook|crm|avito/messenger/webhook|rivn-leads/ingest) {
        limit_req zone=rivn_sensitive_api burst=20 nodelay;
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /api/ {
        limit_req zone=rivn_api burst=50 nodelay;
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Apply

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## Firewall

Allow only SSH, HTTP, and HTTPS from the public internet. Keep `3000` private.

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw deny 3000/tcp
sudo ufw enable
sudo ufw status
```

## PM2

```bash
cd /var/www/rivnos
npm ci
npm run build
pm2 start ecosystem.config.cjs
pm2 save
pm2 status
```

## Required env

Set these on the server before restart:

```txt
CRON_SECRET=long-random-secret
CRM_WEBHOOK_SECRET=long-random-secret
RIVN_LEADS_INGEST_SECRET=long-random-secret
TELEGRAM_WEBHOOK_SECRET=long-random-secret
TELEGRAM_WEBHOOK_SECRET_ENFORCED=true
```

After changing the Telegram secret, call the webhook setup endpoint once:

```bash
curl "https://rivnos.ru/api/telegram/set-webhook?secret=CRON_SECRET_VALUE"
```
