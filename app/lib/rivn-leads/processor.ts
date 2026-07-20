import type { SupabaseClient } from "@supabase/supabase-js";
import { findLeadStopWords, matchLeadKeywords, normalizeLeadText, type KeywordCandidate, type StopWordCandidate } from "./text";
import { formatRivnLeadTelegramMessage, sendRivnLeadTelegramMessage } from "./telegram";

type ServiceSupabase = SupabaseClient;

export type RivnLeadsIncomingMessage = {
  sourceChatId: string;
  telegramChatId: string;
  telegramMessageId: string;
  messageText: string;
  authorId?: string | null;
  authorName?: string | null;
  authorUsername?: string | null;
  messageLink?: string | null;
  messageDate?: string | null;
};

type ProjectRow = {
  id: string;
  workspace_id: string;
  name: string;
  status: string;
  destination_chat_id: string | null;
  telegram_bot_added: boolean;
  daily_lead_limit: number | null;
  monthly_lead_limit: number | null;
};

type SourceChatRow = {
  id: string;
  title: string;
  telegram_chat_id: string;
  reader_account_id: string | null;
};

type ProjectSourceChatRow = {
  project_id: string;
  source_chat_id: string;
  enabled: boolean;
};

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
}

function startOfDayIso(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy.toISOString();
}

function startOfMonthIso(date: Date) {
  const copy = new Date(date);
  copy.setDate(1);
  copy.setHours(0, 0, 0, 0);
  return copy.toISOString();
}

function isUniqueConflict(error: { code?: string } | null | undefined) {
  return error?.code === "23505";
}

function getAuthorKeys(message: RivnLeadsIncomingMessage) {
  const keys = [];
  const authorId = message.authorId?.trim();
  const authorUsername = message.authorUsername?.replace(/^@/, "").trim().toLowerCase();

  if (authorId) keys.push(`id:${authorId}`);
  if (authorUsername) keys.push(`username:${authorUsername}`);

  return keys;
}

async function canCreateLeadForProject(serviceSupabase: ServiceSupabase, project: ProjectRow) {
  const now = new Date();

  if (project.daily_lead_limit !== null) {
    const { count, error } = await serviceSupabase
      .from("rivn_leads_leads")
      .select("id", { count: "exact", head: true })
      .eq("project_id", project.id)
      .gte("created_at", startOfDayIso(now));

    if (error) throw new Error(error.message);
    if ((count ?? 0) >= project.daily_lead_limit) return { allowed: false, reason: "daily_project_limit" };
  }

  if (project.monthly_lead_limit !== null) {
    const { count, error } = await serviceSupabase
      .from("rivn_leads_leads")
      .select("id", { count: "exact", head: true })
      .eq("project_id", project.id)
      .gte("created_at", startOfMonthIso(now));

    if (error) throw new Error(error.message);
    if ((count ?? 0) >= project.monthly_lead_limit) return { allowed: false, reason: "monthly_project_limit" };
  }

  return { allowed: true, reason: null };
}

