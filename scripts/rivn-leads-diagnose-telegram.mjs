import { createDecipheriv } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { TelegramClient } from "telegram";
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

function envFlag(name, defaultValue) {
  const value = process.env[name];
  if (value === undefined || value === null || value === "") return defaultValue;
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

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

function withTimeout(promise, ms, message) {
  let timeoutId = null;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), ms);
  });

  return Promise.race([promise, timeout]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  });
}

async function testMode({ label, sessionString, apiId, apiHash, useWSS, proxy }) {
  const startedAt = Date.now();
  const client = new TelegramClient(new StringSession(sessionString), apiId, apiHash, {
    connectionRetries: 1,
    useWSS,
    proxy,
  });

  try {
    console.log(`\n[${label}] Проверяем подключение...`);
    console.log(`[${label}] mode: useWSS=${useWSS}, proxy=${proxy ? `${proxy.ip}:${proxy.port}` : "off"}`);
    await withTimeout(client.connect(), 15_000, `[${label}] connect timeout`);
    const authorized = await withTimeout(client.isUserAuthorized(), 5_000, `[${label}] auth timeout`);
    if (!authorized) throw new Error(`[${label}] session не авторизована`);

    const dialogs = await withTimeout(client.getDialogs({ limit: 20 }), 15_000, `[${label}] getDialogs timeout`);
    console.log(`[${label}] OK: подключение работает, чатов получено: ${dialogs.length}, время: ${Date.now() - startedAt}ms`);
  } catch (error) {
    console.error(`[${label}] ERROR: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    await client.disconnect().catch(() => undefined);
  }
}

async function main() {
  const supabaseUrl = requiredEnv("NEXT_PUBLIC_SUPABASE_URL", ["SUPABASE_URL"]);
  const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  const apiId = Number(requiredEnv("TELEGRAM_API_ID"));
  const apiHash = requiredEnv("TELEGRAM_API_HASH");
  const encryptionKey = requiredEnv("RIVN_LEADS_ENCRYPTION_KEY", ["ENCRYPTION_KEY"]);

  if (!Number.isFinite(apiId) || apiId <= 0) throw new Error("TELEGRAM_API_ID должен быть числом");

  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  const { data: reader, error } = await supabase
    .from("rivn_leads_reader_accounts")
    .select("id,label,encrypted_session_string,status,last_error")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!reader) throw new Error("Reader-аккаунты не найдены");

  console.log(`Reader: ${reader.label} (${reader.id})`);
  console.log(`Статус: ${reader.status}`);
  if (reader.last_error) console.log(`Последняя ошибка: ${reader.last_error}`);

  const sessionString = decryptSessionString(reader.encrypted_session_string, encryptionKey);

  await testMode({ label: "old-direct-useWSS-false", sessionString, apiId, apiHash, useWSS: false });
  await testMode({ label: "wss-443-useWSS-true", sessionString, apiId, apiHash, useWSS: true });

  const proxy = getTelegramProxy();
  if (proxy) {
    await testMode({ label: "configured-proxy-80", sessionString, apiId, apiHash, useWSS: false, proxy });
    await testMode({ label: "configured-proxy-443", sessionString, apiId, apiHash, useWSS: true, proxy });
  } else {
    console.log("\n[configured-proxy] Прокси не настроен. Для проверки прокси добавь TELEGRAM_PROXY_* в .env.production.");
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
