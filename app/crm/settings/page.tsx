"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  History,
  Route,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";
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
import { getWorkspaceMemberDisplayName } from "../../lib/supabase/workspace-members";
import type {
  CrmAssignmentMode,
  CrmAssignmentRule,
  CrmAssignmentRuleSettings,
} from "../../lib/supabase/crm";

type AssignmentDraft = {
  mode: CrmAssignmentMode;
  target_member_ids: string[];
  settings: CrmAssignmentRuleSettings;
};

type RuleRow = {
  key: string;
  kind: string | null;
  name: string;
  caption: string;
  rule: CrmAssignmentRule | null;
};

const GLOBAL_RULE_KEY = "__global__";

const modeOptions: Array<{
  value: CrmAssignmentMode;
  label: string;
  shortLabel: string;
  description: string;
}> = [
  {
    value: "manual",
    label: "Ручное назначение",
    shortLabel: "Ручной режим",
    description: "Заявка создается без автоматического ответственного.",
  },
  {
    value: "fixed_manager",
    label: "Закрепленные менеджеры",
    shortLabel: "Закреплено",
    description: "Все заявки канала уходят выбранному менеджеру или группе.",
  },
  {
    value: "round_robin",
    label: "Равномерно по очереди",
    shortLabel: "По очереди",
    description: "Система делит заявки между выбранными менеджерами ровными долями.",
  },
  {
    value: "least_loaded",
    label: "Кто свободнее",
    shortLabel: "По нагрузке",
    description: "Новая заявка уходит менеджеру с меньшим числом открытых сделок.",
  },
];

function getModeLabel(mode: CrmAssignmentMode) {
  return modeOptions.find((option) => option.value === mode)?.label ?? mode;
}

