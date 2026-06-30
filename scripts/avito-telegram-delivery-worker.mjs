import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
const AVITO_TELEGRAM_QUEUE_MARKER = "AVITO_TELEGRAM_PENDING_V1";
const AVITO_TELEGRAM_FAILED_MARKER = "AVITO_TELEGRAM_FAILED_V1";

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

const config = {
  supabaseUrl: requiredEnv("NEXT_PUBLIC_SUPABASE_URL", ["SUPABASE_URL"]),
  serviceRoleKey: requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
  telegramBotToken: requiredEnv("AVITO_TELEGRAM_BOT_TOKEN", ["TELEGRAM_BOT_TOKEN"]),
  pollMs: Number(process.env.AVITO_TELEGRAM_WORKER_POLL_MS || 10_000),
  batchSize: Number(process.env.AVITO_TELEGRAM_WORKER_BATCH_SIZE || 10),
  messageLimit: Number(process.env.AVITO_TELEGRAM_MESSAGE_LIMIT || 3900),
  requestTimeoutMs: Number(process.env.AVITO_TELEGRAM_REQUEST_TIMEOUT_MS || 20_000),
};

const supabase = createClient(config.supabaseUrl, config.serviceRoleKey, {
  auth: { persistSession: false },
});

let isStopping = false;
let isDelivering = false;

function log(message, meta = {}) {
  console.log(JSON.stringify({ level: "info", service: "avito-telegram-worker", message, ...meta }));
}

function logError(message, error, meta = {}) {
  console.error(
    JSON.stringify({
      level: "error",
      service: "avito-telegram-worker",
      message,
      error: error instanceof Error ? error.message : String(error),
      ...meta,
    })
  );
}

function splitTelegramMessage(text) {
  if (text.length <= config.messageLimit) return [text];

  const parts = [];
  let current = "";

  for (const block of text.split("\n\n")) {
    const next = current ? `${current}\n\n${block}` : block;
    if (next.length <= config.messageLimit) {
      current = next;
      continue;
    }

    if (current) {
      parts.push(current);
      current = "";
    }

    if (block.length <= config.messageLimit) {
      current = block;
      continue;
    }

    for (let index = 0; index < block.length; index += config.messageLimit) {
      parts.push(block.slice(index, index + config.messageLimit));
    }
  }

  if (current) parts.push(current);
  return parts;
}

function formatTelegramError(error) {
  if (!error) return "network error";
  if (!(error instanceof Error)) return String(error);

  const cause = error.cause;
  const causeMessage = cause && typeof cause === "object" && "message" in cause ? String(cause.message) : cause ? String(cause) : "";
  const causeCode = cause && typeof cause === "object" && "code" in cause ? String(cause.code) : "";

  return [error.message, causeCode, causeMessage].filter(Boolean).join(" | ");
}

async function callTelegram(method, payload) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.requestTimeoutMs);

  try {
    const response = await fetch(`https://api.telegram.org/bot${config.telegramBotToken}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify(payload),
    });

    const body = await response.json().catch(() => null);
    if (!response.ok || !body?.ok) {
      throw new Error(body?.description || `Telegram ${method} failed: ${response.status}`);
    }

    return body.result;
  } catch (error) {
    throw new Error(formatTelegramError(error));
  } finally {
    clearTimeout(timeoutId);
  }
}

async function sendTelegramReport(chatId, text) {
  let lastMessage = null;

  for (const part of splitTelegramMessage(text)) {
    lastMessage = await callTelegram("sendMessage", {
      chat_id: chatId,
      text: part,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    });
    await sleep(350);
  }

  return lastMessage;
}

async function fetchPendingReports() {
  const { data, error } = await supabase
    .from("avito_report_logs")
    .select("id, client_id, telegram_chat_id, report_type, period_start, period_end, message, created_at")
    .eq("status", "success")
    .like("message", `${AVITO_TELEGRAM_QUEUE_MARKER}%`)
    .order("created_at", { ascending: true })
    .limit(config.batchSize);

  if (error) throw new Error(error.message);
  return data ?? [];
}

async function markReportStatus(reportId, status, message) {
  const patch = { status };
  if (typeof message === "string") patch.message = message;

  const { error } = await supabase.from("avito_report_logs").update(patch).eq("id", reportId);
  if (error) throw new Error(error.message);
}

async function deliverReport(report) {
  const chatId = report.telegram_chat_id ? String(report.telegram_chat_id) : "";
  const rawText = report.message ? String(report.message) : "";
  const text = rawText.startsWith(AVITO_TELEGRAM_QUEUE_MARKER)
    ? rawText.slice(AVITO_TELEGRAM_QUEUE_MARKER.length).replace(/^\n/, "")
    : rawText;

  if (!chatId) throw new Error("Report has no telegram_chat_id");
  if (!text) throw new Error("Report has empty message");

  const sent = await sendTelegramReport(chatId, text);
  await markReportStatus(report.id, "success", text);

  return {
    messageId: sent?.message_id ?? null,
  };
}

async function deliverPendingReports() {
  if (isDelivering) return;
  isDelivering = true;

  try {
    const reports = await fetchPendingReports();
    for (const report of reports) {
      if (isStopping) return;

      try {
        const result = await deliverReport(report);
        log("Avito report delivered", {
          reportId: report.id,
          clientId: report.client_id,
          chatId: report.telegram_chat_id,
          reportType: report.report_type,
          telegramMessageId: result.messageId,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await markReportStatus(report.id, "success", `${AVITO_TELEGRAM_FAILED_MARKER}\n${message}`).catch((updateError) =>
          logError("Failed to mark Avito report delivery as failed", updateError, { reportId: report.id })
        );
        logError("Avito report delivery failed", error, {
          reportId: report.id,
          clientId: report.client_id,
          chatId: report.telegram_chat_id,
          reportType: report.report_type,
        });
      }
    }
  } finally {
    isDelivering = false;
  }
}

async function main() {
  log("Avito Telegram delivery worker started", {
    pollMs: config.pollMs,
    batchSize: config.batchSize,
  });

  void deliverPendingReports().catch((error) => logError("Initial Avito report delivery failed", error));
  const timer = setInterval(() => {
    void deliverPendingReports().catch((error) => logError("Avito report delivery poll failed", error));
  }, config.pollMs);

  const stop = () => {
    isStopping = true;
    clearInterval(timer);
    log("Avito Telegram delivery worker stopped");
    setTimeout(() => process.exit(0), 500).unref();
  };

  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}

main().catch((error) => {
  logError("Avito Telegram delivery worker crashed", error);
  process.exitCode = 1;
});
