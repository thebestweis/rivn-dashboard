import { apiSuccess } from "@/app/lib/api/errors";
import { Api, TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { requireSuperAdminRoute } from "../../admin/_utils";
import {
  adminLeadsFailure,
  decryptRivnLeadsSessionString,
  encryptRivnLeadsSessionString,
  keywordMatchTypes,
  leadProjectStatuses,
  normalizeText,
  optionalNumber,
  optionalString,
  readerStatuses,
  requiredString,
  requireEnum,
  sourceChatAccessLevels,
  sourceChatStatuses,
  sourceChatTypes,
  writeAdminLeadsAudit,
} from "../_utils";

export const dynamic = "force-dynamic";

type ManageAction =
  | "create_project"
  | "update_project"
  | "delete_project"
  | "create_source_chat"
  | "update_source_chat"
  | "delete_source_chat"
  | "link_source_chat"
  | "unlink_source_chat"
  | "create_keyword"
  | "update_keyword"
  | "delete_keyword"
  | "create_stop_word"
  | "update_stop_word"
  | "delete_stop_word"
  | "create_reader"
  | "update_reader"
  | "update_reader_status"
  | "delete_reader"
  | "scan_reader_chats";

type TelegramDialogEntity = {
  id?: string | number | bigint;
  title?: string;
  username?: string | null;
  megagroup?: boolean;
  broadcast?: boolean;
  participantsCount?: number | null;
  className?: string;
  constructor?: { name?: string };
};

function getTelegramEntityKind(entity: unknown) {
  const value = entity as TelegramDialogEntity | null;
  const className = value?.className || value?.constructor?.name || "";

  if (entity instanceof Api.Chat || className.includes("Chat")) return "chat";
  if (entity instanceof Api.Channel || className.includes("Channel")) return "channel";

  return null;
}

function toTelegramChatId(entity: unknown) {
  const value = entity as TelegramDialogEntity | null;
  const id = value?.id;
  const kind = getTelegramEntityKind(entity);

  if (id === null || id === undefined || !kind) return null;
  if (kind === "channel") return `-100${String(id)}`;
  return `-${String(id)}`;
}

function dialogTitle(entity: unknown) {
  const value = entity as TelegramDialogEntity | null;
  return value?.title || null;
}

function dialogUsername(entity: unknown) {
  const value = entity as TelegramDialogEntity | null;
  return value?.username ?? null;
}

function dialogKind(entity: unknown) {
  const value = entity as TelegramDialogEntity | null;
  const kind = getTelegramEntityKind(entity);

  if (kind === "chat") return "group";
  if (kind === "channel") return value?.megagroup ? "supergroup" : "channel_discussion";

  return null;
}

function dialogMemberCount(entity: unknown) {
  const value = entity as TelegramDialogEntity | null;
  return value?.participantsCount ?? null;
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string) {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), ms);
  });

  return Promise.race([promise, timeout]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  });
}

