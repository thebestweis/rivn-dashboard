import { createDecipheriv } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { Api, TelegramClient } from "telegram";
import { NewMessage } from "telegram/events/index.js";
import { StringSession } from "telegram/sessions/index.js";

const sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms));

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
    if (!process.env[key]) process.env[key] = value;
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
  const useWSS = true;

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
    .select("id,label,encrypted_session_string,status,last_error")
    .eq("status", "active")
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
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

class ReaderRuntime {
  constructor(reader) {
    this.reader = reader;
    this.client = null;
    this.sourceChats = [];
    this.trackedDialogs = [];
    this.pollTimer = null;
    this.isStopping = false;
  }

  async start() {
    this.sourceChats = await loadSourceChats(this.reader.id);
    if (this.sourceChats.length === 0) {
      log("Reader пропущен: нет активных чатов", { readerId: this.reader.id });
      return;
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

    if (!(await this.client.isUserAuthorized())) {
      await updateReader(this.reader.id, {
        status: "auth_required",
        last_error: "Telegram session больше не авторизована",
        last_seen_at: new Date().toISOString(),
      });
      throw new Error(`Reader ${this.reader.id} требует повторной авторизации`);
    }

    await this.resolveDialogs();
    this.client.addEventHandler((event) => void this.handleNewMessage(event), new NewMessage({}));
    await this.pollRecentMessages();

    this.pollTimer = setInterval(() => {
      void this.pollRecentMessages().catch((error) => this.handleRuntimeError(error, "Ошибка фонового опроса сообщений"));
    }, config.syncIntervalMs);

    await updateReader(this.reader.id, { last_error: null, last_seen_at: new Date().toISOString() });
    log("Reader запущен", { readerId: this.reader.id, chats: this.trackedDialogs.length });
  }

  async stop() {
    this.isStopping = true;
    if (this.pollTimer) clearInterval(this.pollTimer);
    if (this.client) await this.client.disconnect();
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
    if (!this.client) return;
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
    if (!this.client || this.isStopping) return;

    for (const dialog of this.trackedDialogs) {
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
        if (message instanceof Api.Message) await this.processMessage(dialog.sourceChat, message);
      }
    }
  }

  async processMessage(sourceChat, message) {
    if (!this.client) return;
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
    await updateReader(this.reader.id, { last_error: null, last_seen_at: new Date().toISOString() });
    log("Сообщение обработано", {
      readerId: this.reader.id,
      sourceChatId: sourceChat.id,
      telegramMessageId,
      leadsCreated: result?.leadsCreated ?? 0,
      leadsDelivered: result?.leadsDelivered ?? 0,
    });
  }

  async handleRuntimeError(error, message) {
    logError(message, error, { readerId: this.reader.id });

    const errorMessage = error instanceof Error ? error.message : String(error);
    const isAuthError = /auth|session|authorize|unauthorized|AUTH_KEY|SESSION_REVOKED|USER_DEACTIVATED/i.test(errorMessage);

    await updateReader(this.reader.id, {
      status: isAuthError ? "auth_required" : "error",
      last_error: errorMessage,
      last_seen_at: new Date().toISOString(),
    });

    await this.stop();
  }
}

const runtimes = new Map();

async function syncReaders() {
  const readers = await loadReaders();
  const activeIds = new Set(readers.map((reader) => reader.id));

  for (const [readerId, runtime] of runtimes) {
    if (!activeIds.has(readerId)) {
      await runtime.stop();
      runtimes.delete(readerId);
      log("Reader остановлен", { readerId });
    }
  }

  for (const reader of readers) {
    if (runtimes.has(reader.id)) continue;

    const runtime = new ReaderRuntime(reader);
    try {
      await runtime.start();
      runtimes.set(reader.id, runtime);
    } catch (error) {
      await runtime.handleRuntimeError(error, "Reader не запустился");
    }
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
  });

  await syncReaders();
  setInterval(() => {
    void syncReaders().catch((error) => logError("Ошибка синхронизации reader-аккаунтов", error));
  }, config.syncIntervalMs);
}

main().catch((error) => {
  logError("RIVN Leads reader worker упал при запуске", error);
  process.exit(1);
});
