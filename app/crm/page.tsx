"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { FormEvent } from "react";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Circle,
  Clock3,
  Edit3,
  ExternalLink,
  History,
  Inbox,
  LineChart,
  Mail,
  MessageSquareText,
  MoreVertical,
  Paperclip,
  Phone,
  Plus,
  Search,
  Settings2,
  SquareCheckBig,
  Trash2,
  Users,
  X,
} from "lucide-react";
import {
  canAccessCrm,
  canManageCrmSettings,
  canViewAllCrmDeals,
  isAppRole,
} from "../lib/permissions";
import {
  useCreateCrmDealCommentMutation,
  useCreateCrmMessageMutation,
  useCreateCrmDealTaskMutation,
  useCreateCrmPipelineMutation,
  useCreateCrmStageMutation,
  useCreateCrmDealMutation,
  useCrmBootstrapQuery,
  useCrmDealDetailsQuery,
  useCrmInboxQuery,
  useMarkCrmConversationReadMutation,
  useMoveCrmDealMutation,
  useUpdateCrmDealTaskMutation,
  useUpdateCrmPipelineMutation,
  useUpdateCrmStageMutation,
  useUpdateCrmStageOrderMutation,
  useUpdateCrmDealMutation,
  useUpsertCrmAssignmentRuleMutation,
} from "../lib/queries/use-crm-query";
import { useClientsQuery } from "../lib/queries/use-clients-query";
import { useActiveWorkspaceMembers } from "../lib/queries/use-workspace-members-query";
import { CustomSelect } from "../components/ui/custom-select";
import { useAppContextState } from "../providers/app-context-provider";
import { getWorkspaceMemberDisplayName } from "../lib/supabase/workspace-members";
import type {
  CrmDeal,
  CrmDealTask,
  CrmDealStatus,
  CrmAssignmentMode,
  CrmPipeline,
  CrmStage,
} from "../lib/supabase/crm";

type AssignmentRuleDraft = {
  mode: CrmAssignmentMode;
  target_member_ids: string[];
};

type DealFormState = {
  title: string;
  client_id: string;
  client_name: string;
  phone: string;
  telegram: string;
  source_id: string;
  service_amount: string;
  budget: string;
  next_contact_at: string;
  description: string;
  assignee_ids: string[];
};

type MemberProfilePreview = {
  id: string;
  name: string;
  avatarUrl: string | null;
  title: string | null;
};

type DealPanelTab = "info" | "dialogs" | "tasks" | "comments" | "history";

const emptyDealForm: DealFormState = {
  title: "",
  client_id: "",
  client_name: "",
  phone: "",
  telegram: "",
  source_id: "",
  service_amount: "",
  budget: "",
  next_contact_at: "",
  description: "",
  assignee_ids: [],
};

const stageAccentClasses = [
  "border-t-amber-400",
  "border-t-violet-500",
  "border-t-orange-400",
  "border-t-emerald-500",
  "border-t-sky-500",
  "border-t-rose-400",
  "border-t-indigo-500",
  "border-t-slate-400",
];

function money(value: number | null) {
  if (!value) return "0 ₽";

  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatWaitTime(minutes: number) {
  if (minutes < 1) return "только что";
  if (minutes < 60) return `${minutes} мин`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ч`;

  return `${Math.floor(hours / 24)} д`;
}

function toNumberOrNull(value: string) {
  const normalized = value.replace(/\s/g, "").replace(",", ".");
  if (!normalized) return null;

  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

function getStageStatus(stage: CrmStage): CrmDealStatus {
  if (stage.kind === "paid_project") return "won";
  if (stage.kind === "lost") return "lost";

  return "open";
}

function isDealPanelTab(value: string | null): value is DealPanelTab {
  return (
    value === "info" ||
    value === "dialogs" ||
    value === "tasks" ||
    value === "comments" ||
    value === "history"
  );
}

function getDealSignal(deal: CrmDeal) {
  if (deal.status === "won") {
    return {
      label: "Оплачено",
      className:
        "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200",
    };
  }

  if (deal.status === "lost") {
    return {
      label: "Потеряно",
      className:
        "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200",
    };
  }

  if (!deal.next_contact_at) {
    return {
      label: "Нет следующего контакта",
      className:
        "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200",
    };
  }

  const nextContactTime = new Date(deal.next_contact_at).getTime();

  if (Number.isFinite(nextContactTime) && nextContactTime < Date.now()) {
    return {
      label: "Контакт просрочен",
      className:
        "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200",
    };
  }

  return {
    label: "Следующий шаг назначен",
    className:
      "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-200",
  };
}

function getDealTaskTiming(task: CrmDealTask) {
  if (task.status === "done") {
    return {
      label: "Выполнено",
      className:
        "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200",
    };
  }

  if (!task.due_at) {
    return {
      label: "Без срока",
      className:
        "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300",
    };
  }

  const dueTime = new Date(task.due_at).getTime();
  const now = Date.now();
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);

  if (Number.isFinite(dueTime) && dueTime < now) {
    return {
      label: "Просрочено",
      className:
        "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200",
    };
  }

  if (Number.isFinite(dueTime) && dueTime <= endOfToday.getTime()) {
    return {
      label: "Сегодня",
      className:
        "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200",
    };
  }

  return {
    label: new Date(task.due_at).toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
    }),
    className:
      "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-200",
  };
}

function buildFormFromDeal(deal: CrmDeal): DealFormState {
  return {
    title: deal.title,
    client_id: deal.client_id ?? "",
    client_name: deal.client_name ?? "",
    phone: deal.phone ?? "",
    telegram: deal.telegram ?? "",
    source_id: deal.source_id ?? "",
    service_amount: deal.service_amount ? String(deal.service_amount) : "",
    budget: deal.budget ? String(deal.budget) : "",
    next_contact_at: deal.next_contact_at
      ? deal.next_contact_at.slice(0, 16)
      : "",
    description: deal.description ?? "",
    assignee_ids: deal.assignees.map((assignee) => assignee.workspace_member_id),
  };
}

function getInitials(value: string) {
  return value
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function MemberAvatar({
  member,
  size = "sm",
}: {
  member: MemberProfilePreview;
  size?: "xs" | "sm";
}) {
  const sizeClass = size === "xs" ? "h-6 w-6 text-[10px]" : "h-8 w-8 text-xs";

  if (member.avatarUrl) {
    return (
      <img
        src={member.avatarUrl}
        alt={member.name}
        className={`${sizeClass} rounded-full object-cover ring-2 ring-white dark:ring-[#111827]`}
      />
    );
  }

  return (
    <span
      className={`${sizeClass} flex items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-emerald-400 font-bold text-white ring-2 ring-white dark:ring-[#111827]`}
    >
      {getInitials(member.name) || "R"}
    </span>
  );
}

export default function CrmPage() {
  return (
    <Suspense fallback={null}>
      <CrmPageContent />
    </Suspense>
  );
}

function AssigneePreview({ members }: { members: MemberProfilePreview[] }) {
  if (members.length === 0) {
    return <span className="truncate">Без ответственного</span>;
  }

  return (
    <span className="flex min-w-0 items-center gap-2">
      <span className="flex -space-x-2">
        {members.slice(0, 3).map((member) => (
          <MemberAvatar key={member.id} member={member} size="xs" />
        ))}
      </span>
      <span className="truncate">
        {members.map((member) => member.name).join(", ")}
      </span>
    </span>
  );
}

