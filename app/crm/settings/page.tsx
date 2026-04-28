"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  History,
  Route,
  SlidersHorizontal,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  canAccessCrm,
  canManageCrmSettings,
  isAppRole,
} from "../../lib/permissions";
import {
  useCrmAssignmentLogsQuery,
  useCrmBootstrapQuery,
  useUpsertCrmAssignmentRuleMutation,
} from "../../lib/queries/use-crm-query";
import { useActiveWorkspaceMembers } from "../../lib/queries/use-workspace-members-query";
import { useAppContextState } from "../../providers/app-context-provider";
import { CustomSelect } from "../../components/ui/custom-select";
import { getWorkspaceMemberDisplayName } from "../../lib/supabase/workspace-members";
import type {
  CrmAssignmentMode,
  CrmAssignmentRuleSettings,
} from "../../lib/supabase/crm";

type AssignmentDraft = {
  mode: CrmAssignmentMode;
  target_member_ids: string[];
  settings: CrmAssignmentRuleSettings;
};

const GLOBAL_RULE_KEY = "__global__";

const modeOptions: Array<{
  value: CrmAssignmentMode;
  label: string;
  description: string;
}> = [
  {
    value: "manual",
    label: "Ручное назначение",
    description: "Заявка создаётся без автоматического ответственного.",
  },
  {
    value: "fixed_manager",
    label: "Закреплённые менеджеры",
    description: "Все заявки канала уходят выбранному менеджеру или группе.",
  },
  {
    value: "round_robin",
    label: "Равномерно по очереди",
    description: "Система распределяет заявки между выбранными менеджерами 50/50 или равными долями.",
  },
  {
    value: "least_loaded",
    label: "Кто свободнее",
    description: "Новая заявка уходит менеджеру с меньшим числом открытых сделок.",
  },
];

function getModeLabel(mode: CrmAssignmentMode) {
  return modeOptions.find((option) => option.value === mode)?.label ?? mode;
}

function emptyDraft(): AssignmentDraft {
  return {
    mode: "manual",
    target_member_ids: [],
    settings: {
      max_open_deals_per_manager: null,
      priority_member_ids: [],
      disabled_member_ids: [],
    },
  };
}

function getPayloadString(
  payload: Record<string, unknown>,
  key: string,
  fallback = ""
) {
  const value = payload[key];
  return typeof value === "string" ? value : fallback;
}

