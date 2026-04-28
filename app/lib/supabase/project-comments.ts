import { requireBillingAccess } from "../billing-guards";
import { createActivityLogSafely } from "./activity-logs";
import { getAppContext } from "./app-context";

export const CHAT_ATTACHMENTS_BUCKET = "chat-attachments";

const CHAT_ATTACHMENT_SIGNED_URL_TTL_SECONDS = 60 * 60;
const MAX_CHAT_ATTACHMENT_SIZE = 10 * 1024 * 1024;

type SupabaseClient = Awaited<ReturnType<typeof getAppContext>>["supabase"];

export type ChatAttachment = {
  id: string;
  workspace_id: string;
  task_comment_id: string | null;
  project_comment_id: string | null;
  bucket_id: string;
  storage_path: string;
  file_name: string;
  file_type: string | null;
  file_size: number | null;
  signed_url: string | null;
  created_at: string;
};

export type ProjectComment = {
  id: string;
  workspace_id: string;
  project_id: string;
  author_user_id: string | null;
  author_member_id: string | null;
  text: string;
  created_at: string;
  attachments: ChatAttachment[];
};

type DbProjectCommentRow = {
  id: string;
  workspace_id: string;
  project_id: string;
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

function sanitizeFileName(fileName: string) {
  return (
    fileName
      .replace(/[^\w.\-а-яА-ЯёЁ]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 120) || "file"
  );
}

export function formatChatAttachmentSize(size: number | null) {
  if (!size || size <= 0) return "";

  if (size < 1024 * 1024) {
    return `${Math.ceil(size / 1024)} КБ`;
  }

  return `${(size / 1024 / 1024).toFixed(1).replace(".", ",")} МБ`;
}

export function assertChatAttachment(file: File) {
  if (file.size > MAX_CHAT_ATTACHMENT_SIZE) {
    throw new Error("Файл слишком большой. Максимальный размер: 10 МБ.");
  }
}

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

function mapProjectComment(
  row: DbProjectCommentRow,
  attachments: ChatAttachment[] = []
): ProjectComment {
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    project_id: row.project_id,
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

async function getAttachmentsByProjectCommentIds(
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
    .in("project_comment_id", commentIds)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Ошибка загрузки вложений проекта: ${error.message}`);
  }

  const attachments = await attachSignedUrls(
    supabase,
    ((data ?? []) as DbChatAttachmentRow[]).map(mapAttachment)
  );
  const byCommentId = new Map<string, ChatAttachment[]>();

  for (const attachment of attachments) {
    if (!attachment.project_comment_id) continue;

    const current = byCommentId.get(attachment.project_comment_id) ?? [];
    current.push(attachment);
    byCommentId.set(attachment.project_comment_id, current);
  }

  return byCommentId;
}

export async function uploadChatAttachment(params: {
  supabase: SupabaseClient;
  workspaceId: string;
  scope: "task-comments" | "project-comments" | "crm-deal-comments";
  parentId: string;
  file: File;
}) {
  assertChatAttachment(params.file);

  const storagePath = `${params.workspaceId}/${params.scope}/${
    params.parentId
  }/${crypto.randomUUID()}-${sanitizeFileName(params.file.name)}`;

  const { error } = await params.supabase.storage
    .from(CHAT_ATTACHMENTS_BUCKET)
    .upload(storagePath, params.file, {
      contentType: params.file.type || "application/octet-stream",
      upsert: false,
    });

  if (error) {
    throw new Error(`Ошибка загрузки файла: ${error.message}`);
  }

  return storagePath;
}

export async function getProjectComments(
  projectId: string
): Promise<ProjectComment[]> {
  const { supabase, workspace } = await getAppContext();

  const { data, error } = await supabase
    .from("project_comments")
    .select(
      "id, workspace_id, project_id, author_user_id, author_member_id, text, created_at"
    )
    .eq("workspace_id", workspace.id)
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Ошибка загрузки чата проекта: ${error.message}`);
  }

  const comments = (data ?? []) as DbProjectCommentRow[];
  const attachmentsByCommentId = await getAttachmentsByProjectCommentIds(
    supabase,
    workspace.id,
    comments.map((comment) => comment.id)
  );

  return comments.map((comment) =>
    mapProjectComment(comment, attachmentsByCommentId.get(comment.id) ?? [])
  );
}

export async function createProjectComment(params: {
  projectId: string;
  text: string;
  attachment?: File | null;
}): Promise<ProjectComment> {
  await requireBillingAccess();

  const { supabase, workspace, user, membership } = await getAppContext();
  const normalizedText = params.text.trim();
  const attachment = params.attachment ?? null;

  if (!normalizedText && !attachment) {
    throw new Error("Сообщение не может быть пустым");
  }

  if (attachment) {
    assertChatAttachment(attachment);
  }

  const { data: projectRow, error: projectError } = await supabase
    .from("projects")
    .select("id")
    .eq("id", params.projectId)
    .eq("workspace_id", workspace.id)
    .maybeSingle();

  if (projectError) {
    throw new Error(`Ошибка проверки проекта: ${projectError.message}`);
  }

  if (!projectRow) {
    throw new Error("Проект не найден в текущем кабинете");
  }

  const { data, error } = await supabase
    .from("project_comments")
    .insert({
      workspace_id: workspace.id,
      project_id: params.projectId,
      author_user_id: user.id,
      author_member_id: membership?.id ?? null,
      text: normalizedText || `Вложение: ${attachment?.name ?? "файл"}`,
    })
    .select(
      "id, workspace_id, project_id, author_user_id, author_member_id, text, created_at"
    )
    .single();

  if (error) {
    throw new Error(`Ошибка отправки сообщения: ${error.message}`);
  }

  const createdComment = data as DbProjectCommentRow;
  let attachments: ChatAttachment[] = [];

  if (attachment) {
    const storagePath = await uploadChatAttachment({
      supabase,
      workspaceId: workspace.id,
      scope: "project-comments",
      parentId: params.projectId,
      file: attachment,
    });

    const { data: attachmentRow, error: attachmentError } = await supabase
      .from("chat_attachments")
      .insert({
        workspace_id: workspace.id,
        project_comment_id: createdComment.id,
        bucket_id: CHAT_ATTACHMENTS_BUCKET,
        storage_path: storagePath,
        file_name: attachment.name,
        file_type: attachment.type || null,
        file_size: attachment.size,
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
    entityType: "project",
    entityId: params.projectId,
    projectId: params.projectId,
    action: attachment ? "project_file_added" : "project_message_added",
    title: attachment ? "В проект добавлен файл" : "В проект добавлено сообщение",
    description: attachment
      ? `${attachment.name}${normalizedText ? `: ${normalizedText}` : ""}`
      : normalizedText,
    metadata: {
      commentId: createdComment.id,
      fileName: attachment?.name ?? null,
      fileSize: attachment?.size ?? null,
    },
  });

  return mapProjectComment(createdComment, attachments);
}
