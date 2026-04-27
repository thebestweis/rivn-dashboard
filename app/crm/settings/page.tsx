"use client";

import Link from "next/link";
import { ArrowLeft, CheckCircle2, Route, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  canAccessCrm,
  canManageCrmSettings,
  isAppRole,
} from "../../lib/permissions";
import {
  useCrmBootstrapQuery,
  useUpsertCrmAssignmentRuleMutation,
} from "../../lib/queries/use-crm-query";
import { useActiveWorkspaceMembers } from "../../lib/queries/use-workspace-members-query";
import { useAppContextState } from "../../providers/app-context-provider";
import { CustomSelect } from "../../components/ui/custom-select";
import { getWorkspaceMemberDisplayName } from "../../lib/supabase/workspace-members";
import type { CrmAssignmentMode } from "../../lib/supabase/crm";

type AssignmentDraft = {
  mode: CrmAssignmentMode;
  target_member_ids: string[];
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

function emptyDraft(): AssignmentDraft {
  return {
    mode: "manual",
    target_member_ids: [],
  };
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

  function toggleMember(key: string, memberId: string) {
    const draft = drafts[key] ?? emptyDraft();
    const exists = draft.target_member_ids.includes(memberId);

    updateDraft(key, {
      target_member_ids: exists
        ? draft.target_member_ids.filter((id) => id !== memberId)
        : [...draft.target_member_ids, memberId],
    });
  }

  async function saveRule(row: { key: string; kind: string | null }) {
    const draft = drafts[row.key] ?? emptyDraft();

    await upsertRuleMutation.mutateAsync({
      source_kind: row.kind,
      mode: draft.mode,
      target_member_ids:
        draft.mode === "manual" ? [] : draft.target_member_ids,
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
      </section>

      <section className="mt-5 grid gap-4">
        {sourceRows.map((row) => {
          const draft = drafts[row.key] ?? emptyDraft();
          const selectedMembers = activeMembers.filter((member) =>
            draft.target_member_ids.includes(member.id)
          );

          return (
            <div
              key={row.key}
              className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#121827]"
            >
              <div className="grid gap-5 xl:grid-cols-[1fr_280px]">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-200">
                      <Users className="h-5 w-5" />
                    </span>
                    <div>
                      <h2 className="text-lg font-semibold">{row.name}</h2>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {row.kind
                          ? `Источник: ${row.kind}`
                          : "Используется, если для источника нет отдельного правила"}
                      </p>
                    </div>
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
                    Сохранить правило
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </section>
    </main>
  );
}
