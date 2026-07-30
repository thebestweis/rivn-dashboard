export function getAvitoReportsStorageConfig(env = process.env) {
  const standalone = env.AVITO_REPORTS_STORAGE_MODE === "standalone";

  const url = standalone
    ? env.AVITO_REPORTS_DATABASE_URL || env.RIVN_LEADS_DATABASE_URL
    : env.SUPABASE_SERVER_URL ||
      env.SUPABASE_URL ||
      env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = standalone
    ? env.AVITO_REPORTS_DATABASE_SERVICE_KEY ||
      env.RIVN_LEADS_DATABASE_SERVICE_KEY
    : env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      standalone
        ? "Avito Reports standalone storage is not configured"
        : "Supabase storage is not configured"
    );
  }

  return {
    mode: standalone ? "standalone" : "supabase",
    url: url.replace(/\/+$/, ""),
    serviceKey,
  };
}
