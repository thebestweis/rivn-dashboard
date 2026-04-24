export function verifyCronSecret(request: Request) {
  const url = new URL(request.url);
  const secret = url.searchParams.get("secret");
  const expectedSecret =
    process.env.CRON_SECRET || process.env.VERCEL_CRON_SECRET;

  if (!expectedSecret) {
    throw new Error(
      "CRON_SECRET is not available in this Vercel function. Check the Vercel project and Production environment variables, then redeploy."
    );
  }

  if (secret !== expectedSecret) {
    return false;
  }

  return true;
}