function DealCard({
  deal,
  assigneeProfiles,
  sourceName,
  onEdit,
}: {
  deal: CrmDeal;
  assigneeProfiles: MemberProfilePreview[];
  sourceName: string;
  onEdit: () => void;
}) {
  const clientName = deal.client_name || "Клиент пока не создан";
  const initials = getInitials(clientName || deal.title) || "R";
  const signal = getDealSignal(deal);
  const isNextContactOverdue =
    deal.status === "open" &&
    Boolean(deal.next_contact_at) &&
    new Date(deal.next_contact_at ?? "").getTime() < Date.now();

  return (
    <button
      type="button"
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData("text/plain", deal.id);
        event.dataTransfer.effectAllowed = "move";
      }}
      onClick={onEdit}
      className="group w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-left shadow-[0_1px_2px_rgba(15,23,42,0.05)] transition hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-[0_14px_28px_rgba(15,23,42,0.12)] dark:border-white/10 dark:bg-[#111827] dark:hover:border-violet-400/50"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-emerald-400 text-xs font-bold text-white">
          {initials}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-950 dark:text-white">
                {deal.title}
              </p>
              <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                {clientName}
              </p>
            </div>
            <MoreVertical className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:text-slate-500" />
          </div>

          <div className="mt-3 border-t border-slate-100 pt-2 dark:border-white/10">
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <Phone className="h-3.5 w-3.5" />
              <span className="truncate">{deal.phone || "Телефон не указан"}</span>
            </div>
            <div className="mt-1.5 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <Mail className="h-3.5 w-3.5" />
              <span className="truncate">{deal.telegram || sourceName}</span>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${signal.className}`}
            >
              {signal.label}
            </span>
            <span className="rounded-full bg-violet-50 px-2.5 py-1 text-[11px] font-semibold text-violet-700 dark:bg-violet-500/15 dark:text-violet-200">
              {money(deal.service_amount)}
            </span>
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200">
              {sourceName}
            </span>
            {deal.source_item_url || deal.source_item_title ? (
              <span className="max-w-full truncate rounded-full bg-sky-50 px-2.5 py-1 text-[11px] font-semibold text-sky-700 dark:bg-sky-500/15 dark:text-sky-200">
                {deal.source_item_title || "Объявление"}
              </span>
            ) : null}
          </div>

          <div className="mt-3 flex items-center justify-between gap-3 text-[11px] text-slate-500 dark:text-slate-400">
            <AssigneePreview members={assigneeProfiles} />
            {deal.next_contact_at ? (
              <span
                className={`shrink-0 ${
                  isNextContactOverdue
                    ? "text-rose-600 dark:text-rose-300"
                    : "text-amber-600 dark:text-amber-300"
                }`}
              >
                {new Date(deal.next_contact_at).toLocaleDateString("ru-RU", {
                  day: "2-digit",
                  month: "2-digit",
                })}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </button>
  );
}

function CrmPageContent() {
  const searchParams = useSearchParams();
  const { role, isReady, membership } = useAppContextState();
  const currentRole = isAppRole(role) ? role : null;
  const hasAccess = currentRole ? canAccessCrm(currentRole) : false;
  const canManageStages = currentRole ? canManageCrmSettings(currentRole) : false;
  const canViewAllDeals = currentRole ? canViewAllCrmDeals(currentRole) : false;

  const [selectedPipelineId, setSelectedPipelineId] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "open" | "won" | "lost"
  >("all");
  const [qualityFilter, setQualityFilter] = useState<
    "all" | "overdue" | "without_next_contact"
  >("all");
  const [workspaceView, setWorkspaceView] = useState<"pipeline" | "inbox">(
    "pipeline"
  );
  const [inboxFilter, setInboxFilter] = useState<
    "all" | "needs_reply" | "unread" | "avito" | "without_assignee"
  >("all");
  const [viewMode, setViewMode] = useState<"board" | "list">("board");

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [search]);

  useEffect(() => {
    if (selectedPipelineId === "all") {
      setViewMode("list");
    }
  }, [selectedPipelineId]);

  const crmFilters = useMemo(
    () => ({
      search: debouncedSearch,
      sourceId: sourceFilter,
      assigneeId: assigneeFilter,
      status: statusFilter,
    }),
    [assigneeFilter, debouncedSearch, sourceFilter, statusFilter]
  );

  const { data, isLoading, error } = useCrmBootstrapQuery(
    isReady && hasAccess,
    crmFilters
  );
  const { data: inboxItems = [] } = useCrmInboxQuery(isReady && hasAccess);
  const { data: clients = [] } = useClientsQuery(isReady && hasAccess);
  const { activeMembers = [] } = useActiveWorkspaceMembers(isReady && hasAccess);
  const createDealMutation = useCreateCrmDealMutation();
  const updateDealMutation = useUpdateCrmDealMutation();
  const moveDealMutation = useMoveCrmDealMutation();
  const createPipelineMutation = useCreateCrmPipelineMutation();
  const updatePipelineMutation = useUpdateCrmPipelineMutation();
  const createStageMutation = useCreateCrmStageMutation();
  const updateStageMutation = useUpdateCrmStageMutation();
  const updateStageOrderMutation = useUpdateCrmStageOrderMutation();
  const upsertAssignmentRuleMutation = useUpsertCrmAssignmentRuleMutation();
  const createDealTaskMutation = useCreateCrmDealTaskMutation();
  const updateDealTaskMutation = useUpdateCrmDealTaskMutation();
  const createDealCommentMutation = useCreateCrmDealCommentMutation();
  const createMessageMutation = useCreateCrmMessageMutation();
  const markConversationReadMutation = useMarkCrmConversationReadMutation();
  const markingReadConversationIdsRef = useRef(new Set<string>());

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isPipelineSettingsOpen, setIsPipelineSettingsOpen] = useState(false);
  const [isAssignmentSettingsOpen, setIsAssignmentSettingsOpen] = useState(false);
  const [isStageSettingsOpen, setIsStageSettingsOpen] = useState(false);
  const [editingDeal, setEditingDeal] = useState<CrmDeal | null>(null);
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);
  const [dealPanelTab, setDealPanelTab] = useState<DealPanelTab>("info");
  const [form, setForm] = useState<DealFormState>(emptyDealForm);
  const [paidDeal, setPaidDeal] = useState<CrmDeal | null>(null);
  const [pendingLostMove, setPendingLostMove] = useState<{
    dealId: string;
    stage: CrmStage;
  } | null>(null);
  const [selectedLossReasonId, setSelectedLossReasonId] = useState("");
  const [lossComment, setLossComment] = useState("");
  const [newStageName, setNewStageName] = useState("");
  const [newPipelineName, setNewPipelineName] = useState("");
  const [newPipelineKind, setNewPipelineKind] = useState<"sales" | "delivery">(
    "sales"
  );
  const [newDealTaskTitle, setNewDealTaskTitle] = useState("");
  const [newDealTaskDueAt, setNewDealTaskDueAt] = useState("");
  const [newDealComment, setNewDealComment] = useState("");
  const [newDealCommentFileUrl, setNewDealCommentFileUrl] = useState("");
  const [newClientReply, setNewClientReply] = useState("");
  const [newClientReplyAttachmentUrl, setNewClientReplyAttachmentUrl] =
    useState("");
  const [stageNameDrafts, setStageNameDrafts] = useState<Record<string, string>>(
    {}
  );
  const [pipelineNameDrafts, setPipelineNameDrafts] = useState<
    Record<string, string>
  >({});
  const [assignmentRuleDrafts, setAssignmentRuleDrafts] = useState<
    Record<string, AssignmentRuleDraft>
  >({});

  const {
    data: selectedDealDetails,
    isLoading: isDealDetailsLoading,
  } = useCrmDealDetailsQuery(selectedDealId, isReady && hasAccess);

  const pipelines = data?.pipelines ?? [];
  const stages = data?.stages ?? [];
  const deals = data?.deals ?? [];
  const sources = data?.sources ?? [];
  const lossReasons = data?.lossReasons ?? [];
  const assignmentRules = data?.assignmentRules ?? [];
  const stageDealCounts = data?.stageDealCounts ?? {};
  const dealTasks = selectedDealDetails?.dealTasks ?? [];
  const dealComments = selectedDealDetails?.dealComments ?? [];
  const dealActivities = selectedDealDetails?.dealActivities ?? [];
  const dealStageHistory = selectedDealDetails?.stageHistory ?? [];
  const conversations = selectedDealDetails?.conversations ?? [];
  const messages = selectedDealDetails?.messages ?? [];
  const inboxNeedsReplyCount = inboxItems.filter((item) => item.needsReply).length;
  const inboxUnreadCount = inboxItems.filter((item) => item.isUnread).length;
  const inboxAvitoCount = inboxItems.filter(
    (item) => item.conversation.channel === "avito"
  ).length;
  const inboxWithoutAssigneeCount = inboxItems.filter(
    (item) => item.deal.assignees.length === 0
  ).length;
  const filteredInboxItems = useMemo(() => {
    switch (inboxFilter) {
      case "needs_reply":
        return inboxItems.filter((item) => item.needsReply);
      case "unread":
        return inboxItems.filter((item) => item.isUnread);
      case "avito":
        return inboxItems.filter((item) => item.conversation.channel === "avito");
      case "without_assignee":
        return inboxItems.filter((item) => item.deal.assignees.length === 0);
      default:
        return inboxItems;
    }
  }, [inboxFilter, inboxItems]);

  const isAllPipelinesSelected = selectedPipelineId === "all";
  const defaultPipeline =
    pipelines.find((pipeline) => pipeline.kind === "sales") ?? pipelines[0];
  const activePipeline: CrmPipeline | undefined =
    (isAllPipelinesSelected
      ? defaultPipeline
      : pipelines.find((pipeline) => pipeline.id === selectedPipelineId)) ??
    pipelines.find((pipeline) => pipeline.kind === "sales") ??
    pipelines[0];
  const displayMode = isAllPipelinesSelected ? "list" : viewMode;

  const activeStages = useMemo(
    () =>
      stages
        .filter((stage) => stage.pipeline_id === activePipeline?.id)
        .sort((a, b) => a.sort_order - b.sort_order),
    [activePipeline?.id, stages]
  );

  const activeDeals = useMemo(() => {
    if (isAllPipelinesSelected) {
      return deals;
    }

    return deals.filter((deal) => deal.pipeline_id === activePipeline?.id);
  }, [activePipeline?.id, deals, isAllPipelinesSelected]);

  const selectedDeal =
    deals.find((deal) => deal.id === selectedDealId) ?? null;

  const selectedDealTasks = useMemo(
    () =>
      dealTasks
        .filter((task) => task.deal_id === selectedDealId)
        .sort((a, b) => {
          if (a.status === "done" && b.status !== "done") return 1;
          if (a.status !== "done" && b.status === "done") return -1;

          return (
            new Date(a.due_at ?? a.created_at).getTime() -
            new Date(b.due_at ?? b.created_at).getTime()
          );
        }),
    [dealTasks, selectedDealId]
  );

  const selectedDealComments = useMemo(
    () =>
      dealComments
        .filter((comment) => comment.deal_id === selectedDealId)
        .sort(
          (a, b) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        ),
    [dealComments, selectedDealId]
  );

  const selectedDealActivities = useMemo(
    () =>
      dealActivities
        .filter((activity) => activity.deal_id === selectedDealId)
        .sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        ),
    [dealActivities, selectedDealId]
  );

  const selectedDealStageHistory = useMemo(
    () =>
      dealStageHistory
        .filter((movement) => movement.deal_id === selectedDealId)
        .sort(
          (a, b) =>
            new Date(b.moved_at).getTime() - new Date(a.moved_at).getTime()
        ),
    [dealStageHistory, selectedDealId]
  );

  const selectedDealConversations = useMemo(
    () =>
      conversations
        .filter((conversation) => conversation.deal_id === selectedDealId)
        .sort(
          (a, b) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        ),
    [conversations, selectedDealId]
  );

  const selectedDealMessages = useMemo(
    () =>
      messages
        .filter((message) => message.deal_id === selectedDealId)
        .sort(
          (a, b) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        ),
    [messages, selectedDealId]
  );

  const dealsByStage = useMemo(() => {
    const grouped = new Map<string, CrmDeal[]>();

    for (const deal of activeDeals) {
      const current = grouped.get(deal.stage_id) ?? [];
      current.push(deal);
      grouped.set(deal.stage_id, current);
    }

    for (const [stageId, items] of grouped.entries()) {
      grouped.set(
        stageId,
        [...items].sort((a, b) => a.position - b.position)
      );
    }

    return grouped;
  }, [activeDeals]);

  useEffect(() => {
    const dealId = searchParams.get("dealId");
    const tab = searchParams.get("tab");
    if (!dealId || selectedDealId === dealId) return;

    const deal = deals.find((item) => item.id === dealId);
    if (!deal) return;

    setSelectedDealId(deal.id);
    setDealPanelTab(isDealPanelTab(tab) ? tab : "info");
  }, [deals, searchParams, selectedDealId]);

  const memberNameById = useMemo(
    () =>
      new Map(
        activeMembers.map((member) => [
          member.id,
          getWorkspaceMemberDisplayName(member),
        ])
      ),
    [activeMembers]
  );
  const memberProfileById = useMemo(
    () =>
      new Map(
        activeMembers.map((member) => [
          member.id,
          {
            id: member.id,
            name: getWorkspaceMemberDisplayName(member),
            avatarUrl: member.avatar_url,
            title: member.profile_title,
          },
        ])
      ),
    [activeMembers]
  );
  const assignableMembers = useMemo(
    () =>
      canViewAllDeals
        ? activeMembers
        : activeMembers.filter((member) => member.id === membership?.id),
    [activeMembers, canViewAllDeals, membership?.id]
  );

  function getDealAssigneeProfiles(deal: CrmDeal) {
    return deal.assignees
      .map((assignee) => memberProfileById.get(assignee.workspace_member_id))
      .filter((member): member is MemberProfilePreview => Boolean(member));
  }

  const sourceNameById = useMemo(
    () => new Map(sources.map((source) => [source.id, source.name])),
    [sources]
  );

  const stageNameById = useMemo(
    () => new Map(stages.map((stage) => [stage.id, stage.name])),
    [stages]
  );

  const pipelineNameById = useMemo(
    () => new Map(pipelines.map((pipeline) => [pipeline.id, pipeline.name])),
    [pipelines]
  );

  const listDeals = useMemo(
    () => {
      const now = Date.now();
      const filteredDeals = activeDeals.filter((deal) => {
        if (qualityFilter === "overdue") {
          return (
            deal.status === "open" &&
            Boolean(deal.next_contact_at) &&
            new Date(deal.next_contact_at ?? "").getTime() < now
          );
        }

        if (qualityFilter === "without_next_contact") {
          return deal.status === "open" && !deal.next_contact_at;
        }

        return true;
      });

      return filteredDeals.sort(
        (a, b) =>
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );
    },
    [activeDeals, qualityFilter]
  );

  const sourceOverview = useMemo(
    () =>
      sources
        .map((source) => {
          const sourceDeals = activeDeals.filter(
            (deal) => deal.source_id === source.id
          );

          return {
            id: source.id,
            name: source.name,
            count: sourceDeals.length,
            open: sourceDeals.filter((deal) => deal.status === "open").length,
            value: sourceDeals.reduce(
              (sum, deal) => sum + (deal.service_amount ?? 0),
              0
            ),
          };
        })
        .filter((item) => item.count > 0)
        .sort((a, b) => b.value - a.value),
    [activeDeals, sources]
  );

  const qualitySignals = useMemo(() => {
    const now = Date.now();
    const openDeals = activeDeals.filter((deal) => deal.status === "open");
    const overdueContacts = openDeals.filter(
      (deal) =>
        deal.next_contact_at &&
        new Date(deal.next_contact_at).getTime() < now
    );
    const withoutNextContact = openDeals.filter((deal) => !deal.next_contact_at);
    const waitingDialogs = inboxItems.filter(
      (item) => item.needsReply && item.minutesWaiting >= 30
    );

    return {
      overdueContacts,
      withoutNextContact,
      waitingDialogs,
      total:
        overdueContacts.length + withoutNextContact.length + waitingDialogs.length,
    };
  }, [activeDeals, inboxItems]);

  useEffect(() => {
    if (dealPanelTab !== "dialogs" || !selectedDealId) return;

    const inboxItem = inboxItems.find(
      (item) => item.deal.id === selectedDealId && item.isUnread
    );

    if (
      inboxItem &&
      !markingReadConversationIdsRef.current.has(inboxItem.conversation.id)
    ) {
      markingReadConversationIdsRef.current.add(inboxItem.conversation.id);
      markConversationReadMutation.mutate(inboxItem.conversation.id, {
        onSettled: () => {
          markingReadConversationIdsRef.current.delete(inboxItem.conversation.id);
        },
      });
    }
  }, [dealPanelTab, inboxItems, markConversationReadMutation, selectedDealId]);

  function openCreateForm() {
    setEditingDeal(null);
    setForm({
      ...emptyDealForm,
      assignee_ids:
        canViewAllDeals || !membership?.id ? [] : [membership.id],
    });
    setIsFormOpen(true);
  }

  function openStageSettings() {
    setStageNameDrafts(
      Object.fromEntries(activeStages.map((stage) => [stage.id, stage.name]))
    );
    setNewStageName("");
    setIsStageSettingsOpen(true);
  }

  function openPipelineSettings() {
    setPipelineNameDrafts(
      Object.fromEntries(pipelines.map((pipeline) => [pipeline.id, pipeline.name]))
    );
    setNewPipelineName("");
    setNewPipelineKind("sales");
    setIsPipelineSettingsOpen(true);
  }

  function openAssignmentSettings() {
    const ruleBySourceKind = new Map(
      assignmentRules.map((rule) => [rule.source_kind ?? "", rule])
    );

    setAssignmentRuleDrafts(
      Object.fromEntries(
        sources.map((source) => {
          const rule = ruleBySourceKind.get(source.kind);

          return [
            source.kind,
            {
              mode: rule?.mode ?? "manual",
              target_member_ids: rule?.target_member_ids ?? [],
            },
          ];
        })
      )
    );
    setIsAssignmentSettingsOpen(true);
  }

  function openDealPanel(deal: CrmDeal) {
    setSelectedDealId(deal.id);
    setDealPanelTab("info");
  }

  function openDealDialogPanel(deal: CrmDeal) {
    setSelectedDealId(deal.id);
    setDealPanelTab("dialogs");
  }

  function openEditForm(deal: CrmDeal) {
    setEditingDeal(deal);
    setForm(buildFormFromDeal(deal));
    setIsFormOpen(true);
  }

  function closeForm() {
    setIsFormOpen(false);
    setEditingDeal(null);
    setForm(emptyDealForm);
  }

  async function submitDeal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activePipeline || activeStages.length === 0) return;

    const stageId = editingDeal?.stage_id ?? activeStages[0]?.id;
    if (!stageId) return;

    const values = {
      pipeline_id: activePipeline.id,
      stage_id: stageId,
      client_id: form.client_id || null,
      title: form.title,
      client_name: form.client_name || null,
      phone: form.phone || null,
      telegram: form.telegram || null,
      source_id: form.source_id || null,
      service_amount: toNumberOrNull(form.service_amount),
      budget: toNumberOrNull(form.budget),
      next_contact_at: form.next_contact_at || null,
      description: form.description || null,
      assignee_ids: form.assignee_ids,
    };

    if (editingDeal) {
      await updateDealMutation.mutateAsync({
        dealId: editingDeal.id,
        values,
      });
    } else {
      await createDealMutation.mutateAsync(values);
    }

    closeForm();
  }

  function toggleAssignee(memberId: string) {
    setForm((current) => {
      const exists = current.assignee_ids.includes(memberId);

      return {
        ...current,
        assignee_ids: exists
          ? current.assignee_ids.filter((id) => id !== memberId)
          : [...current.assignee_ids, memberId],
      };
    });
  }

  async function moveDealToStage(dealId: string, stage: CrmStage) {
    const deal = deals.find((item) => item.id === dealId);
    if (!deal || !activePipeline) return;

    if (stage.kind === "lost") {
      setPendingLostMove({ dealId, stage });
      setSelectedLossReasonId(lossReasons[0]?.id ?? "");
      setLossComment("");
      return;
    }

    await moveDealMutation.mutateAsync({
      dealId,
      pipelineId: activePipeline.id,
      stageId: stage.id,
      position: Date.now(),
      status: getStageStatus(stage),
    });

    if (stage.kind === "paid_project" || stage.kind === "payment") {
      setPaidDeal({
        ...deal,
        stage_id: stage.id,
        status: getStageStatus(stage),
      });
    }
  }

  async function confirmLostMove() {
    if (!pendingLostMove || !activePipeline) return;

    await moveDealMutation.mutateAsync({
      dealId: pendingLostMove.dealId,
      pipelineId: activePipeline.id,
      stageId: pendingLostMove.stage.id,
      position: Date.now(),
      status: "lost",
      loss_reason_id: selectedLossReasonId || null,
      loss_comment: lossComment.trim() || null,
    });

    setPendingLostMove(null);
    setSelectedLossReasonId("");
    setLossComment("");
  }

  async function addStage() {
    if (!activePipeline) return;

    const name = newStageName.trim();
    if (!name) return;

    await createStageMutation.mutateAsync({
      pipeline_id: activePipeline.id,
      name,
      kind: activePipeline.kind === "delivery" ? "delivery" : "regular",
      sort_order: (activeStages.length + 1) * 10,
    });

    setNewStageName("");
  }

  async function addDealTask() {
    if (!selectedDeal || !newDealTaskTitle.trim()) return;

    const dueAt = newDealTaskDueAt || null;

    await createDealTaskMutation.mutateAsync({
      deal_id: selectedDeal.id,
      title: newDealTaskTitle,
      due_at: dueAt,
      assignee_member_id: selectedDeal.assignees[0]?.workspace_member_id ?? null,
    });

    if (dueAt) {
      await updateDealMutation.mutateAsync({
        dealId: selectedDeal.id,
        values: {
          next_contact_at: dueAt,
        },
      });
    }

    setNewDealTaskTitle("");
    setNewDealTaskDueAt("");
  }

  async function addQuickDealTask(title: string, dueDate: Date) {
    if (!selectedDeal) return;

    await createDealTaskMutation.mutateAsync({
      deal_id: selectedDeal.id,
      title,
      due_at: dueDate.toISOString(),
      assignee_member_id: selectedDeal.assignees[0]?.workspace_member_id ?? null,
    });

    await updateDealMutation.mutateAsync({
      dealId: selectedDeal.id,
      values: {
        next_contact_at: dueDate.toISOString(),
      },
    });
  }

  async function updateSelectedDealNextContact(date: Date) {
    if (!selectedDeal) return;

    await updateDealMutation.mutateAsync({
      dealId: selectedDeal.id,
      values: {
        next_contact_at: date.toISOString(),
      },
    });
  }

  async function assignInboxDeal(deal: CrmDeal, memberId: string) {
    await updateDealMutation.mutateAsync({
      dealId: deal.id,
      values: {
        assignee_ids: memberId ? [memberId] : [],
      },
    });
  }

  async function updateInboxDealNextContact(deal: CrmDeal, value: string) {
    await updateDealMutation.mutateAsync({
      dealId: deal.id,
      values: {
        next_contact_at: value || null,
      },
    });
  }

  async function addDealComment() {
    const commentBody = newDealComment.trim();
    const fileUrl = newDealCommentFileUrl.trim();

    if (!selectedDeal || (!commentBody && !fileUrl)) return;

    await createDealCommentMutation.mutateAsync({
      deal_id: selectedDeal.id,
      body: commentBody || "Вложение",
      file_url: fileUrl || null,
    });

    setNewDealComment("");
    setNewDealCommentFileUrl("");
  }

  async function sendClientReply() {
    const conversation = selectedDealConversations[0];
    const replyBody = newClientReply.trim();
    const attachmentUrl = newClientReplyAttachmentUrl.trim();

    if (!selectedDeal || !conversation || (!replyBody && !attachmentUrl)) return;

    await createMessageMutation.mutateAsync({
      conversation_id: conversation.id,
      deal_id: selectedDeal.id,
      body: replyBody || "Вложение",
      attachment_url: attachmentUrl || null,
    });

    setNewClientReply("");
    setNewClientReplyAttachmentUrl("");
  }

  async function toggleDealTask(task: CrmDealTask) {
    await updateDealTaskMutation.mutateAsync({
      taskId: task.id,
      values: {
        status: task.status === "done" ? "todo" : "done",
      },
    });
  }

  function getActivityText(action: string) {
    switch (action) {
      case "deal_created":
        return "Сделка создана";
      case "deal_updated":
        return "Данные сделки обновлены";
      case "deal_moved":
        return "Сделка перемещена по воронке";
      case "deal_lost":
        return "Сделка перенесена в потерянные";
      case "task_created":
        return "Создана задача по сделке";
      case "task_completed":
        return "Задача выполнена";
      case "task_updated":
        return "Задача обновлена";
      case "comment_created":
        return "Добавлен комментарий";
      case "message_created":
        return "Сообщение добавлено в диалог";
      case "assignment_resolved":
        return "Система распределила заявку";
      default:
        return "Действие по сделке";
    }
  }

  async function saveStageName(stage: CrmStage) {
    const name = (stageNameDrafts[stage.id] ?? stage.name).trim();
    if (!name || name === stage.name) return;

    await updateStageMutation.mutateAsync({
      stageId: stage.id,
      values: { name },
    });
  }

  async function createPipeline() {
    const name = newPipelineName.trim();
    if (!name) return;

    const pipeline = await createPipelineMutation.mutateAsync({
      name,
      kind: newPipelineKind,
    });

    setNewPipelineName("");
    setNewPipelineKind("sales");
    setSelectedPipelineId(pipeline.id);
  }

  async function savePipelineName(pipeline: CrmPipeline) {
    const name = (pipelineNameDrafts[pipeline.id] ?? pipeline.name).trim();
    if (!name || name === pipeline.name) return;

    await updatePipelineMutation.mutateAsync({
      pipelineId: pipeline.id,
      values: { name },
    });
  }

  async function hidePipeline(pipeline: CrmPipeline) {
    const pipelineDeals = deals.filter((deal) => deal.pipeline_id === pipeline.id);

    if (pipelineDeals.length > 0) {
      window.alert("Сначала перенеси или закрой сделки из этой воронки. После этого её можно будет скрыть.");
      return;
    }

    if (pipelines.length <= 1) {
      window.alert("Нельзя скрыть последнюю CRM-воронку.");
      return;
    }

    await updatePipelineMutation.mutateAsync({
      pipelineId: pipeline.id,
      values: { is_active: false },
    });

    if (selectedPipelineId === pipeline.id) {
      setSelectedPipelineId("");
    }
  }

  function updateAssignmentRuleDraft(
    sourceKind: string,
    patch: Partial<AssignmentRuleDraft>
  ) {
    setAssignmentRuleDrafts((current) => ({
      ...current,
      [sourceKind]: {
        mode: current[sourceKind]?.mode ?? "manual",
        target_member_ids: current[sourceKind]?.target_member_ids ?? [],
        ...patch,
      },
    }));
  }

  function toggleAssignmentTarget(sourceKind: string, memberId: string) {
    const currentTargets =
      assignmentRuleDrafts[sourceKind]?.target_member_ids ?? [];
    const nextTargets = currentTargets.includes(memberId)
      ? currentTargets.filter((id) => id !== memberId)
      : [...currentTargets, memberId];

    updateAssignmentRuleDraft(sourceKind, {
      target_member_ids: nextTargets,
    });
  }

  async function saveAssignmentRule(sourceKind: string) {
    const draft = assignmentRuleDrafts[sourceKind];
    if (!draft) return;

    await upsertAssignmentRuleMutation.mutateAsync({
      source_kind: sourceKind,
      mode: draft.mode,
      target_member_ids:
        draft.mode === "manual" ? [] : draft.target_member_ids,
      is_active: true,
    });
  }

  async function hideStage(stage: CrmStage) {
    const stageDeals = dealsByStage.get(stage.id) ?? [];

    if (stageDeals.length > 0) {
      window.alert("Сначала перенеси сделки из этой колонки, потом её можно будет скрыть.");
      return;
    }

    await updateStageMutation.mutateAsync({
      stageId: stage.id,
      values: { is_active: false },
    });
  }

  async function moveStage(stageId: string, direction: -1 | 1) {
    const currentIndex = activeStages.findIndex((stage) => stage.id === stageId);
    const nextIndex = currentIndex + direction;

    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= activeStages.length) {
      return;
    }

    const nextStages = [...activeStages];
    const [stage] = nextStages.splice(currentIndex, 1);
    nextStages.splice(nextIndex, 0, stage);

    await updateStageOrderMutation.mutateAsync(
      nextStages.map((item, index) => ({
        stageId: item.id,
        sortOrder: (index + 1) * 10,
      }))
    );
  }

  const selectedDealSignal = selectedDeal ? getDealSignal(selectedDeal) : null;
  const selectedDealAssigneeProfiles = selectedDeal
    ? getDealAssigneeProfiles(selectedDeal)
    : [];
  const selectedDealTaskStats = {
    active: selectedDealTasks.filter((task) => task.status !== "done").length,
    overdue: selectedDealTasks.filter((task) => {
      if (task.status === "done" || !task.due_at) return false;
      return new Date(task.due_at).getTime() < Date.now();
    }).length,
    done: selectedDealTasks.filter((task) => task.status === "done").length,
  };

  if (!isReady || isLoading) {
    return (
      <main className="min-h-screen bg-[#F5F7FB] px-5 py-6 text-slate-950 dark:bg-[#0B0F1A] dark:text-white lg:px-8">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm dark:border-white/10 dark:bg-[#121827]">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Загружаем CRM...
          </p>
        </div>
      </main>
    );
  }

  if (!hasAccess) {
    return (
      <main className="min-h-screen bg-[#F5F7FB] px-5 py-6 text-slate-950 dark:bg-[#0B0F1A] dark:text-white lg:px-8">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm dark:border-white/10 dark:bg-[#121827]">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
            CRM
          </p>
          <h1 className="mt-3 text-2xl font-semibold">Нет доступа к CRM</h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Этот раздел доступен владельцу, администратору, менеджеру, РОП и менеджеру продаж.
          </p>
        </div>
      </main>
    );
  }

  const totalPipelineValue = activeDeals.reduce(
    (sum, deal) => sum + (deal.service_amount ?? 0),
    0
  );

  return (
    <main className="min-h-screen bg-[#F5F7FB] text-slate-950 dark:bg-[#0B0F1A] dark:text-white">
      <div className="border-b border-slate-200 bg-white px-5 py-4 dark:border-white/10 dark:bg-[#101827] lg:px-8">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="relative w-full max-w-xl">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-violet-400 focus:ring-4 focus:ring-violet-100 dark:border-white/10 dark:bg-[#0B0F1A] dark:focus:ring-violet-500/15"
              placeholder="Поиск клиентов, сделок, телефонов..."
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <CustomSelect
              value={sourceFilter}
              onChange={setSourceFilter}
              options={[
                { value: "", label: "Все источники" },
                ...sources.map((source) => ({
                  value: source.id,
                  label: source.name,
                })),
              ]}
              className="min-w-[160px]"
              buttonClassName="h-10 rounded-xl font-semibold"
            />
            <CustomSelect
              value={assigneeFilter}
              onChange={setAssigneeFilter}
              options={[
                { value: "", label: "Все ответственные" },
                ...(canViewAllDeals ? activeMembers : assignableMembers).map((member) => ({
                  value: member.id,
                  label: getWorkspaceMemberDisplayName(member),
                })),
              ]}
              className="min-w-[180px]"
              buttonClassName="h-10 rounded-xl font-semibold"
            />
            <CustomSelect
              value={statusFilter}
              onChange={(value) => setStatusFilter(value as typeof statusFilter)}
              options={[
                { value: "all", label: "Все статусы" },
                { value: "open", label: "В работе" },
                { value: "won", label: "Оплачено" },
                { value: "lost", label: "Потеряно" },
              ]}
              className="min-w-[150px]"
              buttonClassName="h-10 rounded-xl font-semibold"
            />
            {search ||
            sourceFilter ||
            assigneeFilter ||
            statusFilter !== "all" ||
            qualityFilter !== "all" ? (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setSourceFilter("");
                  setAssigneeFilter("");
                  setStatusFilter("all");
                  setQualityFilter("all");
                }}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600 transition hover:border-violet-200 hover:text-violet-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300"
              >
                Сбросить
              </button>
            ) : null}
            {canManageStages ? (
              <button
                type="button"
                onClick={openPipelineSettings}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600 transition hover:border-violet-200 hover:text-violet-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300"
              >
                <Settings2 className="h-4 w-4" />
                Воронки
              </button>
            ) : null}
            {canManageStages ? (
              <button
                type="button"
                onClick={openAssignmentSettings}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600 transition hover:border-violet-200 hover:text-violet-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300"
              >
                <Users className="h-4 w-4" />
                Распределение
              </button>
            ) : null}
            {canManageStages && !isAllPipelinesSelected ? (
              <button
                type="button"
                onClick={openStageSettings}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600 transition hover:border-violet-200 hover:text-violet-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300"
              >
                <Settings2 className="h-4 w-4" />
                Этапы
              </button>
            ) : null}
            <Link
              href="/crm/settings"
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600 transition hover:border-violet-200 hover:text-violet-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300"
            >
              <Settings2 className="h-4 w-4" />
              Настройки CRM
            </Link>
            <Link
              href="/crm/analytics"
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600 transition hover:border-violet-200 hover:text-violet-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300"
            >
              <LineChart className="h-4 w-4" />
              Аналитика CRM
            </Link>
            <Link
              href="/crm/team"
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600 transition hover:border-violet-200 hover:text-violet-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300"
            >
              <Users className="h-4 w-4" />
              Команда
            </Link>
            <Link
              href="/crm/integrations"
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600 transition hover:border-violet-200 hover:text-violet-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300"
            >
              <MessageSquareText className="h-4 w-4" />
              Интеграции
            </Link>
            <button
              type="button"
              onClick={openCreateForm}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-violet-600 px-4 text-sm font-semibold text-white shadow-lg shadow-violet-500/20 transition hover:bg-violet-500"
            >
              <Plus className="h-4 w-4" />
              Создать сделку
            </button>
          </div>
        </div>
      </div>

      <div className="px-5 py-5 lg:px-8">
        <section className="mb-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                CRM
              </p>
              <h1 className="mt-1 text-3xl font-semibold tracking-tight">
                Сделки ({activeDeals.length})
              </h1>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-white/10 dark:bg-[#121827]">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  В работе
                </p>
                <p className="mt-1 text-xl font-semibold">
                  {activeDeals.filter((deal) => deal.status === "open").length}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-white/10 dark:bg-[#121827]">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Потенциал
                </p>
                <p className="mt-1 text-xl font-semibold">
                  {money(totalPipelineValue)}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-white/10 dark:bg-[#121827]">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Сигналы
                </p>
                <p className="mt-1 text-xl font-semibold">
                  {qualitySignals.total}
                </p>
              </div>
            </div>
          </div>

          {workspaceView === "pipeline" ? (
            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <button
                type="button"
                onClick={() => {
                  setQualityFilter("overdue");
                  setStatusFilter("open");
                  setViewMode("list");
                  setSelectedPipelineId("all");
                }}
                className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-left shadow-sm transition hover:border-rose-300 dark:border-rose-500/20 dark:bg-rose-500/10"
              >
                <p className="text-xs font-semibold text-rose-600 dark:text-rose-200">
                  Просрочен контакт
                </p>
                <p className="mt-1 text-2xl font-semibold text-rose-700 dark:text-rose-100">
                  {qualitySignals.overdueContacts.length}
                </p>
                <p className="mt-1 text-xs text-rose-600/80 dark:text-rose-200/80">
                  Нужно срочно вернуться к клиентам
                </p>
              </button>

              <button
                type="button"
                onClick={() => {
                  setQualityFilter("without_next_contact");
                  setStatusFilter("open");
                  setViewMode("list");
                  setSelectedPipelineId("all");
                }}
                className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-left shadow-sm transition hover:border-amber-300 dark:border-amber-500/20 dark:bg-amber-500/10"
              >
                <p className="text-xs font-semibold text-amber-700 dark:text-amber-200">
                  Нет следующего шага
                </p>
                <p className="mt-1 text-2xl font-semibold text-amber-800 dark:text-amber-100">
                  {qualitySignals.withoutNextContact.length}
                </p>
                <p className="mt-1 text-xs text-amber-700/80 dark:text-amber-200/80">
                  Риск потерять сделку без плана
                </p>
              </button>

              <button
                type="button"
                onClick={() => {
                  setWorkspaceView("inbox");
                  setInboxFilter("needs_reply");
                }}
                className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-left shadow-sm transition hover:border-emerald-300 dark:border-emerald-500/20 dark:bg-emerald-500/10"
              >
                <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-200">
                  Клиент ждёт 30+ минут
                </p>
                <p className="mt-1 text-2xl font-semibold text-emerald-800 dark:text-emerald-100">
                  {qualitySignals.waitingDialogs.length}
                </p>
                <p className="mt-1 text-xs text-emerald-700/80 dark:text-emerald-200/80">
                  Быстрый ответ повышает конверсию
                </p>
              </button>
            </div>
          ) : null}

          <div className="mt-5 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setWorkspaceView("pipeline")}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${
                  workspaceView === "pipeline"
                    ? "bg-violet-600 text-white shadow-lg shadow-violet-500/20"
                    : "border border-slate-200 bg-white text-slate-600 hover:border-violet-200 hover:text-violet-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300"
                }`}
              >
                <SquareCheckBig className="h-4 w-4" />
                Сделки
              </button>
              <button
                type="button"
                onClick={() => {
                  setWorkspaceView("inbox");
                  setInboxFilter("all");
                }}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${
                  workspaceView === "inbox"
                    ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20"
                    : "border border-slate-200 bg-white text-slate-600 hover:border-emerald-200 hover:text-emerald-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300"
                }`}
              >
                <Inbox className="h-4 w-4" />
                Входящие
                {inboxUnreadCount > 0 ? (
                  <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs">
                    {inboxUnreadCount}
                  </span>
                ) : null}
              </button>
            </div>
          </div>

          {workspaceView === "pipeline" ? (
          <div className="mt-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setSelectedPipelineId("all")}
                className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                  isAllPipelinesSelected
                    ? "bg-violet-600 text-white shadow-lg shadow-violet-500/20"
                    : "border border-slate-200 bg-white text-slate-600 hover:border-violet-200 hover:text-violet-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300"
                }`}
              >
                Все сделки
              </button>
              {pipelines.map((pipeline) => {
                const isActive =
                  !isAllPipelinesSelected && pipeline.id === activePipeline?.id;

                return (
                  <button
                    key={pipeline.id}
                    type="button"
                    onClick={() => setSelectedPipelineId(pipeline.id)}
                    className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                      isActive
                        ? "bg-violet-600 text-white shadow-lg shadow-violet-500/20"
                        : "border border-slate-200 bg-white text-slate-600 hover:border-violet-200 hover:text-violet-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300"
                    }`}
                  >
                    {pipeline.name}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-4 text-sm">
              <button
                type="button"
                onClick={() => setViewMode("board")}
                disabled={isAllPipelinesSelected}
                className={`pb-2 font-semibold transition ${
                  displayMode === "board"
                    ? "border-b-2 border-violet-600 text-violet-700 dark:text-violet-300"
                    : "text-slate-500 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40 dark:text-slate-400 dark:hover:text-white"
                }`}
              >
                Доска
              </button>
              <button
                type="button"
                onClick={() => setViewMode("list")}
                className={`pb-2 font-semibold transition ${
                  displayMode === "list"
                    ? "border-b-2 border-violet-600 text-violet-700 dark:text-violet-300"
                    : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                }`}
              >
                Список
              </button>
            </div>
          </div>
          ) : null}

          {error ? (
            <div className="mt-5 rounded-2xl border border-rose-300 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
              {error instanceof Error ? error.message : "CRM пока не загрузилась"}
            </div>
          ) : null}

          {workspaceView === "pipeline" && isAllPipelinesSelected ? (
            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {sourceOverview.length > 0 ? (
                sourceOverview.slice(0, 4).map((source) => (
                  <div
                    key={source.id}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-white/10 dark:bg-[#121827]"
                  >
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                      {source.name}
                    </p>
                    <p className="mt-2 text-xl font-semibold">
                      {source.count} сделок
                    </p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      В работе: {source.open} · Потенциал: {money(source.value)}
                    </p>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500 shadow-sm dark:border-white/10 dark:bg-[#121827] dark:text-slate-400">
                  По выбранным фильтрам пока нет сделок по источникам.
                </div>
              )}
            </div>
          ) : null}
        </section>

        {workspaceView === "inbox" ? (
          <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#121827]">
            <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 dark:border-white/10 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                  Центр сообщений
                </p>
                <h2 className="mt-1 text-xl font-semibold">
                  Входящие из Авито и других каналов
                </h2>
              </div>
              <div className="rounded-2xl bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200">
                Непрочитано: {inboxUnreadCount} · Нужно ответить: {inboxNeedsReplyCount}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {[
                { id: "all" as const, label: "Все", count: inboxItems.length },
                {
                  id: "needs_reply" as const,
                  label: "Требуют ответа",
                  count: inboxNeedsReplyCount,
                },
                {
                  id: "unread" as const,
                  label: "Непрочитанные",
                  count: inboxUnreadCount,
                },
                { id: "avito" as const, label: "Авито", count: inboxAvitoCount },
                {
                  id: "without_assignee" as const,
                  label: "Без ответственного",
                  count: inboxWithoutAssigneeCount,
                },
              ].map((filter) => (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => setInboxFilter(filter.id)}
                  className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition ${
                    inboxFilter === filter.id
                      ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20"
                      : "border border-slate-200 bg-slate-50 text-slate-600 hover:border-emerald-200 hover:text-emerald-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300"
                  }`}
                >
                  {filter.label}
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      inboxFilter === filter.id
                        ? "bg-white/20 text-white"
                        : "bg-white text-slate-500 dark:bg-white/10 dark:text-slate-300"
                    }`}
                  >
                    {filter.count}
                  </span>
                </button>
              ))}
            </div>

            <div className="mt-4 grid gap-3">
              {filteredInboxItems.map((item) => {
                const sourceName = item.deal.source_id
                  ? sourceNameById.get(item.deal.source_id) ?? "Источник"
                  : "Источник не указан";
                const assigneeProfiles = getDealAssigneeProfiles(item.deal);

                return (
                  <div
                    key={item.conversation.id}
                    className={`group rounded-2xl border px-4 py-4 transition hover:-translate-y-0.5 hover:shadow-lg ${
                      item.needsReply
                        ? "border-emerald-200 bg-emerald-50/80 hover:border-emerald-300 dark:border-emerald-500/30 dark:bg-emerald-500/10"
                        : "border-slate-200 bg-slate-50 hover:border-violet-200 dark:border-white/10 dark:bg-white/[0.03]"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => openDealDialogPanel(item.deal)}
                      className="w-full text-left"
                    >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 shadow-sm dark:bg-white/10 dark:text-slate-200">
                            {item.conversation.channel}
                          </span>
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                              item.needsReply
                                ? "bg-emerald-500 text-white"
                                : "bg-slate-200 text-slate-600 dark:bg-white/10 dark:text-slate-300"
                            }`}
                          >
                            {item.needsReply ? "Ждет ответа" : "Ответ отправлен"}
                          </span>
                          {item.isUnread ? (
                            <span className="rounded-full bg-violet-600 px-2.5 py-1 text-xs font-semibold text-white">
                              Новое
                            </span>
                          ) : null}
                          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                            {formatWaitTime(item.minutesWaiting)}
                          </span>
                        </div>

                        <h3 className="mt-3 truncate text-base font-semibold text-slate-950 dark:text-white">
                          {item.deal.title}
                        </h3>
                        <p className="mt-1 truncate text-sm text-slate-500 dark:text-slate-400">
                          {item.deal.client_name || "Клиент пока не создан"} · {sourceName}
                        </p>

                        <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-700 dark:text-slate-200">
                          {item.lastMessage.body || "Вложение без текста"}
                        </p>

                        {item.deal.source_item_url || item.deal.source_item_title ? (
                          <div className="mt-3 inline-flex max-w-full items-center gap-2 rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700 dark:bg-sky-500/10 dark:text-sky-200">
                            <span className="truncate">
                              {item.deal.source_item_title || "Объявление Avito"}
                            </span>
                          </div>
                        ) : null}
                      </div>

                      <div className="flex shrink-0 flex-col gap-2 text-sm text-slate-500 dark:text-slate-400 lg:min-w-[220px] lg:text-right">
                        <span>
                          {new Date(item.lastMessage.created_at).toLocaleString(
                            "ru-RU"
                          )}
                        </span>
                        <span>
                          Сообщений: {item.messageCount}
                        </span>
                        <span className="flex justify-start lg:justify-end">
                          <AssigneePreview members={assigneeProfiles} />
                        </span>
                        <span className="font-semibold text-violet-700 opacity-0 transition group-hover:opacity-100 dark:text-violet-300">
                          Открыть диалог →
                        </span>
                      </div>
                    </div>
                    </button>

                    <div className="mt-4 grid gap-3 border-t border-slate-200 pt-4 dark:border-white/10 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
                      <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                        Ответственный
                        <CustomSelect
                          value={item.deal.assignees[0]?.workspace_member_id ?? ""}
                          onChange={(value) => void assignInboxDeal(item.deal, value)}
                          disabled={updateDealMutation.isPending}
                          options={[
                            ...(canViewAllDeals
                              ? [{ value: "", label: "Без ответственного" }]
                              : []),
                            ...assignableMembers.map((member) => ({
                              value: member.id,
                              label: `${getWorkspaceMemberDisplayName(member)}${
                                member.profile_title ? ` - ${member.profile_title}` : ""
                              }`,
                            })),
                          ]}
                          className="mt-2 w-full"
                          buttonClassName="h-10 rounded-xl"
                        />
                      </label>

                      <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                        Следующий контакт
                        <input
                          type="datetime-local"
                          value={item.deal.next_contact_at?.slice(0, 16) ?? ""}
                          onChange={(event) =>
                            void updateInboxDealNextContact(
                              item.deal,
                              event.target.value
                            )
                          }
                          disabled={updateDealMutation.isPending}
                          className="mt-2 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-emerald-300 disabled:opacity-60 dark:border-white/10 dark:bg-[#0B0F1A] dark:text-slate-200"
                        />
                      </label>

                      <button
                        type="button"
                        onClick={() => openEditForm(item.deal)}
                        className="inline-flex h-10 items-center justify-center rounded-xl border border-violet-200 bg-white px-4 text-sm font-semibold text-violet-700 transition hover:border-violet-300 dark:border-violet-500/20 dark:bg-violet-500/10 dark:text-violet-200"
                      >
                        Открыть сделку
                      </button>
                    </div>
                  </div>
                );
              })}

              {filteredInboxItems.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 px-5 py-12 text-center text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
                  {inboxItems.length === 0
                    ? "Входящих сообщений пока нет. Когда клиент напишет с Авито, карточка появится здесь."
                    : "По выбранному фильтру сообщений нет. Можно переключиться на другой фильтр выше."}
                </div>
              ) : null}
            </div>
          </section>
        ) : displayMode === "board" ? (
        <section className="overflow-x-auto pb-4">
          <div className="grid min-h-[calc(100vh-290px)] gap-4 lg:grid-flow-col lg:auto-cols-[minmax(280px,320px)]">
            {activeStages.map((stage, index) => {
              const stageDeals = dealsByStage.get(stage.id) ?? [];
              const stageTotal = stageDealCounts[stage.id] ?? stageDeals.length;
              const hasHiddenDeals = stageTotal > stageDeals.length;

              return (
                <div
                  key={stage.id}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();
                    const dealId = event.dataTransfer.getData("text/plain");
                    void moveDealToStage(dealId, stage);
                  }}
                  className={`flex min-h-[520px] flex-col rounded-2xl border border-slate-200 border-t-4 bg-[#F0F3F8] p-3 ${stageAccentClasses[index % stageAccentClasses.length]} dark:border-white/10 dark:bg-[#111827]`}
                >
                  <div className="mb-3 flex items-center justify-between gap-3 px-1">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-current text-violet-500" />
                        <h2 className="truncate text-sm font-semibold">
                          {stage.name}
                        </h2>
                        <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-slate-500 shadow-sm dark:bg-white/10 dark:text-slate-300">
                          {stageDeals.length}
                          {hasHiddenDeals ? ` / ${stageTotal}` : ""}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {money(stageDeals.reduce((sum, deal) => sum + (deal.service_amount ?? 0), 0))}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={openCreateForm}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white hover:text-violet-700 dark:hover:bg-white/10 dark:hover:text-white"
                      title="Добавить сделку"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="flex flex-1 flex-col gap-2.5">
                    {hasHiddenDeals ? (
                      <div className="rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-medium text-violet-700 dark:border-violet-500/20 dark:bg-violet-500/10 dark:text-violet-200">
                        Показаны первые {stageDeals.length} сделок. Используй поиск и фильтры, чтобы быстро найти нужную.
                      </div>
                    ) : null}

                    {stageDeals.map((deal) => (
                      <DealCard
                        key={deal.id}
                        deal={deal}
                        sourceName={
                          deal.source_id
                            ? sourceNameById.get(deal.source_id) ?? "Источник"
                            : "Источник не указан"
                        }
                        assigneeProfiles={getDealAssigneeProfiles(deal)}
                        onEdit={() => openDealPanel(deal)}
                      />
                    ))}

                    {stageDeals.length === 0 ? (
                      <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white/50 p-6 text-center text-sm text-slate-400 dark:border-white/10 dark:bg-white/[0.03]">
                        Перетащи сделку сюда
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
        ) : (
          <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#121827]">
            <div className="overflow-x-auto">
              <table className="min-w-[980px] w-full border-collapse text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-[0.12em] text-slate-500 dark:bg-white/[0.03] dark:text-slate-400">
                  <tr>
                    <th className="px-5 py-4 font-semibold">Сделка</th>
                    <th className="px-5 py-4 font-semibold">Воронка</th>
                    <th className="px-5 py-4 font-semibold">Этап</th>
                    <th className="px-5 py-4 font-semibold">Источник</th>
                    <th className="px-5 py-4 font-semibold">Ответственные</th>
                    <th className="px-5 py-4 font-semibold">Следующий контакт</th>
                    <th className="px-5 py-4 font-semibold">Сумма</th>
                    <th className="px-5 py-4 font-semibold">Статус</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/10">
                  {listDeals.map((deal) => {
                    const assigneeProfiles = getDealAssigneeProfiles(deal);

                    return (
                      <tr
                        key={deal.id}
                        onClick={() => openDealPanel(deal)}
                        className="cursor-pointer transition hover:bg-slate-50 dark:hover:bg-white/[0.04]"
                      >
                        <td className="px-5 py-4">
                          <div className="font-semibold text-slate-950 dark:text-white">
                            {deal.title}
                          </div>
                          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            {deal.client_name || "Клиент пока не создан"}
                            {deal.phone ? ` · ${deal.phone}` : ""}
                          </div>
                        </td>
                        <td className="px-5 py-4 text-slate-600 dark:text-slate-300">
                          {pipelineNameById.get(deal.pipeline_id) ??
                            "Воронка не найдена"}
                        </td>
                        <td className="px-5 py-4 text-slate-600 dark:text-slate-300">
                          {stageNameById.get(deal.stage_id) ?? "Этап не найден"}
                        </td>
                        <td className="px-5 py-4">
                          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200">
                            {deal.source_id
                              ? sourceNameById.get(deal.source_id) ?? "Источник"
                              : "Не указан"}
                          </span>
                        </td>
                        <td className="max-w-[220px] px-5 py-4 text-slate-600 dark:text-slate-300">
                          <AssigneePreview members={assigneeProfiles} />
                        </td>
                        <td className="px-5 py-4 text-slate-600 dark:text-slate-300">
                          {deal.next_contact_at
                            ? new Date(deal.next_contact_at).toLocaleDateString(
                                "ru-RU",
                                {
                                  day: "2-digit",
                                  month: "2-digit",
                                  year: "numeric",
                                }
                              )
                            : "Не назначен"}
                        </td>
                        <td className="px-5 py-4 font-semibold text-slate-950 dark:text-white">
                          {money(deal.service_amount)}
                        </td>
                        <td className="px-5 py-4">
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                              deal.status === "won"
                                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200"
                                : deal.status === "lost"
                                  ? "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200"
                                  : "bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-200"
                            }`}
                          >
                            {deal.status === "won"
                              ? "Оплачено"
                              : deal.status === "lost"
                                ? "Потеряно"
                                : "В работе"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {listDeals.length === 0 ? (
              <div className="border-t border-slate-100 px-5 py-12 text-center text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
                Сделок по выбранным фильтрам пока нет.
              </div>
            ) : null}
          </section>
        )}
      </div>

      {isAssignmentSettingsOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="max-h-[88vh] w-full max-w-5xl overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-[#121827]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-violet-600 dark:text-violet-300">
                  CRM
                </p>
                <h2 className="mt-2 text-2xl font-semibold">
                  Распределение заявок
                </h2>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                  Настрой, кому будут назначаться новые сделки из Авито, Tilda, Яндекс Директа и других каналов.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAssignmentSettingsOpen(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
              >
                Закрыть
              </button>
            </div>

            <div className="mt-6 grid gap-4">
              {sources.map((source) => {
                const draft = assignmentRuleDrafts[source.kind] ?? {
                  mode: "manual" as CrmAssignmentMode,
                  target_member_ids: [],
                };
                const needsTargets = draft.mode !== "manual";

                return (
                  <div
                    key={source.id}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-[#0B0F1A]"
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <h3 className="text-base font-semibold">{source.name}</h3>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          Канал: {source.kind}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <CustomSelect
                          value={draft.mode}
                          onChange={(value) =>
                            updateAssignmentRuleDraft(source.kind, {
                              mode: value as CrmAssignmentMode,
                            })
                          }
                          options={[
                            { value: "manual", label: "Ручное назначение" },
                            { value: "round_robin", label: "По очереди" },
                            { value: "least_loaded", label: "Кто свободнее" },
                            { value: "fixed_manager", label: "Фиксированные" },
                          ]}
                          className="min-w-[180px]"
                          buttonClassName="h-10 rounded-xl font-semibold"
                        />

                        <button
                          type="button"
                          onClick={() => void saveAssignmentRule(source.kind)}
                          disabled={
                            upsertAssignmentRuleMutation.isPending ||
                            (needsTargets && draft.target_member_ids.length === 0)
                          }
                          className="h-10 rounded-xl bg-violet-600 px-4 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Сохранить
                        </button>
                      </div>
                    </div>

                    {needsTargets ? (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {activeMembers.map((member) => {
                          const isSelected = draft.target_member_ids.includes(
                            member.id
                          );

                          return (
                            <button
                              key={member.id}
                              type="button"
                              onClick={() =>
                                toggleAssignmentTarget(source.kind, member.id)
                              }
                              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                                isSelected
                                  ? "border-violet-500 bg-violet-600 text-white"
                                  : "border-slate-200 bg-white text-slate-600 hover:border-violet-200 hover:text-violet-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300"
                              }`}
                            >
                              {getWorkspaceMemberDisplayName(member)}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
                        Новые сделки из этого канала будут создаваться без автоматического ответственного.
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}

      {isPipelineSettingsOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-3xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-[#121827]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-violet-600 dark:text-violet-300">
                  CRM
                </p>
                <h2 className="mt-2 text-2xl font-semibold">
                  Управление воронками
                </h2>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                  Создавай отдельные воронки под источники, менеджеров или запуск проектов. Общая воронка при этом остаётся главным обзором продаж.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsPipelineSettingsOpen(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
              >
                Закрыть
              </button>
            </div>

            <div className="mt-6 space-y-3">
              {pipelines.map((pipeline) => {
                const pipelineDealsCount = deals.filter(
                  (deal) => deal.pipeline_id === pipeline.id
                ).length;

                return (
                  <div
                    key={pipeline.id}
                    className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-[#0B0F1A] md:grid-cols-[1fr_auto_auto] md:items-center"
                  >
                    <div>
                      <input
                        value={pipelineNameDrafts[pipeline.id] ?? pipeline.name}
                        onChange={(event) =>
                          setPipelineNameDrafts((current) => ({
                            ...current,
                            [pipeline.id]: event.target.value,
                          }))
                        }
                        className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold outline-none focus:border-violet-400 dark:border-white/10 dark:bg-[#121827]"
                      />
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <span className="rounded-full bg-white px-2 py-1 dark:bg-white/10">
                          {pipeline.kind === "delivery"
                            ? "Запуск проекта"
                            : "Продажи"}
                        </span>
                        <span>{pipelineDealsCount} сделок</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => void savePipelineName(pipeline)}
                      disabled={updatePipelineMutation.isPending}
                      className="h-11 rounded-xl bg-violet-600 px-4 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:opacity-50"
                    >
                      Сохранить
                    </button>

                    <button
                      type="button"
                      onClick={() => void hidePipeline(pipeline)}
                      disabled={
                        updatePipelineMutation.isPending ||
                        pipelineDealsCount > 0 ||
                        pipelines.length <= 1
                      }
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 text-sm font-semibold text-rose-600 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200"
                    >
                      <Trash2 className="h-4 w-4" />
                      Скрыть
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="mt-6 rounded-2xl border border-violet-100 bg-violet-50 p-4 dark:border-violet-500/20 dark:bg-violet-500/10">
              <p className="text-sm font-semibold text-violet-800 dark:text-violet-100">
                Новая воронка
              </p>
              <div className="mt-3 grid gap-3 md:grid-cols-[1fr_220px_auto]">
                <input
                  value={newPipelineName}
                  onChange={(event) => setNewPipelineName(event.target.value)}
                  placeholder="Например: Авито — менеджер Анна"
                  className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-violet-400 dark:border-white/10 dark:bg-[#121827]"
                />
                <CustomSelect
                  value={newPipelineKind}
                  onChange={(value) =>
                    setNewPipelineKind(value as "sales" | "delivery")
                  }
                  options={[
                    { value: "sales", label: "Продажи" },
                    { value: "delivery", label: "Запуск проекта" },
                  ]}
                  className="min-w-[180px]"
                  buttonClassName="h-11 rounded-xl font-semibold"
                />
                <button
                  type="button"
                  onClick={() => void createPipeline()}
                  disabled={createPipelineMutation.isPending || !newPipelineName.trim()}
                  className="h-11 rounded-xl bg-violet-600 px-4 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Создать
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {isStageSettingsOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-3xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-[#121827]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-violet-600 dark:text-violet-300">
                  Настройка воронки
                </p>
                <h2 className="mt-2 text-2xl font-semibold">
                  Этапы: {activePipeline?.name ?? "CRM"}
                </h2>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                  Здесь можно переименовать колонки, поменять порядок и добавить новый этап.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsStageSettingsOpen(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
              >
                Закрыть
              </button>
            </div>

            <div className="mt-6 space-y-3">
              {activeStages.map((stage, index) => (
                <div
                  key={stage.id}
                  className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-[#0B0F1A] md:flex-row md:items-center"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-sm font-semibold text-slate-500 shadow-sm dark:bg-white/10 dark:text-slate-300">
                    {index + 1}
                  </div>

                  <input
                    value={stageNameDrafts[stage.id] ?? stage.name}
                    onChange={(event) =>
                      setStageNameDrafts((current) => ({
                        ...current,
                        [stage.id]: event.target.value,
                      }))
                    }
                    className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100 dark:border-white/10 dark:bg-[#111827] dark:focus:ring-violet-500/15"
                  />

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void moveStage(stage.id, -1)}
                      disabled={index === 0 || updateStageOrderMutation.isPending}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 disabled:opacity-40 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => void moveStage(stage.id, 1)}
                      disabled={
                        index === activeStages.length - 1 ||
                        updateStageOrderMutation.isPending
                      }
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 disabled:opacity-40 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={() => void saveStageName(stage)}
                      disabled={updateStageMutation.isPending}
                      className="rounded-xl bg-violet-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:opacity-50"
                    >
                      Сохранить
                    </button>
                    <button
                      type="button"
                      onClick={() => void hideStage(stage)}
                      disabled={
                        updateStageMutation.isPending ||
                        stage.kind === "lost" ||
                        stage.kind === "paid_project"
                      }
                      className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-600 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200"
                    >
                      <Trash2 className="h-4 w-4" />
                      Скрыть
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-3 dark:border-white/10 dark:bg-[#0B0F1A] md:flex-row">
              <input
                value={newStageName}
                onChange={(event) => setNewStageName(event.target.value)}
                className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100 dark:border-white/10 dark:bg-[#111827] dark:focus:ring-violet-500/15"
                placeholder="Название нового этапа"
              />
              <button
                type="button"
                onClick={() => void addStage()}
                disabled={!newStageName.trim() || createStageMutation.isPending}
                className="rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-400 disabled:opacity-50"
              >
                Добавить этап
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {pendingLostMove ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-[#121827]">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-rose-500">
              Сделка потеряна
            </p>
            <h2 className="mt-2 text-2xl font-semibold">
              Укажи причину отказа
            </h2>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Это поможет понять, где теряются деньги: цена, качество заявок, менеджер или предложение.
            </p>

            <div className="mt-5 grid gap-2">
              {lossReasons.map((reason) => (
                <button
                  key={reason.id}
                  type="button"
                  onClick={() => setSelectedLossReasonId(reason.id)}
                  className={`rounded-xl border px-4 py-3 text-left text-sm font-semibold transition ${
                    selectedLossReasonId === reason.id
                      ? "border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/15 dark:text-rose-100"
                      : "border-slate-200 bg-slate-50 text-slate-600 hover:border-rose-200 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300"
                  }`}
                >
                  {reason.name}
                </button>
              ))}
            </div>

            <textarea
              value={lossComment}
              onChange={(event) => setLossComment(event.target.value)}
              rows={3}
              className="mt-4 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-rose-300 focus:ring-4 focus:ring-rose-100 dark:border-white/10 dark:bg-[#0B0F1A] dark:focus:ring-rose-500/15"
              placeholder="Комментарий, если нужно"
            />

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setPendingLostMove(null)}
                className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={() => void confirmLostMove()}
                disabled={moveDealMutation.isPending}
                className="rounded-xl bg-rose-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-rose-400 disabled:opacity-60"
              >
                Перенести в потерянные
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {selectedDeal ? (
        <div className="fixed inset-y-0 right-0 z-40 flex w-full max-w-xl flex-col border-l border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#101827]">
          <div className="border-b border-slate-200 px-6 py-5 dark:border-white/10">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                  Сделка
                </p>
                <h2 className="mt-1 truncate text-2xl font-semibold text-slate-950 dark:text-white">
                  {selectedDeal.title}
                </h2>
                <p className="mt-1 truncate text-sm text-slate-500 dark:text-slate-400">
                  {selectedDeal.client_name || "Клиент пока не создан"}
                </p>
                {selectedDealSignal ? (
                  <span
                    className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${selectedDealSignal.className}`}
                  >
                    {selectedDealSignal.label}
                  </span>
                ) : null}
              </div>

              <button
                type="button"
                onClick={() => setSelectedDealId(null)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
                title="Закрыть"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-slate-50 p-3 dark:bg-white/[0.04]">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Стоимость услуги
                </p>
                <p className="mt-1 text-lg font-semibold">
                  {money(selectedDeal.service_amount)}
                </p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-3 dark:bg-white/[0.04]">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Бюджет
                </p>
                <p className="mt-1 text-lg font-semibold">
                  {money(selectedDeal.budget)}
                </p>
              </div>
            </div>

            <div className="mt-5 flex gap-2 overflow-x-auto">
              {[
                ["dialogs", `Диалог (${selectedDealMessages.length})`],
                ["info", "Информация"],
                ["tasks", `Задачи (${selectedDealTasks.length})`],
                ["comments", "Комментарии"],
                ["history", "История"],
              ].map(([tab, label]) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setDealPanelTab(tab as typeof dealPanelTab)}
                  className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
                    dealPanelTab === tab
                      ? "bg-violet-600 text-white"
                      : "bg-slate-50 text-slate-600 hover:bg-slate-100 dark:bg-white/[0.04] dark:text-slate-300 dark:hover:bg-white/[0.08]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            {dealPanelTab === "info" ? (
              <div className="space-y-4">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/[0.04]">
                  <div className="grid gap-4 text-sm">
                    <div className="flex items-center gap-3">
                      <Users className="h-4 w-4 text-slate-400" />
                      <AssigneePreview members={selectedDealAssigneeProfiles} />
                    </div>
                    <div className="flex items-center gap-3">
                      <LineChart className="h-4 w-4 text-slate-400" />
                      <span>
                        {pipelineNameById.get(selectedDeal.pipeline_id) || "Воронка"} ·{" "}
                        {stageNameById.get(selectedDeal.stage_id) || "Этап"}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Inbox className="h-4 w-4 text-slate-400" />
                      <span>
                        {selectedDeal.source_id
                          ? sourceNameById.get(selectedDeal.source_id) ?? "Источник"
                          : "Источник не указан"}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Phone className="h-4 w-4 text-slate-400" />
                      <span>{selectedDeal.phone || "Телефон не указан"}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Mail className="h-4 w-4 text-slate-400" />
                      <span>{selectedDeal.telegram || "Telegram не указан"}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Clock3 className="h-4 w-4 text-slate-400" />
                      <span>
                        {selectedDeal.next_contact_at
                          ? new Date(selectedDeal.next_contact_at).toLocaleString(
                              "ru-RU"
                            )
                          : "Следующий контакт не назначен"}
                      </span>
                    </div>
                  </div>

                  {selectedDeal.status === "open" ? (
                    <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-200 pt-4 dark:border-white/10">
                      {[
                        ["Сегодня", 3],
                        ["Завтра", 24],
                        ["Через 3 дня", 72],
                      ].map(([label, hours]) => (
                        <button
                          key={label}
                          type="button"
                          onClick={() =>
                            void updateSelectedDealNextContact(
                              new Date(Date.now() + Number(hours) * 60 * 60 * 1000)
                            )
                          }
                          disabled={updateDealMutation.isPending}
                          className="rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-700 transition hover:border-violet-300 disabled:opacity-50 dark:border-violet-500/20 dark:bg-violet-500/10 dark:text-violet-200"
                        >
                          Контакт: {label}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.03]">
                  <p className="text-sm font-semibold">Описание</p>
                  <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-600 dark:text-slate-300">
                    {selectedDeal.description || "Описание пока не заполнено."}
                  </p>
                </div>

                {selectedDeal.source_item_url || selectedDeal.source_item_title ? (
                  <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm dark:border-sky-400/20 dark:bg-sky-500/10">
                    <p className="font-semibold text-sky-900 dark:text-sky-100">
                      Объявление Avito
                    </p>
                    <p className="mt-1 text-sky-700 dark:text-sky-200">
                      {selectedDeal.source_item_title ||
                        selectedDeal.source_item_id ||
                        "Источник заявки"}
                    </p>
                    {selectedDeal.source_item_url ? (
                      <a
                        href={selectedDeal.source_item_url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-3 inline-flex rounded-xl bg-sky-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-sky-500"
                      >
                        Открыть объявление
                      </a>
                    ) : null}
                  </div>
                ) : null}

                {selectedDeal.status === "lost" ? (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-100">
                    <p className="font-semibold">Причина потери</p>
                    <p className="mt-1">
                      {lossReasons.find(
                        (reason) => reason.id === selectedDeal.loss_reason_id
                      )?.name || "Не указана"}
                    </p>
                    {selectedDeal.loss_comment ? (
                      <p className="mt-2 text-rose-600 dark:text-rose-200">
                        {selectedDeal.loss_comment}
                      </p>
                    ) : null}
                  </div>
                ) : null}

                <button
                  type="button"
                  onClick={() => openEditForm(selectedDeal)}
                  className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-violet-500"
                >
                  <Edit3 className="h-4 w-4" />
                  Редактировать сделку
                </button>
              </div>
            ) : null}

            {dealPanelTab === "dialogs" ? (
              <div className="space-y-4">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/[0.04]">
                  <div className="flex items-center justify-between gap-3">
                    <p className="flex items-center gap-2 text-sm font-semibold">
                      <MessageSquareText className="h-4 w-4 text-emerald-500" />
                      Диалог с клиентом
                    </p>
                    {selectedDealConversations[0] ? (
                      <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200">
                        {selectedDealConversations[0].channel}
                      </span>
                    ) : null}
                  </div>

                  {selectedDealConversations[0]?.channel === "avito" ? (
                    <div className="mt-4 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-800 dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-100">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="font-semibold">
                            Диалог связан с Avito
                          </p>
                          <p className="mt-1 text-xs leading-5 opacity-80">
                            Ответ из этого окна уйдёт клиенту в Avito, а история
                            сохранится в сделке.
                          </p>
                        </div>
                        {selectedDeal.source_item_url ? (
                          <a
                            href={selectedDeal.source_item_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex shrink-0 items-center justify-center rounded-xl bg-sky-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-sky-500"
                          >
                            Открыть объявление
                          </a>
                        ) : null}
                      </div>
                      {selectedDeal.source_item_title ? (
                        <p className="mt-3 truncate text-xs font-semibold">
                          Объявление: {selectedDeal.source_item_title}
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="mt-4 max-h-80 space-y-3 overflow-y-auto pr-1">
                    {selectedDealMessages.map((message) => {
                      const isManager = message.sender_type === "manager";
                      const author =
                        message.sender_member_id &&
                        memberNameById.get(message.sender_member_id);

                      return (
                        <div
                          key={message.id}
                          className={`flex ${isManager ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                              isManager
                                ? "bg-violet-600 text-white"
                                : "border border-slate-200 bg-white text-slate-700 dark:border-white/10 dark:bg-[#0B0F1A] dark:text-slate-200"
                            }`}
                          >
                            <p className="whitespace-pre-line leading-6">
                              {message.body || "Вложение"}
                            </p>
                            {message.attachment_url ? (
                              <a
                                href={message.attachment_url}
                                target="_blank"
                                rel="noreferrer"
                                className={`mt-3 block overflow-hidden rounded-xl border ${
                                  isManager
                                    ? "border-white/20 bg-white/10"
                                    : "border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-white/[0.04]"
                                }`}
                              >
                                {/\.(png|jpe?g|webp|gif)(\?.*)?$/i.test(
                                  message.attachment_url
                                ) ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={message.attachment_url}
                                    alt="Вложение"
                                    className="max-h-56 w-full object-cover"
                                  />
                                ) : (
                                  <span className="block px-3 py-2 text-xs font-semibold underline">
                                    Открыть вложение
                                  </span>
                                )}
                              </a>
                            ) : null}
                            <p
                              className={`mt-2 text-[11px] ${
                                isManager
                                  ? "text-violet-100"
                                  : "text-slate-400 dark:text-slate-500"
                              }`}
                            >
                              {isManager ? author || "Менеджер" : "Клиент"} •{" "}
                              {new Date(message.created_at).toLocaleString(
                                "ru-RU"
                              )}
                            </p>
                          </div>
                        </div>
                      );
                    })}

                    {selectedDealMessages.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-400 dark:border-white/10">
                        Диалогов пока нет. Когда придёт первое сообщение, оно появится здесь.
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.03]">
                  <textarea
                    value={newClientReply}
                    onChange={(event) => setNewClientReply(event.target.value)}
                    rows={4}
                    disabled={!selectedDealConversations[0]}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-[#0B0F1A] dark:focus:ring-violet-500/15"
                    placeholder="Напиши ответ клиенту..."
                  />
                  <input
                    value={newClientReplyAttachmentUrl}
                    onChange={(event) =>
                      setNewClientReplyAttachmentUrl(event.target.value)
                    }
                    disabled={!selectedDealConversations[0]}
                    className="mt-3 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-[#0B0F1A] dark:focus:ring-violet-500/15"
                    placeholder="Ссылка на вложение, если нужно"
                  />
                  {selectedDealConversations[0]?.channel === "avito" &&
                  newClientReplyAttachmentUrl.trim() ? (
                    <p className="mt-2 text-xs text-amber-600 dark:text-amber-300">
                      В CRM вложение сохранится. В Avito сейчас отправится текст
                      ответа, а отправку файлов подключим отдельным API-шагом.
                    </p>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => void sendClientReply()}
                    disabled={
                      !selectedDealConversations[0] ||
                      (!newClientReply.trim() &&
                        !newClientReplyAttachmentUrl.trim()) ||
                      createMessageMutation.isPending
                    }
                    className="mt-3 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-400 disabled:opacity-50"
                  >
                    Ответить
                  </button>
                </div>
              </div>
            ) : null}

            {dealPanelTab === "tasks" ? (
              <div className="space-y-4">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/[0.04]">
                  <p className="text-sm font-semibold">Следующий шаг</p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-white/10 dark:bg-[#0B0F1A]">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                        Активные
                      </p>
                      <p className="mt-1 text-lg font-semibold">
                        {selectedDealTaskStats.active}
                      </p>
                    </div>
                    <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 dark:border-rose-500/20 dark:bg-rose-500/10">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-rose-500">
                        Просрочено
                      </p>
                      <p className="mt-1 text-lg font-semibold text-rose-700 dark:text-rose-100">
                        {selectedDealTaskStats.overdue}
                      </p>
                    </div>
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 dark:border-emerald-500/20 dark:bg-emerald-500/10">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-600">
                        Готово
                      </p>
                      <p className="mt-1 text-lg font-semibold text-emerald-700 dark:text-emerald-100">
                        {selectedDealTaskStats.done}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {[
                      ["Позвонить клиенту", 2],
                      ["Отправить КП", 4],
                      ["Напомнить завтра", 24],
                      ["Проверить оплату", 24],
                      ["Передать в запуск", 48],
                    ].map(([title, hours]) => (
                      <button
                        key={title}
                        type="button"
                        onClick={() =>
                          void addQuickDealTask(
                            String(title),
                            new Date(Date.now() + Number(hours) * 60 * 60 * 1000)
                          )
                        }
                        disabled={createDealTaskMutation.isPending}
                        className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 transition hover:border-emerald-300 disabled:opacity-50 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200"
                      >
                        {title}
                      </button>
                    ))}
                  </div>
                  <div className="mt-3 grid gap-3">
                    <input
                      value={newDealTaskTitle}
                      onChange={(event) => setNewDealTaskTitle(event.target.value)}
                      className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100 dark:border-white/10 dark:bg-[#0B0F1A] dark:focus:ring-violet-500/15"
                      placeholder="Например: отправить КП"
                    />
                    <input
                      type="datetime-local"
                      value={newDealTaskDueAt}
                      onChange={(event) => setNewDealTaskDueAt(event.target.value)}
                      className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100 dark:border-white/10 dark:bg-[#0B0F1A] dark:focus:ring-violet-500/15"
                    />
                    <button
                      type="button"
                      onClick={() => void addDealTask()}
                      disabled={
                        !newDealTaskTitle.trim() ||
                        createDealTaskMutation.isPending
                      }
                      className="rounded-xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-400 disabled:opacity-50"
                    >
                      Добавить задачу
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  {selectedDealTasks.map((task) => {
                    const timing = getDealTaskTiming(task);
                    const assigneeName = task.assignee_member_id
                      ? memberNameById.get(task.assignee_member_id)
                      : null;

                    return (
                      <div
                        key={task.id}
                        className="rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-violet-200 hover:shadow-sm dark:border-white/10 dark:bg-white/[0.03]"
                      >
                        <div className="flex items-start gap-3">
                          {task.status === "done" ? (
                            <SquareCheckBig className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
                          ) : (
                            <Circle className="mt-0.5 h-5 w-5 shrink-0 text-slate-300" />
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p
                                className={`text-sm font-semibold ${
                                  task.status === "done"
                                    ? "text-slate-400 line-through"
                                    : "text-slate-900 dark:text-white"
                                }`}
                              >
                                {task.title}
                              </p>
                              <span
                                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${timing.className}`}
                              >
                                {timing.label}
                              </span>
                            </div>
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                              {task.due_at
                                ? new Date(task.due_at).toLocaleString("ru-RU")
                                : "Без дедлайна"}
                              {assigneeName ? ` · ${assigneeName}` : ""}
                            </p>
                          </div>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2 pl-8">
                          {task.task_id ? (
                            <Link
                              href={`/tasks?task=${task.task_id}`}
                              className="inline-flex items-center gap-1 rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700 transition hover:border-violet-300 dark:border-violet-500/20 dark:bg-violet-500/10 dark:text-violet-200"
                            >
                              Открыть задачу
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Link>
                          ) : null}
                          {task.status !== "in_progress" && task.status !== "done" ? (
                            <button
                              type="button"
                              onClick={() =>
                                void updateDealTaskMutation.mutateAsync({
                                  taskId: task.id,
                                  values: { status: "in_progress" },
                                })
                              }
                              disabled={updateDealTaskMutation.isPending}
                              className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700 transition hover:border-sky-300 disabled:opacity-50 dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-200"
                            >
                              В работу
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => void toggleDealTask(task)}
                            disabled={updateDealTaskMutation.isPending}
                            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
                              task.status === "done"
                                ? "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:bg-white/10 dark:text-slate-300"
                                : "bg-emerald-500 text-white hover:bg-emerald-400"
                            }`}
                          >
                            {task.status === "done" ? "Вернуть в работу" : "Готово"}
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  {selectedDealTasks.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-400 dark:border-white/10">
                      По сделке пока нет задач. Добавь следующий шаг, чтобы менеджер не потерял контакт.
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}

            {dealPanelTab === "comments" ? (
              <div className="space-y-4">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/[0.04]">
                  <p className="flex items-center gap-2 text-sm font-semibold">
                    <MessageSquareText className="h-4 w-4 text-violet-500" />
                    Комментарий для команды
                  </p>
                  <textarea
                    value={newDealComment}
                    onChange={(event) => setNewDealComment(event.target.value)}
                    rows={4}
                    className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100 dark:border-white/10 dark:bg-[#0B0F1A] dark:focus:ring-violet-500/15"
                    placeholder="Напиши договорённость, важную мысль или что нужно проверить"
                  />
                  <input
                    value={newDealCommentFileUrl}
                    onChange={(event) =>
                      setNewDealCommentFileUrl(event.target.value)
                    }
                    className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100 dark:border-white/10 dark:bg-[#0B0F1A] dark:focus:ring-violet-500/15"
                    placeholder="Ссылка на файл или вложение, если нужно"
                  />
                  <button
                    type="button"
                    onClick={() => void addDealComment()}
                    disabled={
                      (!newDealComment.trim() &&
                        !newDealCommentFileUrl.trim()) ||
                      createDealCommentMutation.isPending
                    }
                    className="mt-3 rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:opacity-50"
                  >
                    Добавить комментарий
                  </button>
                </div>

                <div className="space-y-3">
                  {selectedDealComments.map((comment) => {
                    const author =
                      comment.author_member_id &&
                      memberNameById.get(comment.author_member_id);

                    return (
                      <div
                        key={comment.id}
                        className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.03]"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold">
                            {author || "Сотрудник"}
                          </p>
                          <p className="text-xs text-slate-400">
                            {new Date(comment.created_at).toLocaleString("ru-RU")}
                          </p>
                        </div>
                        <p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-600 dark:text-slate-300">
                          {comment.body}
                        </p>
                        {comment.file_url ? (
                          <a
                            href={comment.file_url}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-3 inline-flex items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-700 transition hover:border-violet-300 dark:border-violet-500/20 dark:bg-violet-500/10 dark:text-violet-200"
                          >
                            <Paperclip className="h-3.5 w-3.5" />
                            Открыть вложение
                          </a>
                        ) : null}
                      </div>
                    );
                  })}

                  {selectedDealComments.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-400 dark:border-white/10">
                      Комментариев пока нет. Первый комментарий обычно фиксирует договорённость с клиентом.
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}

            {dealPanelTab === "history" ? (
              <div className="space-y-3">
                <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.03]">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">Путь по воронке</p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        Создание сделки и переходы между этапами.
                      </p>
                    </div>
                    <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700 dark:bg-violet-500/15 dark:text-violet-200">
                      {selectedDealStageHistory.length}
                    </span>
                  </div>

                  <div className="mt-4 space-y-2">
                    {selectedDealStageHistory.map((movement) => {
                      const actor =
                        movement.actor_member_id &&
                        memberNameById.get(movement.actor_member_id);
                      const fromStage = movement.from_stage_id
                        ? stageNameById.get(movement.from_stage_id) ||
                          "Предыдущий этап"
                        : "Создание сделки";
                      const toStage =
                        stageNameById.get(movement.to_stage_id) || "Новый этап";
                      const pipelineName =
                        pipelineNameById.get(movement.to_pipeline_id) || "CRM";

                      return (
                        <div
                          key={movement.id}
                          className="flex gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3 dark:border-white/10 dark:bg-[#0B0F1A]"
                        >
                          <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-200">
                            <ArrowRight className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold">
                              {fromStage} → {toStage}
                            </p>
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                              {pipelineName} · {actor || "Система"} ·{" "}
                              {new Date(movement.moved_at).toLocaleString(
                                "ru-RU"
                              )}
                            </p>
                          </div>
                        </div>
                      );
                    })}

                    {selectedDealStageHistory.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-300 p-4 text-center text-sm text-slate-400 dark:border-white/10">
                        Переходов по этапам пока нет.
                      </div>
                    ) : null}
                  </div>
                </div>

                {selectedDealActivities.map((activity) => {
                  const actor =
                    activity.actor_member_id &&
                    memberNameById.get(activity.actor_member_id);

                  return (
                    <div
                      key={activity.id}
                      className="flex gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.03]"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-200">
                        <History className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold">
                          {getActivityText(activity.action)}
                        </p>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          {actor || "Система"} •{" "}
                          {new Date(activity.created_at).toLocaleString("ru-RU")}
                        </p>
                      </div>
                    </div>
                  );
                })}

                {selectedDealActivities.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-400 dark:border-white/10">
                    История пока пустая. Новые действия по сделке будут появляться здесь.
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {isFormOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <form
            onSubmit={submitDeal}
            className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-[#121827]"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-violet-600 dark:text-violet-300">
                  {editingDeal ? "Редактирование" : "Новая сделка"}
                </p>
                <h2 className="mt-2 text-2xl font-semibold">
                  {editingDeal ? editingDeal.title : "Создать сделку"}
                </h2>
              </div>
              <button
                type="button"
                onClick={closeForm}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
              >
                Закрыть
              </button>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <label className="space-y-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
                Название сделки
                <input
                  required
                  value={form.title}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, title: event.target.value }))
                  }
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100 dark:border-white/10 dark:bg-[#0B0F1A] dark:focus:ring-violet-500/15"
                  placeholder="Например: Продвижение Avito"
                />
              </label>

              <label className="space-y-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
                Клиент из базы
                <CustomSelect
                  value={form.client_id}
                  onChange={(value) => {
                    const client = clients.find((item) => item.id === value);
                    setForm((current) => ({
                      ...current,
                      client_id: value,
                      client_name: client?.name ?? current.client_name,
                    }));
                  }}
                  options={[
                    { value: "", label: "Можно без клиента" },
                    ...clients.map((client) => ({
                      value: client.id,
                      label: client.name,
                    })),
                  ]}
                  className="w-full"
                  buttonClassName="rounded-xl bg-slate-50 py-3 dark:bg-[#0B0F1A]"
                />
              </label>

              <label className="space-y-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
                Имя клиента
                <input
                  value={form.client_name}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      client_name: event.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100 dark:border-white/10 dark:bg-[#0B0F1A] dark:focus:ring-violet-500/15"
                  placeholder="Название компании или имя"
                />
              </label>

              <label className="space-y-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
                Источник
                <CustomSelect
                  value={form.source_id}
                  onChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      source_id: value,
                    }))
                  }
                  options={[
                    { value: "", label: "Не указан" },
                    ...sources.map((source) => ({
                      value: source.id,
                      label: source.name,
                    })),
                  ]}
                  className="w-full"
                  buttonClassName="rounded-xl bg-slate-50 py-3 dark:bg-[#0B0F1A]"
                />
              </label>

              <label className="space-y-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
                Телефон
                <input
                  value={form.phone}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, phone: event.target.value }))
                  }
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100 dark:border-white/10 dark:bg-[#0B0F1A] dark:focus:ring-violet-500/15"
                  placeholder="+7..."
                />
              </label>

              <label className="space-y-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
                Telegram
                <input
                  value={form.telegram}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      telegram: event.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100 dark:border-white/10 dark:bg-[#0B0F1A] dark:focus:ring-violet-500/15"
                  placeholder="@username"
                />
              </label>

              <label className="space-y-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
                Стоимость услуги
                <input
                  value={form.service_amount}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      service_amount: event.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100 dark:border-white/10 dark:bg-[#0B0F1A] dark:focus:ring-violet-500/15"
                  placeholder="50000"
                />
              </label>

              <label className="space-y-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
                Бюджет
                <input
                  value={form.budget}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, budget: event.target.value }))
                  }
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100 dark:border-white/10 dark:bg-[#0B0F1A] dark:focus:ring-violet-500/15"
                  placeholder="100000"
                />
              </label>

              <label className="space-y-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
                Следующий контакт
                <input
                  type="datetime-local"
                  value={form.next_contact_at}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      next_contact_at: event.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100 dark:border-white/10 dark:bg-[#0B0F1A] dark:focus:ring-violet-500/15"
                />
              </label>

              <div className="space-y-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
                Ответственные
                <div className="flex min-h-[48px] flex-wrap gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2 dark:border-white/10 dark:bg-[#0B0F1A]">
                  {assignableMembers.map((member) => {
                    const isSelected = form.assignee_ids.includes(member.id);
                    const label = getWorkspaceMemberDisplayName(member);

                    return (
                        <button
                          key={member.id}
                        type="button"
                        onClick={() => toggleAssignee(member.id)}
                        className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
                          isSelected
                            ? "bg-violet-600 text-white"
                            : "bg-white text-slate-600 hover:bg-slate-100 dark:bg-white/10 dark:text-slate-300"
                        }`}
                        >
                          <span className="flex items-center gap-2">
                            <MemberAvatar
                              member={{
                                id: member.id,
                                name: label,
                                avatarUrl: member.avatar_url,
                                title: member.profile_title,
                              }}
                              size="xs"
                            />
                            <span className="flex flex-col items-start">
                              <span>{label}</span>
                              {member.profile_title ? (
                                <span className="text-[10px] opacity-70">
                                  {member.profile_title}
                                </span>
                              ) : null}
                            </span>
                          </span>
                        </button>
                      );
                  })}
                </div>
              </div>
            </div>

            <label className="mt-4 block space-y-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
              Описание
              <textarea
                value={form.description}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                rows={4}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100 dark:border-white/10 dark:bg-[#0B0F1A] dark:focus:ring-violet-500/15"
                placeholder="Что нужно знать по заявке"
              />
            </label>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeForm}
                className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
              >
                Отмена
              </button>
              <button
                type="submit"
                disabled={
                  createDealMutation.isPending || updateDealMutation.isPending
                }
                className="rounded-xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:opacity-60"
              >
                {editingDeal ? "Сохранить сделку" : "Создать сделку"}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {paidDeal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-[#121827]">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <h2 className="mt-4 text-2xl font-semibold">
              Сделка дошла до оплаты
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
              Теперь удобно создать проект в RIVN OS и передать работу команде.
              Автоматически проект пока не создаём, чтобы менеджер мог проверить данные.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => setPaidDeal(null)}
                className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
              >
                Не сейчас
              </button>
              <Link
                href="/projects"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-violet-500"
              >
                Перейти к проектам
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
