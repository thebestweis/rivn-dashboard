import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

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

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

async function sendAlert(title, lines) {
  const telegramBotToken = env("RIVNOS_ALERT_BOT_TOKEN", [
    "AUTH_ALERT_BOT_TOKEN",
    "RIVN_LEADS_ALERT_BOT_TOKEN",
    "TELEGRAM_BOT_TOKEN",
  ]);
  const alertChatId = env("RIVNOS_ALERT_CHAT_ID", [
    "AUTH_ALERT_CHAT_ID",
    "RIVN_LEADS_ALERT_CHAT_ID",
    "CRON_ERROR_CHAT_ID",
  ]);

  if (!telegramBotToken || !alertChatId) {
    console.error("No RIVNOS_ALERT_BOT_TOKEN/RIVNOS_ALERT_CHAT_ID configured for site health alert");
    return;
  }

  const text = [
    `[RIVN OS] <b>${escapeHtml(title)}</b>`,
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

async function fetchWithTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      method: "GET",
      redirect: "manual",
      signal: controller.signal,
      headers: {
        "user-agent": "RIVN-OS-health-check/1.0",
      },
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function main() {
  const url = process.env.RIVNOS_HEALTH_URL || "https://rivnos.ru";
  const timeoutMs = Number(process.env.RIVNOS_HEALTH_TIMEOUT_MS || 12000);
  const startedAt = Date.now();

  try {
    const response = await fetchWithTimeout(url, timeoutMs);
    const durationMs = Date.now() - startedAt;

    if (response.status < 200 || response.status >= 400) {
      throw new Error(`Unexpected status ${response.status} after ${durationMs}ms`);
    }

    console.log(JSON.stringify({ ok: true, url, status: response.status, durationMs }, null, 2));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    await sendAlert("Сайт не прошёл health-check", [
      `URL: ${url}`,
      `Ошибка: ${message}`,
      `Время: ${new Date().toISOString()}`,
    ]).catch((alertError) => {
      console.error(alertError instanceof Error ? alertError.message : String(alertError));
    });

    console.error(JSON.stringify({ ok: false, url, error: message }, null, 2));
    process.exitCode = 1;
  }
}

main();
