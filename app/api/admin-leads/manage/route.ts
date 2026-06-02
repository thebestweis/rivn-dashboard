import { apiSuccess } from "@/app/lib/api/errors";
import { requireSuperAdminRoute } from "../../admin/_utils";
import {
  adminLeadsFailure,
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
  | "update_reader_status";

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

      const { data, error } = await serviceSupabase
        .from("rivn_leads_projects")
        .insert({
          workspace_id: workspaceId,
          reader_account_id: optionalString(body.readerAccountId),
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

    throw new Error("Неизвестное действие");
  } catch (error) {
    return adminLeadsFailure(error);
  }
}
