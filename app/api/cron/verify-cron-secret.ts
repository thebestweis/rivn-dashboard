export function verifyCronSecret(request: Request) {
  const url = new URL(request.url);
  const secret = url.searchParams.get("secret");

  if (!process.env.CRON_SECRET) {
    throw new Error("CRON_SECRET не задан");
  }

  if (secret !== process.env.CRON_SECRET) {
    return false;
  }

  return true;
}