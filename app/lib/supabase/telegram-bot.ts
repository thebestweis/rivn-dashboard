import { createClient } from "@supabase/supabase-js";

function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("Не найдены Supabase env для server-side Telegram bot");
  }

  return createClient(url, serviceRoleKey);
}

export type TelegramProfile = {
  telegramUserId: number;
  telegramChatId: number;
  username?: string | null;
  firstName?: string | null;
  lastName?: string | null;
};

export async function logTelegramBotEvent(params: {
  telegramUserId?: number | null;
  telegramChatId?: number | null;
  direction: "incoming" | "outgoing";
  messageType?: string | null;
  payload: Record<string, unknown>;
}) {
  const supabase = getAdminSupabase();

  await supabase.from("telegram_bot_logs").insert({
    telegram_user_id: params.telegramUserId ?? null,
    telegram_chat_id: params.telegramChatId ?? null,
    direction: params.direction,
    message_type: params.messageType ?? null,
    payload: params.payload,
  });
}

export async function consumeTelegramLinkCode(params: {
  code: string;
  profile: TelegramProfile;
}) {
  const supabase = getAdminSupabase();

  const nowIso = new Date().toISOString();

  const { data: pendingAction, error } = await supabase
    .from("telegram_pending_actions")
    .select("*")
    .eq("action_type", "link_code")
    .eq("status", "pending")
    .eq("payload->>code", params.code)
    .maybeSingle();

  if (error) {
    throw new Error(`Не удалось проверить код привязки: ${error.message}`);
  }

  if (!pendingAction) {
    throw new Error("Код привязки не найден или уже использован");
  }

  if (pendingAction.expires_at && pendingAction.expires_at < nowIso) {
    throw new Error("Срок действия кода привязки истёк");
  }

  const userId = pendingAction.user_id as string | null;
  const workspaceId = pendingAction.workspace_id as string | null;

  if (!userId || !workspaceId) {
    throw new Error("В коде привязки не хватает user_id или workspace_id");
  }

  const { data: existingLink } = await supabase
    .from("telegram_workspace_links")
    .select("id")
    .eq("telegram_user_id", params.profile.telegramUserId)
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();

  if (existingLink?.id) {
    await supabase
      .from("telegram_workspace_links")
      .update({
        telegram_chat_id: params.profile.telegramChatId,
        telegram_username: params.profile.username ?? null,
        telegram_first_name: params.profile.firstName ?? null,
        telegram_last_name: params.profile.lastName ?? null,
        is_active: true,
        is_default: true,
        updated_at: nowIso,
      })
      .eq("id", existingLink.id);
  } else {
    await supabase
      .from("telegram_workspace_links")
      .update({ is_default: false, updated_at: nowIso })
      .eq("telegram_user_id", params.profile.telegramUserId);

    const { error: insertError } = await supabase
      .from("telegram_workspace_links")
      .insert({
        telegram_user_id: params.profile.telegramUserId,
        telegram_chat_id: params.profile.telegramChatId,
        telegram_username: params.profile.username ?? null,
        telegram_first_name: params.profile.firstName ?? null,
        telegram_last_name: params.profile.lastName ?? null,
        user_id: userId,
        workspace_id: workspaceId,
        is_active: true,
        is_default: true,
      });

    if (insertError) {
      throw new Error(`Не удалось сохранить связку Telegram: ${insertError.message}`);
    }
  }

  await supabase
    .from("telegram_pending_actions")
    .update({
      status: "completed",
      updated_at: nowIso,
      payload: {
        ...(pendingAction.payload ?? {}),
        consumed_at: nowIso,
      },
    })
    .eq("id", pendingAction.id);

  return { userId, workspaceId };
}

export async function getTelegramWorkspaceLinks(telegramUserId: number) {
  const supabase = getAdminSupabase();

  const { data, error } = await supabase
    .from("telegram_workspace_links")
    .select(`
      id,
      telegram_user_id,
      telegram_chat_id,
      user_id,
      workspace_id,
      is_active,
      is_default,
      workspaces (
        id,
        name,
        slug
      )
    `)
    .eq("telegram_user_id", telegramUserId)
    .eq("is_active", true);

  if (error) {
    throw new Error(`Не удалось загрузить telegram workspace links: ${error.message}`);
  }

  return data ?? [];
}

