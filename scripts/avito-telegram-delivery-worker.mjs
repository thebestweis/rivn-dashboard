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

function optionalEnv(name) {
  const value = process.env[name]?.trim();
  return value || "";
}

const config = {
  supabaseUrl: requiredEnv("NEXT_PUBLIC_SUPABASE_URL", ["SUPABASE_URL"]),
  serviceRoleKey: requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
  telegramBotToken: requiredEnv("AVITO_TELEGRAM_BOT_TOKEN"),
  fallbackTelegramBotTokenConfigured: Boolean(optionalEnv("TELEGRAM_BOT_TOKEN")),
  pollMs: Number(process.env.AVITO_TELEGRAM_WORKER_POLL_MS || 10_000),
  updatesPollTimeoutSeconds: Number(process.env.AVITO_TELEGRAM_UPDATES_POLL_TIMEOUT_SECONDS || 25),
  batchSize: Number(process.env.AVITO_TELEGRAM_WORKER_BATCH_SIZE || 10),
  messageLimit: Number(process.env.AVITO_TELEGRAM_MESSAGE_LIMIT || 3900),
  requestTimeoutMs: Number(process.env.AVITO_TELEGRAM_REQUEST_TIMEOUT_MS || 20_000),
  maxAttempts: Number(process.env.AVITO_TELEGRAM_WORKER_MAX_ATTEMPTS || 5),
};

const supabase = createClient(config.supabaseUrl, config.serviceRoleKey, {
  auth: { persistSession: false },
});

let isStopping = false;
let isDelivering = false;
let updatesOffset = 0;

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

async function validateTelegramBot() {
  const bot = await callTelegram("getMe", {});
  log("Avito Telegram bot token validated", {
    botId: bot?.id ?? null,
    username: bot?.username ? `@${bot.username}` : null,
    fallbackTelegramBotTokenConfigured: config.fallbackTelegramBotTokenConfigured,
  });
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

async function sendTelegramMessage(chatId, text) {
  return callTelegram("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
  });
}

