import { createDecipheriv } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { Api, TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";

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

function requiredEnv(name, fallbackNames = []) {
  const value = process.env[name] || fallbackNames.map((fallback) => process.env[fallback]).find(Boolean);
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function parseArgs() {
  const args = process.argv.slice(2);
  const readerIdIndex = args.indexOf("--reader-id");
  const limitIndex = args.indexOf("--limit");

  return {
    readerId: readerIdIndex >= 0 ? args[readerIdIndex + 1] : null,
    limit: limitIndex >= 0 ? Number(args[limitIndex + 1]) : null,
  };
}

const args = parseArgs();

const config = {
  supabaseUrl: requiredEnv("NEXT_PUBLIC_SUPABASE_URL", ["SUPABASE_URL"]),
  serviceRoleKey: requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
  telegramApiId: Number(requiredEnv("TELEGRAM_API_ID")),
  telegramApiHash: requiredEnv("TELEGRAM_API_HASH"),
  encryptionKey: requiredEnv("RIVN_LEADS_ENCRYPTION_KEY", ["ENCRYPTION_KEY"]),
  dialogScanLimit: Math.min(Math.max(Number(process.env.RIVN_LEADS_DIALOG_SCAN_LIMIT || 5000), 500), 5000),
};

if (!Number.isFinite(config.telegramApiId) || config.telegramApiId <= 0) {
  throw new Error("TELEGRAM_API_ID must be a number");
}

const supabase = createClient(config.supabaseUrl, config.serviceRoleKey, {
  auth: { persistSession: false },
});

function getTelegramProxy() {
  const ip = process.env.TELEGRAM_PROXY_IP || process.env.TELEGRAM_PROXY_HOST;
  const port = Number(process.env.TELEGRAM_PROXY_PORT);
  const socksType = Number(process.env.TELEGRAM_PROXY_SOCKS_TYPE || 5);

  if (!ip || !Number.isFinite(port) || port <= 0) return undefined;

  return {
    ip,
    port,
    socksType: socksType === 4 ? 4 : 5,
    username: process.env.TELEGRAM_PROXY_USERNAME || undefined,
    password: process.env.TELEGRAM_PROXY_PASSWORD || undefined,
    timeout: Number(process.env.TELEGRAM_PROXY_TIMEOUT_SECONDS || 10),
  };
}

function getTelegramClientOptions(connectionRetries) {
  const proxy = getTelegramProxy();

  return {
    connectionRetries,
    useWSS: proxy ? false : true,
    proxy,
  };
}

function getKey(encryptionKey) {
  const maybeBase64 = Buffer.from(encryptionKey, "base64");
  if (maybeBase64.length === 32) return maybeBase64;

  const utf8 = Buffer.from(encryptionKey, "utf8");
  if (utf8.length === 32) return utf8;

  throw new Error("RIVN_LEADS_ENCRYPTION_KEY must be exactly 32 bytes in utf8 or base64");
}

function decryptSessionString(encryptedSessionString, encryptionKey) {
  const [version, ivBase64, tagBase64, encryptedBase64] = String(encryptedSessionString || "").split(":");
  if (version !== "v1" || !ivBase64 || !tagBase64 || !encryptedBase64) {
    throw new Error("Telegram session string is saved in an unsupported format");
  }

  const decipher = createDecipheriv("aes-256-gcm", getKey(encryptionKey), Buffer.from(ivBase64, "base64"));
  decipher.setAuthTag(Buffer.from(tagBase64, "base64"));

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedBase64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

function withTimeout(promise, ms, message) {
  let timeoutId = null;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), ms);
  });

  return Promise.race([promise, timeout]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  });
}

function getTelegramEntityKind(entity) {
  const className = entity?.className || entity?.constructor?.name || "";

  if (entity instanceof Api.Chat || className.includes("Chat")) return "chat";
  if (entity instanceof Api.Channel || className.includes("Channel")) return "channel";

  return null;
}

function toTelegramChatId(entity) {
  const id = entity?.id;
  const kind = getTelegramEntityKind(entity);

  if (id === null || id === undefined || !kind) return null;
  if (kind === "channel") return `-100${String(id)}`;
  return `-${String(id)}`;
}

function dialogTitle(entity) {
  return entity?.title || null;
}

function dialogUsername(entity) {
  return entity?.username ?? null;
}

function dialogKind(entity) {
  const kind = getTelegramEntityKind(entity);

  if (kind === "chat") return "group";
  if (kind === "channel") return entity?.megagroup ? "supergroup" : "channel_discussion";

  return null;
}

function dialogMemberCount(entity) {
  return entity?.participantsCount ?? null;
}

