import { createDecipheriv } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { Api, TelegramClient } from "telegram";
import { NewMessage } from "telegram/events/index.js";
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
  if (!value) throw new Error(`${name} не заполнен`);
  return value;
}

const config = {
  supabaseUrl: requiredEnv("NEXT_PUBLIC_SUPABASE_URL", ["SUPABASE_URL"]),
  serviceRoleKey: requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
  telegramApiId: Number(requiredEnv("TELEGRAM_API_ID")),
  telegramApiHash: requiredEnv("TELEGRAM_API_HASH"),
  encryptionKey: requiredEnv("RIVN_LEADS_ENCRYPTION_KEY", ["ENCRYPTION_KEY"]),
  ingestSecret: requiredEnv("RIVN_LEADS_INGEST_SECRET", ["CRON_SECRET", "VERCEL_CRON_SECRET"]),
  appUrl: (process.env.RIVN_LEADS_APP_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL || "https://rivnos.ru").replace(/\/$/, ""),
  syncIntervalMs: Number(process.env.RIVN_LEADS_READER_SYNC_MS || 30_000),
  recentMessagesLimit: Number(process.env.RIVN_LEADS_RECENT_MESSAGES_LIMIT || 10),
  heartbeatMs: Number(process.env.RIVN_LEADS_READER_HEARTBEAT_MS || 60_000),
  telegramBotToken: process.env.RIVN_LEADS_ALERT_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || "",
  alertChatId: process.env.RIVN_LEADS_ALERT_CHAT_ID || process.env.CRON_ERROR_CHAT_ID || "",
  alertThrottleMs: Number(process.env.RIVN_LEADS_ALERT_THROTTLE_MS || 300_000),
};

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
  const useWSS = proxy ? false : true;

  return {
    connectionRetries,
    useWSS,
    proxy,
  };
}

if (!Number.isFinite(config.telegramApiId) || config.telegramApiId <= 0) {
  throw new Error("TELEGRAM_API_ID должен быть числом");
}

const supabase = createClient(config.supabaseUrl, config.serviceRoleKey, {
  auth: { persistSession: false },
});

function log(message, meta = {}) {
  console.log(JSON.stringify({ level: "info", service: "rivn-leads-reader", message, ...meta }));
}

function logError(message, error, meta = {}) {
  console.error(
    JSON.stringify({
      level: "error",
      service: "rivn-leads-reader",
      message,
      error: error instanceof Error ? error.message : String(error),
      ...meta,
    })
  );
}

const alertSentAt = new Map();

