import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

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
  telegramBotToken: requiredEnv("TELEGRAM_BOT_TOKEN"),
  pollTimeoutSeconds: Number(process.env.RIVN_LEADS_BOT_POLL_TIMEOUT_SECONDS || 25),
};

const supabase = createClient(config.supabaseUrl, config.serviceRoleKey, {
  auth: { persistSession: false },
});

let offset = 0;
let isStopping = false;

function log(message, meta = {}) {
  console.log(JSON.stringify({ level: "info", service: "rivn-leads-bot", message, ...meta }));
}

function logError(message, error, meta = {}) {
  console.error(
    JSON.stringify({
      level: "error",
      service: "rivn-leads-bot",
      message,
      error: error instanceof Error ? error.message : String(error),
      ...meta,
    })
  );
}

function buildTelegramApiUrl(method) {
  return `https://api.telegram.org/bot${config.telegramBotToken}/${method}`;
}

async function callTelegram(method, payload) {
  const response = await fetch(buildTelegramApiUrl(method), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });

  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.ok) {
    throw new Error(body?.description || `Telegram ${method} failed: ${response.status}`);
  }

  return body.result;
}

async function sendTelegramMessage(chatId, text) {
  return callTelegram("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
  });
}

function pickMessage(update) {
  return update.message || update.edited_message || update.channel_post || null;
}

function parseCommand(text) {
  const [commandRaw = "", payload = ""] = String(text || "").trim().split(/\s+/);
  return {
    command: commandRaw.split("@")[0].toLowerCase(),
    payload: payload.trim(),
  };
}

async function saveTelegramChatFromMessage(message) {
  const chat = message?.chat;
  const from = message?.from;
  if (!chat?.id) return;

  const title =
    chat.title ||
    [chat.first_name, chat.last_name].filter(Boolean).join(" ") ||
    [from?.first_name, from?.last_name].filter(Boolean).join(" ") ||
    chat.username ||
    from?.username ||
    "Без названия";

  const { error } = await supabase.from("telegram_bot_chats").upsert(
    {
      chat_id: String(chat.id),
      title,
      username: chat.username || from?.username || null,
      type: chat.type || null,
      last_message_text: message.text || null,
      last_seen_at: new Date().toISOString(),
      raw: message,
    },
    { onConflict: "chat_id" }
  );

  if (error) logError("Не удалось сохранить Telegram chat_id", error, { chatId: chat.id });
}

async function linkChatToRivnLeadsProject({ projectId, chatId }) {
  const normalizedProjectId = String(projectId || "").trim();
  const telegramChatId = String(chatId);

  const { data: project, error: projectError } = await supabase
    .from("rivn_leads_projects")
    .select("id,name,destination_chat_id")
    .eq("id", normalizedProjectId)
    .maybeSingle();

  if (projectError || !project) {
    await sendTelegramMessage(
      chatId,
      "Проект RIVN Leads не найден. Проверь команду из админки и попробуй еще раз."
    );
    return { linked: false, reason: "project_not_found" };
  }

  const { error: updateError } = await supabase
    .from("rivn_leads_projects")
    .update({
      destination_chat_id: telegramChatId,
      telegram_bot_added: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", project.id);

  if (updateError) {
    await sendTelegramMessage(chatId, `Не удалось привязать чат к RIVN Leads: ${updateError.message}`);
    return { linked: false, reason: "update_failed" };
  }

  await sendTelegramMessage(
    chatId,
    [
      "<b>Готово! Чат привязан к RIVN Leads</b>",
      "",
      `Проект: ${project.name}`,
      `Chat ID: <code>${telegramChatId}</code>`,
      "",
      "Теперь найденные заявки по этому проекту будут приходить в эту беседу.",
    ].join("\n")
  );

  return { linked: true, projectId: project.id };
}

async function handleUpdate(update) {
  const message = pickMessage(update);
  if (!message?.chat?.id) return;

  await saveTelegramChatFromMessage(message);

  const text = message.text?.trim();
  if (!text) return;

  const { command, payload } = parseCommand(text);
  const chatId = message.chat.id;

  if (command !== "/leads" && command !== "/rivnleads") return;

  if (!payload) {
    await sendTelegramMessage(
      chatId,
      "Укажи ID проекта RIVN Leads. Команду лучше скопировать из админки проекта."
    );
    return;
  }

  const result = await linkChatToRivnLeadsProject({ projectId: payload, chatId });
  log("Команда привязки RIVN Leads обработана", {
    chatId: String(chatId),
    projectId: payload,
    linked: result.linked,
    reason: result.reason,
  });
}

async function pollUpdates() {
  const result = await callTelegram("getUpdates", {
    offset: offset || undefined,
    timeout: config.pollTimeoutSeconds,
    allowed_updates: ["message", "edited_message", "channel_post"],
  });

  const updates = Array.isArray(result) ? result : [];

  for (const update of updates) {
    offset = Math.max(offset, Number(update.update_id || 0) + 1);
    try {
      await handleUpdate(update);
    } catch (error) {
      logError("Не удалось обработать Telegram update", error, {
        updateId: update.update_id,
      });
    }
  }
}

async function clearWebhook() {
  await callTelegram("deleteWebhook", { drop_pending_updates: false });
}

async function main() {
  const me = await callTelegram("getMe", {});
  await clearWebhook();

  log("RIVN Leads bot worker запущен", {
    botUsername: me?.username || null,
    pollTimeoutSeconds: config.pollTimeoutSeconds,
  });

  while (!isStopping) {
    try {
      await pollUpdates();
    } catch (error) {
      logError("Ошибка long polling Telegram", error);
      await sleep(3000);
    }
  }
}

async function shutdown(signal) {
  isStopping = true;
  log("Останавливаем RIVN Leads bot worker", { signal });
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

main().catch((error) => {
  logError("RIVN Leads bot worker упал при запуске", error);
  process.exit(1);
});
