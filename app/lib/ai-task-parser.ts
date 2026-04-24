export type ParsedTelegramTaskIntent = "create_task" | "update_task" | "unknown";

export type ParsedTelegramTaskResult = {
  intent: ParsedTelegramTaskIntent;
  rawText: string;

  title: string | null;
  description: string | null;

  deadlineText: string | null;
  deadlineAt: string | null;

  assigneeNames: string[];
  projectName: string | null;
  clientName: string | null;

  needsClarification: boolean;
  clarificationQuestion: string | null;

  editTargetHint: string | null;
};

function extractDeadlineFromText(text: string): string | null {
  const normalized = text.toLowerCase();

  const match =
    normalized.match(/до\s+(\d{1,2})\s+([а-яА-Яa-zA-Z]+)\s+до\s+(\d{1,2}:\d{2})/) ||
    normalized.match(/до\s+(\d{1,2}\.\d{1,2}\.\d{4})\s+(\d{1,2}:\d{2})/);

  if (!match) {
    return null;
  }

  return match[0];
}

function extractAssignees(text: string): string[] {
  const result: string[] = [];
  const normalized = text.replace(/\n/g, " ");

  const patterns = [
    /на\s+меня\s+и\s+([A-Za-zА-Яа-яЁё0-9_-]+)/gi,
    /на\s+([A-Za-zА-Яа-яЁё0-9_-]+)/gi,
    /исполнитель[:\s]+([A-Za-zА-Яа-яЁё0-9_,\s-]+)/gi,
  ];

  for (const pattern of patterns) {
    const matches = normalized.matchAll(pattern);

    for (const match of matches) {
      const value = match[1]?.trim();
      if (value) {
        result.push(value);
      }
    }
    if (result.length > 0) break;
  }

  return Array.from(new Set(result.map((item) => item.trim()).filter(Boolean)));
}

function extractProjectName(text: string): string | null {
  const patterns = [
    /для\s+проекта\s+(.+?)(?:\.|,|$)/i,
    /по\s+проекту\s+(.+?)(?:\.|,|$)/i,
    /проект\s+(.+?)(?:\.|,|$)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    const value = match?.[1]?.trim();
    if (value) return value;
  }

  return null;
}

function extractClientName(text: string): string | null {
  const patterns = [
    /для\s+клиента\s+(.+?)(?:\.|,|$)/i,
    /клиент\s+(.+?)(?:\.|,|$)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    const value = match?.[1]?.trim();
    if (value) return value;
  }

  return null;
}

function buildTitle(text: string): string | null {
  const cleaned = text
    .replace(/поставь\s+задачу/gi, "")
    .replace(/создай\s+задачу/gi, "")
    .replace(/нужно/gi, "")
    .replace(/я хочу/gi, "")
    .trim();

  if (!cleaned) return null;

  return cleaned.length > 140 ? cleaned.slice(0, 140).trim() : cleaned;
}

export async function parseTelegramTaskText(
  text: string
): Promise<ParsedTelegramTaskResult> {
  const normalized = text.trim();

  if (!normalized) {
    return {
      intent: "unknown",
      rawText: text,
      title: null,
      description: null,
      deadlineText: null,
      deadlineAt: null,
      assigneeNames: [],
      projectName: null,
      clientName: null,
      needsClarification: true,
      clarificationQuestion: "Не удалось понять задачу. Напиши, что именно нужно сделать.",
      editTargetHint: null,
    };
  }

  const lower = normalized.toLowerCase();

  const isEditIntent =
    lower.includes("измени задачу") ||
    lower.includes("обнови задачу") ||
    lower.includes("исправь задачу") ||
    lower.includes("отредактируй задачу");

  const intent: ParsedTelegramTaskIntent = isEditIntent ? "update_task" : "create_task";

  const title = buildTitle(normalized);
  const deadlineText = extractDeadlineFromText(normalized);
  const assigneeNames = extractAssignees(normalized);
  const projectName = extractProjectName(normalized);
  const clientName = extractClientName(normalized);

  return {
    intent,
    rawText: text,
    title,
    description: normalized,
    deadlineText,
    deadlineAt: null,
    assigneeNames,
    projectName,
    clientName,
    needsClarification: !title,
    clarificationQuestion: !title
      ? "Не смог понять название задачи. Напиши коротко, что нужно сделать."
      : null,
    editTargetHint: isEditIntent ? normalized : null,
  };
}