async function ensureSourceChatCategory(serviceSupabase: any, niche?: string | null) {
  const normalizedNiche = niche?.trim().toLowerCase();
  const preferredSlug = normalizedNiche === "crm" ? "crm" : normalizedNiche === "marketing" ? "marketing" : null;

  let query = serviceSupabase
    .from("rivn_leads_source_chat_categories")
    .select("id")
    .limit(1);

  if (preferredSlug) query = query.eq("slug", preferredSlug);

  const { data: existing, error: existingError } = await query.maybeSingle();
  if (existingError) throw new Error(existingError.message);
  if (existing?.id) return existing.id as string;

  const { data: fallback, error: fallbackError } = await serviceSupabase
    .from("rivn_leads_source_chat_categories")
    .select("id")
    .order("name", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (fallbackError) throw new Error(fallbackError.message);
  if (fallback?.id) return fallback.id as string;

  const { data: created, error: createError } = await serviceSupabase
    .from("rivn_leads_source_chat_categories")
    .insert({
      name: "Бизнес и предприниматели",
      slug: "business",
      description: "Бизнес-чаты, где могут появляться запросы на услуги",
    })
    .select("id")
    .single();

  if (createError) throw new Error(createError.message);
  return created.id as string;
}

async function getProjectWorkspaceId(serviceSupabase: any, projectId: string) {
  const { data, error } = await serviceSupabase
    .from("rivn_leads_projects")
    .select("workspace_id")
    .eq("id", projectId)
    .maybeSingle();

  if (error || !data) {
    throw new Error(error?.message || "Проект RIVN Leads не найден");
  }

  return data.workspace_id as string;
}

async function scanReaderChatsInBackground(params: {
  serviceSupabase: any;
  userId: string;
  readerId: string;
  apiId: number;
  apiHash: string;
  now: string;
}) {
  const { serviceSupabase, userId, readerId, apiId, apiHash, now } = params;

  const { data: reader, error: readerError } = await serviceSupabase
    .from("rivn_leads_reader_accounts")
    .select("id,label,encrypted_session_string,assigned_niche,max_chats_limit")
    .eq("id", readerId)
    .maybeSingle();

  if (readerError) throw new Error(readerError.message);
  if (!reader) throw new Error("Reader-аккаунт не найден");

  const sessionString = decryptRivnLeadsSessionString(reader.encrypted_session_string);
  const client = new TelegramClient(new StringSession(sessionString), apiId, apiHash, {
    connectionRetries: 3,
    useWSS: false,
  });

  let found = 0;
  let saved = 0;
  let linked = 0;

  try {
    await withTimeout(
      client.connect(),
      12_000,
      "Telegram слишком долго отвечает при подключении reader-аккаунта. Проверь session string и доступ сервера к Telegram."
    );

    if (!(await withTimeout(
      client.isUserAuthorized(),
      5_000,
      "Telegram не подтвердил авторизацию reader-аккаунта. Попробуй заменить session string."
    ))) {
      throw new Error("Reader-аккаунт требует повторной авторизации в Telegram");
    }

    const limit = Math.min(Number(reader.max_chats_limit) || 500, 500);
    const dialogs = await withTimeout(
      client.getDialogs({ limit }),
      18_000,
      "Telegram слишком долго отдаёт список чатов. Попробуй уменьшить лимит чатов reader-аккаунта и повторить загрузку."
    );
    const categoryId = await ensureSourceChatCategory(serviceSupabase, reader.assigned_niche);

    const uniqueRows = new Map<string, {
      category_id: string;
      reader_account_id: string;
      title: string;
      telegram_chat_id: string;
      username: string | null;
      type: string;
      access_level: string;
      status: string;
      member_count: number | null;
      last_checked_at: string;
      updated_at: string;
    }>();

    for (const dialog of dialogs) {
      const telegramChatId = toTelegramChatId(dialog.entity);
      const title = dialogTitle(dialog.entity);
      const type = dialogKind(dialog.entity);
      const username = dialogUsername(dialog.entity);

      if (!telegramChatId || !title || !type) continue;

      uniqueRows.set(telegramChatId, {
        category_id: categoryId,
        reader_account_id: readerId,
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
    found = rows.length;

    if (rows.length > 0) {
      const { data: savedChats, error: saveChatsError } = await serviceSupabase
        .from("rivn_leads_source_chats")
        .upsert(rows, { onConflict: "telegram_chat_id" })
        .select("id");

      if (saveChatsError) throw new Error(saveChatsError.message);
      saved = savedChats?.length ?? 0;

      const { data: projects, error: projectsError } = await serviceSupabase
        .from("rivn_leads_projects")
        .select("id")
        .eq("reader_account_id", readerId);

      if (projectsError) throw new Error(projectsError.message);

      const links = (projects ?? []).flatMap((project: { id: string }) =>
        (savedChats ?? []).map((chat: { id: string }) => ({
          project_id: project.id,
          source_chat_id: chat.id,
          enabled: true,
          updated_at: now,
        }))
      );

      if (links.length > 0) {
        const { error: linksError } = await serviceSupabase
          .from("rivn_leads_project_source_chats")
          .upsert(links, { onConflict: "project_id,source_chat_id" });

        if (linksError) throw new Error(linksError.message);
        linked = links.length;
      }
    }

    await serviceSupabase
      .from("rivn_leads_reader_accounts")
      .update({
        status: "active",
        last_error: null,
        last_seen_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", readerId);

    await writeAdminLeadsAudit(serviceSupabase, {
      userId,
      action: "reader.scan_chats",
      entityType: "RivnLeadsReaderAccount",
      entityId: readerId,
      metadata: { found, saved, linked },
    });
  } catch (scanError) {
    const message = scanError instanceof Error ? scanError.message : "Не удалось загрузить Telegram-чаты";

    await serviceSupabase
      .from("rivn_leads_reader_accounts")
      .update({
        status: message.includes("авториза") || message.includes("authoriz") ? "auth_required" : "error",
        last_error: message,
        last_seen_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", readerId);

    console.error("RIVN Leads reader chat scan failed:", scanError);
  } finally {
    await client.disconnect().catch(() => undefined);
  }
}

export async function POST(request: Request) {
  try {
    const { user, serviceSupabase } = await requireSuperAdminRoute();
    const body = (await request.json().catch(() => null)) as
      | (Record<string, unknown> & { action?: ManageAction })
      | null;

    if (!body?.action) {
      throw new Error("Не указано действие");
    }

    const now = new Date().toISOString();

    if (body.action === "create_project") {
      const workspaceId = requiredString(body.workspaceId, "Кабинет");
      const name = requiredString(body.name, "Название проекта");
      const niche = requiredString(body.niche, "Ниша").toLowerCase();
      const readerAccountId = optionalString(body.readerAccountId);

      const { data, error } = await serviceSupabase
        .from("rivn_leads_projects")
        .insert({
          workspace_id: workspaceId,
          reader_account_id: readerAccountId,
          name,
          niche,
          status: requireEnum(body.status, leadProjectStatuses, "draft"),
          destination_chat_id: optionalString(body.destinationChatId),
          daily_lead_limit: optionalNumber(body.dailyLeadLimit),
          monthly_lead_limit: optionalNumber(body.monthlyLeadLimit),
          created_by: user.id,
          updated_at: now,
        })
        .select("id")
        .single();

      if (error) throw new Error(error.message);

      if (readerAccountId) {
        const { data: readerChats, error: readerChatsError } = await serviceSupabase
          .from("rivn_leads_source_chats")
          .select("id")
          .eq("reader_account_id", readerAccountId)
          .eq("status", "active");

        if (readerChatsError) throw new Error(readerChatsError.message);

        const links = (readerChats ?? []).map((chat: { id: string }) => ({
          project_id: data.id,
          source_chat_id: chat.id,
          enabled: true,
          updated_at: now,
        }));

        if (links.length > 0) {
          const { error: linksError } = await serviceSupabase
            .from("rivn_leads_project_source_chats")
            .upsert(links, { onConflict: "project_id,source_chat_id" });

          if (linksError) throw new Error(linksError.message);
        }
      }

      await writeAdminLeadsAudit(serviceSupabase, {
        userId: user.id,
        workspaceId,
        action: "project.create",
        entityType: "RivnLeadsProject",
        entityId: data.id,
      });

      return apiSuccess({ id: data.id });
    }

    if (body.action === "update_project") {
      const id = requiredString(body.id, "ID проекта");
      const workspaceId = await getProjectWorkspaceId(serviceSupabase, id);
      const { error } = await serviceSupabase
        .from("rivn_leads_projects")
        .update({
          reader_account_id: Object.prototype.hasOwnProperty.call(body, "readerAccountId")
            ? optionalString(body.readerAccountId)
            : undefined,
          name: optionalString(body.name) ?? undefined,
          niche: optionalString(body.niche)?.toLowerCase() ?? undefined,
          status: body.status
            ? requireEnum(body.status, leadProjectStatuses, "draft")
            : undefined,
          destination_chat_id: Object.prototype.hasOwnProperty.call(body, "destinationChatId")
            ? optionalString(body.destinationChatId)
            : undefined,
          daily_lead_limit: Object.prototype.hasOwnProperty.call(body, "dailyLeadLimit")
            ? optionalNumber(body.dailyLeadLimit)
            : undefined,
          monthly_lead_limit: Object.prototype.hasOwnProperty.call(body, "monthlyLeadLimit")
            ? optionalNumber(body.monthlyLeadLimit)
            : undefined,
          updated_at: now,
        })
        .eq("id", id);

      if (error) throw new Error(error.message);
      await writeAdminLeadsAudit(serviceSupabase, {
        userId: user.id,
        workspaceId,
        action: "project.update",
        entityType: "RivnLeadsProject",
        entityId: id,
      });

      return apiSuccess({ id });
    }

    if (body.action === "delete_project") {
      const id = requiredString(body.id, "ID проекта");
      const workspaceId = await getProjectWorkspaceId(serviceSupabase, id);
      const { error } = await serviceSupabase.from("rivn_leads_projects").delete().eq("id", id);

      if (error) throw new Error(error.message);
      await writeAdminLeadsAudit(serviceSupabase, {
        userId: user.id,
        workspaceId,
        action: "project.delete",
        entityType: "RivnLeadsProject",
        entityId: id,
      });

      return apiSuccess({ id });
    }

    if (body.action === "create_source_chat") {
      const title = requiredString(body.title, "Название чата");
      const categoryId = requiredString(body.categoryId, "Категория");
      const telegramChatId = requiredString(body.telegramChatId, "Telegram chat_id");

      const { data, error } = await serviceSupabase
        .from("rivn_leads_source_chats")
        .insert({
          category_id: categoryId,
          reader_account_id: optionalString(body.readerAccountId),
          title,
          telegram_chat_id: telegramChatId,
          username: optionalString(body.username),
          invite_link: optionalString(body.inviteLink),
          type: requireEnum(body.type, sourceChatTypes, "group"),
          access_level: requireEnum(body.accessLevel, sourceChatAccessLevels, "private"),
          status: requireEnum(body.status, sourceChatStatuses, "pending_access"),
          member_count: optionalNumber(body.memberCount),
          updated_at: now,
        })
        .select("id")
        .single();

      if (error) throw new Error(error.message);
      await writeAdminLeadsAudit(serviceSupabase, {
        userId: user.id,
        action: "source_chat.create",
        entityType: "RivnLeadsSourceChat",
        entityId: data.id,
      });

      return apiSuccess({ id: data.id });
    }

    if (body.action === "update_source_chat") {
      const id = requiredString(body.id, "ID чата");
      const { error } = await serviceSupabase
        .from("rivn_leads_source_chats")
        .update({
          category_id: optionalString(body.categoryId) ?? undefined,
          reader_account_id: Object.prototype.hasOwnProperty.call(body, "readerAccountId")
            ? optionalString(body.readerAccountId)
            : undefined,
          title: optionalString(body.title) ?? undefined,
          telegram_chat_id: optionalString(body.telegramChatId) ?? undefined,
          username: Object.prototype.hasOwnProperty.call(body, "username")
            ? optionalString(body.username)
            : undefined,
          invite_link: Object.prototype.hasOwnProperty.call(body, "inviteLink")
            ? optionalString(body.inviteLink)
            : undefined,
          type: body.type ? requireEnum(body.type, sourceChatTypes, "group") : undefined,
          access_level: body.accessLevel
            ? requireEnum(body.accessLevel, sourceChatAccessLevels, "private")
            : undefined,
          status: body.status
            ? requireEnum(body.status, sourceChatStatuses, "pending_access")
            : undefined,
          member_count: Object.prototype.hasOwnProperty.call(body, "memberCount")
            ? optionalNumber(body.memberCount)
            : undefined,
          updated_at: now,
        })
        .eq("id", id);

      if (error) throw new Error(error.message);
      await writeAdminLeadsAudit(serviceSupabase, {
        userId: user.id,
        action: "source_chat.update",
        entityType: "RivnLeadsSourceChat",
        entityId: id,
      });

      return apiSuccess({ id });
    }

    if (body.action === "delete_source_chat") {
      const id = requiredString(body.id, "ID чата");
      const { error } = await serviceSupabase.from("rivn_leads_source_chats").delete().eq("id", id);

      if (error) throw new Error(error.message);
      await writeAdminLeadsAudit(serviceSupabase, {
        userId: user.id,
        action: "source_chat.delete",
        entityType: "RivnLeadsSourceChat",
        entityId: id,
      });

      return apiSuccess({ id });
    }

    if (body.action === "link_source_chat" || body.action === "unlink_source_chat") {
      const projectId = requiredString(body.projectId, "Проект");
      const sourceChatId = requiredString(body.sourceChatId, "Чат-источник");
      const workspaceId = await getProjectWorkspaceId(serviceSupabase, projectId);

      const { data, error } = await serviceSupabase
        .from("rivn_leads_project_source_chats")
        .upsert(
          {
            project_id: projectId,
            source_chat_id: sourceChatId,
            enabled: body.action === "link_source_chat",
            updated_at: now,
          },
          { onConflict: "project_id,source_chat_id" }
        )
        .select("id")
        .single();

      if (error) throw new Error(error.message);
      await writeAdminLeadsAudit(serviceSupabase, {
        userId: user.id,
        workspaceId,
        action: body.action === "link_source_chat" ? "project_source_chat.link" : "project_source_chat.unlink",
        entityType: "RivnLeadsProjectSourceChat",
        entityId: data.id,
      });

      return apiSuccess({ id: data.id });
    }

    if (body.action === "create_keyword") {
      const projectId = requiredString(body.projectId, "Проект");
      const value = requiredString(body.value, "Ключевое слово");
      const normalizedValue = normalizeText(value);
      const workspaceId = await getProjectWorkspaceId(serviceSupabase, projectId);

      const { data, error } = await serviceSupabase
        .from("rivn_leads_keywords")
        .upsert(
          {
            project_id: projectId,
            value,
            normalized_value: normalizedValue,
            match_type: requireEnum(body.matchType, keywordMatchTypes, "contains"),
            enabled: true,
            updated_at: now,
          },
          { onConflict: "project_id,normalized_value" }
        )
        .select("id")
        .single();

      if (error) throw new Error(error.message);
      await writeAdminLeadsAudit(serviceSupabase, {
        userId: user.id,
        workspaceId,
        action: "keyword.upsert",
        entityType: "RivnLeadsKeyword",
        entityId: data.id,
      });

      return apiSuccess({ id: data.id });
    }

    if (body.action === "update_keyword") {
      const id = requiredString(body.id, "ID ключевого слова");
      const value = optionalString(body.value);
      const { error } = await serviceSupabase
        .from("rivn_leads_keywords")
        .update({
          value: value ?? undefined,
          normalized_value: value ? normalizeText(value) : undefined,
          match_type: body.matchType ? requireEnum(body.matchType, keywordMatchTypes, "contains") : undefined,
          enabled: typeof body.enabled === "boolean" ? body.enabled : undefined,
          updated_at: now,
        })
        .eq("id", id);

      if (error) throw new Error(error.message);
      return apiSuccess({ id });
    }

    if (body.action === "delete_keyword") {
      const id = requiredString(body.id, "ID ключевого слова");
      const { error } = await serviceSupabase.from("rivn_leads_keywords").delete().eq("id", id);
      if (error) throw new Error(error.message);
      return apiSuccess({ id });
    }

    if (body.action === "create_stop_word") {
      const projectId = requiredString(body.projectId, "Проект");
      const value = requiredString(body.value, "Стоп-слово");
      const normalizedValue = normalizeText(value);
      const workspaceId = await getProjectWorkspaceId(serviceSupabase, projectId);

      const { data, error } = await serviceSupabase
        .from("rivn_leads_stop_words")
        .upsert(
          {
            project_id: projectId,
            value,
            normalized_value: normalizedValue,
            enabled: true,
            updated_at: now,
          },
          { onConflict: "project_id,normalized_value" }
        )
        .select("id")
        .single();

      if (error) throw new Error(error.message);
      await writeAdminLeadsAudit(serviceSupabase, {
        userId: user.id,
        workspaceId,
        action: "stop_word.upsert",
        entityType: "RivnLeadsStopWord",
        entityId: data.id,
      });

      return apiSuccess({ id: data.id });
    }

    if (body.action === "update_stop_word") {
      const id = requiredString(body.id, "ID стоп-слова");
      const value = optionalString(body.value);
      const { error } = await serviceSupabase
        .from("rivn_leads_stop_words")
        .update({
          value: value ?? undefined,
          normalized_value: value ? normalizeText(value) : undefined,
          enabled: typeof body.enabled === "boolean" ? body.enabled : undefined,
          updated_at: now,
        })
        .eq("id", id);

      if (error) throw new Error(error.message);
      return apiSuccess({ id });
    }

    if (body.action === "delete_stop_word") {
      const id = requiredString(body.id, "ID стоп-слова");
      const { error } = await serviceSupabase.from("rivn_leads_stop_words").delete().eq("id", id);
      if (error) throw new Error(error.message);
      return apiSuccess({ id });
    }

    if (body.action === "create_reader") {
      const label = requiredString(body.label, "Название reader-аккаунта");
      const sessionString = requiredString(body.sessionString, "Telegram session string");
      const encryptedSessionString = encryptRivnLeadsSessionString(sessionString);

      const { data, error } = await serviceSupabase
        .from("rivn_leads_reader_accounts")
        .insert({
          label,
          phone_hint: optionalString(body.phoneHint),
          encrypted_session_string: encryptedSessionString,
          encryption_key_id: process.env.RIVN_LEADS_ENCRYPTION_KEY_ID || "default",
          status: requireEnum(body.status, readerStatuses, "paused"),
          assigned_niche: optionalString(body.assignedNiche),
          max_chats_limit: optionalNumber(body.maxChatsLimit) ?? 50,
          last_error: null,
          updated_at: now,
        })
        .select("id")
        .single();

      if (error) throw new Error(error.message);
      await writeAdminLeadsAudit(serviceSupabase, {
        userId: user.id,
        action: "reader.create",
        entityType: "RivnLeadsReaderAccount",
        entityId: data.id,
        metadata: { label },
      });

      return apiSuccess({ id: data.id });
    }

    if (body.action === "update_reader") {
      const id = requiredString(body.id, "ID reader-аккаунта");
      const sessionString = optionalString(body.sessionString);
      const updatePayload: Record<string, unknown> = {
        label: optionalString(body.label) ?? undefined,
        phone_hint: Object.prototype.hasOwnProperty.call(body, "phoneHint")
          ? optionalString(body.phoneHint)
          : undefined,
        assigned_niche: Object.prototype.hasOwnProperty.call(body, "assignedNiche")
          ? optionalString(body.assignedNiche)
          : undefined,
        max_chats_limit: Object.prototype.hasOwnProperty.call(body, "maxChatsLimit")
          ? optionalNumber(body.maxChatsLimit) ?? 50
          : undefined,
        status: body.status ? requireEnum(body.status, readerStatuses, "paused") : undefined,
        updated_at: now,
      };

      if (sessionString) {
        updatePayload.encrypted_session_string = encryptRivnLeadsSessionString(sessionString);
        updatePayload.encryption_key_id = process.env.RIVN_LEADS_ENCRYPTION_KEY_ID || "default";
        updatePayload.last_error = null;
      }

      const { error } = await serviceSupabase
        .from("rivn_leads_reader_accounts")
        .update(updatePayload)
        .eq("id", id);

      if (error) throw new Error(error.message);
      await writeAdminLeadsAudit(serviceSupabase, {
        userId: user.id,
        action: "reader.update",
        entityType: "RivnLeadsReaderAccount",
        entityId: id,
      });

      return apiSuccess({ id });
    }

    if (body.action === "update_reader_status") {
      const id = requiredString(body.id, "ID reader-аккаунта");
      const status = requireEnum(body.status, readerStatuses, "paused");
      const { error } = await serviceSupabase
        .from("rivn_leads_reader_accounts")
        .update({ status, updated_at: now })
        .eq("id", id);

      if (error) throw new Error(error.message);
      await writeAdminLeadsAudit(serviceSupabase, {
        userId: user.id,
        action: "reader.status.update",
        entityType: "RivnLeadsReaderAccount",
        entityId: id,
        metadata: { status },
      });

      return apiSuccess({ id });
    }

    if (body.action === "delete_reader") {
      const id = requiredString(body.id, "ID reader-аккаунта");

      const { data: reader, error: readerError } = await serviceSupabase
        .from("rivn_leads_reader_accounts")
        .select("id,label")
        .eq("id", id)
        .maybeSingle();

      if (readerError) throw new Error(readerError.message);
      if (!reader) throw new Error("Reader-аккаунт не найден");

      const { error: projectsError } = await serviceSupabase
        .from("rivn_leads_projects")
        .update({ reader_account_id: null, updated_at: now })
        .eq("reader_account_id", id);

      if (projectsError) throw new Error(projectsError.message);

      const { error: chatsError } = await serviceSupabase
        .from("rivn_leads_source_chats")
        .update({ reader_account_id: null, updated_at: now })
        .eq("reader_account_id", id);

      if (chatsError) throw new Error(chatsError.message);

      const { error: deleteError } = await serviceSupabase
        .from("rivn_leads_reader_accounts")
        .delete()
        .eq("id", id);

      if (deleteError) throw new Error(deleteError.message);

      await writeAdminLeadsAudit(serviceSupabase, {
        userId: user.id,
        action: "reader.delete",
        entityType: "RivnLeadsReaderAccount",
        entityId: id,
        metadata: { label: reader.label },
      });

      return apiSuccess({ id });
    }

    if (body.action === "scan_reader_chats") {
      const id = requiredString(body.id, "ID reader-аккаунта");
      const apiId = Number(process.env.TELEGRAM_API_ID);
      const apiHash = process.env.TELEGRAM_API_HASH;

      if (!Number.isFinite(apiId) || apiId <= 0 || !apiHash) {
        throw new Error("TELEGRAM_API_ID и TELEGRAM_API_HASH должны быть заполнены на сервере");
      }

      const { data: reader, error: readerError } = await serviceSupabase
        .from("rivn_leads_reader_accounts")
        .select("id")
        .eq("id", id)
        .maybeSingle();

      if (readerError) throw new Error(readerError.message);
      if (!reader) throw new Error("Reader-аккаунт не найден");

      await serviceSupabase
        .from("rivn_leads_reader_accounts")
        .update({
          status: "active",
          last_error: "Загрузка Telegram-чатов запущена. Обычно это занимает несколько секунд.",
          last_seen_at: now,
          updated_at: now,
        })
        .eq("id", id);

      void scanReaderChatsInBackground({
        serviceSupabase,
        userId: user.id,
        readerId: id,
        apiId,
        apiHash,
        now,
      });

      return apiSuccess({ started: true });
    }

    throw new Error("Неизвестное действие");
  } catch (error) {
    return adminLeadsFailure(error);
  }
}