function isRecoverableReaderError(error) {
  return /disconnected|reconnect|TIMEOUT|Not connected|fetch failed|network|socket hang up|ECONNRESET|ETIMEDOUT|ECONNREFUSED|EAI_AGAIN|ENOTFOUND|temporar|external service|Telegram connection was reset|Внешний сервис|временно не ответил/i.test(
    String(error || "")
  );
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

async function sendAdminAlert(title, lines = [], throttleKey = title) {
  if (!config.telegramBotToken || !config.alertChatId) return;

  const now = Date.now();
  const previousSentAt = alertSentAt.get(throttleKey) || 0;
  if (now - previousSentAt < config.alertThrottleMs) return;
  alertSentAt.set(throttleKey, now);

  const text = [
    `[ALERT] <b>${escapeHtml(title)}</b>`,
    "",
    ...lines.map((line) => escapeHtml(line)),
  ].join("\n");

  try {
    const response = await fetch(`https://api.telegram.org/bot${config.telegramBotToken}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: config.alertChatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      logError("RIVN Leads alert delivery failed", new Error(`${response.status}: ${body}`));
    }
  } catch (error) {
    logError("RIVN Leads alert delivery failed", error);
  }
}

function getKey(encryptionKey) {
  const maybeBase64 = Buffer.from(encryptionKey, "base64");
  if (maybeBase64.length === 32) return maybeBase64;

  const utf8 = Buffer.from(encryptionKey, "utf8");
  if (utf8.length === 32) return utf8;

  throw new Error("RIVN_LEADS_ENCRYPTION_KEY должен быть ровно 32 байта в utf8 или base64");
}

function decryptSessionString(encryptedSessionString, encryptionKey) {
  const [version, ivBase64, tagBase64, encryptedBase64] = encryptedSessionString.split(":");
  if (version !== "v1" || !ivBase64 || !tagBase64 || !encryptedBase64) {
    throw new Error("Неподдерживаемый формат Telegram session string");
  }

  const decipher = createDecipheriv("aes-256-gcm", getKey(encryptionKey), Buffer.from(ivBase64, "base64"));
  decipher.setAuthTag(Buffer.from(tagBase64, "base64"));

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedBase64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

function getPeerId(peer) {
  if (!peer || typeof peer !== "object") return null;
  const rawId = peer.channelId ?? peer.chatId ?? peer.userId;
  return rawId === undefined || rawId === null ? null : String(rawId);
}

function toTelegramChatId(entity) {
  if (entity instanceof Api.Channel) return `-100${String(entity.id)}`;
  if (entity instanceof Api.Chat) return `-${String(entity.id)}`;
  return null;
}

function peerLookupKeys(telegramChatId) {
  const keys = new Set([telegramChatId]);
  if (telegramChatId.startsWith("-100")) keys.add(telegramChatId.slice(4));
  if (telegramChatId.startsWith("-")) keys.add(telegramChatId.slice(1));
  return [...keys];
}

function getMessageDate(message) {
  return typeof message.date === "number" ? new Date(message.date * 1000).toISOString() : new Date().toISOString();
}

function buildMessageLink(sourceChat, telegramMessageId) {
  if (sourceChat.username) return `https://t.me/${sourceChat.username}/${telegramMessageId}`;
  const internalChatId = String(sourceChat.telegram_chat_id).replace(/^-100/, "");
  return internalChatId ? `https://t.me/c/${internalChatId}/${telegramMessageId}` : null;
}

async function resolveSender(client, message) {
  if (!message.senderId) return { authorName: null, authorUsername: null };

  try {
    const entity = await client.getEntity(message.senderId);
    if (entity instanceof Api.User) {
      const name = [entity.firstName, entity.lastName].filter(Boolean).join(" ").trim();
      return {
        authorName: name || null,
        authorUsername: entity.username ?? null,
      };
    }
  } catch {
    return { authorName: null, authorUsername: null };
  }

  return { authorName: null, authorUsername: null };
}

async function sendToIngest(payload) {
  const response = await fetch(`${config.appUrl}/api/rivn-leads/ingest`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-rivn-leads-secret": config.ingestSecret,
    },
    body: JSON.stringify(payload),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.ok) {
    throw new Error(body?.error || `RIVN Leads ingest failed: ${response.status}`);
  }
  return body.result;
}

async function loadReaders() {
  const { data, error } = await supabase
    .from("rivn_leads_reader_accounts")
    .select("id,label,encrypted_session_string,status,last_error,assigned_niche,max_chats_limit")
    .in("status", ["active", "error"])
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []).filter((reader) => {
    if (reader.status === "active") return true;
    return isRecoverableReaderError(reader.last_error);
  });
}

async function loadSourceChats(readerId) {
  const { data, error } = await supabase
    .from("rivn_leads_source_chats")
    .select("id,title,telegram_chat_id,username,status")
    .eq("reader_account_id", readerId)
    .eq("status", "active");

  if (error) throw new Error(error.message);
  return data ?? [];
}

function isChatScanRequested(reader) {
  return String(reader?.last_error || "").startsWith("chat_scan_requested:");
}

async function updateReader(readerId, payload) {
  const { error } = await supabase
    .from("rivn_leads_reader_accounts")
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq("id", readerId);
  if (error) logError("Не удалось обновить reader", error, { readerId });
}

async function updateSourceChat(sourceChatId, payload) {
  const { error } = await supabase
    .from("rivn_leads_source_chats")
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq("id", sourceChatId);
  if (error) logError("Не удалось обновить чат-источник", error, { sourceChatId });
}

function dialogTitle(entity) {
  return entity?.title || null;
}

function dialogUsername(entity) {
  return entity?.username ?? null;
}

function dialogKind(entity) {
  if (entity instanceof Api.Chat) return "group";
  if (entity instanceof Api.Channel) return entity.megagroup ? "supergroup" : "channel_discussion";
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

class ReaderRuntime {
  constructor(reader) {
    this.reader = reader;
    this.client = null;
    this.sourceChats = [];
    this.trackedDialogs = [];
    this.pollTimer = null;
    this.isStopping = false;
    this.isConnected = false;
    this.isPolling = false;
    this.needsRestart = false;
  }

  async start() {
    const shouldScanChats = isChatScanRequested(this.reader);
    this.sourceChats = await loadSourceChats(this.reader.id);
    if (this.sourceChats.length === 0 && !shouldScanChats) {
      log("Reader пропущен: нет активных чатов", { readerId: this.reader.id });
      return false;
    }

    const sessionString = decryptSessionString(this.reader.encrypted_session_string, config.encryptionKey);
    const telegramClientOptions = getTelegramClientOptions(5);
    log("Reader Telegram connection mode", {
      readerId: this.reader.id,
      useWSS: telegramClientOptions.useWSS,
      proxy: Boolean(telegramClientOptions.proxy),
    });

    this.client = new TelegramClient(
      new StringSession(sessionString),
      config.telegramApiId,
      config.telegramApiHash,
      telegramClientOptions
    );

    await this.client.connect();
    this.isConnected = true;

    if (!(await this.client.isUserAuthorized())) {
      await updateReader(this.reader.id, {
        status: "auth_required",
        last_error: "Telegram session больше не авторизована",
        last_seen_at: new Date().toISOString(),
      });
      throw new Error(`Reader ${this.reader.id} требует повторной авторизации`);
    }

    if (shouldScanChats) {
      const result = await this.scanReaderChats();
      log("Reader Telegram chats scanned", { readerId: this.reader.id, ...result });
      this.sourceChats = await loadSourceChats(this.reader.id);

      if (this.sourceChats.length === 0) {
        log("Reader пропущен: нет активных чатов", { readerId: this.reader.id });
        await this.stop();
        return false;
      }
    }

    await this.resolveDialogs();
    this.client.addEventHandler((event) => void this.handleNewMessage(event), new NewMessage({}));
    await this.pollRecentMessages();

    this.pollTimer = setInterval(() => {
      void this.pollRecentMessages().catch((error) => this.handleRuntimeError(error, "Ошибка фонового опроса сообщений"));
    }, config.syncIntervalMs);

    await updateReader(this.reader.id, { status: "active", last_error: null, last_seen_at: new Date().toISOString() });
    log("Reader запущен", { readerId: this.reader.id, chats: this.trackedDialogs.length });
    return true;
  }

  async stop() {
    this.isStopping = true;
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.isConnected = false;
    if (this.client) await this.client.disconnect().catch(() => undefined);
  }

  async scanReaderChats() {
    if (!this.client) return { found: 0, saved: 0, linked: 0 };

    const now = new Date().toISOString();
    const limit = Math.min(Number(this.reader.max_chats_limit) || 500, 500);
    const dialogs = await this.client.getDialogs({ limit });
    const categoryId = await ensureSourceChatCategory(this.reader.assigned_niche);
    const uniqueRows = new Map();

    for (const dialog of dialogs) {
      const telegramChatId = toTelegramChatId(dialog.entity);
      const title = dialogTitle(dialog.entity);
      const type = dialogKind(dialog.entity);
      const username = dialogUsername(dialog.entity);

      if (!telegramChatId || !title || !type) continue;

      uniqueRows.set(telegramChatId, {
        category_id: categoryId,
        reader_account_id: this.reader.id,
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
      await updateReader(this.reader.id, {
        status: "active",
        last_error: "Telegram connected, but no group chats were found",
        last_seen_at: now,
      });
      return { found: 0, saved: 0, linked: 0 };
    }

    const { data: savedChats, error: saveChatsError } = await supabase
      .from("rivn_leads_source_chats")
      .upsert(rows, { onConflict: "telegram_chat_id" })
      .select("id,title");

    if (saveChatsError) throw new Error(saveChatsError.message);

    const linked = await linkChatsToProjects(this.reader.id, savedChats ?? [], now);

    await updateReader(this.reader.id, {
      status: "active",
      last_error: null,
      last_seen_at: now,
    });

    return { found: rows.length, saved: savedChats?.length ?? 0, linked };
  }

  async resolveDialogs() {
    if (!this.client) return;

    const dialogs = await this.client.getDialogs({ limit: 500 });
    const sourceChatsById = new Map();

    for (const chat of this.sourceChats) {
      for (const key of peerLookupKeys(chat.telegram_chat_id)) {
        sourceChatsById.set(key, chat);
      }
    }

    this.trackedDialogs = dialogs
      .map((dialog) => {
        const telegramChatId = toTelegramChatId(dialog.entity);
        const sourceChat = telegramChatId ? sourceChatsById.get(telegramChatId) : undefined;
        if (!sourceChat || !dialog.entity) return null;
        return { sourceChat, entity: dialog.entity };
      })
      .filter(Boolean);

    const trackedIds = new Set(this.trackedDialogs.map((dialog) => dialog.sourceChat.id));
    await Promise.all(
      this.sourceChats
        .filter((chat) => !trackedIds.has(chat.id))
        .map((chat) =>
          updateSourceChat(chat.id, {
            status: "access_lost",
            last_checked_at: new Date().toISOString(),
          })
        )
    );
  }

  async handleNewMessage(event) {
    if (!this.client || this.isStopping || !this.isConnected) return;
    const message = event.message;
    if (!(message instanceof Api.Message)) return;

    const rawPeerId = getPeerId(message.peerId);
    const sourceChat = this.sourceChats.find((chat) => {
      const keys = peerLookupKeys(chat.telegram_chat_id);
      return keys.includes(String(rawPeerId)) || keys.includes(`-100${rawPeerId}`) || keys.includes(`-${rawPeerId}`);
    });

    if (!sourceChat) return;
    await this.processMessage(sourceChat, message);
  }

  async pollRecentMessages() {
    if (!this.client || this.isStopping || this.isPolling || !this.isConnected) return;

    this.isPolling = true;

    try {
      for (const dialog of this.trackedDialogs) {
        if (this.isStopping || !this.isConnected) return;

        let messages = [];
        try {
          messages = await this.client.getMessages(dialog.entity, { limit: config.recentMessagesLimit });
        } catch (error) {
          if (/CHANNEL_PRIVATE|CHAT_ADMIN_REQUIRED|not a participant|forbidden|access/i.test(String(error))) {
            await updateSourceChat(dialog.sourceChat.id, {
              status: "access_lost",
              last_checked_at: new Date().toISOString(),
            });
            continue;
          }
          throw error;
        }

        for (const message of [...messages].reverse()) {
          if (this.isStopping || !this.isConnected) return;
          if (message instanceof Api.Message) await this.processMessage(dialog.sourceChat, message);
        }
      }
    } finally {
      this.isPolling = false;
    }
  }

  async processMessage(sourceChat, message) {
    if (!this.client || this.isStopping || !this.isConnected) return;
    const text = message.message ?? "";
    if (!text.trim()) return;

    const sender = await resolveSender(this.client, message);
    const telegramMessageId = String(message.id);
    const result = await sendToIngest({
      sourceChatId: sourceChat.id,
      telegramChatId: sourceChat.telegram_chat_id,
      telegramMessageId,
      messageText: text,
      authorName: sender.authorName,
      authorUsername: sender.authorUsername,
      messageLink: buildMessageLink(sourceChat, telegramMessageId),
      messageDate: getMessageDate(message),
    });

    await updateSourceChat(sourceChat.id, {
      last_message_at: getMessageDate(message),
      last_checked_at: new Date().toISOString(),
    });
    await updateReader(this.reader.id, { status: "active", last_error: null, last_seen_at: new Date().toISOString() });
    log("Сообщение обработано", {
      readerId: this.reader.id,
      sourceChatId: sourceChat.id,
      telegramMessageId,
      leadsCreated: result?.leadsCreated ?? 0,
      leadsDelivered: result?.leadsDelivered ?? 0,
      reason: result?.reason ?? null,
      leadIds: result?.leadIds ?? [],
    });
  }

  async handleRuntimeError(error, message) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const isDisconnectError = /disconnected|reconnect|TIMEOUT|Not connected/i.test(errorMessage);
    const isRecoverableError = isRecoverableReaderError(errorMessage);

    if (this.isStopping && isDisconnectError) return;

    logError(message, error, { readerId: this.reader.id });

    const isAuthError = /auth|session|authorize|unauthorized|AUTH_KEY|SESSION_REVOKED|USER_DEACTIVATED/i.test(errorMessage);
    const readerLabel = this.reader.label || this.reader.id;

    if (isRecoverableError && !isAuthError) {
      await sendAdminAlert(
        "RIVN Leads reader is reconnecting",
        [
          `Reader: ${readerLabel}`,
          `Reason: ${errorMessage}`,
          "Status: recoverable error, worker will restart reader automatically.",
        ],
        `reader-recoverable:${this.reader.id}:${errorMessage.slice(0, 120)}`
      );
      this.needsRestart = true;
      await updateReader(this.reader.id, {
        status: "active",
        last_error: errorMessage,
        last_seen_at: new Date().toISOString(),
      });
      await this.stop();
      return;
    }

    await sendAdminAlert(
      isAuthError ? "RIVN Leads reader needs Telegram re-auth" : "RIVN Leads reader stopped",
      [
        `Reader: ${readerLabel}`,
        `Reason: ${errorMessage}`,
        `Status: ${isAuthError ? "auth_required" : "error"}`,
        isAuthError
          ? "Action: generate and save a new Telegram session string."
          : "Action: check worker logs and run leads diagnostics.",
      ],
      `reader-fatal:${this.reader.id}:${isAuthError ? "auth" : errorMessage.slice(0, 120)}`
    );

    await updateReader(this.reader.id, {
      status: isAuthError ? "auth_required" : "error",
      last_error: errorMessage,
      last_seen_at: new Date().toISOString(),
    });

    await this.stop();
  }
}

const runtimes = new Map();
const startingReaders = new Set();
let lastHeartbeatAt = 0;

async function syncReaders() {
  const readers = await loadReaders();
  const activeIds = new Set(readers.map((reader) => reader.id));
  const scanRequestedIds = new Set(readers.filter(isChatScanRequested).map((reader) => reader.id));

  for (const [readerId, runtime] of runtimes) {
    if (!activeIds.has(readerId) || runtime.needsRestart || scanRequestedIds.has(readerId)) {
      await runtime.stop();
      runtimes.delete(readerId);
      log(runtime.needsRestart ? "Reader будет перезапущен" : "Reader остановлен", { readerId });
    }
  }

  for (const reader of readers) {
    if (runtimes.has(reader.id) || startingReaders.has(reader.id)) continue;

    startingReaders.add(reader.id);
    const runtime = new ReaderRuntime(reader);
    try {
      const started = await runtime.start();
      if (started) runtimes.set(reader.id, runtime);
    } catch (error) {
      await runtime.handleRuntimeError(error, "Reader не запустился");
    } finally {
      startingReaders.delete(reader.id);
    }
  }

  const now = Date.now();
  if (now - lastHeartbeatAt >= config.heartbeatMs) {
    lastHeartbeatAt = now;
    log("Reader heartbeat", {
      activeReaders: readers.length,
      runningReaders: runtimes.size,
      startingReaders: startingReaders.size,
      runtimes: [...runtimes.values()].map((runtime) => ({
        readerId: runtime.reader.id,
        sourceChats: runtime.sourceChats.length,
        trackedDialogs: runtime.trackedDialogs.length,
        connected: runtime.isConnected,
        needsRestart: runtime.needsRestart,
        isPolling: runtime.isPolling,
      })),
    });
  }
}

async function shutdown(signal) {
  log("Останавливаем RIVN Leads reader", { signal });
  await Promise.all([...runtimes.values()].map((runtime) => runtime.stop()));
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

async function main() {
  log("Запускаем RIVN Leads reader worker", {
    appUrl: config.appUrl,
    syncIntervalMs: config.syncIntervalMs,
    heartbeatMs: config.heartbeatMs,
  });

  await syncReaders();
  setInterval(() => {
    void syncReaders().catch((error) => {
      logError("Ошибка синхронизации reader-аккаунтов", error);
      void sendAdminAlert(
        "RIVN Leads reader sync failed",
        [
          `Reason: ${error instanceof Error ? error.message : String(error)}`,
          "Action: check rivn-leads-reader PM2 logs and Supabase connectivity.",
        ],
        "reader-sync-failed"
      );
    });
  }, config.syncIntervalMs);
}

main().catch((error) => {
  logError("RIVN Leads reader worker упал при запуске", error);
  void sendAdminAlert(
    "RIVN Leads reader worker crashed on startup",
    [
      `Reason: ${error instanceof Error ? error.message : String(error)}`,
      "Action: check .env.production and restart PM2 process.",
    ],
    "reader-startup-crash"
  ).finally(() => {
    process.exit(1);
  });
});
