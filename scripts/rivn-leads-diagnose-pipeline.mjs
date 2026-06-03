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

const supabaseUrl = env("NEXT_PUBLIC_SUPABASE_URL", ["SUPABASE_URL"]);
const serviceRoleKey = env("SUPABASE_SERVICE_ROLE_KEY");

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Supabase env is not configured");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

async function count(table, apply = (query) => query) {
  const query = apply(supabase.from(table).select("id", { count: "exact", head: true }));
  const { count: value, error } = await query;
  if (error) throw new Error(`${table}: ${error.message}`);
  return value ?? 0;
}

async function main() {
  const [
    readers,
    activeReaders,
    sourceChats,
    activeSourceChats,
    projects,
    activeProjects,
    projectsWithDestination,
    keywords,
    activeKeywords,
    links,
    enabledLinks,
    leadsNew,
    leadsDelivered,
    leadsFailed,
  ] = await Promise.all([
    count("rivn_leads_reader_accounts"),
    count("rivn_leads_reader_accounts", (query) => query.eq("status", "active")),
    count("rivn_leads_source_chats"),
    count("rivn_leads_source_chats", (query) => query.eq("status", "active")),
    count("rivn_leads_projects"),
    count("rivn_leads_projects", (query) => query.eq("status", "active")),
    count("rivn_leads_projects", (query) => query.eq("status", "active").not("destination_chat_id", "is", null)),
    count("rivn_leads_keywords"),
    count("rivn_leads_keywords", (query) => query.eq("enabled", true)),
    count("rivn_leads_project_source_chats"),
    count("rivn_leads_project_source_chats", (query) => query.eq("enabled", true)),
    count("rivn_leads_leads", (query) => query.eq("status", "new")),
    count("rivn_leads_leads", (query) => query.eq("status", "delivered")),
    count("rivn_leads_leads", (query) => query.eq("status", "delivery_failed")),
  ]);

  const { data: readerRows, error: readersError } = await supabase
    .from("rivn_leads_reader_accounts")
    .select("id,label,status,last_error,last_seen_at")
    .order("created_at", { ascending: true });
  if (readersError) throw new Error(readersError.message);

  const { data: projectRows, error: projectsError } = await supabase
    .from("rivn_leads_projects")
    .select("id,name,status,reader_account_id,destination_chat_id,telegram_bot_added")
    .order("created_at", { ascending: true });
  if (projectsError) throw new Error(projectsError.message);

  const { data: keywordRows, error: keywordsError } = await supabase
    .from("rivn_leads_keywords")
    .select("project_id,value,normalized_value,match_type,enabled")
    .order("created_at", { ascending: true })
    .limit(30);
  if (keywordsError) throw new Error(keywordsError.message);

  const output = {
    counts: {
      readers,
      activeReaders,
      sourceChats,
      activeSourceChats,
      projects,
      activeProjects,
      projectsWithDestination,
      keywords,
      activeKeywords,
      links,
      enabledLinks,
      leadsNew,
      leadsDelivered,
      leadsFailed,
    },
    readers: readerRows ?? [],
    projects: projectRows ?? [],
    keywords: keywordRows ?? [],
  };

  console.log(JSON.stringify(output, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
