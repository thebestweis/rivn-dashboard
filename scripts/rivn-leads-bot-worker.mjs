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
  deliveryPollMs: Number(process.env.RIVN_LEADS_BOT_DELIVERY_POLL_MS || 10_000),
  deliveryBatchSize: Number(process.env.RIVN_LEADS_BOT_DELIVERY_BATCH_SIZE || 20),
  retryFailedDeliveries: process.env.RIVN_LEADS_BOT_RETRY_FAILED_DELIVERIES !== "false",
};

const supabase = createClient(config.supabaseUrl, config.serviceRoleKey, {
  auth: { persistSession: false },
});

let offset = 0;
let isStopping = false;
let isDelivering = false;

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

async function sendTelegramMessage(chatId, text, parseMode = "HTML") {
  return callTelegram("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: parseMode,
    disable_web_page_preview: true,
  });
}

function htmlEscape(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function htmlAttributeEscape(value) {
  return htmlEscape(value).replaceAll('"', "&quot;");
}

function formatSourceChatTitle(sourceChat, telegramMessage) {
  const title = htmlEscape(sourceChat?.title || "Telegram-\u0447\u0430\u0442");
  const messageLink = telegramMessage?.message_link ? String(telegramMessage.message_link) : "";
  if (!messageLink || !/^https?:\/\//i.test(messageLink)) return title;
  return `<a href="${htmlAttributeEscape(messageLink)}">${title}</a>`;
}

function formatOriginalMessageLink(telegramMessage) {
  const messageLink = telegramMessage?.message_link ? String(telegramMessage.message_link) : "";
  if (!messageLink || !/^https?:\/\//i.test(messageLink)) return null;
  return `<a href="${htmlAttributeEscape(messageLink)}">\u041e\u0442\u043a\u0440\u044b\u0442\u044c \u0438\u0441\u0445\u043e\u0434\u043d\u043e\u0435 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435</a>`;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlightMatchedKeywords(messageText, matchedKeywords) {
  const keywords = [...new Set(matchedKeywords.map((keyword) => String(keyword || "").trim()).filter(Boolean))]
    .sort((left, right) => right.length - left.length);

  if (keywords.length === 0) return htmlEscape(messageText);

  const ranges = [];

  for (const keyword of keywords) {
    const pattern = new RegExp(escapeRegExp(keyword).replaceAll("е", "[её]").replaceAll("Е", "[ЕЁ]"), "giu");
    for (const match of String(messageText).matchAll(pattern)) {
      const start = match.index ?? -1;
      const end = start + match[0].length;
      if (start < 0 || end <= start) continue;
      if (ranges.some((range) => start < range.end && end > range.start)) continue;
      ranges.push({ start, end });
    }
  }

  if (ranges.length === 0) return htmlEscape(messageText);

  ranges.sort((left, right) => left.start - right.start);

  let cursor = 0;
  let result = "";
  for (const range of ranges) {
    result += htmlEscape(String(messageText).slice(cursor, range.start));
    result += `<b>${htmlEscape(String(messageText).slice(range.start, range.end))}</b>`;
    cursor = range.end;
  }
  result += htmlEscape(String(messageText).slice(cursor));

  return result;
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

function one(row, key) {
  const value = row?.[key];
  return Array.isArray(value) ? value[0] : value;
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

  if (error) logError("Failed to save Telegram chat_id", error, { chatId: chat.id });
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
      `Проект: ${htmlEscape(project.name)}`,
      `Chat ID: <code>${telegramChatId}</code>`,
      "",
      "Теперь найденные заявки по этому проекту будут приходить в эту беседу.",
    ].join("\n")
  );

  return { linked: true, projectId: project.id };
}

function formatLeadMessage(lead) {
  const sourceChat = one(lead, "rivn_leads_source_chats");
  const telegramMessage = one(lead, "rivn_leads_telegram_messages");
  const authorUsername = telegramMessage?.author_username
    ? `@${String(telegramMessage.author_username).replace(/^@/, "")}`
    : "username \u043e\u0442\u0441\u0443\u0442\u0441\u0442\u0432\u0443\u0435\u0442";
  const matchedKeywords = Array.isArray(lead.matched_keywords)
    ? lead.matched_keywords.map((item) => String(item?.value ?? item)).filter(Boolean)
    : [];
  const originalMessageLink = formatOriginalMessageLink(telegramMessage);

  const lines = [
    "\u{1F525} <b>\u041f\u043e\u0442\u0435\u043d\u0446\u0438\u0430\u043b\u044c\u043d\u044b\u0439 \u043b\u0438\u0434</b>",
    "",
    "<b>\u0421\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435:</b>",
    `<blockquote>${highlightMatchedKeywords(telegramMessage?.message_text || "", matchedKeywords)}</blockquote>`,
    "",
    "<b>\u041a\u043e\u043d\u0442\u0430\u043a\u0442:</b>",
    htmlEscape(authorUsername),
    "",
    "<b>\u0418\u0441\u0442\u043e\u0447\u043d\u0438\u043a:</b>",
    formatSourceChatTitle(sourceChat, telegramMessage),
  ];

  if (originalMessageLink) {
    lines.push("", originalMessageLink);
  }

  return lines.join("\n");
}

async function fetchPendingLeads() {
  const statuses = config.retryFailedDeliveries ? ["new", "delivery_failed"] : ["new"];

  const { data, error } = await supabase
    .from("rivn_leads_leads")
    .select(
      `
        id,
        project_id,
        source_chat_id,
        status,
        matched_keywords,
        rivn_leads_projects!inner(id,name,destination_chat_id),
        rivn_leads_source_chats!inner(id,title),
        rivn_leads_telegram_messages!inner(id,message_text,author_username,message_link)
      `
    )
    .in("status", statuses)
    .order("created_at", { ascending: true })
    .limit(config.deliveryBatchSize);

  if (error) throw new Error(error.message);
  return data ?? [];
}

async function markDeliveryFailed(lead, destinationChatId, error) {
  const message = error instanceof Error ? error.message : String(error);

  await supabase.from("rivn_leads_delivery_logs").insert({
    lead_id: lead.id,
    project_id: lead.project_id,
    destination_chat_id: destinationChatId || "",
    status: "failed",
    error_message: message,
  });

  await supabase.from("rivn_leads_leads").update({ status: "delivery_failed" }).eq("id", lead.id);
}

async function deliverLead(lead) {
  const project = one(lead, "rivn_leads_projects");
  const destinationChatId = project?.destination_chat_id ? String(project.destination_chat_id) : "";

  if (!destinationChatId) {
    await markDeliveryFailed(lead, destinationChatId, new Error("Project has no destination_chat_id"));
    return { delivered: false, reason: "destination_missing" };
  }

  const sent = await sendTelegramMessage(destinationChatId, formatLeadMessage(lead));

  await supabase.from("rivn_leads_delivery_logs").insert({
    lead_id: lead.id,
    project_id: lead.project_id,
    destination_chat_id: destinationChatId,
    telegram_bot_message_id: String(sent.message_id),
    status: "sent",
  });

  await supabase
    .from("rivn_leads_leads")
    .update({ status: "delivered", delivered_at: new Date().toISOString() })
    .eq("id", lead.id);

  return { delivered: true, reason: null };
}

async function deliverPendingLeads() {
  if (isDelivering) return;
  isDelivering = true;

  try {
    const leads = await fetchPendingLeads();
    for (const lead of leads) {
      if (isStopping) return;

      try {
        const result = await deliverLead(lead);
        log("Lead delivery processed", {
          leadId: lead.id,
          projectId: lead.project_id,
          delivered: result.delivered,
          reason: result.reason,
        });
      } catch (error) {
        const project = one(lead, "rivn_leads_projects");
        await markDeliveryFailed(lead, project?.destination_chat_id, error);
        logError("Lead delivery failed", error, { leadId: lead.id, projectId: lead.project_id });
      }
    }
  } finally {
    isDelivering = false;
  }
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
  log("RIVN Leads link command processed", {
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
      logError("Failed to process Telegram update", error, {
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

  log("RIVN Leads bot worker started", {
    botUsername: me?.username || null,
    pollTimeoutSeconds: config.pollTimeoutSeconds,
    deliveryPollMs: config.deliveryPollMs,
  });

  void deliverPendingLeads().catch((error) => logError("Initial lead delivery poll failed", error));
  const deliveryTimer = setInterval(() => {
    void deliverPendingLeads().catch((error) => logError("Lead delivery poll failed", error));
  }, config.deliveryPollMs);

  while (!isStopping) {
    try {
      await pollUpdates();
    } catch (error) {
      logError("Telegram long polling failed", error);
      await sleep(3000);
    }
  }

  clearInterval(deliveryTimer);
}

async function shutdown(signal) {
  isStopping = true;
  log("Stopping RIVN Leads bot worker", { signal });
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

main().catch((error) => {
  logError("RIVN Leads bot worker crashed on startup", error);
  process.exit(1);
});
