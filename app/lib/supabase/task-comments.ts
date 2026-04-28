import { requireBillingAccess } from "../billing-guards";
import { createActivityLogSafely } from "./activity-logs";
import { getAppContext } from "./app-context";
import {
  CHAT_ATTACHMENTS_BUCKET,
  type ChatAttachment,
  assertChatAttachment,
  uploadChatAttachment,
} from "./project-comments";

const CHAT_ATTACHMENT_SIGNED_URL_TTL_SECONDS = 60 * 60;

type SupabaseClient = Awaited<ReturnType<typeof getAppContext>>["supabase"];

export type TaskComment = {
  id: string;
  workspace_id: string;
  task_id: string;
  author_user_id: string | null;
  author_member_id: string | null;
  text: string;
  created_at: string;
  attachments: ChatAttachment[];
};

type DbTaskCommentRow = {
  id: string;
  workspace_id: string;
  task_id: string;
  author_user_id: string | null;
  author_member_id: string | null;
  text: string;
  created_at: string;
};

type DbChatAttachmentRow = {
  id: string;
  workspace_id: string;
  task_comment_id: string | null;
  project_comment_id: string | null;
  bucket_id: string;
  storage_path: string;
  file_name: string;
  file_type: string | null;
  file_size: number | null;
  created_at: string;
};

function mapAttachment(row: DbChatAttachmentRow): ChatAttachment {
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    task_comment_id: row.task_comment_id ?? null,
    project_comment_id: row.project_comment_id ?? null,
    bucket_id: row.bucket_id,
    storage_path: row.storage_path,
    file_name: row.file_name,
    file_type: row.file_type ?? null,
    file_size: row.file_size ?? null,
    signed_url: null,
    created_at: row.created_at,
  };
}

function mapTaskComment(
  row: DbTaskCommentRow,
  attachments: ChatAttachment[] = []
): TaskComment {
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    task_id: row.task_id,
    author_user_id: row.author_user_id ?? null,
    author_member_id: row.author_member_id ?? null,
    text: row.text,
    created_at: row.created_at,
    attachments,
  };
}

async function attachSignedUrls(
  supabase: SupabaseClient,
  attachments: ChatAttachment[]
) {
  return Promise.all(
    attachments.map(async (attachment) => {
      const { data } = await supabase.storage
        .from(attachment.bucket_id)
        .createSignedUrl(
          attachment.storage_path,
          CHAT_ATTACHMENT_SIGNED_URL_TTL_SECONDS
        );

      return {
        ...attachment,
        signed_url: data?.signedUrl ?? null,
      };
    })
  );
}

async function getAttachmentsByTaskCommentIds(
  supabase: SupabaseClient,
  workspaceId: string,
  commentIds: string[]
) {
  if (commentIds.length === 0) {
    return new Map<string, ChatAttachment[]>();
  }

  const { data, error } = await supabase
    .from("chat_attachments")
    .select(
      "id, workspace_id, task_comment_id, project_comment_id, bucket_id, storage_path, file_name, file_type, file_size, created_at"
    )
    .eq("workspace_id", workspaceId)
    .in("task_comment_id", commentIds)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Ошибка загрузки вложений задачи: ${error.message}`);
  }

  const attachments = await attachSignedUrls(
    supabase,
    ((data ?? []) as DbChatAttachmentRow[]).map(mapAttachment)
  );
  const byCommentId = new Map<string, ChatAttachment[]>();

  for (const attachment of attachments) {
    if (!attachment.task_comment_id) continue;

    const current = byCommentId.get(attachment.task_comment_id) ?? [];
    current.push(attachment);
    byCommentId.set(attachment.task_comment_id, current);
  }

  return byCommentId;
}

export async function getTaskComments(taskId: string): Promise<TaskComment[]> {
  const { supabase, workspace } = await getAppContext();

  const { data, error } = await supabase
    .from("task_comments")
    .select(
      "id, workspace_id, task_id, author_user_id, author_member_id, text, created_at"
    )
    .eq("workspace_id", workspace.id)
    .eq("task_id", taskId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Ошибка загрузки комментариев: ${error.message}`);
  }

  const comments = (data ?? []) as DbTaskCommentRow[];
  const attachmentsByCommentId = await getAttachmentsByTaskCommentIds(
    supabase,
    workspace.id,
    comments.map((comment) => comment.id)
  );

  return comments.map((comment) =>
    mapTaskComment(comment, attachmentsByCommentId.get(comment.id) ?? [])
  );
}