export async function setDefaultTelegramWorkspaceLink(params: {
  telegramUserId: number;
  workspaceId: string;
}) {
  const supabase = getAdminSupabase();
  const nowIso = new Date().toISOString();

  await supabase
    .from("telegram_workspace_links")
    .update({ is_default: false, updated_at: nowIso })
    .eq("telegram_user_id", params.telegramUserId);

  const { error } = await supabase
    .from("telegram_workspace_links")
    .update({ is_default: true, updated_at: nowIso })
    .eq("telegram_user_id", params.telegramUserId)
    .eq("workspace_id", params.workspaceId);

  if (error) {
    throw new Error(`Не удалось переключить активный workspace: ${error.message}`);
  }
}

export async function getDefaultTelegramWorkspaceLink(telegramUserId: number) {
  const links = await getTelegramWorkspaceLinks(telegramUserId);
  return (
    links.find((item: any) => item.is_default) ??
    links[0] ??
    null
  );
}

export async function getWorkspaceMembersForBot(workspaceId: string) {
  const supabase = getAdminSupabase();

  const { data, error } = await supabase
    .from("workspace_members")
    .select(`
      id,
      role,
      status,
      display_name,
      profiles!workspace_members_user_id_fkey (
        email
      )
    `)
    .eq("workspace_id", workspaceId)
    .eq("status", "active");

  if (error) {
    throw new Error(`Не удалось загрузить участников workspace: ${error.message}`);
  }

  return (data ?? []).map((item: any) => ({
    id: item.id as string,
    role: item.role as string,
    status: item.status as string,
    display_name: item.display_name as string | null,
    email: Array.isArray(item.profiles)
      ? item.profiles[0]?.email ?? null
      : item.profiles?.email ?? null,
  }));
}

export async function getProjectsForBot(workspaceId: string) {
  const supabase = getAdminSupabase();

  const { data, error } = await supabase
    .from("projects")
    .select("id, name, client_id, status")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Не удалось загрузить проекты: ${error.message}`);
  }

  return data ?? [];
}

export async function getClientsForBot(workspaceId: string) {
  const supabase = getAdminSupabase();

  const { data, error } = await supabase
    .from("clients")
    .select("id, name, status")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Не удалось загрузить клиентов: ${error.message}`);
  }

  return data ?? [];
}

export async function createTaskFromTelegram(params: {
  workspaceId: string;
  userId: string;
  title: string;
  description?: string | null;
  deadlineAt?: string | null;
  projectId?: string | null;
  assigneeIds?: string[];
}) {
  const supabase = getAdminSupabase();

  const { data: task, error: taskError } = await supabase
    .from("tasks")
    .insert({
      workspace_id: params.workspaceId,
      user_id: params.userId,
      project_id: params.projectId ?? null,
      parent_task_id: null,
      title: params.title,
      description: params.description ?? null,
      status: "todo",
      deadline_at: params.deadlineAt ?? null,
      is_archived: false,
      position: 0,
    })
    .select("*")
    .single();

  if (taskError) {
    throw new Error(`Не удалось создать задачу из Telegram: ${taskError.message}`);
  }

  const safeAssigneeIds = Array.from(
    new Set((params.assigneeIds ?? []).map((item) => item.trim()).filter(Boolean))
  );

  if (safeAssigneeIds.length > 0) {
    const { error: assigneeError } = await supabase
      .from("task_assignees")
      .insert(
        safeAssigneeIds.map((workspaceMemberId) => ({
          task_id: task.id,
          workspace_member_id: workspaceMemberId,
        }))
      );

    if (assigneeError) {
      throw new Error(`Задача создана, но исполнители не сохранились: ${assigneeError.message}`);
    }
  }

  return task;
}

export async function saveTelegramPendingAction(params: {
  telegramUserId: number;
  telegramChatId: number;
  userId?: string | null;
  workspaceId?: string | null;
  actionType: string;
  payload?: Record<string, unknown>;
  expiresAt?: string | null;
}) {
  const supabase = getAdminSupabase();

  const { error } = await supabase.from("telegram_pending_actions").insert({
    telegram_user_id: params.telegramUserId,
    telegram_chat_id: params.telegramChatId,
    user_id: params.userId ?? null,
    workspace_id: params.workspaceId ?? null,
    action_type: params.actionType,
    status: "pending",
    payload: params.payload ?? {},
    expires_at: params.expiresAt ?? null,
  });

  if (error) {
    throw new Error(`Не удалось сохранить pending action: ${error.message}`);
  }
}