function getModeShortLabel(mode: CrmAssignmentMode) {
  return modeOptions.find((option) => option.value === mode)?.shortLabel ?? mode;
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

function draftFromRule(rule: CrmAssignmentRule | null): AssignmentDraft {
  if (!rule) return emptyDraft();

  return {
    mode: rule.mode,
    target_member_ids: rule.target_member_ids,
    settings: rule.settings,
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
      return "канал закреплен за выбранными менеджерами";
    case "least_open_deals":
      return "выбран менеджер с меньшей нагрузкой";
    case "equal_distribution":
      return "заявки распределяются равномерно";
    case "selected_in_form":
      return "ответственный выбран вручную";
    case "limited_role_self_assignment":
      return "менеджер создал сделку для себя";
    case "manual_mode":
      return "включен ручной режим";
    case "rule_missing":
      return "для канала нет отдельного правила";
    case "target_members_missing":
      return "в правиле не выбраны менеджеры";
    case "all_managers_disabled":
      return "все менеджеры правила временно выключены";
    case "capacity_limit_overridden":
      return "лимит достигнут, выбран наименее загруженный";
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
  const [selectedKey, setSelectedKey] = useState(GLOBAL_RULE_KEY);

  const sources = useMemo(() => data?.sources ?? [], [data?.sources]);
  const assignmentRules = useMemo(
    () => data?.assignmentRules ?? [],
    [data?.assignmentRules]
  );
  const activeRules = useMemo(
    () => assignmentRules.filter((rule) => rule.is_active),
    [assignmentRules]
  );
  const defaultRule = activeRules.find((rule) => !rule.source_kind) ?? null;
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

  const rows: RuleRow[] = useMemo(() => {
    const uniqueSources = Array.from(
      new Map(sources.map((source) => [source.kind, source])).values()
    );

    return [
      {
        key: GLOBAL_RULE_KEY,
        kind: null,
        name: "Правило по умолчанию",
        caption: "Сработает, если для канала нет отдельного правила",
        rule: defaultRule,
      },
      ...uniqueSources.map((source) => {
        const rule =
          activeRules.find((item) => item.source_kind === source.kind) ?? null;

        return {
          key: source.kind,
          kind: source.kind,
          name: source.name,
          caption: `Источник: ${source.kind}`,
          rule,
        };
      }),
    ];
  }, [activeRules, defaultRule, sources]);

  const selectedRow = rows.find((row) => row.key === selectedKey) ?? rows[0];
  const selectedDraft =
    drafts[selectedRow?.key ?? GLOBAL_RULE_KEY] ??
    draftFromRule(selectedRow?.rule ?? null);
  const sourceRuleCount = activeRules.filter((rule) => rule.source_kind).length;
  const riskyRuleCount = rows.filter((row) => {
    const draft = drafts[row.key] ?? draftFromRule(row.rule);
    return draft.mode !== "manual" && draft.target_member_ids.length === 0;
  }).length;
  const selectedMembers = activeMembers.filter((member) =>
    selectedDraft.target_member_ids.includes(member.id)
  );
  const selectedDisabledIds = selectedDraft.settings.disabled_member_ids ?? [];
  const selectedPriorityIds = [
    ...new Set([
      ...(selectedDraft.settings.priority_member_ids ?? []),
      ...selectedDraft.target_member_ids,
    ]),
  ].filter((id) => selectedDraft.target_member_ids.includes(id));
  const headerStats = [
    {
      label: "Источников",
      value: sources.length,
      hint: "каналы входящих заявок",
      icon: Route,
    },
    {
      label: "Правил",
      value: sourceRuleCount,
      hint: "отдельно по источникам",
      icon: SlidersHorizontal,
    },
    {
      label: "Команда",
      value: activeMembers.length,
      hint: "активных сотрудников",
      icon: Users,
    },
    {
      label: "Состояние",
      value: riskyRuleCount > 0 ? riskyRuleCount : "OK",
      hint:
        riskyRuleCount > 0
          ? "правил требуют внимания"
          : "рисков не найдено",
      icon: riskyRuleCount > 0 ? AlertTriangle : ShieldCheck,
      danger: riskyRuleCount > 0,
    },
  ];

  function getDraft(row: RuleRow) {
    return drafts[row.key] ?? draftFromRule(row.rule);
  }

  function updateDraft(key: string, patch: Partial<AssignmentDraft>) {
    const row = rows.find((item) => item.key === key);
    const current = row ? getDraft(row) : drafts[key] ?? emptyDraft();

    setDrafts((previous) => ({
      ...previous,
      [key]: {
        ...current,
        ...patch,
      },
    }));
  }

  function updateDraftSettings(
    key: string,
    patch: Partial<CrmAssignmentRuleSettings>
  ) {
    const row = rows.find((item) => item.key === key);
    const current = row ? getDraft(row) : drafts[key] ?? emptyDraft();

    setDrafts((previous) => ({
      ...previous,
      [key]: {
        ...current,
        settings: {
          ...current.settings,
          ...patch,
        },
      },
    }));
  }

  function toggleMember(key: string, memberId: string) {
    const row = rows.find((item) => item.key === key);
    const draft = row ? getDraft(row) : drafts[key] ?? emptyDraft();
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
    const row = rows.find((item) => item.key === key);
    const draft = row ? getDraft(row) : drafts[key] ?? emptyDraft();
    const disabledIds = draft.settings.disabled_member_ids ?? [];
    const exists = disabledIds.includes(memberId);

    updateDraftSettings(key, {
      disabled_member_ids: exists
        ? disabledIds.filter((id) => id !== memberId)
        : [...disabledIds, memberId],
    });
  }

  function movePriorityMember(key: string, memberId: string, direction: -1 | 1) {
    const row = rows.find((item) => item.key === key);
    const draft = row ? getDraft(row) : drafts[key] ?? emptyDraft();
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

  async function saveRule(row: RuleRow) {
    const draft = getDraft(row);

    await upsertRuleMutation.mutateAsync({
      source_kind: row.kind,
      mode: draft.mode,
      target_member_ids:
        draft.mode === "manual" ? [] : draft.target_member_ids,
      settings: draft.settings,
      is_active: true,
    });

    setDrafts((previous) => {
      const next = { ...previous };
      delete next[row.key];
      return next;
    });
  }

  if (!isReady || isLoading) {
    return (
      <main className="rivn-scope min-h-screen px-5 py-6 text-slate-950 dark:text-white lg:px-8">
        <div className="rivn-card p-8">
          <p className="text-sm text-white/55">Загружаем настройки CRM...</p>
        </div>
      </main>
    );
  }

  if (!hasAccess || !canManageSettings) {
    return (
      <main className="rivn-scope min-h-screen px-5 py-6 text-slate-950 dark:text-white lg:px-8">
        <div className="rivn-card p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#00f5a8]">
            CRM
          </p>
          <h1 className="mt-3 text-2xl font-semibold">
            Нет доступа к настройкам CRM
          </h1>
          <p className="mt-2 text-sm text-white/55">
            Настраивать распределение заявок может владелец, администратор,
            менеджер или руководитель отдела продаж.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="rivn-scope min-h-screen px-5 py-6 text-slate-950 dark:text-white lg:px-8">
      <section className="rivn-card overflow-hidden p-0">
        <div className="relative p-6 lg:p-7">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute right-0 top-0 h-56 w-72 rounded-full bg-[#00f5a8]/12 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-12 -top-16 h-72 w-72 rounded-full bg-[#7c5cff]/18 blur-3xl"
          />

          <div className="relative flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <Link
                href="/crm"
                className="inline-flex items-center gap-2 text-sm font-semibold text-white/50 transition hover:text-white"
              >
                <ArrowLeft className="h-4 w-4" />
                Назад в CRM
              </Link>
              <p className="mt-5 text-xs font-semibold uppercase tracking-[0.22em] text-[#00f5a8]">
                CRM control
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white lg:text-4xl">
                Пульт распределения заявок
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-white/55">
                Настрой, куда попадут новые заявки из Авито, Tilda, Telegram и
                других каналов. Сначала работает правило конкретного источника,
                а если его нет, система использует правило по умолчанию.
              </p>
            </div>

            <div className="flex flex-col gap-3 xl:min-w-[720px]">
              <div className="grid gap-2 sm:grid-cols-2 xl:ml-auto xl:w-[360px]">
                <Link
                  href="/crm/analytics"
                  className="rivn-pill justify-center px-4 py-3 text-sm font-semibold"
                >
                  <Route className="h-4 w-4" />
                  Аналитика CRM
                </Link>
                <Link
                  href="/crm/integrations"
                  className="rivn-pill justify-center px-4 py-3 text-sm font-semibold"
                >
                  <Settings2 className="h-4 w-4" />
                  Интеграции
                </Link>
              </div>
              <div className="hidden grid-cols-4 gap-2 xl:grid">
                {headerStats.map((item) => {
                  const Icon = item.icon;

                  return (
                    <div
                      key={item.label}
                      className={`rounded-[18px] border px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] ${
                        item.danger
                          ? "border-amber-400/25 bg-amber-400/10"
                          : "border-white/10 bg-white/[0.055]"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/42">
                          {item.label}
                        </p>
                        <Icon
                          className={`h-4 w-4 ${
                            item.danger ? "text-amber-200" : "text-[#00f5a8]"
                          }`}
                        />
                      </div>
                      <p className="mt-2 text-xl font-semibold text-white">
                        {item.value}
                      </p>
                      <p className="mt-0.5 text-[11px] text-white/45">
                        {item.hint}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="relative mt-5 flex flex-wrap items-stretch gap-2 xl:hidden">
            {headerStats.map((item) => {
              const Icon = item.icon;

              return (
                <div
                  key={item.label}
                  className={`min-w-[170px] flex-1 rounded-[18px] border px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] md:flex-none ${
                    item.danger
                      ? "border-amber-400/25 bg-amber-400/10"
                      : "border-white/10 bg-white/[0.055]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/42">
                      {item.label}
                    </p>
                    <Icon
                      className={`h-4 w-4 ${
                        item.danger ? "text-amber-200" : "text-[#00f5a8]"
                      }`}
                    />
                  </div>
                  <p className="mt-2 text-xl font-semibold text-white">
                    {item.value}
                  </p>
                  <p className="mt-0.5 text-[11px] text-white/45">{item.hint}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="rivn-card overflow-hidden p-0">
          <div className="border-b border-white/10 px-5 py-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/38">
                  Правила
                </p>
                <h2 className="mt-1 text-xl font-semibold text-white">
                  Куда уходят новые заявки
                </h2>
              </div>
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-[#00f5a8]/20 bg-[#00f5a8]/10 px-3 py-1.5 text-xs font-semibold text-[#9fffe3]">
                <Sparkles className="h-3.5 w-3.5" />
                Выбери строку для настройки
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] border-collapse text-left text-sm">
              <thead className="border-b border-white/10 text-xs uppercase tracking-[0.14em] text-white/35">
                <tr>
                  <th className="px-5 py-4 font-semibold">Источник</th>
                  <th className="px-5 py-4 font-semibold">Режим</th>
                  <th className="px-5 py-4 font-semibold">Менеджеры</th>
                  <th className="px-5 py-4 font-semibold">Лимит</th>
                  <th className="px-5 py-4 text-right font-semibold">
                    Статус
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {rows.map((row) => {
                  const draft = getDraft(row);
                  const managerNames = draft.target_member_ids.map(
                    (id) => memberNameById.get(id) ?? "Сотрудник"
                  );
                  const isSelected = row.key === selectedRow.key;
                  const needsManagers =
                    draft.mode !== "manual" &&
                    draft.target_member_ids.length === 0;

                  return (
                    <tr
                      key={row.key}
                      onClick={() => setSelectedKey(row.key)}
                      className={`cursor-pointer transition duration-300 ${
                        isSelected
                          ? "bg-[#00f5a8]/10"
                          : "hover:bg-white/[0.045]"
                      }`}
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <span
                            className={`h-2.5 w-2.5 rounded-full ${
                              needsManagers
                                ? "bg-amber-300"
                                : draft.mode === "manual"
                                  ? "bg-white/28"
                                  : "bg-[#00f5a8]"
                            }`}
                          />
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-white">
                              {row.name}
                            </p>
                            <p className="mt-0.5 truncate text-xs text-white/40">
                              {row.caption}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className="rounded-full border border-white/10 bg-white/[0.055] px-3 py-1.5 text-xs font-semibold text-white/78">
                          {getModeShortLabel(draft.mode)}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-white/65">
                        {draft.mode === "manual"
                          ? "не назначаются автоматически"
                          : managerNames.length > 0
                            ? managerNames.join(", ")
                            : "не выбраны"}
                      </td>
                      <td className="px-5 py-4 text-white/65">
                        {draft.settings.max_open_deals_per_manager
                          ? `${draft.settings.max_open_deals_per_manager} сделок`
                          : "без лимита"}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <span
                          className={`inline-flex rounded-full px-3 py-1.5 text-xs font-semibold ${
                            needsManagers
                              ? "bg-amber-400/14 text-amber-100"
                              : "bg-[#00f5a8]/12 text-[#9fffe3]"
                          }`}
                        >
                          {needsManagers ? "нужна команда" : "готово"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {selectedRow ? (
          <aside className="rivn-card rivn-card-flat sticky top-6 h-fit overflow-hidden p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#00f5a8]">
                  Настройка правила
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-white">
                  {selectedRow.name}
                </h2>
                <p className="mt-1 text-sm text-white/45">
                  {selectedRow.caption}
                </p>
              </div>
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] text-white/70">
                <SlidersHorizontal className="h-5 w-5" />
              </span>
            </div>

            <div className="mt-5 space-y-3">
              {modeOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() =>
                    updateDraft(selectedRow.key, { mode: option.value })
                  }
                  className={`w-full rounded-[20px] border p-4 text-left transition duration-300 active:scale-[0.99] ${
                    selectedDraft.mode === option.value
                      ? "border-[#00f5a8]/45 bg-[#00f5a8]/14 text-white shadow-[0_18px_44px_rgba(0,245,168,0.10)]"
                      : "border-white/10 bg-white/[0.045] text-white/68 hover:border-white/18 hover:bg-white/[0.07] hover:text-white"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <CheckCircle2
                      className={`mt-0.5 h-5 w-5 ${
                        selectedDraft.mode === option.value
                          ? "text-[#00f5a8]"
                          : "text-white/28"
                      }`}
                    />
                    <div>
                      <p className="text-sm font-semibold">{option.label}</p>
                      <p className="mt-1 text-xs leading-5 opacity-70">
                        {option.description}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            <div className="mt-5 rounded-[22px] border border-white/10 bg-white/[0.045] p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-white">
                    Команда правила
                  </p>
                  <p className="mt-1 text-xs text-white/42">
                    Кто может получать заявки по этому правилу
                  </p>
                </div>
                <span className="rounded-full bg-white/[0.06] px-3 py-1 text-xs font-semibold text-white/55">
                  {selectedMembers.length}
                </span>
              </div>

              <div className="mt-4 max-h-64 space-y-2 overflow-y-auto pr-1">
                {activeMembers.map((member) => {
                  const isSelected = selectedDraft.target_member_ids.includes(
                    member.id
                  );
                  const isDisabled = selectedDisabledIds.includes(member.id);
                  const priorityIndex = selectedPriorityIds.indexOf(member.id);

                  return (
                    <div
                      key={member.id}
                      className={`rounded-2xl border p-2.5 transition ${
                        isSelected
                          ? "border-[#00f5a8]/28 bg-[#00f5a8]/10"
                          : "border-white/10 bg-white/[0.035]"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => toggleMember(selectedRow.key, member.id)}
                        disabled={selectedDraft.mode === "manual"}
                        className="flex w-full items-center justify-between gap-3 text-left disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        <span className="truncate text-sm font-semibold text-white/85">
                          {getWorkspaceMemberDisplayName(member)}
                        </span>
                        <span className="text-xs text-white/42">
                          {isSelected ? "выбран" : "добавить"}
                        </span>
                      </button>

                      {isSelected && selectedDraft.mode !== "manual" ? (
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              movePriorityMember(selectedRow.key, member.id, -1)
                            }
                            className="rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-xs font-semibold text-white/62 transition hover:text-white"
                          >
                            выше
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              movePriorityMember(selectedRow.key, member.id, 1)
                            }
                            className="rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-xs font-semibold text-white/62 transition hover:text-white"
                          >
                            ниже
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              toggleDisabledMember(selectedRow.key, member.id)
                            }
                            className={`rounded-lg px-2 py-1 text-xs font-semibold transition ${
                              isDisabled
                                ? "bg-amber-400/14 text-amber-100"
                                : "bg-[#00f5a8]/12 text-[#9fffe3]"
                            }`}
                          >
                            {isDisabled ? "пауза" : "активен"}
                          </button>
                          <span className="ml-auto text-xs text-white/35">
                            #{priorityIndex + 1}
                          </span>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-4 rounded-[22px] border border-white/10 bg-white/[0.045] p-4">
              <p className="text-sm font-semibold text-white">
                Лимит нагрузки
              </p>
              <p className="mt-1 text-xs text-white/42">
                Можно не заполнять, если менеджеры могут брать любое количество
                открытых сделок.
              </p>
              <input
                type="number"
                min={0}
                value={selectedDraft.settings.max_open_deals_per_manager ?? ""}
                onChange={(event) =>
                  updateDraftSettings(selectedRow.key, {
                    max_open_deals_per_manager: event.target.value
                      ? Number(event.target.value)
                      : null,
                  })
                }
                disabled={selectedDraft.mode === "manual"}
                className="rivn-field mt-3 h-12"
                placeholder="Без лимита"
              />
            </div>

            {selectedDraft.mode !== "manual" &&
            selectedDraft.target_member_ids.length === 0 ? (
              <div className="mt-4 flex gap-2 rounded-[20px] border border-amber-400/25 bg-amber-400/10 p-3 text-xs leading-5 text-amber-100">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  Автоматический режим включен, но команда не выбрана. Добавь
                  хотя бы одного менеджера, чтобы сохранить правило.
                </span>
              </div>
            ) : null}

            <button
              type="button"
              onClick={() => void saveRule(selectedRow)}
              disabled={
                upsertRuleMutation.isPending ||
                (selectedDraft.mode !== "manual" &&
                  selectedDraft.target_member_ids.length === 0)
              }
              className="mt-5 h-12 w-full rounded-full bg-[#00f5a8] px-5 text-sm font-semibold text-[#05111d] shadow-[0_18px_46px_rgba(0,245,168,0.22)] transition duration-300 hover:-translate-y-0.5 hover:bg-[#37ffc0] disabled:cursor-not-allowed disabled:opacity-45"
            >
              {upsertRuleMutation.isPending
                ? "Сохраняем..."
                : "Сохранить правило"}
            </button>
          </aside>
        ) : null}
      </section>

      <section className="rivn-card mt-5 p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/38">
              Контроль
            </p>
            <h2 className="mt-1 text-xl font-semibold text-white">
              Последние распределения
            </h2>
          </div>
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs font-semibold text-white/55">
            <History className="h-4 w-4" />
            {assignmentLogs.length} событий
          </span>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {assignmentLogs.length === 0 ? (
            <div className="rounded-[22px] border border-dashed border-white/10 bg-white/[0.035] p-5 text-sm text-white/45">
              Журнал пока пустой. Он начнет заполняться, когда в CRM появятся
              новые заявки или диалоги.
            </div>
          ) : (
            assignmentLogs.slice(0, 6).map((log) => {
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
                getPayloadString(
                  payload,
                  "source_kind",
                  "Источник не указан"
                );

              return (
                <div
                  key={log.id}
                  className="rounded-[22px] border border-white/10 bg-white/[0.04] p-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-[#00f5a8]/12 px-3 py-1 text-xs font-semibold text-[#9fffe3]">
                      {sourceName}
                    </span>
                    <span className="rounded-full bg-white/[0.06] px-3 py-1 text-xs font-semibold text-white/55">
                      {getModeLabel(mode as CrmAssignmentMode)}
                    </span>
                  </div>
                  <p className="mt-3 truncate text-sm font-semibold text-white">
                    {dealTitle}
                  </p>
                  <p className="mt-1 text-sm text-white/48">
                    Причина: {getAssignmentReasonText(reason)}
                  </p>
                  <div className="mt-3 grid gap-2 rounded-2xl bg-white/[0.04] p-3 text-xs text-white/45">
                    <p>
                      Назначено:{" "}
                      <span className="font-semibold text-white/82">
                        {selectedNames.length > 0
                          ? selectedNames.join(", ")
                          : "без ответственного"}
                      </span>
                    </p>
                    <p>
                      Команда правила:{" "}
                      <span className="font-semibold text-white/72">
                        {targetNames.length > 0
                          ? targetNames.join(", ")
                          : "не выбрана"}
                      </span>
                    </p>
                    <p>
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
