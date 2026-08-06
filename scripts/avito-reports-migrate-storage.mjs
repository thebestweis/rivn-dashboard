import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { getAvitoReportsStorageConfig } from "./lib/avito-reports-storage.mjs";

function loadEnvFile(fileName) {
  const path = resolve(process.cwd(), fileName);
  if (!existsSync(path)) return;

  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator < 1) continue;

    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvFile(".env.production");
loadEnvFile(".env.local");

function required(name, fallbacks = []) {
  const value =
    process.env[name] ||
    fallbacks.map((fallback) => process.env[fallback]).find(Boolean);
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function inferOfficialSupabaseUrl(serviceKey) {
  try {
    const payload = JSON.parse(
      Buffer.from(serviceKey.split(".")[1], "base64url").toString("utf8")
    );
    return payload.ref ? `https://${payload.ref}.supabase.co` : "";
  } catch {
    return "";
  }
}

const sourceKey = required("AVITO_REPORTS_MIGRATION_SOURCE_KEY", [
  "SUPABASE_SERVICE_ROLE_KEY",
]);
const sourceUrl = (
  process.env.AVITO_REPORTS_MIGRATION_SOURCE_URL ||
  process.env.SUPABASE_SERVER_URL ||
  inferOfficialSupabaseUrl(sourceKey) ||
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  ""
).replace(/\/+$/, "");

if (!sourceUrl) {
  throw new Error("AVITO_REPORTS_MIGRATION_SOURCE_URL is not configured");
}

const targetStorage = getAvitoReportsStorageConfig({
  ...process.env,
  AVITO_REPORTS_STORAGE_MODE: "standalone",
});
const apply = process.argv.includes("--apply");
const pageSize = 500;

if (sourceUrl === targetStorage.url) {
  throw new Error("Migration source and target URLs must be different");
}

const source = createClient(sourceUrl, sourceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const target = createClient(targetStorage.url, targetStorage.serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const tables = [
  {
    name: "avito_report_clients",
    columns: [
      "id",
      "workspace_id",
      "project_id",
      "name",
      "client_code",
      "telegram_chat_id",
      "is_active",
      "daily_reports_enabled",
      "weekly_reports_enabled",
      "created_at",
      "updated_at",
    ],
  },
  {
    name: "avito_report_accounts",
    columns: [
      "id",
      "client_id",
      "name",
      "access_token",
      "avito_user_id",
      "avito_client_id",
      "avito_client_secret",
      "crm_dialogs_enabled",
      "is_active",
      "created_at",
      "updated_at",
    ],
  },
  {
    name: "avito_report_chat_links",
    columns: [
      "id",
      "client_id",
      "telegram_chat_id",
      "telegram_chat_title",
      "linked_by_telegram_id",
      "linked_by_username",
      "is_active",
      "created_at",
      "updated_at",
    ],
  },
  {
    name: "avito_report_logs",
    columns: [
      "id",
      "client_id",
      "telegram_chat_id",
      "report_type",
      "period_start",
      "period_end",
      "status",
      "message",
      "error",
      "created_at",
      "updated_at",
    ],
  },
  {
    name: "avito_report_metrics",
    columns: [
      "id",
      "client_id",
      "account_id",
      "report_type",
      "period_start",
      "period_end",
      "views",
      "contacts",
      "favorites",
      "expenses",
      "conversion",
      "cost_per_contact",
      "raw",
      "created_at",
      "updated_at",
    ],
  },
  {
    name: "avito_report_expenses",
    columns: [
      "id",
      "account_id",
      "expense_date",
      "amount",
      "created_at",
      "updated_at",
    ],
  },
  {
    name: "avito_report_item_cache",
    columns: [
      "id",
      "account_id",
      "avito_user_id",
      "item_ids",
      "next_page",
      "is_complete",
      "fetched_at",
      "created_at",
      "updated_at",
    ],
  },
  {
    name: "avito_report_stats_cache",
    columns: [
      "id",
      "account_id",
      "avito_user_id",
      "date_from",
      "date_to",
      "item_ids_hash",
      "views",
      "contacts",
      "favorites",
      "processed_chunks",
      "total_chunks",
      "is_complete",
      "created_at",
      "updated_at",
    ],
  },
  {
    name: "avito_report_snapshots",
    columns: [
      "id",
      "client_id",
      "account_id",
      "report_type",
      "period_type",
      "period_start",
      "period_end",
      "views",
      "contacts",
      "favorites",
      "expenses",
      "conversion",
      "cost_per_contact",
      "stats_status",
      "expenses_status",
      "quality_status",
      "warnings",
      "attempts",
      "last_error",
      "raw",
      "fetched_at",
      "created_at",
      "updated_at",
    ],
  },
  {
    name: "avito_report_sync_jobs",
    columns: [
      "id",
      "client_id",
      "account_id",
      "report_type",
      "period_start",
      "period_end",
      "status",
      "priority",
      "attempts",
      "next_run_at",
      "locked_at",
      "last_error",
      "created_at",
      "updated_at",
    ],
  },
  {
    name: "avito_telegram_delivery_queue",
    columns: [
      "id",
      "client_id",
      "telegram_chat_id",
      "report_type",
      "period_start",
      "period_end",
      "dedupe_key",
      "message",
      "status",
      "attempts",
      "last_error",
      "telegram_message_id",
      "created_at",
      "updated_at",
      "sent_at",
    ],
  },
];

async function countRows(client, table) {
  const { count, error } = await client
    .from(table)
    .select("id", { count: "exact", head: true });
  if (error) throw new Error(`${table} count failed: ${error.message}`);
  return count ?? 0;
}

async function migrateTable(table) {
  const sourceCount = await countRows(source, table.name);
  const beforeCount = await countRows(target, table.name);

  if (apply) {
    for (let from = 0; from < sourceCount; from += pageSize) {
      const { data, error: readError } = await source
        .from(table.name)
        .select("*")
        .order("id", { ascending: true })
        .range(from, from + pageSize - 1);
      if (readError) {
        throw new Error(
          `${table.name} read failed at offset ${from}: ${readError.message}`
        );
      }
      if (!data?.length) break;

      const rows = data.map((row) =>
        Object.fromEntries(
          table.columns
            .filter((column) => Object.hasOwn(row, column))
            .map((column) => [column, row[column]])
        )
      );
      const { error: writeError } = await target
        .from(table.name)
        .upsert(rows, { onConflict: "id" });
      if (writeError) {
        throw new Error(
          `${table.name} write failed at offset ${from}: ${writeError.message}`
        );
      }
    }
  }

  const afterCount = await countRows(target, table.name);
  if (apply && afterCount !== sourceCount) {
    throw new Error(
      `${table.name} verification failed: source=${sourceCount}, target=${afterCount}`
    );
  }

  return { table: table.name, sourceCount, beforeCount, afterCount };
}

console.log(
  JSON.stringify({
    mode: apply ? "apply" : "dry-run",
    sourceHost: new URL(sourceUrl).host,
    targetHost: new URL(targetStorage.url).host,
  })
);

const sourceClientCount = await countRows(source, "avito_report_clients");
if (apply && sourceClientCount === 0) {
  throw new Error(
    "Source contains no Avito report clients. Refusing to apply an empty migration."
  );
}

for (const table of tables) {
  console.log(JSON.stringify(await migrateTable(table)));
}

console.log(
  apply
    ? "Avito Reports migration completed and row counts verified."
    : "Dry run completed. Run again with --apply to copy data."
);