function getPayloadStringArray(payload: Record<string, unknown>, key: string) {
  const value = payload[key];
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function getAssignmentReasonText(reason: string) {
  switch (reason) {
    case "fixed_manager":
      return "канал закреплён за выбранными менеджерами";
    case "least_open_deals":
      return "выбран менеджер с меньшей нагрузкой";
    case "equal_distribution":
      return "заявки распределяются равномерно";
    case "selected_in_form":
      return "ответственный выбран вручную при создании";
    case "limited_role_self_assignment":
      return "менеджер создал сделку для себя";
    case "manual_mode":
      return "включён ручной режим";
    case "rule_missing":
      return "для канала нет правила";
    case "target_members_missing":
      return "в правиле не выбраны менеджеры";
    case "all_managers_disabled":
      return "все менеджеры в правиле временно выключены";
    case "capacity_limit_overridden":
      return "лимит загрузки достигнут, выбран наименее загруженный";
    default:
      return "сработало правило распределения";
  }
}

export default function CrmSettingsPage() {
  const { role, isReady } = useAppContextState();
  const currentRole = isAppRole(role) ? role : null;
  const hasAccess = currentRole ? canAccessCrm(currentRole) : false;
  const canManageSettings = currentRole
    ? canManageCrmSettings(currentRole)
    : false;
  const { data, isLoading } = useCrmBootstrapQuery(isReady && hasAccess, {
    status: "all",
  });
  const { activeMembers = [] } = useActiveWorkspaceMembers(
    isReady && hasAccess
  );
  const { data: assignmentLogs = [] } = useCrmAssignmentLogsQuery(
    isReady && hasAccess && canManageSettings
  );
  const upsertRuleMutation = useUpsertCrmAssignmentRuleMutation();
  const [drafts, setDrafts] = useState<Record<string, AssignmentDraft>>({});
  const sources = data?.sources ?? [];
  const assignmentRules = data?.assignmentRules ?? [];
  const sourceRows = useMemo(() => {
    const uniqueSources = Array.from(
      new Map(sources.map((source) => [source.kind, source])).values()
    );

    return [
      {
        key: GLOBAL_RULE_KEY,
        kind: null,
        name: "Все источники без отдельного правила",
      },
      ...uniqueSources.map((source) => ({
        key: source.kind,
        kind: source.kind,
        name: source.name,
      })),
    ];
  }, [sources]);
  const activeRules = assignmentRules.filter((rule) => rule.is_active);
  const defaultRule = activeRules.find((rule) => !rule.source_kind);
  const sourceRuleCount = activeRules.filter((rule) => rule.source_kind).length;
  const riskyRuleCount = activeRules.filter(
    (rule) => rule.mode !== "manual" && rule.target_member_ids.length === 0
  ).length;
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

  useEffect(() => {
    setDrafts((current) => {
      const next = { ...current };

      for (const row of sourceRows) {
        const rule = assignmentRules.find((item) =>
          row.kind ? item.source_kind === row.kind : !item.source_kind
        );

        next[row.key] = rule
          ? {
              mode: rule.mode,
              target_member_ids: rule.target_member_ids,
              settings: rule.settings,
            }
          : next[row.key] ?? emptyDraft();
      }

      return next;
    });
  }, [assignmentRules, sourceRows]);

  function updateDraft(key: string, patch: Partial<AssignmentDraft>) {
    setDrafts((current) => ({
      ...current,
      [key]: {
        ...(current[key] ?? emptyDraft()),
        ...patch,
      },
    }));
  }

  function updateDraftSettings(
    key: string,
    patch: Partial<CrmAssignmentRuleSettings>
  ) {
    setDrafts((current) => {
      const draft = current[key] ?? emptyDraft();

      return {
        ...current,
        [key]: {
          ...draft,
          settings: {
            ...draft.settings,
            ...patch,
          },
        },
      };
    });
  }

  function toggleMember(key: string, memberId: string) {
    const draft = drafts[key] ?? emptyDraft();
    const exists = draft.target_member_ids.includes(memberId);
    const nextTargetIds = exists
      ? draft.target_member_ids.filter((id) => id !== memberId)
      : [...draft.target_member_ids, memberId];

    updateDraft(key, {
      target_member_ids: nextTargetIds,
      settings: {
        ...draft.settings,
        priority_member_ids: (draft.settings.priority_member_ids ?? []).filter(
          (id) => nextTargetIds.includes(id)
        ),
        disabled_member_ids: (draft.settings.disabled_member_ids ?? []).filter(
          (id) => nextTargetIds.includes(id)
        ),
      },
    });
  }

  function toggleDisabledMember(key: string, memberId: string) {
    const draft = drafts[key] ?? emptyDraft();
    const disabledIds = draft.settings.disabled_member_ids ?? [];
    const exists = disabledIds.includes(memberId);

    updateDraftSettings(key, {
      disabled_member_ids: exists
        ? disabledIds.filter((id) => id !== memberId)
        : [...disabledIds, memberId],
    });
  }

  function movePriorityMember(key: string, memberId: string, direction: -1 | 1) {
    const draft = drafts[key] ?? emptyDraft();
    const orderedIds = [
      ...new Set([
        ...(draft.settings.priority_member_ids ?? []),
        ...draft.target_member_ids,
      ]),
    ].filter((id) => draft.target_member_ids.includes(id));
    const index = orderedIds.indexOf(memberId);
    const nextIndex = index + direction;

    if (index < 0 || nextIndex < 0 || nextIndex >= orderedIds.length) return;

    const nextIds = [...orderedIds];
    [nextIds[index], nextIds[nextIndex]] = [nextIds[nextIndex], nextIds[index]];
    updateDraftSettings(key, { priority_member_ids: nextIds });
  }

  async function saveRule(row: { key: string; kind: string | null }) {
    const draft = drafts[row.key] ?? emptyDraft();

    await upsertRuleMutation.mutateAsync({
      source_kind: row.kind,
      mode: draft.mode,
      target_member_ids:
        draft.mode === "manual" ? [] : draft.target_member_ids,
      settings: draft.settings,
      is_active: true,
    });
  }

  if (!isReady || isLoading) {
    return (
      <main className="min-h-screen bg-[#F5F7FB] px-5 py-6 text-slate-950 dark:bg-[#0B0F1A] dark:text-white lg:px-8">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm dark:border-white/10 dark:bg-[#121827]">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Загружаем настройки CRM...
          </p>
        </div>
      </main>
    );
  }

  if (!hasAccess || !canManageSettings) {
    return (
      <main className="min-h-screen bg-[#F5F7FB] px-5 py-6 text-slate-950 dark:bg-[#0B0F1A] dark:text-white lg:px-8">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm dark:border-white/10 dark:bg-[#121827]">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
            CRM
          </p>
          <h1 className="mt-3 text-2xl font-semibold">
            Нет доступа к настройкам CRM
          </h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Настраивать распределение заявок может владелец, администратор,
            менеджер или руководитель отдела продаж.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F5F7FB] px-5 py-6 text-slate-950 dark:bg-[#0B0F1A] dark:text-white lg:px-8">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-[#121827]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <Link
              href="/crm"
              className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-violet-600 dark:text-slate-400 dark:hover:text-violet-200"
            >
              <ArrowLeft className="h-4 w-4" />
              Назад в CRM
            </Link>
            <p className="mt-5 text-sm font-semibold uppercase tracking-[0.18em] text-violet-600 dark:text-violet-300">
              CRM
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">
              Распределение заявок
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500 dark:text-slate-400">
              Настрой, кому будут попадать новые заявки из Авито, Tilda,
              Яндекс Директа и других каналов. Это помогает быстро отвечать
              клиентам и не терять продажи из-за ручной передачи лидов.
            </p>
          </div>

          <Link
            href="/crm/analytics"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 transition hover:border-violet-200 hover:text-violet-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300"
          >
            <Route className="h-4 w-4" />
            Аналитика CRM
          </Link>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4 dark:border-violet-500/20 dark:bg-violet-500/10">
            <p className="text-sm font-semibold text-violet-900 dark:text-violet-100">
              Канал → менеджеры
            </p>
            <p className="mt-2 text-sm text-violet-700 dark:text-violet-200">
              Для Авито можно выбрать одну команду, для Tilda другую.
            </p>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-500/20 dark:bg-emerald-500/10">
            <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">
              Равные доли
            </p>
            <p className="mt-2 text-sm text-emerald-700 dark:text-emerald-200">
              Если менеджеров несколько, заявки будут делиться равномерно.
            </p>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/20 dark:bg-amber-500/10">
            <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
              Защита от перегруза
            </p>
            <p className="mt-2 text-sm text-amber-700 dark:text-amber-200">
              Режим “кто свободнее” отдаёт лиды менеджеру с меньшей нагрузкой.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/[0.04]">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Источники
            </p>
            <p className="mt-2 text-2xl font-semibold">{sources.length}</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Каналы, откуда могут приходить заявки
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/[0.04]">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Настроено
            </p>
            <p className="mt-2 text-2xl font-semibold">{sourceRuleCount}</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Отдельных правил по каналам
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/[0.04]">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              По умолчанию
            </p>
            <p className="mt-2 text-sm font-semibold">
              {defaultRule ? getModeLabel(defaultRule.mode) : "Ручное назначение"}
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Сработает, если у канала нет своего правила
            </p>
          </div>
          <div
            className={`rounded-2xl border p-4 ${
              riskyRuleCount > 0
                ? "border-amber-200 bg-amber-50 dark:border-amber-500/20 dark:bg-amber-500/10"
                : "border-emerald-200 bg-emerald-50 dark:border-emerald-500/20 dark:bg-emerald-500/10"
            }`}
          >
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Контроль
            </p>
            <p className="mt-2 text-sm font-semibold">
              {riskyRuleCount > 0 ? "Есть риск" : "Всё спокойно"}
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {riskyRuleCount > 0
                ? "В некоторых правилах не выбраны менеджеры"
                : "Правила не оставляют заявки без исполнителей"}
            </p>
          </div>
        </div>
      </section>

      <section className="mt-5 grid gap-4">
        {sourceRows.map((row) => {
          const draft = drafts[row.key] ?? emptyDraft();
          const selectedMembers = activeMembers.filter((member) =>
            draft.target_member_ids.includes(member.id)
          );
          const needsManagers =
            draft.mode !== "manual" && draft.target_member_ids.length === 0;

          return (
            <div
              key={row.key}
              className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#121827]"
            >
              <div className="grid gap-5 xl:grid-cols-[1fr_280px]">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-200">
                      <SlidersHorizontal className="h-5 w-5" />
                    </span>
                    <div>
                      <h2 className="text-lg font-semibold">{row.name}</h2>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {row.kind
                          ? `Источник: ${row.kind}`
                          : "Используется, если для источника нет отдельного правила"}
                        </p>
                    </div>
                    <span
                      className={`ml-auto inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${
                        needsManagers
                          ? "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-100"
                          : draft.mode === "manual"
                            ? "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300"
                            : "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-100"
                      }`}
                    >
                      {needsManagers
                        ? "Нужны менеджеры"
                        : getModeLabel(draft.mode)}
                    </span>
                  </div>

                  <div className="mt-5 grid gap-3 lg:grid-cols-2">
                    {modeOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() =>
                          updateDraft(row.key, { mode: option.value })
                        }
                        className={`rounded-2xl border p-4 text-left transition ${
                          draft.mode === option.value
                            ? "border-violet-300 bg-violet-50 text-violet-900 shadow-sm dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-100"
                            : "border-slate-200 bg-slate-50 text-slate-700 hover:border-violet-200 dark:border-white/10 dark:bg-[#0B0F1A] dark:text-slate-300"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <CheckCircle2
                            className={`mt-0.5 h-5 w-5 ${
                              draft.mode === option.value
                                ? "text-violet-600 dark:text-violet-200"
                                : "text-slate-300"
                            }`}
                          />
                          <div>
                            <p className="text-sm font-semibold">
                              {option.label}
                            </p>
                            <p className="mt-1 text-xs leading-5 opacity-75">
                              {option.description}
                            </p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-[#0B0F1A]">
                  <p className="text-sm font-semibold">Менеджеры</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Выбери людей, между которыми система будет распределять
                    заявки.
                  </p>

                  <div className="mt-4 space-y-2">
                    {activeMembers.map((member) => {
                      const isSelected = draft.target_member_ids.includes(
                        member.id
                      );

                      return (
                        <button
                          key={member.id}
                          type="button"
                          onClick={() => toggleMember(row.key, member.id)}
                          disabled={draft.mode === "manual"}
                          className={`flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left text-sm transition disabled:cursor-not-allowed disabled:opacity-50 ${
                            isSelected
                              ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-100"
                              : "border-slate-200 bg-white text-slate-700 hover:border-violet-200 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300"
                          }`}
                        >
                          <span className="truncate">
                            {getWorkspaceMemberDisplayName(member)}
                          </span>
                          <span className="text-xs opacity-60">
                            {isSelected ? "выбран" : "добавить"}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-4">
                    <CustomSelect
                      value={draft.mode}
                      onChange={(value) =>
                        updateDraft(row.key, {
                          mode: value as CrmAssignmentMode,
                        })
                      }
                      options={modeOptions.map((option) => ({
                        value: option.value,
                        label: option.label,
                      }))}
                      buttonClassName="rounded-xl font-semibold"
                    />
                  </div>

                  <div className="mt-4 rounded-xl bg-white p-3 text-xs text-slate-500 dark:bg-white/[0.04] dark:text-slate-400">
                    Сейчас выбрано:{" "}
                    <span className="font-semibold text-slate-800 dark:text-white">
                      {draft.mode === "manual"
                        ? "ручное назначение"
                        : selectedMembers.length > 0
                          ? selectedMembers
                              .map((member) =>
                                getWorkspaceMemberDisplayName(member)
                              )
                              .join(", ")
                          : "менеджеры не выбраны"}
                    </span>
                  </div>

                  {draft.mode !== "manual" ? (
                    <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-white/[0.04]">
                      <p className="text-sm font-semibold">
                        Лимиты и приоритеты
                      </p>
                      <label className="mt-3 block text-xs font-semibold text-slate-500 dark:text-slate-400">
                        Максимум открытых сделок на менеджера
                        <input
                          type="number"
                          min={0}
                          value={
                            draft.settings.max_open_deals_per_manager ?? ""
                          }
                          onChange={(event) =>
                            updateDraftSettings(row.key, {
                              max_open_deals_per_manager: event.target.value
                                ? Number(event.target.value)
                                : null,
                            })
                          }
                          className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-950 outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100 dark:border-white/10 dark:bg-[#0B0F1A] dark:text-white dark:focus:ring-violet-500/15"
                          placeholder="Без лимита"
                        />
                      </label>

                      <div className="mt-3 space-y-2">
                        {selectedMembers.length === 0 ? (
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            Выбери менеджеров выше, чтобы настроить приоритеты.
                          </p>
                        ) : (
                          selectedMembers.map((member) => {
                            const isDisabled = (
                              draft.settings.disabled_member_ids ?? []
                            ).includes(member.id);
                            const orderedIds = [
                              ...new Set([
                                ...(draft.settings.priority_member_ids ?? []),
                                ...draft.target_member_ids,
                              ]),
                            ].filter((id) => draft.target_member_ids.includes(id));
                            const priorityIndex = orderedIds.indexOf(member.id);

                            return (
                              <div
                                key={member.id}
                                className="rounded-xl border border-slate-200 bg-slate-50 p-2 dark:border-white/10 dark:bg-[#0B0F1A]"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-semibold">
                                      {getWorkspaceMemberDisplayName(member)}
                                    </p>
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                      Приоритет: {priorityIndex + 1}
                                    </p>
                                  </div>
                                  <div className="flex shrink-0 gap-1">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        movePriorityMember(row.key, member.id, -1)
                                      }
                                      className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 transition hover:border-violet-200 hover:text-violet-700 dark:border-white/10 dark:text-slate-300"
                                    >
                                      ↑
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        movePriorityMember(row.key, member.id, 1)
                                      }
                                      className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 transition hover:border-violet-200 hover:text-violet-700 dark:border-white/10 dark:text-slate-300"
                                    >
                                      ↓
                                    </button>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() =>
                                    toggleDisabledMember(row.key, member.id)
                                  }
                                  className={`mt-2 w-full rounded-lg px-2 py-1.5 text-xs font-semibold transition ${
                                    isDisabled
                                      ? "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-100"
                                      : "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-100"
                                  }`}
                                >
                                  {isDisabled
                                    ? "Не участвует в распределении"
                                    : "Участвует в распределении"}
                                </button>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  ) : null}

                  {needsManagers ? (
                    <div className="mt-3 flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-100">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>
                        Выбран автоматический режим, но менеджеры не указаны.
                        Сохрани правило после выбора команды.
                      </span>
                    </div>
                  ) : null}

                  <button
                    type="button"
                    onClick={() => void saveRule(row)}
                    disabled={
                      upsertRuleMutation.isPending ||
                      (draft.mode !== "manual" &&
                        draft.target_member_ids.length === 0)
                    }
                    className="mt-4 h-11 w-full rounded-xl bg-violet-600 px-4 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {upsertRuleMutation.isPending
                      ? "Сохраняем..."
                      : "Сохранить правило"}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </section>

      <section className="mt-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-[#121827]">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-violet-600 dark:text-violet-300">
              Контроль
            </p>
            <h2 className="mt-2 text-2xl font-semibold">
              Журнал распределения заявок
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500 dark:text-slate-400">
              Здесь видно, какой алгоритм сработал и почему заявка попала
              конкретному менеджеру. Это помогает РОПу быстро проверять
              справедливость распределения.
            </p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300">
            <History className="h-4 w-4" />
            Последние {assignmentLogs.length}
          </span>
        </div>

        <div className="mt-5 space-y-3">
          {assignmentLogs.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-400">
              Журнал пока пустой. Он начнёт заполняться, когда в CRM появятся
              новые заявки или диалоги.
            </div>
          ) : (
            assignmentLogs.map((log) => {
              const payload = log.payload ?? {};
              const selectedMemberIds = getPayloadStringArray(
                payload,
                "selected_member_ids"
              );
              const targetMemberIds = getPayloadStringArray(
                payload,
                "target_member_ids"
              );
              const selectedNames = selectedMemberIds.map(
                (id) => memberNameById.get(id) ?? "Сотрудник"
              );
              const targetNames = targetMemberIds.map(
                (id) => memberNameById.get(id) ?? "Сотрудник"
              );
              const reason = getPayloadString(payload, "reason");
              const mode = getPayloadString(payload, "mode", "manual");
              const dealTitle = getPayloadString(
                payload,
                "deal_title",
                "Новая заявка"
              );
              const sourceName =
                getPayloadString(payload, "source_name") ||
                getPayloadString(payload, "source_kind", "Источник не указан");

              return (
                <div
                  key={log.id}
                  className="grid gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-[#0B0F1A] lg:grid-cols-[1fr_260px]"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-700 dark:bg-violet-500/15 dark:text-violet-100">
                        {sourceName}
                      </span>
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-white/[0.06] dark:text-slate-300">
                        {getModeLabel(mode as CrmAssignmentMode)}
                      </span>
                    </div>
                    <p className="mt-3 text-sm font-semibold text-slate-950 dark:text-white">
                      {dealTitle}
                    </p>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      Причина: {getAssignmentReasonText(reason)}
                    </p>
                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-500">
                      Команда правила:{" "}
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        {targetNames.length > 0
                          ? targetNames.join(", ")
                          : "не выбрана"}
                      </span>
                    </p>
                  </div>
                  <div className="rounded-xl bg-white p-3 text-sm dark:bg-white/[0.04]">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                      Назначено
                    </p>
                    <p className="mt-2 font-semibold text-slate-950 dark:text-white">
                      {selectedNames.length > 0
                        ? selectedNames.join(", ")
                        : "Без ответственного"}
                    </p>
                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                      {new Date(log.created_at).toLocaleString("ru-RU", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>
    </main>
  );
}