export async function deliverRivnLead(serviceSupabase: ServiceSupabase, leadId: string) {
  const { data: lead, error: leadError } = await serviceSupabase
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
        rivn_leads_telegram_messages!inner(id,message_text,author_id,author_name,author_username,message_link)
      `
    )
    .eq("id", leadId)
    .maybeSingle();

  if (leadError) throw new Error(leadError.message);
  if (!lead) throw new Error("Лид не найден");
  if (lead.status === "delivered" || lead.status === "marked_as_lead" || lead.status === "marked_as_not_lead") {
    return { delivered: false, reason: "already_delivered" };
  }

  const project = Array.isArray(lead.rivn_leads_projects)
    ? lead.rivn_leads_projects[0]
    : lead.rivn_leads_projects;
  const sourceChat = Array.isArray(lead.rivn_leads_source_chats)
    ? lead.rivn_leads_source_chats[0]
    : lead.rivn_leads_source_chats;
  const telegramMessage = Array.isArray(lead.rivn_leads_telegram_messages)
    ? lead.rivn_leads_telegram_messages[0]
    : lead.rivn_leads_telegram_messages;
  const destinationChatId = project?.destination_chat_id;

  if (!destinationChatId) {
    await serviceSupabase.from("rivn_leads_delivery_logs").insert({
      lead_id: lead.id,
      project_id: lead.project_id,
      destination_chat_id: "",
      status: "failed",
      error_message: "У проекта не указан Telegram-чат для доставки лидов",
    });
    await serviceSupabase.from("rivn_leads_leads").update({ status: "delivery_failed" }).eq("id", lead.id);
    return { delivered: false, reason: "destination_missing" };
  }

  try {
    const matchedKeywords = Array.isArray(lead.matched_keywords)
      ? lead.matched_keywords.map((item: { value?: string } | string) => String(typeof item === "string" ? item : item.value ?? "")).filter(Boolean)
      : [];
    const authorKey =
      telegramMessage.author_id
        ? `id:${telegramMessage.author_id}`
        : telegramMessage.author_username
          ? `username:${String(telegramMessage.author_username).replace(/^@/, "").toLowerCase()}`
          : "";
    const sent = await sendRivnLeadTelegramMessage({
      chatId: destinationChatId,
      text: formatRivnLeadTelegramMessage({
        messageText: telegramMessage.message_text,
        authorUsername: telegramMessage.author_username,
        sourceChatTitle: sourceChat.title,
        messageLink: telegramMessage.message_link,
        matchedKeywords,
      }),
      replyMarkup: authorKey
        ? {
            inline_keyboard: [
              [
                {
                  text: "👨🛑",
                  callback_data: `rl:block:${lead.id}`,
                },
              ],
            ],
          }
        : undefined,
    });

    await serviceSupabase.from("rivn_leads_delivery_logs").insert({
      lead_id: lead.id,
      project_id: lead.project_id,
      destination_chat_id: destinationChatId,
      telegram_bot_message_id: String(sent.message_id),
      status: "sent",
    });
    await serviceSupabase
      .from("rivn_leads_leads")
      .update({ status: "delivered", delivered_at: new Date().toISOString() })
      .eq("id", lead.id);

    return { delivered: true, reason: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Telegram не доставил лид";
    await serviceSupabase.from("rivn_leads_delivery_logs").insert({
      lead_id: lead.id,
      project_id: lead.project_id,
      destination_chat_id: destinationChatId,
      status: "failed",
      error_message: message,
    });
    await serviceSupabase.from("rivn_leads_leads").update({ status: "delivery_failed" }).eq("id", lead.id);
    throw error;
  }
}

export async function processRivnLeadsMessage(
  serviceSupabase: ServiceSupabase,
  message: RivnLeadsIncomingMessage,
  options: { deliver?: boolean } = {}
) {
  const normalizedText = normalizeLeadText(message.messageText);
  if (!normalizedText) {
    return { processed: false, reason: "empty_message", leadsCreated: 0, leadsDelivered: 0 };
  }

  const messageDate = message.messageDate ?? new Date().toISOString();

  const { error: processedError } = await serviceSupabase.from("rivn_leads_processed_messages").insert({
    telegram_chat_id: message.telegramChatId,
    telegram_message_id: message.telegramMessageId,
  });

  if (isUniqueConflict(processedError)) {
    return { processed: false, reason: "duplicate_message", leadsCreated: 0, leadsDelivered: 0 };
  }
  if (processedError) throw new Error(processedError.message);

  const { data: sourceChat, error: sourceChatError } = await serviceSupabase
    .from("rivn_leads_source_chats")
    .select("id,title,telegram_chat_id,reader_account_id")
    .eq("id", message.sourceChatId)
    .maybeSingle<SourceChatRow>();

  if (sourceChatError) throw new Error(sourceChatError.message);
  if (!sourceChat) throw new Error("Чат-источник не найден");

  await serviceSupabase
    .from("rivn_leads_source_chats")
    .update({ last_message_at: messageDate, last_checked_at: new Date().toISOString() })
    .eq("id", message.sourceChatId);

  const { data: links, error: linksError } = await serviceSupabase
    .from("rivn_leads_project_source_chats")
    .select("project_id,source_chat_id,enabled")
    .eq("source_chat_id", message.sourceChatId)
    .eq("enabled", true)
    .returns<ProjectSourceChatRow[]>();

  if (linksError) throw new Error(linksError.message);

  const explicitProjectIds = (links ?? []).map((link) => link.project_id);
  const readerProjectIds: string[] = [];

  if (sourceChat.reader_account_id) {
    const { data: readerProjects, error: readerProjectsError } = await serviceSupabase
      .from("rivn_leads_projects")
      .select("id")
      .eq("reader_account_id", sourceChat.reader_account_id)
      .eq("status", "active");

    if (readerProjectsError) throw new Error(readerProjectsError.message);
    readerProjectIds.push(...((readerProjects ?? []) as Array<{ id: string }>).map((project) => project.id));
  }

  const projectIds = [...new Set([...explicitProjectIds, ...readerProjectIds])];

  if (projectIds.length === 0) {
    return { processed: true, reason: "no_projects_for_source", leadsCreated: 0, leadsDelivered: 0 };
  }

  const { data: projects, error: projectsError } = await serviceSupabase
    .from("rivn_leads_projects")
    .select("id,workspace_id,name,status,destination_chat_id,telegram_bot_added,daily_lead_limit,monthly_lead_limit")
    .in("id", projectIds)
    .eq("status", "active")
    .not("destination_chat_id", "is", null)
    .returns<ProjectRow[]>();

  if (projectsError) throw new Error(projectsError.message);
  if (!projects?.length) {
    return { processed: true, reason: "no_active_projects", leadsCreated: 0, leadsDelivered: 0 };
  }

  const activeProjectIds = projects.map((project) => project.id);
  const authorKeys = getAuthorKeys(message);
  const [
    { data: keywords, error: keywordsError },
    { data: stopWords, error: stopWordsError },
    { data: blockedAuthors, error: blockedAuthorsError },
  ] = await Promise.all([
    serviceSupabase
      .from("rivn_leads_keywords")
      .select("id,project_id,value,normalized_value,match_type,enabled")
      .in("project_id", activeProjectIds)
      .eq("enabled", true),
    serviceSupabase
      .from("rivn_leads_stop_words")
      .select("id,project_id,value,normalized_value,enabled")
      .in("project_id", activeProjectIds)
      .eq("enabled", true),
    authorKeys.length > 0
      ? serviceSupabase
          .from("rivn_leads_blocked_authors")
          .select("project_id,author_key")
          .in("project_id", activeProjectIds)
          .in("author_key", authorKeys)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (keywordsError) throw new Error(keywordsError.message);
  if (stopWordsError) throw new Error(stopWordsError.message);
  if (blockedAuthorsError) throw new Error(blockedAuthorsError.message);

  const blockedProjectIds = new Set(
    ((blockedAuthors ?? []) as Array<{ project_id: string }>).map((item) => item.project_id)
  );

  const { data: telegramMessage, error: messageError } = await serviceSupabase
    .from("rivn_leads_telegram_messages")
    .upsert(
      {
        source_chat_id: message.sourceChatId,
        telegram_chat_id: message.telegramChatId,
        telegram_message_id: message.telegramMessageId,
        message_text: message.messageText,
        normalized_text: normalizedText,
        author_id: message.authorId ?? null,
        author_name: message.authorName ?? null,
        author_username: message.authorUsername?.replace(/^@/, "") ?? null,
        message_link: message.messageLink ?? null,
        message_date: messageDate,
        expires_at: addDays(new Date(), 90),
      },
      { onConflict: "telegram_chat_id,telegram_message_id" }
    )
    .select("id")
    .single();

  if (messageError) throw new Error(messageError.message);

  let leadsCreated = 0;
  let leadsDelivered = 0;
  const leadIds: string[] = [];

  for (const project of projects) {
    if (blockedProjectIds.has(project.id)) continue;

    const projectKeywords = ((keywords ?? []) as Array<KeywordCandidate & { project_id: string }>).filter(
      (keyword) => keyword.project_id === project.id
    );
    const projectStopWords = ((stopWords ?? []) as Array<StopWordCandidate & { project_id: string }>).filter((stopWord) => stopWord.project_id === project.id);
    const matchedKeywords = matchLeadKeywords(normalizedText, projectKeywords);
    const blockedByStopWords = findLeadStopWords(normalizedText, projectStopWords);

    if (matchedKeywords.length === 0 || blockedByStopWords.length > 0) continue;

    const limit = await canCreateLeadForProject(serviceSupabase, project);
    if (!limit.allowed) continue;

    const { data: lead, error: leadError } = await serviceSupabase
      .from("rivn_leads_leads")
      .insert({
        project_id: project.id,
        telegram_message_id: telegramMessage.id,
        source_chat_id: message.sourceChatId,
        status: "new",
        matched_keywords: matchedKeywords,
        blocked_by_stop_words: blockedByStopWords,
        expires_at: addDays(new Date(), 30),
      })
      .select("id")
      .single();

    if (isUniqueConflict(leadError)) continue;
    if (leadError) throw new Error(leadError.message);
    if (!lead) continue;

    leadsCreated += 1;
    leadIds.push(lead.id);

    if (options.deliver !== false) {
      const delivery = await deliverRivnLead(serviceSupabase, lead.id);
      if (delivery.delivered) leadsDelivered += 1;
    }
  }

  return {
    processed: true,
    reason: "processed",
    leadsCreated,
    leadsDelivered,
    leadIds,
  };
}