function htmlEscape(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function pickMessage(update) {
  return update?.message || update?.edited_message || update?.channel_post || null;
}

function parseCommand(text) {
  const [commandRaw = "", payload = ""] = String(text || "").trim().split(/\s+/);
  return {
    command: commandRaw.split("@")[0].toLowerCase(),
    payload: payload.trim(),
  };
}

async function clearWebhook() {
  await callTelegram("deleteWebhook", { drop_pending_updates: false });
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

  if (error) logError("Failed to save Avito Telegram chat", error, { chatId: chat.id });
}

async function linkChatToClientCode({ clientCode, chatId, chatTitle, fromId, fromUsername }) {
  const normalizedClientCode = String(clientCode || "").trim();
  const telegramChatId = String(chatId);

  const { data: client, error: clientError } = await supabase
    .from("avito_report_clients")
    .select("id, name, client_code, telegram_chat_id")
    .eq("client_code", normalizedClientCode)
    .eq("is_active", true)
    .maybeSingle();

  if (clientError || !client) {
    await sendTelegramMessage(
      chatId,
      `❌ Код <code>${htmlEscape(normalizedClientCode)}</code> не найден. Проверь команду из RIVN OS или отправь новую команду привязки.`
    );
    return { linked: false, reason: "client_not_found" };
  }

  const { data: existingChatLink, error: existingChatLinkError } = await supabase
    .from("avito_report_chat_links")
    .select("client_id")
    .eq("telegram_chat_id", telegramChatId)
    .eq("is_active", true)
    .maybeSingle();

  if (existingChatLinkError) {
    await sendTelegramMessage(chatId, `❌ Не удалось проверить привязку чата: ${htmlEscape(existingChatLinkError.message)}`);
    return { linked: false, reason: "chat_link_check_failed" };
  }

  if (existingChatLink && existingChatLink.client_id !== client.id) {
    await sendTelegramMessage(
      chatId,
      "⚠️ Этот Telegram-чат уже привязан к другому проекту. Чтобы не отправить отчёты не туда, я не меняю привязку автоматически."
    );
    return { linked: false, reason: "chat_already_linked" };
  }

  if (client.telegram_chat_id && String(client.telegram_chat_id) !== telegramChatId) {
    await sendTelegramMessage(
      chatId,
      "⚠️ Этот проект уже привязан к другому Telegram-чату. Сначала отключи старую привязку в RIVN OS."
    );
    return { linked: false, reason: "client_already_linked" };
  }

  const { error: updateClientError } = await supabase
    .from("avito_report_clients")
    .update({
      telegram_chat_id: telegramChatId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", client.id);

  if (updateClientError) {
    await sendTelegramMessage(chatId, `❌ Ошибка сохранения chat_id: ${htmlEscape(updateClientError.message)}`);
    return { linked: false, reason: "client_update_failed" };
  }

  const { data: existingLinkByChat, error: existingLinkByChatError } = await supabase
    .from("avito_report_chat_links")
    .select("id")
    .eq("telegram_chat_id", telegramChatId)
    .maybeSingle();

  if (existingLinkByChatError) {
    await sendTelegramMessage(chatId, `❌ Не удалось проверить связь чата: ${htmlEscape(existingLinkByChatError.message)}`);
    return { linked: false, reason: "link_check_failed" };
  }

  const linkPayload = {
    client_id: client.id,
    telegram_chat_id: telegramChatId,
    telegram_chat_title: chatTitle,
    linked_by_telegram_id: fromId ? String(fromId) : null,
    linked_by_username: fromUsername,
    is_active: true,
  };

  const { error: linkError } = existingLinkByChat
    ? await supabase.from("avito_report_chat_links").update(linkPayload).eq("id", existingLinkByChat.id)
    : await supabase.from("avito_report_chat_links").insert(linkPayload);

  if (linkError) {
    await sendTelegramMessage(chatId, `❌ Ошибка привязки чата: ${htmlEscape(linkError.message)}`);
    return { linked: false, reason: "link_upsert_failed" };
  }

  await sendTelegramMessage(
    chatId,
    [
      "✅ <b>Готово! Чат привязан к Avito Reports</b>",
      "",
      `Проект: ${htmlEscape(client.name)}`,
      `Код привязки: <code>${htmlEscape(client.client_code)}</code>`,
      `Chat ID: <code>${htmlEscape(telegramChatId)}</code>`,
      "",
      "Теперь ежедневные и еженедельные отчёты будут приходить в этот чат, если они включены в RIVN OS.",
    ].join("\n")
  );

  return { linked: true, clientId: client.id };
}

async function handleTelegramUpdate(update) {
  const message = pickMessage(update);
  if (!message?.chat?.id) return;

  await saveTelegramChatFromMessage(message);

  const text = message.text?.trim();
  if (!text) return;

  const { command, payload } = parseCommand(text);
  const chatId = message.chat.id;
  const chatTitle = message.chat.title || "Личный чат";
  const chatType = message.chat.type;
  const fromId = message.from?.id ?? null;
  const fromUsername = message.from?.username || null;

  if (command === "/start") {
    if (payload && chatType !== "private") {
      const result = await linkChatToClientCode({
        clientCode: payload,
        chatId,
        chatTitle,
        fromId,
        fromUsername,
      });
      log("Avito Reports startgroup link processed", {
        chatId: String(chatId),
        clientCode: payload,
        linked: result.linked,
        reason: result.reason,
      });
      return;
    }

    await sendTelegramMessage(
      chatId,
      [
        "👋 <b>Это бот RIVN OS для Avito Reports.</b>",
        "",
        chatType === "private"
          ? "Чтобы подключить отчёты к беседе, добавь меня в нужный чат и отправь там команду из RIVN OS."
          : "Чтобы привязать эту беседу к проекту, отправь команду из RIVN OS.",
        "",
        "<code>/link@stat_rivnos_bot rivn-xxxxxxx</code>",
      ].join("\n")
    );
    return;
  }

  if (command === "/link") {
    if (!payload) {
      await sendTelegramMessage(chatId, "⚠️ Укажи код клиента. Пример:\n\n<code>/link@stat_rivnos_bot rivn-xxxxxxx</code>");
      return;
    }

    const result = await linkChatToClientCode({
      clientCode: payload,
      chatId,
      chatTitle,
      fromId,
      fromUsername,
    });
    log("Avito Reports link command processed", {
      chatId: String(chatId),
      clientCode: payload,
      linked: result.linked,
      reason: result.reason,
    });
    return;
  }

  if (command === "/status") {
    const { data: link, error } = await supabase
      .from("avito_report_chat_links")
      .select("client_id, telegram_chat_id, is_active, avito_report_clients(name, client_code)")
      .eq("telegram_chat_id", String(chatId))
      .maybeSingle();

    if (error) {
      await sendTelegramMessage(chatId, `❌ Не удалось проверить статус: ${htmlEscape(error.message)}`);
      return;
    }

    if (!link) {
      await sendTelegramMessage(chatId, "⚠️ Этот чат пока не привязан. Отправь команду из RIVN OS:\n\n<code>/link@stat_rivnos_bot rivn-xxxxxxx</code>");
      return;
    }

    const client = Array.isArray(link.avito_report_clients)
      ? link.avito_report_clients[0]
      : link.avito_report_clients;

    await sendTelegramMessage(
      chatId,
      [
        "✅ <b>Чат привязан</b>",
        "",
        `Клиент: ${htmlEscape(client?.name || "Не найден")}`,
        `Код клиента: <code>${htmlEscape(client?.client_code || "Не найден")}</code>`,
        `Chat ID: <code>${htmlEscape(chatId)}</code>`,
      ].join("\n")
    );
  }
}

async function pollTelegramUpdates() {
  const result = await callTelegram("getUpdates", {
    offset: updatesOffset || undefined,
    timeout: config.updatesPollTimeoutSeconds,
    allowed_updates: ["message", "edited_message", "channel_post"],
  });

  const updates = Array.isArray(result) ? result : [];

  for (const update of updates) {
    updatesOffset = Math.max(updatesOffset, Number(update.update_id || 0) + 1);
    try {
      await handleTelegramUpdate(update);
    } catch (error) {
      logError("Failed to process Avito Telegram update", error, {
        updateId: update.update_id,
      });
    }
  }
}

async function fetchPendingReports() {
  const { data, error } = await supabase
    .from("avito_telegram_delivery_queue")
    .select("id, client_id, telegram_chat_id, report_type, period_start, period_end, message, attempts, created_at")
    .in("status", ["pending", "failed"])
    .lt("attempts", config.maxAttempts)
    .order("created_at", { ascending: true })
    .limit(config.batchSize);

  if (error) throw new Error(error.message);
  return data ?? [];
}

async function updateQueueReport(reportId, patch) {
  const { error } = await supabase
    .from("avito_telegram_delivery_queue")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", reportId);
  if (error) throw new Error(error.message);
}

async function insertDeliveryLog(report, message) {
  const { error } = await supabase.from("avito_report_logs").insert({
    client_id: report.client_id,
    telegram_chat_id: report.telegram_chat_id,
    report_type: report.report_type,
    period_start: report.period_start,
    period_end: report.period_end,
    status: "success",
    message,
  });

  if (error) {
    logError("Failed to write Avito report delivery log", new Error(error.message), { reportId: report.id });
  }
}

async function deliverReport(report) {
  const chatId = report.telegram_chat_id ? String(report.telegram_chat_id) : "";
  const text = report.message ? String(report.message) : "";

  if (!chatId) throw new Error("Report has no telegram_chat_id");
  if (!text) throw new Error("Report has empty message");

  await updateQueueReport(report.id, {
    status: "processing",
    attempts: Number(report.attempts || 0) + 1,
    last_error: null,
  });

  const sent = await sendTelegramReport(chatId, text);
  await updateQueueReport(report.id, {
    status: "sent",
    telegram_message_id: sent?.message_id ? String(sent.message_id) : null,
    sent_at: new Date().toISOString(),
    last_error: null,
  });
  await insertDeliveryLog(report, text);

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
        await updateQueueReport(report.id, {
          status: "failed",
          last_error: message,
        }).catch((updateError) =>
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
  await validateTelegramBot();
  await clearWebhook();

  log("Avito Telegram delivery worker started", {
    pollMs: config.pollMs,
    batchSize: config.batchSize,
    updatesPollTimeoutSeconds: config.updatesPollTimeoutSeconds,
  });

  void deliverPendingReports().catch((error) => logError("Initial Avito report delivery failed", error));
  const timer = setInterval(() => {
    void deliverPendingReports().catch((error) => logError("Avito report delivery poll failed", error));
  }, config.pollMs);

  void (async () => {
    while (!isStopping) {
      try {
        await pollTelegramUpdates();
      } catch (error) {
        logError("Avito Telegram long polling failed", error);
        await sleep(3000);
      }
    }
  })();

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