export async function createTaskComment(
  taskId: string,
  text: string,
  attachment?: File | null
): Promise<TaskComment> {
  await requireBillingAccess();

  const { supabase, workspace, user, membership } = await getAppContext();
  const normalizedText = text.trim();
  const selectedAttachment = attachment ?? null;

  if (!normalizedText && !selectedAttachment) {
    throw new Error("Сообщение не может быть пустым");
  }

  if (selectedAttachment) {
    assertChatAttachment(selectedAttachment);
  }

  const { data: taskRow, error: taskError } = await supabase
    .from("tasks")
    .select("id, project_id")
    .eq("id", taskId)
    .eq("workspace_id", workspace.id)
    .maybeSingle();

  if (taskError) {
    throw new Error(`Ошибка проверки задачи: ${taskError.message}`);
  }

  if (!taskRow) {
    throw new Error("Задача не найдена в текущем кабинете");
  }

  const { data, error } = await supabase
    .from("task_comments")
    .insert({
      workspace_id: workspace.id,
      task_id: taskId,
      author_user_id: user.id,
      author_member_id: membership?.id ?? null,
      text: normalizedText || `Вложение: ${selectedAttachment?.name ?? "файл"}`,
    })
    .select(
      "id, workspace_id, task_id, author_user_id, author_member_id, text, created_at"
    )
    .single();

  if (error) {
    throw new Error(`Ошибка создания комментария: ${error.message}`);
  }

  const createdComment = data as DbTaskCommentRow;
  let attachments: ChatAttachment[] = [];

  if (selectedAttachment) {
    const storagePath = await uploadChatAttachment({
      supabase,
      workspaceId: workspace.id,
      scope: "task-comments",
      parentId: taskId,
      file: selectedAttachment,
    });

    const { data: attachmentRow, error: attachmentError } = await supabase
      .from("chat_attachments")
      .insert({
        workspace_id: workspace.id,
        task_comment_id: createdComment.id,
        bucket_id: CHAT_ATTACHMENTS_BUCKET,
        storage_path: storagePath,
        file_name: selectedAttachment.name,
        file_type: selectedAttachment.type || null,
        file_size: selectedAttachment.size,
      })
      .select(
        "id, workspace_id, task_comment_id, project_comment_id, bucket_id, storage_path, file_name, file_type, file_size, created_at"
      )
      .single();

    if (attachmentError) {
      throw new Error(`Ошибка сохранения файла: ${attachmentError.message}`);
    }

    attachments = await attachSignedUrls(supabase, [
      mapAttachment(attachmentRow as DbChatAttachmentRow),
    ]);
  }

  await createActivityLogSafely({
    entityType: "task",
    entityId: taskId,
    projectId: (taskRow as { project_id: string | null }).project_id ?? null,
    taskId,
    action: selectedAttachment ? "task_file_added" : "task_message_added",
    title: selectedAttachment
      ? "В задачу добавлен файл"
      : "В задачу добавлено сообщение",
    description: selectedAttachment
      ? `${selectedAttachment.name}${normalizedText ? `: ${normalizedText}` : ""}`
      : normalizedText,
    metadata: {
      commentId: createdComment.id,
      fileName: selectedAttachment?.name ?? null,
      fileSize: selectedAttachment?.size ?? null,
    },
  });

  return mapTaskComment(createdComment, attachments);
}
