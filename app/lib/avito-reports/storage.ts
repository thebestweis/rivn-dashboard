import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/app/lib/supabase/service-role";

export type AvitoReportsStorageMode = "supabase" | "standalone";

const avitoReportsTables = new Set([
  "avito_report_accounts",
  "avito_report_chat_links",
  "avito_report_clients",
  "avito_report_expenses",
  "avito_report_item_cache",
  "avito_report_logs",
  "avito_report_metrics",
  "avito_report_snapshots",
  "avito_report_stats_cache",
  "avito_report_sync_jobs",
  "avito_telegram_delivery_queue",
]);

function storageMode(): AvitoReportsStorageMode {
  return process.env.AVITO_REPORTS_STORAGE_MODE === "standalone"
    ? "standalone"
    : "supabase";
}

function requiredStandaloneEnv(name: string, fallbackName?: string) {
  const value =
    process.env[name]?.trim() ||
    (fallbackName ? process.env[fallbackName]?.trim() : "");

  if (!value) {
    throw new Error(
      `${name} is required when AVITO_REPORTS_STORAGE_MODE=standalone`
    );
  }

  return value;
}

export function isAvitoReportsTable(table: string) {
  return avitoReportsTables.has(table);
}

export function createAvitoReportsClient(): SupabaseClient {
  if (storageMode() === "supabase") {
    return createServiceRoleClient();
  }

  const url = requiredStandaloneEnv(
    "AVITO_REPORTS_DATABASE_URL",
    "RIVN_LEADS_DATABASE_URL"
  ).replace(/\/+$/, "");
  const serviceKey = requiredStandaloneEnv(
    "AVITO_REPORTS_DATABASE_SERVICE_KEY",
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

export function createAvitoAwareServiceClient(): SupabaseClient {
  const platformClient = createServiceRoleClient();

  if (storageMode() === "supabase") {
    return platformClient;
  }

  const avitoClient = createAvitoReportsClient();

  return new Proxy(platformClient, {
    get(target, property, receiver) {
      if (property === "from") {
        return (table: string) =>
          (isAvitoReportsTable(table) ? avitoClient : platformClient).from(
            table
          );
      }

      const value = Reflect.get(target, property, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

export function getAvitoReportsStorageInfo() {
  const mode = storageMode();
  const configuredUrl =
    mode === "standalone"
      ? process.env.AVITO_REPORTS_DATABASE_URL ||
        process.env.RIVN_LEADS_DATABASE_URL
      : process.env.SUPABASE_SERVER_URL ||
        process.env.SUPABASE_URL ||
        process.env.NEXT_PUBLIC_SUPABASE_URL;
  const configuredKey =
    mode === "standalone"
      ? process.env.AVITO_REPORTS_DATABASE_SERVICE_KEY ||
        process.env.RIVN_LEADS_DATABASE_SERVICE_KEY
      : process.env.SUPABASE_SERVICE_ROLE_KEY;

  let host: string | null = null;
  try {
    host = configuredUrl ? new URL(configuredUrl).host : null;
  } catch {
    host = null;
  }

  return {
    mode,
    host,
    configured: Boolean(configuredUrl && configuredKey),
  };
}
