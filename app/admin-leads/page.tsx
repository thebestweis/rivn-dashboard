"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useConfirmDialog } from "../components/ui/confirm-dialog-provider";
import { useAppContextState } from "../providers/app-context-provider";

type Summary = {
  readersTotal: number;
  readersActive: number;
  readersNeedAttention: number;
  sourceChatsTotal: number;
  sourceChatsActive: number;
  projectsTotal: number;
  projectsActive: number;
  leadsToday: number;
  leadsWeek: number;
  failedDeliveriesWeek: number;
};

type Workspace = { id: string; name: string };
type ReaderAccount = {
  id: string;
  label: string;
  phone_hint: string | null;
  status: string | null;
  assigned_niche: string | null;
  last_seen_at: string | null;
  last_error: string | null;
  max_chats_limit: number | null;
};
type Category = { id: string; name: string; slug: string };
type SourceChat = {
  id: string;
  category_id: string;
  reader_account_id: string | null;
  title: string;
  telegram_chat_id: string;
  username: string | null;
  invite_link: string | null;
  type: string;
  access_level: string;
  status: string;
  member_count: number | null;
  last_message_at: string | null;
};
type LeadProject = {
  id: string;
  workspace_id: string;
  reader_account_id: string | null;
  name: string;
  niche: string;
  status: string;
  destination_chat_id: string | null;
  telegram_bot_added: boolean;
  daily_lead_limit: number | null;
  monthly_lead_limit: number | null;
  created_at: string | null;
};
type ProjectSourceChat = {
  id: string;
  project_id: string;
  source_chat_id: string;
  enabled: boolean;
};
type Keyword = {
  id: string;
  project_id: string;
  value: string;
  match_type: string;
  enabled: boolean;
};
type StopWord = {
  id: string;
  project_id: string;
  value: string;
  enabled: boolean;
};
type Lead = {
  id: string;
  project_id: string;
  source_chat_id: string | null;
  status: string | null;
  matched_keywords: unknown;
  delivered_at: string | null;
  created_at: string | null;
};
type DeliveryLog = {
  id: string;
  project_id: string | null;
  status: string | null;
  error_message: string | null;
  created_at: string | null;
};

type OverviewResponse = {
  ok: boolean;
  error: string;
  summary: Summary;
  workspaces: Workspace[];
  readers: ReaderAccount[];
  categories: Category[];
  sourceChats: SourceChat[];
  projects: LeadProject[];
  projectSourceChats: ProjectSourceChat[];
  keywords: Keyword[];
  stopWords: StopWord[];
  latestLeads: Lead[];
  recentDeliveryLogs: DeliveryLog[];
  generatedAt: string;
};

const emptySummary: Summary = {
  readersTotal: 0,
  readersActive: 0,
  readersNeedAttention: 0,
  sourceChatsTotal: 0,
  sourceChatsActive: 0,
  projectsTotal: 0,
  projectsActive: 0,
  leadsToday: 0,
  leadsWeek: 0,
  failedDeliveriesWeek: 0,
};

const projectStatusOptions = [
  ["draft", "Черновик"],
  ["active", "Активен"],
  ["paused", "На паузе"],
  ["archived", "Архив"],
] as const;

const sourceStatusOptions = [
  ["active", "Активен"],
  ["paused", "На паузе"],
  ["pending_access", "Ждёт доступ"],
  ["access_lost", "Доступ потерян"],
  ["error", "Ошибка"],
] as const;

const readerStatusOptions = [
  ["active", "Активен"],
  ["paused", "На паузе"],
  ["auth_required", "Нужна авторизация"],
  ["banned", "Заблокирован"],
  ["error", "Ошибка"],
] as const;

const tabs = [
  ["projects", "Проекты"],
  ["sources", "Источники"],
  ["readers", "Reader-аккаунты"],
  ["delivery", "Лиды и доставка"],
] as const;