async function ensureSourceChatCategory(niche) {
  const normalizedNiche = niche?.trim().toLowerCase();
  const preferredSlug = normalizedNiche === "crm" ? "crm" : normalizedNiche === "marketing" ? "marketing" : null;

  let query = supabase
    .from("rivn_leads_source_chat_categories")
    .select("id")
    .limit(1);

  if (preferredSlug) query = query.eq("slug", preferredSlug);

  const { data: existing, error: existingError } = await query.maybeSingle();
  if (existingError) throw new Error(existingError.message);
  if (existing?.id) return existing.id;

  const { data: fallback, error: fallbackError } = await supabase
    .from("rivn_leads_source_chat_categories")
    .select("id")
    .order("name", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (fallbackError) throw new Error(fallbackError.message);
  if (fallback?.id) return fallback.id;

  const { data: created, error: createError } = await supabase
    .from("rivn_leads_source_chat_categories")
    .insert({
      name: "Business",
      slug: "business",
      description: "Telegram business chats for lead monitoring",
    })
    .select("id")
    .single();

  if (createError) throw new Error(createError.message);
  return created.id;
}

async function loadReaders() {
  let query = supabase
    .from("rivn_leads_reader_accounts")
    .select("id,label,encrypted_session_string,status,assigned_niche,max_chats_limit")
    .not("encrypted_session_string", "is", null)
    .order("created_at", { ascending: true });

  if (args.readerId) query = query.eq("id", args.readerId);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function updateReader(readerId, payload) {
  const { error } = await supabase
    .from("rivn_leads_reader_accounts")
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq("id", readerId);

  if (error) console.error(`Reader status update failed: ${error.message}`);
}

async function linkChatsToProjects(readerId, savedChats, now) {
  const { data: projects, error: projectsError } = await supabase
    .from("rivn_leads_projects")
    .select("id")
    .eq("reader_account_id", readerId);

  if (projectsError) throw new Error(projectsError.message);
  if (!projects?.length || !savedChats?.length) return 0;

  const links = projects.flatMap((project) =>
    savedChats.map((chat) => ({
      project_id: project.id,
      source_chat_id: chat.id,
      enabled: true,
      updated_at: now,
    }))
  );

  const { error: linksError } = await supabase
    .from("rivn_leads_project_source_chats")
    .upsert(links, { onConflict: "project_id,source_chat_id" });

  if (linksError) throw new Error(linksError.message);
  return links.length;
}

async function scanReader(reader) {
  const now = new Date().toISOString();
  const limit = Math.min(args.limit || config.dialogScanLimit, config.dialogScanLimit);
  const sessionString = decryptSessionString(reader.encrypted_session_string, config.encryptionKey);
  const telegramClientOptions = getTelegramClientOptions(5);
  const client = new TelegramClient(
    new StringSession(sessionString),
    config.telegramApiId,
    config.telegramApiHash,
    telegramClientOptions
  );

  console.log(`\nReader: ${reader.label || reader.id}`);
  console.log(`Connection: useWSS=${telegramClientOptions.useWSS}, proxy=${Boolean(telegramClientOptions.proxy)}`);

  try {
    await withTimeout(client.connect(), 20_000, "Telegram connection timeout");

    const isAuthorized = await withTimeout(
      client.isUserAuthorized(),
      8_000,
      "Telegram authorization check timeout"
    );

    if (!isAuthorized) {
      throw new Error("Reader account requires Telegram re-authorization");
    }

    const dialogs = await withTimeout(
      client.getDialogs({ limit }),
      30_000,
      "Telegram chat list loading timeout"
    );

    const categoryId = await ensureSourceChatCategory(reader.assigned_niche);
    const uniqueRows = new Map();

    for (const dialog of dialogs) {
      const telegramChatId = toTelegramChatId(dialog.entity);
      const title = dialogTitle(dialog.entity);
      const type = dialogKind(dialog.entity);
      const username = dialogUsername(dialog.entity);

      if (!telegramChatId || !title || !type) continue;

      uniqueRows.set(telegramChatId, {
        category_id: categoryId,
        reader_account_id: reader.id,
        title,
        telegram_chat_id: telegramChatId,
        username,
        type,
        access_level: username ? "public" : "private",
        status: "active",
        member_count: dialogMemberCount(dialog.entity),
        last_checked_at: now,
        updated_at: now,
      });
    }

    const rows = [...uniqueRows.values()];

    if (rows.length === 0) {
      await updateReader(reader.id, {
        status: "active",
        last_error: "Telegram connected, but no group chats were found",
        last_seen_at: now,
      });
      console.log("Result: connected, but no group chats were found.");
      return { found: 0, saved: 0, linked: 0 };
    }

    const { data: savedChats, error: saveChatsError } = await supabase
      .from("rivn_leads_source_chats")
      .upsert(rows, { onConflict: "telegram_chat_id" })
      .select("id,title");

    if (saveChatsError) throw new Error(saveChatsError.message);

    const linked = await linkChatsToProjects(reader.id, savedChats ?? [], now);

    await updateReader(reader.id, {
      status: "active",
      last_error: null,
      last_seen_at: now,
    });

    console.log(`Result: found=${rows.length}, saved=${savedChats?.length ?? 0}, linked=${linked}`);
    return { found: rows.length, saved: savedChats?.length ?? 0, linked };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const isAuthError = /auth|session|authorize|unauthorized|AUTH_KEY|SESSION_REVOKED|USER_DEACTIVATED/i.test(message);

    await updateReader(reader.id, {
      status: isAuthError ? "auth_required" : "error",
      last_error: message,
      last_seen_at: now,
    });

    console.error(`Result: failed - ${message}`);
    return { found: 0, saved: 0, linked: 0, failed: true };
  } finally {
    await client.disconnect().catch(() => undefined);
  }
}

async function main() {
  const readers = await loadReaders();
  if (readers.length === 0) {
    console.log("No reader accounts with saved Telegram session string found.");
    return;
  }

  let totalFound = 0;
  let totalSaved = 0;
  let totalLinked = 0;
  let failed = 0;

  for (const reader of readers) {
    const result = await scanReader(reader);
    totalFound += result.found ?? 0;
    totalSaved += result.saved ?? 0;
    totalLinked += result.linked ?? 0;
    if (result.failed) failed += 1;
  }

  console.log(`\nDone. readers=${readers.length}, found=${totalFound}, saved=${totalSaved}, linked=${totalLinked}, failed=${failed}`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
