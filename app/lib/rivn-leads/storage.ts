import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/app/lib/supabase/service-role";

export type RivnLeadsStorageMode = "supabase" | "standalone";

function storageMode(): RivnLeadsStorageMode {
  return process.env.RIVN_LEADS_STORAGE_MODE === "standalone"
    ? "standalone"
    : "supabase";
}

function requiredStandaloneEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(
      `${name} is required when RIVN_LEADS_STORAGE_MODE=standalone`
    );
  }
  return value;
}

export function createRivnLeadsClient(): SupabaseClient {
  if (storageMode() === "supabase") {
    return createServiceRoleClient();
  }

  const url = requiredStandaloneEnv("RIVN_LEADS_DATABASE_URL").replace(
    /\/+$/,
    ""
  );
  const serviceKey = requiredStandaloneEnv(
    "RIVN_LEADS_DATABASE_SERVICE_KEY"
  );

  return createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

export function getRivnLeadsStorageInfo() {
  const mode = storageMode();
  const configuredUrl =
    mode === "standalone"
      ? process.env.RIVN_LEADS_DATABASE_URL
      : process.env.SUPABASE_SERVER_URL ||
        process.env.SUPABASE_URL ||
        process.env.NEXT_PUBLIC_SUPABASE_URL;

  let host: string | null = null;
  try {
    host = configuredUrl ? new URL(configuredUrl).host : null;
  } catch {
    host = null;
  }

  return {
    mode,
    host,
    configured: Boolean(configuredUrl),
  };
}
