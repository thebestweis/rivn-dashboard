import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

function loadEnvFile(fileName) {
  const path = resolve(process.cwd(), fileName);
  if (!existsSync(path)) return;

  const content = readFileSync(path, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

loadEnvFile(".env.production");
loadEnvFile(".env.local");

function env(name, fallbacks = []) {
  return process.env[name] || fallbacks.map((fallback) => process.env[fallback]).find(Boolean) || "";
}

function requiredEnv(name, fallbacks = []) {
  const value = env(name, fallbacks);
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

async function sendAlert(title, lines) {
  const telegramBotToken = env("RIVN_LEADS_ALERT_BOT_TOKEN", ["TELEGRAM_BOT_TOKEN"]);
  const alertChatId = env("RIVN_LEADS_ALERT_CHAT_ID", ["CRON_ERROR_CHAT_ID"]);

  if (!telegramBotToken || !alertChatId) {
    console.error(
      "No RIVN_LEADS_ALERT_BOT_TOKEN/TELEGRAM_BOT_TOKEN or RIVN_LEADS_ALERT_CHAT_ID/CRON_ERROR_CHAT_ID for RIVN Leads health alert"
    );
    return;
  }

  const text = [
    `[ALERT] <b>${escapeHtml(title)}</b>`,
    "",
    ...lines.map((line) => escapeHtml(line)),
  ].join("\n");

  const response = await fetch(`https://api.telegram.org/bot${telegramBotToken}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: alertChatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Telegram alert failed: ${response.status} ${body}`);
  }
}

async function count(supabase, table, apply = (query) => query) {
  const query = apply(supabase.from(table).select("id", { count: "exact", head: true }));
  const { count: value, error } = await query;
  if (error) throw new Error(`${table}: ${error.message}`);
  return value ?? 0;
}

function minutesSince(value) {
  if (!value) return Infinity;
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return Infinity;
  return Math.floor((Date.now() - timestamp) / 60_000);
}

async function main() {
  const supabase = createClient(
    requiredEnv("NEXT_PUBLIC_SUPABASE_URL", ["SUPABASE_URL"]),
    requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false } }
  );

  const staleAfterMinutes = Number(process.env.RIVN_LEADS_HEALTH_STALE_MINUTES || 10);

  const [
    activeSourceChats,
    activeProjects,
    projectsWithDestination,
    activeKeywords,
    enabledLinks,
    failedLeads,
    { data: readers, error: readersError },
  ] = await Promise.all([
    count(supabase, "rivn_leads_source_chats", (query) => query.eq("status", "active")),
    count(supabase, "rivn_leads_projects", (query) => query.eq("status", "active")),
    count(supabase, "rivn_leads_projects", (query) => query.eq("status", "active").not("destination_chat_id", "is", null)),
    count(supabase, "rivn_leads_keywords", (query) => query.eq("enabled", true)),
    count(supabase, "rivn_leads_project_source_chats", (query) => query.eq("enabled", true)),
    count(supabase, "rivn_leads_leads", (query) => query.eq("status", "delivery_failed")),
    supabase
      .from("rivn_leads_reader_accounts")
      .select("id,label,status,last_error,last_seen_at")
      .order("created_at", { ascending: true }),
  ]);

  if (readersError) throw new Error(readersError.message);

  const issues = [];
  const readerRows = readers ?? [];
  const activeReaders = readerRows.filter((reader) => reader.status === "active");
  const staleReaders = activeReaders.filter((reader) => minutesSince(reader.last_seen_at) > staleAfterMinutes);
  const brokenReaders = readerRows.filter((reader) => reader.status !== "active");

  if (readerRows.length === 0) issues.push("No reader accounts found.");
  if (activeReaders.length === 0) issues.push("No active reader accounts.");
  if (brokenReaders.length > 0) {
    issues.push(
      ...brokenReaders.map(
        (reader) => `Reader "${reader.label || reader.id}" status=${reader.status}, error=${reader.last_error || "empty"}`
      )
    );
  }
  if (staleReaders.length > 0) {
    issues.push(
      ...staleReaders.map(
        (reader) => `Reader "${reader.label || reader.id}" is stale: last_seen_at=${reader.last_seen_at || "empty"}`
      )
    );
  }
  if (activeSourceChats === 0) issues.push("No active source chats.");
  if (activeProjects === 0) issues.push("No active projects.");
  if (projectsWithDestination === 0) issues.push("No active projects with destination chat.");
  if (activeKeywords === 0) issues.push("No active keywords.");
  if (enabledLinks === 0) issues.push("No enabled project/chat links.");
  if (failedLeads > 0) issues.push(`There are ${failedLeads} failed leads.`);

  const summary = {
    readers: readerRows.length,
    activeReaders: activeReaders.length,
    activeSourceChats,
    activeProjects,
    projectsWithDestination,
    activeKeywords,
    enabledLinks,
    failedLeads,
  };

  if (issues.length > 0) {
    await sendAlert("RIVN Leads health check failed", [
      ...issues,
      "",
      `Summary: ${JSON.stringify(summary)}`,
    ]);
    console.error(JSON.stringify({ ok: false, issues, summary }, null, 2));
    process.exitCode = 1;
    return;
  }

  console.log(JSON.stringify({ ok: true, summary }, null, 2));
}

main().catch(async (error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  await sendAlert("RIVN Leads health check crashed", [message]).catch((alertError) => {
    console.error(alertError instanceof Error ? alertError.message : String(alertError));
  });
  process.exitCode = 1;
});
