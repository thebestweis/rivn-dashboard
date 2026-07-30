import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

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

const sourceUrl = required(
  "RIVN_LEADS_MIGRATION_SOURCE_URL",
  ["SUPABASE_SERVER_URL", "SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"]
).replace(/\/+$/, "");
const sourceKey = required("RIVN_LEADS_MIGRATION_SOURCE_KEY", [
  "SUPABASE_SERVICE_ROLE_KEY",
]);
const targetUrl = required("RIVN_LEADS_DATABASE_URL").replace(/\/+$/, "");
const targetKey = required("RIVN_LEADS_DATABASE_SERVICE_KEY");
const apply = process.argv.includes("--apply");
const pageSize = 500;

if (sourceUrl === targetUrl) {
  throw new Error("Migration source and target URLs must be different");
}

const source = createClient(sourceUrl, sourceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const target = createClient(targetUrl, targetKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const tables = [
  "rivn_leads_reader_accounts",
  "rivn_leads_source_chat_categories",
  "rivn_leads_source_chats",
  "rivn_leads_projects",
  "rivn_leads_project_source_chats",
  "rivn_leads_keywords",
  "rivn_leads_stop_words",
  "rivn_leads_special_chat_requests",
  "rivn_leads_telegram_messages",
  "rivn_leads_leads",
  "rivn_leads_blocked_authors",
  "rivn_leads_processed_messages",
  "rivn_leads_delivery_logs",
  "rivn_leads_daily_reports",
  "rivn_leads_audit_logs",
];

async function countRows(client, table) {
  const { count, error } = await client
    .from(table)
    .select("id", { count: "exact", head: true });
  if (error) throw new Error(`${table} count failed: ${error.message}`);
  return count ?? 0;
}

async function readPage(table, from) {
  const { data, error } = await source
    .from(table)
    .select("*")
    .order("id", { ascending: true })
    .range(from, from + pageSize - 1);
  if (error) throw new Error(`${table} read failed: ${error.message}`);
  return data ?? [];
}

async function migrateTable(table) {
  const sourceCount = await countRows(source, table);
  const beforeCount = await countRows(target, table);

  if (!apply) {
    return { table, sourceCount, beforeCount, afterCount: beforeCount };
  }

  for (let from = 0; from < sourceCount; from += pageSize) {
    const rows = await readPage(table, from);
    if (rows.length === 0) break;

    const { error } = await target
      .from(table)
      .upsert(rows, { onConflict: "id" });
    if (error) {
      throw new Error(`${table} write failed at offset ${from}: ${error.message}`);
    }
  }

  const afterCount = await countRows(target, table);
  if (afterCount !== sourceCount) {
    throw new Error(
      `${table} verification failed: source=${sourceCount}, target=${afterCount}. ` +
        "The target contains missing or extra rows; stop the cutover and reconcile it."
    );
  }

  return { table, sourceCount, beforeCount, afterCount };
}

console.log(
  JSON.stringify({
    mode: apply ? "apply" : "dry-run",
    sourceHost: new URL(sourceUrl).host,
    targetHost: new URL(targetUrl).host,
  })
);

for (const table of tables) {
  const result = await migrateTable(table);
  console.log(JSON.stringify(result));
}

console.log(
  apply
    ? "RIVN Leads storage migration completed and row counts verified."
    : "Dry run completed. Run again with --apply to copy data."
);
