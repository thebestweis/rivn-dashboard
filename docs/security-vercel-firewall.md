# Vercel Firewall baseline

Use this as the production firewall baseline for RIVN Control.

## Already in repository

`vercel.json` denies:

- common scanner paths: `/wp-admin`, `/wp-login.php`, `/xmlrpc.php`, `/phpmyadmin`, `/.env`, `/.git`;
- production debug endpoints: `/api/avito/test*`, `/api/avito/get-token`, `/api/avito/get-all-items`, `/api/telegram/test*`.

## Enable in Vercel Firewall

Set these in Vercel Dashboard -> Project -> Firewall.

1. Enable Bot Protection in challenge mode.
2. Enable Attack Challenge Mode during active incidents.
3. Add API rate limit:
   - path starts with `/api/`;
   - fixed window 60 seconds;
   - limit 100 requests per IP;
   - action `deny`.
4. Add stricter webhook/cron rate limits:
   - path starts with `/api/cron/`;
   - fixed window 60 seconds;
   - limit 20 requests per IP;
   - action `deny`.
5. Add stricter auth page/API protection:
   - paths `/login`, `/register`;
   - fixed window 60 seconds;
   - limit 20 requests per IP;
   - action `challenge`.

## Notes

- Keep rate limiting on the edge, not in application memory. Serverless instances are not a reliable global counter.
- Do not challenge webhook providers unless they are explicitly allowlisted first.
- Review firewall logs after enabling rules in `log` mode for 24 hours, then switch to `deny`/`challenge`.
