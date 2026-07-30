export function getRivnLeadsStorageConfig(requiredEnv) {
  const mode =
    process.env.RIVN_LEADS_STORAGE_MODE === "standalone"
      ? "standalone"
      : "supabase";

  if (mode === "standalone") {
    return {
      mode,
      url: requiredEnv("RIVN_LEADS_DATABASE_URL").replace(/\/+$/, ""),
      serviceKey: requiredEnv("RIVN_LEADS_DATABASE_SERVICE_KEY"),
    };
  }

  return {
    mode,
    url: requiredEnv("SUPABASE_SERVER_URL", [
      "SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_URL",
    ]).replace(/\/+$/, ""),
    serviceKey: requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
  };
}

export function storageHost(url) {
  try {
    return new URL(url).host;
  } catch {
    return "invalid-url";
  }
}
