type MemberLite = {
  id: string;
  display_name: string | null;
  email: string | null;
};

type ProjectLite = {
  id: string;
  name: string;
  client_id: string | null;
};

type ClientLite = {
  id: string;
  name: string;
};

type ParseTaskInput = {
  text: string;
  members: MemberLite[];
  projects: ProjectLite[];
  clients: ClientLite[];
};

type ParseTaskResult = {
  title: string;
  description: string;
  deadlineAt: string | null;
  matchedAssigneeIds: string[];
  matchedProjectId: string | null;
  matchedClientId: string | null;
  needsAssigneeClarification: boolean;
  needsProjectClarification: boolean;
};

const RU_MONTHS: Record<string, number> = {
  января: 0,
  февраль: 1,
  февраля: 1,
  март: 2,
  марта: 2,
  апрель: 3,
  апреля: 3,
  май: 4,
  мая: 4,
  июнь: 5,
  июня: 5,
  июль: 6,
  июля: 6,
  август: 7,
  августа: 7,
  сентябрь: 8,
  сентября: 8,
  октябрь: 9,
  октября: 9,
  ноябрь: 10,
  ноября: 10,
  декабрь: 11,
  декабря: 11,
};

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/[«»"']/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function buildMemberSearchStrings(member: MemberLite) {
  const result: string[] = [];

  if (member.display_name?.trim()) {
    result.push(normalizeText(member.display_name));
  }

  if (member.email?.trim()) {
    result.push(normalizeText(member.email));
    result.push(normalizeText(member.email.split("@")[0] ?? ""));
  }

  return Array.from(new Set(result.filter(Boolean)));
}

function smartTitleFromText(text: string) {
  const cleaned = text
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^я хочу\s+/i, "")
    .replace(/^нужно\s+/i, "")
    .replace(/^поставь задачу\s+/i, "")
    .trim();

  if (!cleaned) {
    return "Новая задача";
  }

  const sliced = cleaned.length > 120 ? `${cleaned.slice(0, 117).trim()}...` : cleaned;
  return sliced.charAt(0).toUpperCase() + sliced.slice(1);
}

function parseDeadline(text: string): string | null {
  const normalized = normalizeText(text);
  const now = new Date();

  const ddmmyyyyTime =
    normalized.match(
      /до\s+(\d{1,2})[.\-/](\d{1,2})(?:[.\-/](\d{4}))?(?:\s*(?:в|до)?\s*(\d{1,2}):(\d{2}))?/
    ) ??
    normalized.match(
      /(\d{1,2})[.\-/](\d{1,2})(?:[.\-/](\d{4}))?(?:\s*(?:в|до)?\s*(\d{1,2}):(\d{2}))?/
    );

  if (ddmmyyyyTime) {
    const day = Number(ddmmyyyyTime[1]);
    const month = Number(ddmmyyyyTime[2]) - 1;
    const year = Number(ddmmyyyyTime[3] ?? now.getFullYear());
    const hours = Number(ddmmyyyyTime[4] ?? 12);
    const minutes = Number(ddmmyyyyTime[5] ?? 0);

    const date = new Date(year, month, day, hours, minutes, 0, 0);
    if (!Number.isNaN(date.getTime())) {
      return date.toISOString();
    }
  }

  const ruMonthMatch =
    normalized.match(
      /до\s+(\d{1,2})\s+([а-яё]+)(?:\s+(\d{4}))?(?:\s*(?:в|до)?\s*(\d{1,2}):(\d{2}))?/
    ) ??
    normalized.match(
      /(\d{1,2})\s+([а-яё]+)(?:\s+(\d{4}))?(?:\s*(?:в|до)?\s*(\d{1,2}):(\d{2}))?/
    );

  if (ruMonthMatch) {
    const day = Number(ruMonthMatch[1]);
    const monthName = ruMonthMatch[2];
    const month = RU_MONTHS[monthName];
    const year = Number(ruMonthMatch[3] ?? now.getFullYear());
    const hours = Number(ruMonthMatch[4] ?? 12);
    const minutes = Number(ruMonthMatch[5] ?? 0);

    if (month !== undefined) {
      const date = new Date(year, month, day, hours, minutes, 0, 0);
      if (!Number.isNaN(date.getTime())) {
        return date.toISOString();
      }
    }
  }

  return null;
}

export function parseTaskFromTelegramText(input: ParseTaskInput): ParseTaskResult {
  const text = input.text.trim();
  const normalized = normalizeText(text);

  const matchedMembers = input.members.filter((member) =>
    buildMemberSearchStrings(member).some((candidate) =>
      candidate && normalized.includes(candidate)
    )
  );

  const matchedProjects = input.projects.filter((project) =>
    normalized.includes(normalizeText(project.name))
  );

  const matchedClients = input.clients.filter((client) =>
    normalized.includes(normalizeText(client.name))
  );

  const deadlineAt = parseDeadline(text);

  const title = smartTitleFromText(text);

  const descriptionParts = [
    `Источник: Telegram бот`,
    `Исходная формулировка пользователя: ${text}`,
  ];

  const description = descriptionParts.join("\n\n");

  const matchedProjectId = matchedProjects[0]?.id ?? null;
  const matchedClientId = matchedClients[0]?.id ?? null;

  const hasAssigneeMention =
    normalized.includes("на меня") ||
    normalized.includes("исполнитель") ||
    normalized.includes("сотрудник") ||
    normalized.includes("на ") ||
    matchedMembers.length > 0;

  const hasProjectMention =
    normalized.includes("проект") ||
    normalized.includes("клиент") ||
    matchedProjects.length > 0 ||
    matchedClients.length > 0;

  return {
    title,
    description,
    deadlineAt,
    matchedAssigneeIds: matchedMembers.map((item) => item.id),
    matchedProjectId,
    matchedClientId,
    needsAssigneeClarification: hasAssigneeMention && matchedMembers.length === 0,
    needsProjectClarification:
      (normalized.includes("проект") || normalized.includes("клиент")) &&
      !matchedProjectId &&
      !matchedClientId,
  };
}