function fieldClass(extra = "") {
  return `w-full rounded-2xl border border-white/10 bg-[#0B1020] px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-emerald-300/50 ${extra}`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "нет данных";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "нет данных";

  return date.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusLabel(status: string | null | undefined) {
  const labels: Record<string, string> = {
    active: "Активен",
    connected: "Подключен",
    ok: "Работает",
    draft: "Черновик",
    paused: "На паузе",
    archived: "Архив",
    inactive: "Выключен",
    failed: "Ошибка",
    error: "Ошибка",
    auth_required: "Нужна авторизация",
    pending_access: "Ждёт доступ",
    access_lost: "Доступ потерян",
    delivered: "Доставлен",
    new: "Новый",
  };

  return status ? labels[status] ?? status : "Не указан";
}

function statusClass(status: string | null | undefined) {
  if (status === "active" || status === "connected" || status === "ok" || status === "delivered") {
    return "border-emerald-400/25 bg-emerald-400/10 text-emerald-200";
  }

  if (status === "auth_required" || status === "failed" || status === "error" || status === "access_lost") {
    return "border-rose-400/25 bg-rose-400/10 text-rose-200";
  }

  if (status === "paused" || status === "pending_access" || status === "draft") {
    return "border-amber-400/25 bg-amber-400/10 text-amber-200";
  }

  return "border-white/10 bg-white/5 text-white/60";
}

function StatusPill({ status }: { status: string | null | undefined }) {
  return (
    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${statusClass(status)}`}>
      {statusLabel(status)}
    </span>
  );
}

function MetricCard({
  label,
  value,
  caption,
}: {
  label: string;
  value: string | number;
  caption: string;
}) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5 shadow-[0_18px_55px_rgba(0,0,0,0.18)]">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/40">{label}</p>
      <div className="mt-3 text-3xl font-semibold tracking-tight text-white">{value}</div>
      <p className="mt-2 text-sm leading-5 text-white/50">{caption}</p>
    </div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[28px] border border-white/10 bg-[#111827]/95 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.25)] lg:p-6">
      <div className="mb-5 flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200/70">RIVN Leads</p>
          <h2 className="mt-2 text-xl font-semibold text-white">{title}</h2>
        </div>
        <p className="max-w-2xl text-sm leading-6 text-white/55">{description}</p>
      </div>
      {children}
    </section>
  );
}

function getKeywords(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item)).filter(Boolean);
}

export default function AdminLeadsPage() {
  const { isLoading: isContextLoading, isSuperAdmin } = useAppContextState();
  const { confirm } = useConfirmDialog();
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number][0]>("projects");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const [projectForm, setProjectForm] = useState({
    workspaceId: "",
    name: "",
    niche: "",
    readerAccountId: "",
    destinationChatId: "",
    dailyLeadLimit: "",
    monthlyLeadLimit: "",
    status: "draft",
  });
  const [sourceForm, setSourceForm] = useState({
    title: "",
    categoryId: "",
    telegramChatId: "",
    username: "",
    readerAccountId: "",
    type: "group",
    accessLevel: "private",
    status: "active",
    memberCount: "",
  });
  const [readerForm, setReaderForm] = useState({
    label: "",
    phoneHint: "",
    assignedNiche: "",
    maxChatsLimit: "50",
    status: "paused",
    sessionString: "",
  });
  const [editingReaderId, setEditingReaderId] = useState("");
  const [readerEditForm, setReaderEditForm] = useState({
    label: "",
    phoneHint: "",
    assignedNiche: "",
    maxChatsLimit: "50",
    status: "paused",
    sessionString: "",
  });
  const [keywordForm, setKeywordForm] = useState({ value: "", matchType: "contains" });
  const [stopWordForm, setStopWordForm] = useState({ value: "" });
  const [testLeadForm, setTestLeadForm] = useState({
    sourceChatId: "",
    messageText: "Ищу специалиста по Яндекс.Директу для проекта в B2B. Нужен опыт с заявками на услуги.",
  });

  const loadOverview = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch("/api/admin-leads/overview", { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as OverviewResponse | null;

      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || "Не удалось загрузить админку RIVN Leads");
      }

      setData(payload);
      setProjectForm((current) => ({
        ...current,
        workspaceId: current.workspaceId || payload.workspaces[0]?.id || "",
      }));
      setSourceForm((current) => ({
        ...current,
        categoryId: current.categoryId || payload.categories[0]?.id || "",
      }));
      setSelectedProjectId((current) => current || payload.projects[0]?.id || "");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Не удалось загрузить админку RIVN Leads");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isContextLoading || !isSuperAdmin) return;
    void loadOverview();
  }, [isContextLoading, isSuperAdmin, loadOverview]);

  const summary = data?.summary ?? emptySummary;
  const selectedProject = data?.projects.find((project) => project.id === selectedProjectId) ?? null;

  const workspacesById = useMemo(() => {
    return new Map((data?.workspaces ?? []).map((workspace) => [workspace.id, workspace.name]));
  }, [data?.workspaces]);

  const categoriesById = useMemo(() => {
    return new Map((data?.categories ?? []).map((category) => [category.id, category.name]));
  }, [data?.categories]);

  const readersById = useMemo(() => {
    return new Map((data?.readers ?? []).map((reader) => [reader.id, reader.label]));
  }, [data?.readers]);

  const sourceChatsById = useMemo(() => {
    return new Map((data?.sourceChats ?? []).map((chat) => [chat.id, chat.title]));
  }, [data?.sourceChats]);

  const projectSourceChatIds = useMemo(() => {
    return new Set(
      (data?.projectSourceChats ?? [])
        .filter((link) => link.project_id === selectedProjectId && link.enabled)
        .map((link) => link.source_chat_id)
    );
  }, [data?.projectSourceChats, selectedProjectId]);

  const selectedProjectChats = useMemo(() => {
    return (data?.sourceChats ?? []).filter(
      (chat) =>
        projectSourceChatIds.has(chat.id) ||
        (selectedProject?.reader_account_id && chat.reader_account_id === selectedProject.reader_account_id)
    );
  }, [data?.sourceChats, projectSourceChatIds, selectedProject?.reader_account_id]);

  const sourceChatCountByReader = useMemo(() => {
    const counts = new Map<string, number>();

    for (const chat of data?.sourceChats ?? []) {
      if (!chat.reader_account_id) continue;
      counts.set(chat.reader_account_id, (counts.get(chat.reader_account_id) ?? 0) + 1);
    }

    return counts;
  }, [data?.sourceChats]);

  async function runAction(body: Record<string, unknown>, successMessage: string) {
    setIsSubmitting(true);
    setNotice("");
    setError("");

    try {
      const response = await fetch("/api/admin-leads/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const rawPayload = await response.text();
      const payload = rawPayload
        ? (JSON.parse(rawPayload) as ({ ok?: boolean; error?: string } & Record<string, unknown>))
        : null;

      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || `Сервер вернул ошибку ${response.status}`);
      }

      setNotice(successMessage);
      await loadOverview();
      return payload;
    } catch (actionError) {
      const message =
        actionError instanceof SyntaxError
          ? "Сервер вернул не API-ответ. Скорее всего, приложение на сервере ещё не обновлено или маршрут упал при запуске."
          : actionError instanceof Error
            ? actionError.message
            : "Не удалось выполнить действие";

      setError(message);
      return null;
    } finally {
      setIsSubmitting(false);
    }
  }

  async function createProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await runAction(
      {
        action: "create_project",
        workspaceId: projectForm.workspaceId,
        name: projectForm.name,
        niche: projectForm.niche,
        readerAccountId: projectForm.readerAccountId,
        destinationChatId: projectForm.destinationChatId,
        dailyLeadLimit: projectForm.dailyLeadLimit,
        monthlyLeadLimit: projectForm.monthlyLeadLimit,
        status: projectForm.status,
      },
      "Проект RIVN Leads создан"
    );
    setProjectForm((current) => ({ ...current, name: "", niche: "", destinationChatId: "" }));
  }

  async function createSourceChat(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await runAction(
      {
        action: "create_source_chat",
        title: sourceForm.title,
        categoryId: sourceForm.categoryId,
        telegramChatId: sourceForm.telegramChatId,
        username: sourceForm.username,
        readerAccountId: sourceForm.readerAccountId,
        type: sourceForm.type,
        accessLevel: sourceForm.accessLevel,
        status: sourceForm.status,
        memberCount: sourceForm.memberCount,
      },
      "Чат-источник добавлен"
    );
    setSourceForm((current) => ({ ...current, title: "", telegramChatId: "", username: "", memberCount: "" }));
  }

  async function createReader(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await runAction(
      {
        action: "create_reader",
        label: readerForm.label,
        phoneHint: readerForm.phoneHint,
        assignedNiche: readerForm.assignedNiche,
        maxChatsLimit: readerForm.maxChatsLimit,
        status: readerForm.status,
        sessionString: readerForm.sessionString,
      },
      "Reader-аккаунт добавлен. После запуска worker он начнёт читать назначенные чаты."
    );
    setReaderForm((current) => ({ ...current, label: "", phoneHint: "", assignedNiche: "", sessionString: "" }));
  }

  async function toggleProjectChat(chat: SourceChat) {
    if (!selectedProjectId) return;
    const isLinked = projectSourceChatIds.has(chat.id);

    await runAction(
      {
        action: isLinked ? "unlink_source_chat" : "link_source_chat",
        projectId: selectedProjectId,
        sourceChatId: chat.id,
      },
      isLinked ? "Чат отключён от проекта" : "Чат подключён к проекту"
    );
  }

  async function scanReaderChats(reader: ReaderAccount) {
    const result = await runAction(
      { action: "scan_reader_chats", id: reader.id },
      "Чаты reader-аккаунта загружены"
    );

    if (result) {
      if (result.started) {
        setNotice("Загрузка чатов запущена. Обнови страницу через несколько секунд, чтобы увидеть найденные чаты.");
        window.setTimeout(() => void loadOverview(), 5000);
        return;
      }

      const found = typeof result.found === "number" ? result.found : 0;
      const saved = typeof result.saved === "number" ? result.saved : 0;
      const linked = typeof result.linked === "number" ? result.linked : 0;
      setNotice(`Готово: найдено ${found}, сохранено ${saved}, привязано к проектам ${linked}`);
    }
  }

  function startEditReader(reader: ReaderAccount) {
    setEditingReaderId(reader.id);
    setReaderEditForm({
      label: reader.label,
      phoneHint: reader.phone_hint ?? "",
      assignedNiche: reader.assigned_niche ?? "",
      maxChatsLimit: reader.max_chats_limit ? String(reader.max_chats_limit) : "50",
      status: reader.status ?? "paused",
      sessionString: "",
    });
  }

  function cancelEditReader() {
    setEditingReaderId("");
    setReaderEditForm({
      label: "",
      phoneHint: "",
      assignedNiche: "",
      maxChatsLimit: "50",
      status: "paused",
      sessionString: "",
    });
  }

  async function saveReaderEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingReaderId) return;

    const result = await runAction(
      {
        action: "update_reader",
        id: editingReaderId,
        label: readerEditForm.label,
        phoneHint: readerEditForm.phoneHint,
        assignedNiche: readerEditForm.assignedNiche,
        maxChatsLimit: readerEditForm.maxChatsLimit,
        status: readerEditForm.status,
        sessionString: readerEditForm.sessionString,
      },
      "Reader-аккаунт обновлён"
    );

    if (result) cancelEditReader();
  }

  async function deleteReader(reader: ReaderAccount) {
    const confirmed = await confirm({
      title: "Удалить reader-аккаунт?",
      description:
        "Проекты и найденные чаты не удалятся, но этот reader больше не будет читать Telegram-чаты и искать заявки.",
      confirmLabel: "Удалить",
      cancelLabel: "Отмена",
      tone: "danger",
    });

    if (!confirmed) return;

    const result = await runAction(
      { action: "delete_reader", id: reader.id },
      "Reader-аккаунт удалён"
    );

    if (result && editingReaderId === reader.id) cancelEditReader();
  }

  async function createKeyword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedProjectId) return;

    await runAction(
      {
        action: "create_keyword",
        projectId: selectedProjectId,
        value: keywordForm.value,
        matchType: keywordForm.matchType,
      },
      "Ключевое слово добавлено"
    );
    setKeywordForm({ value: "", matchType: "contains" });
  }

  async function createStopWord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedProjectId) return;

    await runAction(
      {
        action: "create_stop_word",
        projectId: selectedProjectId,
        value: stopWordForm.value,
      },
      "Стоп-слово добавлено"
    );
    setStopWordForm({ value: "" });
  }

  async function runTestIngest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const sourceChatId = testLeadForm.sourceChatId || selectedProjectChats[0]?.id || "";

    setIsSubmitting(true);
    setNotice("");
    setError("");

    try {
      const response = await fetch("/api/admin-leads/test-ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceChatId,
          messageText: testLeadForm.messageText,
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { ok?: boolean; error?: string; result?: { leadsCreated?: number; leadsDelivered?: number; reason?: string } }
        | null;

      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || "Не удалось запустить тест RIVN Leads");
      }

      setNotice(
        `Тест обработан: лидов создано ${payload.result?.leadsCreated ?? 0}, доставлено ${payload.result?.leadsDelivered ?? 0}.`
      );
      await loadOverview();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Не удалось запустить тест RIVN Leads");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isContextLoading) {
    return (
      <main className="min-h-screen px-5 py-6 text-white lg:px-8">
        <div className="rounded-[28px] border border-white/10 bg-[#111827] p-8">Загружаем доступы...</div>
      </main>
    );
  }

  if (!isSuperAdmin) {
    return (
      <main className="min-h-screen px-5 py-6 text-white lg:px-8">
        <div className="rounded-[28px] border border-rose-400/20 bg-rose-400/10 p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-rose-200/80">Закрытый раздел</p>
          <h1 className="mt-3 text-2xl font-semibold">Нет доступа к админке RIVN Leads</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/60">
            Эта страница доступна только супер-администратору платформы.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen space-y-6 px-5 py-6 text-white lg:px-8">
      <section className="overflow-hidden rounded-[32px] border border-white/10 bg-[#111827] p-6 shadow-[0_28px_90px_rgba(0,0,0,0.3)] lg:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-sm font-bold uppercase tracking-[0.22em] text-emerald-300">Admin Leads</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight lg:text-5xl">Управление RIVN Leads</h1>
            <p className="mt-4 text-base leading-7 text-white/60">
              Это первый рабочий слой переноса: можно создавать проекты, подключать Telegram-чаты,
              назначать reader-аккаунты, управлять ключевыми словами и стоп-словами.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
            <button
              type="button"
              onClick={() => void loadOverview()}
              className="rounded-2xl bg-emerald-400 px-5 py-3 text-sm font-semibold text-[#06120f] shadow-[0_18px_50px_rgba(16,185,129,0.25)] transition hover:bg-emerald-300"
            >
              Обновить данные
            </button>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm text-white/50">
              Обновлено: {formatDate(data?.generatedAt)}
            </div>
          </div>
        </div>

        {notice ? (
          <div className="mt-6 rounded-2xl border border-emerald-400/25 bg-emerald-400/10 px-5 py-4 text-sm text-emerald-100">
            {notice}
          </div>
        ) : null}
        {error ? (
          <div className="mt-6 rounded-2xl border border-rose-400/25 bg-rose-400/10 px-5 py-4 text-sm text-rose-100">
            {error}
          </div>
        ) : null}
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Reader-аккаунты" value={`${summary.readersActive}/${summary.readersTotal}`} caption="Аккаунты, которые читают Telegram-чаты." />
        <MetricCard label="Источники" value={`${summary.sourceChatsActive}/${summary.sourceChatsTotal}`} caption="Чаты и сообщества в мониторинге." />
        <MetricCard label="Проекты" value={`${summary.projectsActive}/${summary.projectsTotal}`} caption="Активные проекты поиска лидов." />
        <MetricCard label="Лиды" value={summary.leadsToday} caption={`За 7 дней найдено: ${summary.leadsWeek}`} />
        <MetricCard label="Внимание" value={summary.readersNeedAttention + summary.failedDeliveriesWeek} caption="Ошибки reader-аккаунтов и доставки." />
      </section>

      <nav className="flex flex-wrap gap-2 rounded-[24px] border border-white/10 bg-white/[0.035] p-2">
        {tabs.map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setActiveTab(value)}
            className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
              activeTab === value ? "bg-emerald-400 text-[#06120f]" : "text-white/55 hover:bg-white/10 hover:text-white"
            }`}
          >
            {label}
          </button>
        ))}
      </nav>

      {isLoading ? (
        <div className="rounded-[28px] border border-white/10 bg-[#111827] p-8 text-white/60">Загружаем данные RIVN Leads...</div>
      ) : null}

      {!isLoading && activeTab === "projects" ? (
        <div className="space-y-6">
          <Section title="Создать проект поиска лидов" description="Проект привязан к кабинету RIVN OS, нише, reader-аккаунту и Telegram-беседе, куда будут приходить найденные заявки.">
            <form className="grid gap-3" onSubmit={(event) => void createProject(event)}>
              <div className="grid gap-3 lg:grid-cols-2">
                <select className={fieldClass()} value={projectForm.workspaceId} onChange={(event) => setProjectForm({ ...projectForm, workspaceId: event.target.value })} required>
                  <option value="">Выбери кабинет</option>
                  {(data?.workspaces ?? []).map((workspace) => (
                    <option key={workspace.id} value={workspace.id}>{workspace.name}</option>
                  ))}
                </select>
                <input className={fieldClass()} placeholder="Название проекта" value={projectForm.name} onChange={(event) => setProjectForm({ ...projectForm, name: event.target.value })} required />
              </div>
              <div className="grid gap-3 lg:grid-cols-3">
                <input className={fieldClass()} placeholder="Ниша: директологи, CRM, юристы..." value={projectForm.niche} onChange={(event) => setProjectForm({ ...projectForm, niche: event.target.value })} required />
                <select className={fieldClass()} value={projectForm.readerAccountId} onChange={(event) => setProjectForm({ ...projectForm, readerAccountId: event.target.value })}>
                  <option value="">Reader не назначен</option>
                  {(data?.readers ?? []).map((reader) => (
                    <option key={reader.id} value={reader.id}>{reader.label}</option>
                  ))}
                </select>
                <select className={fieldClass()} value={projectForm.status} onChange={(event) => setProjectForm({ ...projectForm, status: event.target.value })}>
                  {projectStatusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </div>
              <div className="grid gap-3 lg:grid-cols-3">
                <input className={fieldClass()} placeholder="Telegram chat_id для доставки" value={projectForm.destinationChatId} onChange={(event) => setProjectForm({ ...projectForm, destinationChatId: event.target.value })} />
                <input className={fieldClass()} placeholder="Дневной лимит лидов" value={projectForm.dailyLeadLimit} onChange={(event) => setProjectForm({ ...projectForm, dailyLeadLimit: event.target.value })} />
                <input className={fieldClass()} placeholder="Месячный лимит лидов" value={projectForm.monthlyLeadLimit} onChange={(event) => setProjectForm({ ...projectForm, monthlyLeadLimit: event.target.value })} />
              </div>
              <button className="rounded-2xl bg-emerald-400 px-5 py-3 text-sm font-semibold text-[#06120f] transition hover:bg-emerald-300 disabled:opacity-50" disabled={isSubmitting} type="submit">
                Создать проект
              </button>
            </form>
          </Section>

          <Section title="Проекты RIVN Leads" description="Выбери проект, чтобы настроить ключевые слова, стоп-слова и чаты-источники.">
            <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
              {(data?.projects ?? []).map((project) => (
                <button
                  key={project.id}
                  type="button"
                  onClick={() => setSelectedProjectId(project.id)}
                  className={`rounded-2xl border p-4 text-left transition ${
                    selectedProjectId === project.id
                      ? "border-emerald-300/50 bg-emerald-300/10"
                      : "border-white/10 bg-white/[0.035] hover:border-white/20"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-base font-semibold">{project.name}</h3>
                      <p className="mt-1 text-sm text-white/45">
                        {workspacesById.get(project.workspace_id) ?? "Кабинет не найден"} · {project.niche}
                      </p>
                      <p className="mt-1 text-xs text-white/35">
                        Reader: {project.reader_account_id ? readersById.get(project.reader_account_id) ?? "не найден" : "не назначен"}
                      </p>
                    </div>
                    <StatusPill status={project.status} />
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {projectStatusOptions.map(([value, label]) => (
                      <span
                        key={value}
                        onClick={(event) => {
                          event.stopPropagation();
                          void runAction({ action: "update_project", id: project.id, status: value }, "Статус проекта обновлён");
                        }}
                        className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/60 hover:border-emerald-300/40 hover:text-emerald-100"
                      >
                        {label}
                      </span>
                    ))}
                  </div>
                </button>
              ))}
            </div>
          </Section>

          {selectedProject ? (
            <div className="grid gap-6 xl:grid-cols-[.9fr_1.1fr]">
              <Section title={`Настройки: ${selectedProject.name}`} description="Словарь проекта определяет, какие сообщения система считает потенциальными заявками.">
                <div className="space-y-5">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                    <p className="text-sm text-white/50">Доставка лидов</p>
                    <p className="mt-2 font-semibold">{selectedProject.destination_chat_id || "Telegram-чат не указан"}</p>
                    <p className="mt-1 text-sm text-white/45">Бот добавлен: {selectedProject.telegram_bot_added ? "да" : "нет"}</p>
                  </div>

                  <form className="space-y-3" onSubmit={(event) => void createKeyword(event)}>
                    <p className="font-semibold">Ключевые слова</p>
                    <div className="grid gap-3 md:grid-cols-[1fr_180px]">
                      <input className={fieldClass()} placeholder="Например: нужен директолог" value={keywordForm.value} onChange={(event) => setKeywordForm({ ...keywordForm, value: event.target.value })} required />
                      <select className={fieldClass()} value={keywordForm.matchType} onChange={(event) => setKeywordForm({ ...keywordForm, matchType: event.target.value })}>
                        <option value="contains">Содержит</option>
                        <option value="exact">Точное</option>
                        <option value="fuzzy">Похожее</option>
                      </select>
                    </div>
                    <button className="rounded-2xl border border-emerald-300/30 px-4 py-2 text-sm text-emerald-100 hover:bg-emerald-300/10" disabled={isSubmitting} type="submit">
                      Добавить ключ
                    </button>
                    <div className="flex flex-wrap gap-2">
                      {(data?.keywords ?? []).filter((item) => item.project_id === selectedProject.id).map((keyword) => (
                        <button
                          key={keyword.id}
                          type="button"
                          onClick={() => void runAction({ action: "update_keyword", id: keyword.id, enabled: !keyword.enabled }, "Ключевое слово обновлено")}
                          className={`rounded-full border px-3 py-1 text-xs ${keyword.enabled ? "border-cyan-300/25 bg-cyan-300/10 text-cyan-100" : "border-white/10 bg-white/5 text-white/40"}`}
                        >
                          {keyword.value}
                        </button>
                      ))}
                    </div>
                  </form>

                  <form className="space-y-3" onSubmit={(event) => void createStopWord(event)}>
                    <p className="font-semibold">Стоп-слова</p>
                    <input className={fieldClass()} placeholder="Например: вакансия, бесплатно, стажировка" value={stopWordForm.value} onChange={(event) => setStopWordForm({ value: event.target.value })} required />
                    <button className="rounded-2xl border border-rose-300/30 px-4 py-2 text-sm text-rose-100 hover:bg-rose-300/10" disabled={isSubmitting} type="submit">
                      Добавить стоп-слово
                    </button>
                    <div className="flex flex-wrap gap-2">
                      {(data?.stopWords ?? []).filter((item) => item.project_id === selectedProject.id).map((stopWord) => (
                        <button
                          key={stopWord.id}
                          type="button"
                          onClick={() => void runAction({ action: "update_stop_word", id: stopWord.id, enabled: !stopWord.enabled }, "Стоп-слово обновлено")}
                          className={`rounded-full border px-3 py-1 text-xs ${stopWord.enabled ? "border-rose-300/25 bg-rose-300/10 text-rose-100" : "border-white/10 bg-white/5 text-white/40"}`}
                        >
                          {stopWord.value}
                        </button>
                      ))}
                    </div>
                  </form>
                </div>
              </Section>

              <Section title="Чаты проекта" description="Подключай только те чаты, где есть смысл искать заявки для выбранной ниши.">
                <div className="space-y-3">
                  <form className="rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-4" onSubmit={(event) => void runTestIngest(event)}>
                    <div className="flex flex-col gap-3">
                      <div>
                        <p className="font-semibold text-emerald-100">Тестовый входящий лид</p>
                        <p className="mt-1 text-sm leading-5 text-emerald-100/65">
                          Проверяет полный путь: сообщение из Telegram-чата, ключевые слова, создание лида и доставка в Telegram.
                        </p>
                      </div>
                      <select
                        className={fieldClass()}
                        value={testLeadForm.sourceChatId}
                        onChange={(event) => setTestLeadForm({ ...testLeadForm, sourceChatId: event.target.value })}
                      >
                        <option value="">Первый подключенный чат проекта</option>
                        {selectedProjectChats.map((chat) => (
                          <option key={chat.id} value={chat.id}>{chat.title}</option>
                        ))}
                      </select>
                      <textarea
                        className={fieldClass("min-h-[120px] resize-none")}
                        value={testLeadForm.messageText}
                        onChange={(event) => setTestLeadForm({ ...testLeadForm, messageText: event.target.value })}
                        placeholder="Например: ищу директолога для B2B-компании"
                        required
                      />
                      <button
                        className="rounded-2xl bg-emerald-400 px-5 py-3 text-sm font-semibold text-[#06120f] transition hover:bg-emerald-300 disabled:opacity-50"
                        disabled={isSubmitting || selectedProjectChats.length === 0}
                        type="submit"
                      >
                        Проверить создание лида
                      </button>
                    </div>
                  </form>

                  {(data?.sourceChats ?? []).map((chat) => {
                    const isInheritedFromReader = Boolean(
                      selectedProject?.reader_account_id && chat.reader_account_id === selectedProject.reader_account_id
                    );
                    const isLinked =
                      projectSourceChatIds.has(chat.id) || isInheritedFromReader;

                    return (
                      <article key={chat.id} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <h3 className="font-semibold">{chat.title}</h3>
                            <p className="mt-1 text-sm text-white/45">
                              {categoriesById.get(chat.category_id) ?? "Без категории"} · {chat.username ? `@${chat.username}` : chat.telegram_chat_id}
                            </p>
                            <p className="mt-1 text-xs text-white/35">
                              Reader: {chat.reader_account_id ? readersById.get(chat.reader_account_id) ?? "не найден" : "не назначен"}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <StatusPill status={chat.status} />
                            <button
                              type="button"
                              onClick={() => void toggleProjectChat(chat)}
                              className={`rounded-full border px-4 py-2 text-xs font-semibold ${
                                isLinked
                                  ? "border-emerald-300/25 bg-emerald-300/10 text-emerald-100"
                                  : "border-white/10 bg-white/5 text-white/55"
                              }`}
                              disabled={isSubmitting || isInheritedFromReader}
                            >
                              {isInheritedFromReader ? "Из reader" : isLinked ? "Подключен" : "Подключить"}
                            </button>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </Section>
            </div>
          ) : null}
        </div>
      ) : null}

      {!isLoading && activeTab === "sources" ? (
        <div className="space-y-6">
          <Section title="Добавить чат-источник" description="Источник - это Telegram-чат или обсуждение, где reader будет искать потенциальные заявки.">
            <form className="grid gap-3" onSubmit={(event) => void createSourceChat(event)}>
              <input className={fieldClass()} placeholder="Название чата" value={sourceForm.title} onChange={(event) => setSourceForm({ ...sourceForm, title: event.target.value })} required />
              <div className="grid gap-3 md:grid-cols-2">
                <input className={fieldClass()} placeholder="Telegram chat_id" value={sourceForm.telegramChatId} onChange={(event) => setSourceForm({ ...sourceForm, telegramChatId: event.target.value })} required />
                <input className={fieldClass()} placeholder="Username без @" value={sourceForm.username} onChange={(event) => setSourceForm({ ...sourceForm, username: event.target.value })} />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <select className={fieldClass()} value={sourceForm.categoryId} onChange={(event) => setSourceForm({ ...sourceForm, categoryId: event.target.value })} required>
                  <option value="">Категория</option>
                  {(data?.categories ?? []).map((category) => (
                    <option key={category.id} value={category.id}>{category.name}</option>
                  ))}
                </select>
                <select className={fieldClass()} value={sourceForm.readerAccountId} onChange={(event) => setSourceForm({ ...sourceForm, readerAccountId: event.target.value })}>
                  <option value="">Reader не назначен</option>
                  {(data?.readers ?? []).map((reader) => (
                    <option key={reader.id} value={reader.id}>{reader.label}</option>
                  ))}
                </select>
              </div>
              <div className="grid gap-3 md:grid-cols-4">
                <select className={fieldClass()} value={sourceForm.type} onChange={(event) => setSourceForm({ ...sourceForm, type: event.target.value })}>
                  <option value="group">Группа</option>
                  <option value="supergroup">Супергруппа</option>
                  <option value="channel_discussion">Обсуждение канала</option>
                </select>
                <select className={fieldClass()} value={sourceForm.accessLevel} onChange={(event) => setSourceForm({ ...sourceForm, accessLevel: event.target.value })}>
                  <option value="private">Приватный</option>
                  <option value="public">Публичный</option>
                  <option value="special">Спец-доступ</option>
                </select>
                <select className={fieldClass()} value={sourceForm.status} onChange={(event) => setSourceForm({ ...sourceForm, status: event.target.value })}>
                  {sourceStatusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
                <input className={fieldClass()} placeholder="Участников" value={sourceForm.memberCount} onChange={(event) => setSourceForm({ ...sourceForm, memberCount: event.target.value })} />
              </div>
              <button className="rounded-2xl bg-emerald-400 px-5 py-3 text-sm font-semibold text-[#06120f] transition hover:bg-emerald-300 disabled:opacity-50" disabled={isSubmitting} type="submit">
                Добавить чат
              </button>
            </form>
          </Section>

          <Section title="Все источники" description="Быстрый контроль статусов и привязки reader-аккаунтов к чатам.">
            <div className="grid gap-3 lg:grid-cols-2">
              {(data?.sourceChats ?? []).map((chat) => (
                <article key={chat.id} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate font-semibold">{chat.title}</h3>
                      <p className="mt-1 text-sm text-white/45">
                        {categoriesById.get(chat.category_id) ?? "Без категории"} · {chat.username ? `@${chat.username}` : chat.telegram_chat_id}
                      </p>
                    </div>
                    <StatusPill status={chat.status} />
                  </div>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    <select
                      className={fieldClass()}
                      value={chat.status}
                      onChange={(event) => void runAction({ action: "update_source_chat", id: chat.id, status: event.target.value }, "Статус источника обновлён")}
                    >
                      {sourceStatusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                    <select
                      className={fieldClass()}
                      value={chat.reader_account_id ?? ""}
                      onChange={(event) => void runAction({ action: "update_source_chat", id: chat.id, readerAccountId: event.target.value }, "Reader источника обновлён")}
                    >
                      <option value="">Reader не назначен</option>
                      {(data?.readers ?? []).map((reader) => (
                        <option key={reader.id} value={reader.id}>{reader.label}</option>
                      ))}
                    </select>
                  </div>
                </article>
              ))}
            </div>
          </Section>
        </div>
      ) : null}

      {!isLoading && activeTab === "readers" ? (
        <Section title="Reader-аккаунты" description="Reader-аккаунт — это Telegram-аккаунт, который легально состоит в нужных чатах и читает сообщения для поиска заявок. Session string хранится только в зашифрованном виде.">
          <div className="mb-6 rounded-2xl border border-violet-300/20 bg-violet-300/10 p-4">
            <p className="text-sm font-semibold text-violet-100">Как подключить чаты одной кнопкой</p>
            <p className="mt-2 text-sm leading-6 text-white/60">
              Сначала добавь reader-аккаунт с Telegram session string. После сохранения ниже появится карточка reader-аккаунта
              с кнопкой «Загрузить чаты». Она сама считает доступные Telegram-чаты аккаунта и привяжет их как единую пачку.
            </p>
          </div>

          <form className="mb-6 rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-4" onSubmit={(event) => void createReader(event)}>
            <div className="grid gap-3 lg:grid-cols-2">
              <input
                className={fieldClass()}
                placeholder="Название reader-аккаунта"
                value={readerForm.label}
                onChange={(event) => setReaderForm({ ...readerForm, label: event.target.value })}
                required
              />
              <input
                className={fieldClass()}
                placeholder="Телефон-подсказка: +7 *** **-45"
                value={readerForm.phoneHint}
                onChange={(event) => setReaderForm({ ...readerForm, phoneHint: event.target.value })}
              />
            </div>
            <div className="mt-3 grid gap-3 lg:grid-cols-3">
              <input
                className={fieldClass()}
                placeholder="Ниша или роль аккаунта"
                value={readerForm.assignedNiche}
                onChange={(event) => setReaderForm({ ...readerForm, assignedNiche: event.target.value })}
              />
              <input
                className={fieldClass()}
                placeholder="Лимит чатов"
                value={readerForm.maxChatsLimit}
                onChange={(event) => setReaderForm({ ...readerForm, maxChatsLimit: event.target.value })}
              />
              <select
                className={fieldClass()}
                value={readerForm.status}
                onChange={(event) => setReaderForm({ ...readerForm, status: event.target.value })}
              >
                <option value="paused">Создать на паузе</option>
                <option value="active">Сразу активировать</option>
              </select>
            </div>
            <textarea
              className={fieldClass("mt-3 min-h-[120px] resize-none")}
              placeholder="Telegram session string. Его можно получить отдельной сервисной командой на сервере."
              value={readerForm.sessionString}
              onChange={(event) => setReaderForm({ ...readerForm, sessionString: event.target.value })}
              required
            />
            <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <p className="text-sm leading-5 text-emerald-100/65">
                Важно: не вставляй сюда пароль от Telegram. Нужен именно session string reader-аккаунта. После сохранения он сразу шифруется.
              </p>
              <button
                className="rounded-2xl bg-emerald-400 px-5 py-3 text-sm font-semibold text-[#06120f] transition hover:bg-emerald-300 disabled:opacity-50"
                disabled={isSubmitting}
                type="submit"
              >
                Добавить reader
              </button>
            </div>
          </form>

          <div className="space-y-3">
            {(data?.readers ?? []).length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.025] p-6 text-sm leading-6 text-white/55">
                Reader-аккаунтов пока нет. Добавь первый reader выше, и после сохранения здесь появится кнопка «Загрузить чаты».
              </div>
            ) : null}

            {(data?.readers ?? []).map((reader) => {
              const isEditing = editingReaderId === reader.id;

              return (
                <article key={reader.id} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold">{reader.label}</h3>
                        <StatusPill status={reader.status} />
                      </div>
                      <p className="mt-1 text-sm text-white/45">
                        {reader.phone_hint || "Телефон скрыт"} · {reader.assigned_niche || "Ниша не указана"}
                      </p>
                      <p className="mt-1 text-xs text-white/35">
                        Последняя активность: {formatDate(reader.last_seen_at)} · лимит чатов: {reader.max_chats_limit ?? "не указан"}
                      </p>
                    </div>
                    <div className="flex w-full flex-col gap-2 sm:w-auto sm:min-w-[240px]">
                      <button
                        type="button"
                        onClick={() => void scanReaderChats(reader)}
                        className="rounded-2xl border border-emerald-300/25 bg-emerald-300/10 px-4 py-3 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-300/15 disabled:opacity-50"
                        disabled={isSubmitting}
                      >
                        Загрузить чаты
                      </button>
                      <button
                        type="button"
                        onClick={() => (isEditing ? cancelEditReader() : startEditReader(reader))}
                        className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white/75 transition hover:bg-white/10 disabled:opacity-50"
                        disabled={isSubmitting}
                      >
                        {isEditing ? "Свернуть" : "Редактировать"}
                      </button>
                    </div>
                  </div>

                  <p className="mt-3 rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2 text-sm text-white/55">
                    Подключено чатов: {sourceChatCountByReader.get(reader.id) ?? 0}. Один reader = одна пачка чатов, которую можно выбрать в проекте.
                  </p>

                  {isEditing ? (
                    <form className="mt-4 rounded-2xl border border-white/10 bg-[#0B1020]/80 p-4" onSubmit={(event) => void saveReaderEdit(event)}>
                      <div className="grid gap-3 lg:grid-cols-2">
                        <input
                          className={fieldClass()}
                          placeholder="Название reader-аккаунта"
                          value={readerEditForm.label}
                          onChange={(event) => setReaderEditForm({ ...readerEditForm, label: event.target.value })}
                          required
                        />
                        <input
                          className={fieldClass()}
                          placeholder="Телефон-подсказка"
                          value={readerEditForm.phoneHint}
                          onChange={(event) => setReaderEditForm({ ...readerEditForm, phoneHint: event.target.value })}
                        />
                      </div>
                      <div className="mt-3 grid gap-3 lg:grid-cols-3">
                        <input
                          className={fieldClass()}
                          placeholder="Ниша или роль аккаунта"
                          value={readerEditForm.assignedNiche}
                          onChange={(event) => setReaderEditForm({ ...readerEditForm, assignedNiche: event.target.value })}
                        />
                        <input
                          className={fieldClass()}
                          placeholder="Лимит чатов"
                          value={readerEditForm.maxChatsLimit}
                          onChange={(event) => setReaderEditForm({ ...readerEditForm, maxChatsLimit: event.target.value })}
                        />
                        <select
                          className={fieldClass()}
                          value={readerEditForm.status}
                          onChange={(event) => setReaderEditForm({ ...readerEditForm, status: event.target.value })}
                        >
                          {readerStatusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                        </select>
                      </div>
                      <textarea
                        className={fieldClass("mt-3 min-h-[110px] resize-none")}
                        placeholder="Новый Telegram session string. Оставь пустым, если не нужно менять авторизацию."
                        value={readerEditForm.sessionString}
                        onChange={(event) => setReaderEditForm({ ...readerEditForm, sessionString: event.target.value })}
                      />
                      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <button
                          type="button"
                          onClick={() => void deleteReader(reader)}
                          className="rounded-2xl border border-rose-300/25 bg-rose-300/10 px-4 py-3 text-sm font-semibold text-rose-100 transition hover:bg-rose-300/15 disabled:opacity-50"
                          disabled={isSubmitting}
                        >
                          Удалить reader
                        </button>
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <button
                            type="button"
                            onClick={cancelEditReader}
                            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white/70 transition hover:bg-white/10 disabled:opacity-50"
                            disabled={isSubmitting}
                          >
                            Отмена
                          </button>
                          <button
                            type="submit"
                            className="rounded-2xl bg-emerald-400 px-5 py-3 text-sm font-semibold text-[#06120f] transition hover:bg-emerald-300 disabled:opacity-50"
                            disabled={isSubmitting}
                          >
                            Сохранить
                          </button>
                        </div>
                      </div>
                    </form>
                  ) : null}

                  {reader.last_error ? (
                    <p className="mt-3 rounded-xl border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-sm text-amber-100">{reader.last_error}</p>
                  ) : null}
                </article>
              );
            })}
          </div>
        </Section>
      ) : null}

      {!isLoading && activeTab === "delivery" ? (
        <Section title="Последние лиды и доставка" description="Здесь видно, находятся ли заявки и доходят ли они до Telegram-бесед клиентов.">
          <div className="grid gap-4 xl:grid-cols-2">
            <div className="space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-white/45">Найденные лиды</h3>
              {(data?.latestLeads ?? []).slice(0, 12).map((lead) => (
                <article key={lead.id} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{data?.projects.find((project) => project.id === lead.project_id)?.name ?? "Проект не найден"}</p>
                      <p className="mt-1 text-sm text-white/45">
                        {lead.source_chat_id ? sourceChatsById.get(lead.source_chat_id) ?? "Чат не найден" : "Источник не указан"}
                      </p>
                    </div>
                    <StatusPill status={lead.status} />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {getKeywords(lead.matched_keywords).slice(0, 5).map((keyword) => (
                      <span key={`${lead.id}-${keyword}`} className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs text-cyan-100">{keyword}</span>
                    ))}
                  </div>
                  <p className="mt-3 text-xs text-white/35">
                    Найден: {formatDate(lead.created_at)} · доставлен: {formatDate(lead.delivered_at)}
                  </p>
                </article>
              ))}
              {(data?.latestLeads ?? []).length === 0 ? <p className="text-sm text-white/45">Лидов пока нет.</p> : null}
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-white/45">Доставка в Telegram</h3>
              {(data?.recentDeliveryLogs ?? []).map((log) => (
                <article key={log.id} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">
                        {log.project_id ? data?.projects.find((project) => project.id === log.project_id)?.name ?? "Проект не найден" : "Проект не указан"}
                      </p>
                      <p className="mt-1 text-sm text-white/45">{formatDate(log.created_at)}</p>
                    </div>
                    <StatusPill status={log.status} />
                  </div>
                  {log.error_message ? (
                    <p className="mt-3 rounded-xl border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-sm text-rose-100">{log.error_message}</p>
                  ) : null}
                </article>
              ))}
            </div>
          </div>
        </Section>
      ) : null}
    </main>
  );
}
