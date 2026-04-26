export function verifyCronSecret(request: Request) {
  const url = new URL(request.url);
  const secret = url.searchParams.get("secret");
  const authorization = request.headers.get("authorization");
  const bearerSecret = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : null;
  const expectedSecrets = [
    process.env.CRON_SECRET,
    process.env.VERCEL_CRON_SECRET,
  ].filter((value): value is string => Boolean(value));

  if (expectedSecrets.length === 0) {
    throw new Error(
      "CRON_SECRET is not available in this Vercel function. Check the Vercel project and Production environment variables, then redeploy."
    );
  }

  if (
    !expectedSecrets.includes(secret ?? "") &&
    !expectedSecrets.includes(bearerSecret ?? "")
  ) {
    return false;
  }

  return true;
}

export function getCronSecret() {
  const secret = process.env.CRON_SECRET || process.env.VERCEL_CRON_SECRET;

  if (!secret) {
    throw new Error(
      "CRON_SECRET is not available in this Vercel function. Check the Vercel project and Production environment variables, then redeploy."
    );
  }

  return secret;
}
