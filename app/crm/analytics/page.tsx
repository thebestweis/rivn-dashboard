"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  Clock3,
  LineChart as LineChartIcon,
  MessageSquareText,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { canAccessCrm, isAppRole } from "../../lib/permissions";
import {
  useCrmBootstrapQuery,
  useCrmInboxQuery,
  useCrmSalesPlansQuery,
  useCrmStageHistoryQuery,
  useUpsertCrmSalesPlanMutation,
} from "../../lib/queries/use-crm-query";
import { useActiveWorkspaceMembers } from "../../lib/queries/use-workspace-members-query";
import { useAppContextState } from "../../providers/app-context-provider";
import { getWorkspaceMemberDisplayName } from "../../lib/supabase/workspace-members";
import { CustomSelect } from "../../components/ui/custom-select";

const CHART_COLORS = ["#7C3AED", "#10B981", "#F59E0B", "#0EA5E9", "#F43F5E"];
const DEFAULT_CRM_PLAN = {
  revenue: 500000,
  deals: 10,
  leads: 40,
};

type CrmPlanMetric = "revenue" | "deals" | "leads";
type CrmPlan = typeof DEFAULT_CRM_PLAN;
type CrmAnalyticsTab = "overview" | "planfact";

function money(value: number) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(value);
}

function percent(value: number) {
  if (!Number.isFinite(value)) return "0%";
  return `${Math.round(value)}%`;
}

function toInputDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getCurrentMonthRange() {
  const now = new Date();
  return {
    from: toInputDate(new Date(now.getFullYear(), now.getMonth(), 1)),
    to: toInputDate(now),
  };
}

function getPreviousPeriodRange(from: string, to: string) {
  const fromDate = new Date(`${from}T00:00:00`);
  const toDate = new Date(`${to}T00:00:00`);
  const dayMs = 24 * 60 * 60 * 1000;
  const daysCount = Math.max(
    1,
    Math.round((toDate.getTime() - fromDate.getTime()) / dayMs) + 1
  );
  const previousTo = new Date(fromDate.getTime() - dayMs);
  const previousFrom = new Date(previousTo.getTime() - (daysCount - 1) * dayMs);

  return {
    from: toInputDate(previousFrom),
    to: toInputDate(previousTo),
  };
}

function isInRange(value: string | null | undefined, from: string, to: string) {
  if (!value) return false;
  const time = new Date(value).getTime();
  const fromTime = new Date(`${from}T00:00:00`).getTime();
  const toTime = new Date(`${to}T23:59:59`).getTime();

  return time >= fromTime && time <= toTime;
}

function getMonthKey(value: string) {
  return value.slice(0, 7);
}

function getMonthRange(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  const lastDay = new Date(year, month, 0).getDate();

  return {
    from: `${monthKey}-01`,
    to: `${monthKey}-${String(lastDay).padStart(2, "0")}`,
  };
}

function monthLabel(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);

  return new Date(year, month - 1, 1).toLocaleDateString("ru-RU", {
    month: "long",
    year: "numeric",
  });
}

function buildDateBuckets(from: string, to: string) {
  const buckets: Array<{ key: string; label: string }> = [];
  const cursor = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);

  while (cursor.getTime() <= end.getTime()) {
    buckets.push({
      key: toInputDate(cursor),
      label: cursor.toLocaleDateString("ru-RU", {
        day: "2-digit",
        month: "2-digit",
      }),
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  return buckets;
}

function trendPercent(current: number, previous: number) {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return 0;
  if (previous === 0) return current > 0 ? 100 : 0;

  return ((current - previous) / previous) * 100;
}

function trendLabel(current: number, previous: number) {
  const trend = trendPercent(current, previous);
  const sign = trend > 0 ? "+" : "";

  return `${sign}${percent(trend)} к прошлому периоду`;
}

function formatMinutes(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "0 мин";
  if (value < 60) return `${Math.round(value)} мин`;

  const hours = Math.floor(value / 60);
  const minutes = Math.round(value % 60);

  return minutes > 0 ? `${hours} ч ${minutes} мин` : `${hours} ч`;
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getInitials(value: string) {
  return value
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

export default function CrmAnalyticsPage() {
  const { role, isReady } = useAppContextState();
  const currentRole = isAppRole(role) ? role : null;
  const hasAccess = currentRole ? canAccessCrm(currentRole) : false;
  const currentMonthRange = getCurrentMonthRange();
  const [rangeFrom, setRangeFrom] = useState(currentMonthRange.from);
  const [rangeTo, setRangeTo] = useState(currentMonthRange.to);
  const [planMonth, setPlanMonth] = useState(getMonthKey(currentMonthRange.from));
  const [planMetric, setPlanMetric] = useState<CrmPlanMetric>("revenue");
  const [activeTab, setActiveTab] = useState<CrmAnalyticsTab>("overview");
  const [selectedPipelineId, setSelectedPipelineId] = useState("all");
  const [selectedSourceId, setSelectedSourceId] = useState("all");
  const [selectedManagerId, setSelectedManagerId] = useState("all");

  const { data, isLoading, error } = useCrmBootstrapQuery(isReady && hasAccess, {
    status: "all",
  });
  const { data: inboxItems = [] } = useCrmInboxQuery(isReady && hasAccess);
  const { data: crmSalesPlans = [] } = useCrmSalesPlansQuery(isReady && hasAccess);
  const { data: stageHistory = [] } = useCrmStageHistoryQuery(
    isReady && hasAccess,
    {
      from: rangeFrom,
      to: rangeTo,
      pipelineId: selectedPipelineId,
      sourceId: selectedSourceId,
      assigneeId: selectedManagerId,
    }
  );
  const upsertSalesPlanMutation = useUpsertCrmSalesPlanMutation();
  const { activeMembers = [] } = useActiveWorkspaceMembers(isReady && hasAccess);

  const deals = data?.deals ?? [];
  const pipelines = data?.pipelines ?? [];
  const sources = data?.sources ?? [];
  const stages = data?.stages ?? [];
  function updateCrmPlan(metric: CrmPlanMetric, value: number) {
    const nextValue = Number.isFinite(value) ? Math.max(0, value) : 0;
    const nextPlan = {
      ...currentPlan,
      [metric]: nextValue,
    };

    upsertSalesPlanMutation.mutate({
      month: planMonth,
      revenue_plan: nextPlan.revenue,
      won_deals_plan: nextPlan.deals,
      leads_plan: nextPlan.leads,
    });
  }

  const analytics = useMemo(() => {
    const filteredDeals = deals.filter((deal) => {
      const matchesPipeline =
        selectedPipelineId === "all" || deal.pipeline_id === selectedPipelineId;
      const matchesSource =
        selectedSourceId === "all" || deal.source_id === selectedSourceId;
      const matchesManager =
        selectedManagerId === "all" ||
        deal.assignees.some(
          (assignee) => assignee.workspace_member_id === selectedManagerId
        );

      return matchesPipeline && matchesSource && matchesManager;
    });
    const periodDeals = filteredDeals.filter((deal) =>
      isInRange(deal.created_at, rangeFrom, rangeTo)
    );
    const periodWonDeals = filteredDeals.filter(
      (deal) =>
        deal.status === "won" && isInRange(deal.updated_at, rangeFrom, rangeTo)
    );
    const periodLostDeals = filteredDeals.filter(
      (deal) =>
        deal.status === "lost" && isInRange(deal.updated_at, rangeFrom, rangeTo)
    );
    const openDeals = periodDeals.filter((deal) => deal.status === "open");
    const closedCount = periodWonDeals.length + periodLostDeals.length;
    const periodValue = periodDeals.reduce(
      (sum, deal) => sum + (deal.service_amount ?? 0),
      0
    );
    const openValue = openDeals.reduce(
      (sum, deal) => sum + (deal.service_amount ?? 0),
      0
    );
    const wonValue = periodWonDeals.reduce(
      (sum, deal) => sum + (deal.service_amount ?? 0),
      0
    );
    const now = Date.now();
    const overdueDeals = filteredDeals.filter(
      (deal) =>
        deal.status === "open" &&
        deal.next_contact_at &&
        new Date(deal.next_contact_at).getTime() < now
    );
    const withoutNextContact = filteredDeals.filter(
      (deal) => deal.status === "open" && !deal.next_contact_at
    );
    const waitingDialogs = inboxItems.filter(
      (item) => item.needsReply && item.minutesWaiting >= 30
    );

    const bySource = sources
      .filter((source) => selectedSourceId === "all" || source.id === selectedSourceId)
      .map((source) => {
        const sourceDeals = periodDeals.filter(
          (deal) => deal.source_id === source.id
        );
        const sourceWon = periodWonDeals.filter(
          (deal) => deal.source_id === source.id
        );
        const sourceLost = periodLostDeals.filter(
          (deal) => deal.source_id === source.id
        );
        const sourceClosed = sourceWon.length + sourceLost.length;

        return {
          id: source.id,
          name: source.name,
          count: sourceDeals.length,
          open: sourceDeals.filter((deal) => deal.status === "open").length,
          won: sourceWon.length,
          value: sourceDeals.reduce(
            (sum, deal) => sum + (deal.service_amount ?? 0),
            0
          ),
          conversion: sourceClosed ? (sourceWon.length / sourceClosed) * 100 : 0,
        };
      })
      .filter((item) => item.count > 0 || item.won > 0)
      .sort((a, b) => b.value - a.value);

    const byManager = activeMembers
      .filter((member) => selectedManagerId === "all" || member.id === selectedManagerId)
      .map((member) => {
        const managerDeals = periodDeals.filter((deal) =>
          deal.assignees.some(
            (assignee) => assignee.workspace_member_id === member.id
          )
        );
        const managerWon = periodWonDeals.filter((deal) =>
          deal.assignees.some(
            (assignee) => assignee.workspace_member_id === member.id
          )
        );
        const managerLost = periodLostDeals.filter((deal) =>
          deal.assignees.some(
            (assignee) => assignee.workspace_member_id === member.id
          )
        );
        const managerClosed = managerWon.length + managerLost.length;
        const managerDialogs = inboxItems.filter((item) =>
          item.deal.assignees.some(
            (assignee) => assignee.workspace_member_id === member.id
          )
        );
        const waitingDialogs = managerDialogs.filter(
          (item) => item.needsReply && item.minutesWaiting >= 30
        );
        const wonValue = managerWon.reduce(
          (sum, deal) => sum + (deal.service_amount ?? 0),
          0
        );

        return {
          id: member.id,
          name: getWorkspaceMemberDisplayName(member),
          avatarUrl: member.avatar_url,
          title: member.profile_title,
          count: managerDeals.length,
          open: managerDeals.filter((deal) => deal.status === "open").length,
          won: managerWon.length,
          lost: managerLost.length,
          value: managerDeals.reduce(
            (sum, deal) => sum + (deal.service_amount ?? 0),
            0
          ),
          wonValue,
          averageCheck: managerWon.length ? wonValue / managerWon.length : 0,
          conversion: managerClosed ? (managerWon.length / managerClosed) * 100 : 0,
          waitingDialogs: waitingDialogs.length,
          averageWaitingMinutes: waitingDialogs.length
            ? waitingDialogs.reduce((sum, item) => sum + item.minutesWaiting, 0) /
              waitingDialogs.length
            : 0,
        };
      })
      .filter((item) => item.count > 0 || item.won > 0)
      .sort((a, b) => b.wonValue - a.wonValue);

    const dailyDynamics = buildDateBuckets(rangeFrom, rangeTo).map((bucket) => {
      const createdDeals = periodDeals.filter((deal) =>
        deal.created_at.startsWith(bucket.key)
      );
      const wonDeals = periodWonDeals.filter((deal) =>
        deal.updated_at.startsWith(bucket.key)
      );

      return {
        date: bucket.label,
        deals: createdDeals.length,
        wonValue: wonDeals.reduce(
          (sum, deal) => sum + (deal.service_amount ?? 0),
          0
        ),
      };
    });

    const byStage = stages
      .map((stage) => {
        const stageDeals = periodDeals.filter((deal) => deal.stage_id === stage.id);
        return {
          id: stage.id,
          name: stage.name,
          deals: stageDeals.length,
          value: stageDeals.reduce(
            (sum, deal) => sum + (deal.service_amount ?? 0),
            0
          ),
        };
      })
      .filter((item) => item.deals > 0);

    const stageById = new Map(stages.map((stage) => [stage.id, stage]));
    const pipelineNameById = new Map(
      pipelines.map((pipeline) => [pipeline.id, pipeline.name])
    );
    const latestStageMoveByDeal = new Map<string, string>();

    for (const movement of stageHistory) {
      const current = latestStageMoveByDeal.get(movement.deal_id);

      if (
        !current ||
        new Date(movement.moved_at).getTime() > new Date(current).getTime()
      ) {
        latestStageMoveByDeal.set(movement.deal_id, movement.moved_at);
      }
    }

    const stuckDeals = filteredDeals
      .filter((deal) => deal.status === "open")
      .map((deal) => {
        const stage = stageById.get(deal.stage_id);
        const lastMoveAt =
          latestStageMoveByDeal.get(deal.id) ?? deal.updated_at ?? deal.created_at;
        const daysInStage = Math.max(
          0,
          Math.floor((now - new Date(lastMoveAt).getTime()) / 86_400_000)
        );

        return {
          id: deal.id,
          title: deal.title,
          clientName: deal.client_name,
          value: deal.service_amount ?? 0,
          stageName: stage?.name ?? "Этап не найден",
          pipelineName: pipelineNameById.get(deal.pipeline_id) ?? "CRM",
          daysInStage,
          lastMoveAt,
        };
      })
      .filter((deal) => deal.daysInStage >= 3)
      .sort((a, b) => b.daysInStage - a.daysInStage)
      .slice(0, 8);
    const stageConversions = pipelines
      .map((pipeline) => {
        const pipelineStages = stages
          .filter((stage) => stage.pipeline_id === pipeline.id)
          .sort((a, b) => a.sort_order - b.sort_order);
        const pipelineDeals = periodDeals.filter((deal) => {
          const stage = stageById.get(deal.stage_id);

          return stage?.pipeline_id === pipeline.id;
        });
        const pipelineHistory = stageHistory.filter(
          (item) =>
            item.to_pipeline_id === pipeline.id || item.from_pipeline_id === pipeline.id
        );
        const hasHistoricalData = pipelineHistory.length > 0;
        const steps = pipelineStages.slice(0, -1).map((fromStage, index) => {
          const toStage = pipelineStages[index + 1];
          const fromReached = hasHistoricalData
            ? new Set(
                pipelineHistory
                  .filter(
                    (item) =>
                      item.to_stage_id === fromStage.id ||
                      item.from_stage_id === fromStage.id
                  )
                  .map((item) => item.deal_id)
              ).size
            : pipelineDeals.filter((deal) => {
                const stage = stageById.get(deal.stage_id);

                return stage ? stage.sort_order >= fromStage.sort_order : false;
              }).length;
          const toReached = hasHistoricalData
            ? new Set(
                pipelineHistory
                  .filter(
                    (item) =>
                      item.from_stage_id === fromStage.id &&
                      item.to_stage_id === toStage.id
                  )
                  .map((item) => item.deal_id)
              ).size
            : pipelineDeals.filter((deal) => {
                const stage = stageById.get(deal.stage_id);

                return stage ? stage.sort_order >= toStage.sort_order : false;
              }).length;
          const lost = Math.max(0, fromReached - toReached);

          return {
            id: `${fromStage.id}-${toStage.id}`,
            fromName: fromStage.name,
            toName: toStage.name,
            fromReached,
            toReached,
            lost,
            conversion: fromReached ? (toReached / fromReached) * 100 : 0,
          };
        });
        const weakestStep =
          steps
            .filter((step) => step.fromReached > 0)
            .sort((a, b) => a.conversion - b.conversion)[0] ?? null;

        return {
          id: pipeline.id,
          name: pipeline.name,
          total: hasHistoricalData
            ? new Set(pipelineHistory.map((item) => item.deal_id)).size
            : pipelineDeals.length,
          hasHistoricalData,
          steps,
          weakestStep,
        };
      })
      .filter((pipeline) => pipeline.steps.length > 0);

    return {
      total: periodDeals.length,
      open: openDeals.length,
      won: periodWonDeals.length,
      lost: periodLostDeals.length,
      periodValue,
      openValue,
      wonValue,
      conversion: closedCount ? (periodWonDeals.length / closedCount) * 100 : 0,
      overdueDeals,
      withoutNextContact,
      waitingDialogs,
      bySource,
      byManager,
      dailyDynamics,
      byStage,
      stuckDeals,
      stageConversions,
    };
  }, [
    activeMembers,
    deals,
    inboxItems,
    pipelines,
    rangeFrom,
    rangeTo,
    selectedManagerId,
    selectedPipelineId,
    selectedSourceId,
    sources,
    stageHistory,
    stages,
  ]);

  const previousAnalytics = useMemo(() => {
    const previousRange = getPreviousPeriodRange(rangeFrom, rangeTo);
    const filteredDeals = deals.filter((deal) => {
      const matchesPipeline =
        selectedPipelineId === "all" || deal.pipeline_id === selectedPipelineId;
      const matchesSource =
        selectedSourceId === "all" || deal.source_id === selectedSourceId;
      const matchesManager =
        selectedManagerId === "all" ||
        deal.assignees.some(
          (assignee) => assignee.workspace_member_id === selectedManagerId
        );

      return matchesPipeline && matchesSource && matchesManager;
    });
    const periodDeals = filteredDeals.filter((deal) =>
      isInRange(deal.created_at, previousRange.from, previousRange.to)
    );
    const periodWonDeals = filteredDeals.filter(
      (deal) =>
        deal.status === "won" &&
        isInRange(deal.updated_at, previousRange.from, previousRange.to)
    );
    const periodLostDeals = filteredDeals.filter(
      (deal) =>
        deal.status === "lost" &&
        isInRange(deal.updated_at, previousRange.from, previousRange.to)
    );
    const closedCount = periodWonDeals.length + periodLostDeals.length;

    return {
      total: periodDeals.length,
      periodValue: periodDeals.reduce(
        (sum, deal) => sum + (deal.service_amount ?? 0),
        0
      ),
      won: periodWonDeals.length,
      wonValue: periodWonDeals.reduce(
        (sum, deal) => sum + (deal.service_amount ?? 0),
        0
      ),
      conversion: closedCount ? (periodWonDeals.length / closedCount) * 100 : 0,
    };
  }, [
    deals,
    rangeFrom,
    rangeTo,
    selectedManagerId,
    selectedPipelineId,
    selectedSourceId,
  ]);

  const crmPlans = useMemo<Record<string, CrmPlan>>(
    () =>
      Object.fromEntries(
        crmSalesPlans.map((plan) => [
          plan.month,
          {
            revenue: plan.revenue_plan,
            deals: plan.won_deals_plan,
            leads: plan.leads_plan,
          },
        ])
      ),
    [crmSalesPlans]
  );
  const currentPlan = crmPlans[planMonth] ?? DEFAULT_CRM_PLAN;
  const planMonthRange = getMonthRange(planMonth);
  const planMonthDeals = deals.filter((deal) =>
    isInRange(deal.created_at, planMonthRange.from, planMonthRange.to)
  );
  const planMonthWonDeals = deals.filter(
    (deal) =>
      deal.status === "won" &&
      isInRange(deal.updated_at, planMonthRange.from, planMonthRange.to)
  );
  const planMonthWonValue = planMonthWonDeals.reduce(
    (sum, deal) => sum + (deal.service_amount ?? 0),
    0
  );
  const planRows: Array<{
    key: CrmPlanMetric;
    label: string;
    plan: number;
    fact: number;
    format: (value: number) => string;
  }> = [
    {
      key: "revenue",
      label: "Выручка продаж",
      plan: currentPlan.revenue,
      fact: planMonthWonValue,
      format: money,
    },
    {
      key: "deals",
      label: "Выигранные сделки",
      plan: currentPlan.deals,
      fact: planMonthWonDeals.length,
      format: (value) => String(Math.round(value)),
    },
    {
      key: "leads",
      label: "Новые заявки",
      plan: currentPlan.leads,
      fact: planMonthDeals.length,
      format: (value) => String(Math.round(value)),
    },
  ];
  const selectedPlanRow =
    planRows.find((row) => row.key === planMetric) ?? planRows[0];
  const planFactData = [
    { name: "План", value: selectedPlanRow.plan },
    { name: "Факт", value: selectedPlanRow.fact },
  ];
  const detailCards = [
    { label: "Новые сделки", value: analytics.total, hint: "Созданы за выбранный период" },
    { label: "Сделки в работе", value: analytics.open, hint: "Новые сделки, которые еще не закрыты" },
    { label: "Выиграно", value: analytics.won, hint: "Перешли в успешные продажи" },
    { label: "Потеряно", value: analytics.lost, hint: "Закрыты без оплаты" },
    { label: "Потенциал периода", value: money(analytics.periodValue), hint: "Сумма услуг в новых сделках" },
    { label: "Активный потенциал", value: money(analytics.openValue), hint: "Сумма сделок, которые еще в работе" },
    { label: "Средний чек продажи", value: money(analytics.won ? analytics.wonValue / analytics.won : 0), hint: "Средняя сумма выигранной сделки" },
    { label: "Конверсия закрытых", value: percent(analytics.conversion), hint: "Доля выигранных среди закрытых" },
    { label: "Просрочен контакт", value: analytics.overdueDeals.length, hint: "Нужно срочно вернуться к клиенту" },
    { label: "Нет следующего шага", value: analytics.withoutNextContact.length, hint: "Сделки без даты следующего контакта" },
    { label: "Клиент ждёт 30+ мин", value: analytics.waitingDialogs.length, hint: "Диалоги, где нужен быстрый ответ" },
    { label: "Новые продажи", value: money(analytics.wonValue), hint: "Выручка по выигранным сделкам" },
  ];
  const overviewSignals = [
    analytics.waitingDialogs.length > 0
      ? {
          title: "Клиенты ждут ответа",
          text: `${analytics.waitingDialogs.length} диалогов ждут 30+ минут. Это прямой риск потери заявки.`,
          tone: "amber",
        }
      : null,
    analytics.overdueDeals.length > 0
      ? {
          title: "Есть просроченные контакты",
          text: `${analytics.overdueDeals.length} сделок требуют связи с клиентом. Лучше вернуть их в работу сегодня.`,
          tone: "rose",
        }
      : null,
    analytics.withoutNextContact.length > 0
      ? {
          title: "Нет следующего шага",
          text: `${analytics.withoutNextContact.length} открытых сделок без даты следующего контакта. Менеджерам сложно управлять такими заявками.`,
          tone: "violet",
        }
      : null,
    trendPercent(analytics.wonValue, previousAnalytics.wonValue) < -15
      ? {
          title: "Продажи просели",
          text: `Выручка по новым продажам ниже прошлого периода на ${percent(
            Math.abs(trendPercent(analytics.wonValue, previousAnalytics.wonValue))
          )}. Стоит проверить источники и работу по переговорам.`,
          tone: "rose",
        }
      : null,
  ].filter(Boolean) as Array<{ title: string; text: string; tone: string }>;
  const planSignals = planRows
    .map((row) => {
      const progress = row.plan > 0 ? (row.fact / row.plan) * 100 : 0;

      if (row.plan <= 0) {
        return {
          title: `${row.label}: план не задан`,
          text: "Заполни план, чтобы система могла сравнивать факт с целью.",
          tone: "violet",
        };
      }

      if (progress >= 100) {
        return {
          title: `${row.label}: план выполнен`,
          text: `Факт ${row.format(row.fact)} при плане ${row.format(row.plan)}. Отличный сигнал для масштабирования.`,
          tone: "emerald",
        };
      }

      if (progress < 50) {
        return {
          title: `${row.label}: сильное отставание`,
          text: `Выполнено только ${percent(progress)}. Нужно усилить заявки, обработку или конверсию.`,
          tone: "rose",
        };
      }

      return {
        title: `${row.label}: в работе`,
        text: `Выполнено ${percent(progress)}. Держим фокус на доведении до плана.`,
        tone: "amber",
      };
    })
    .slice(0, 3);
  const topManager = analytics.byManager[0];
  const teamSummary = {
    managers: analytics.byManager.length,
    wonValue: analytics.byManager.reduce((sum, manager) => sum + manager.wonValue, 0),
    wonDeals: analytics.byManager.reduce((sum, manager) => sum + manager.won, 0),
    waitingDialogs: analytics.byManager.reduce(
      (sum, manager) => sum + manager.waitingDialogs,
      0
    ),
  };
  const attentionItems = [
    ...analytics.waitingDialogs.slice(0, 3).map((item) => ({
      id: `dialog-${item.conversation.id}`,
      dealId: item.deal.id,
      tab: "dialogs",
      title: item.deal.title,
      label: "Клиент ждёт ответа",
      meta: `${formatMinutes(item.minutesWaiting)} без ответа · ${item.deal.client_name || "Клиент не указан"}`,
      tone: "amber",
    })),
    ...analytics.overdueDeals.slice(0, 3).map((deal) => ({
      id: `overdue-${deal.id}`,
      dealId: deal.id,
      tab: "tasks",
      title: deal.title,
      label: "Просрочен контакт",
      meta: `${deal.next_contact_at ? formatDateTime(deal.next_contact_at) : "Дата не указана"} · ${deal.client_name || "Клиент не указан"}`,
      tone: "rose",
    })),
    ...analytics.withoutNextContact.slice(0, 3).map((deal) => ({
      id: `next-contact-${deal.id}`,
      dealId: deal.id,
      tab: "tasks",
      title: deal.title,
      label: "Нет следующего шага",
      meta: `${money(deal.service_amount ?? 0)} · ${deal.client_name || "Клиент не указан"}`,
      tone: "violet",
    })),
  ].slice(0, 6);
  const stageMovementAnalytics = useMemo(() => {
    const stageNameById = new Map(stages.map((stage) => [stage.id, stage.name]));
    const pipelineNameById = new Map(
      pipelines.map((pipeline) => [pipeline.id, pipeline.name])
    );
    const movements = stageHistory
      .map((item) => ({
        id: item.id,
        dealId: item.deal_id,
        pipelineName: pipelineNameById.get(item.to_pipeline_id) ?? "CRM",
        fromName: item.from_stage_id
          ? stageNameById.get(item.from_stage_id) ?? "Предыдущий этап"
          : "Создание сделки",
        toName: stageNameById.get(item.to_stage_id) ?? "Новый этап",
        movedAt: item.moved_at,
      }))
      .sort(
        (a, b) => new Date(b.movedAt).getTime() - new Date(a.movedAt).getTime()
      );
    const transitionMap = new Map<
      string,
      {
        id: string;
        fromName: string;
        toName: string;
        pipelineName: string;
        count: number;
      }
    >();

    for (const movement of movements) {
      const key = `${movement.pipelineName}:${movement.fromName}:${movement.toName}`;
      const current = transitionMap.get(key);

      transitionMap.set(key, {
        id: key,
        fromName: movement.fromName,
        toName: movement.toName,
        pipelineName: movement.pipelineName,
        count: (current?.count ?? 0) + 1,
      });
    }

    return {
      total: movements.length,
      uniqueDeals: new Set(movements.map((movement) => movement.dealId)).size,
      recent: movements.slice(0, 6),
      topTransitions: Array.from(transitionMap.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, 5),
    };
  }, [pipelines, stageHistory, stages]);
  const pipelineOptions = [
    { value: "all", label: "Все воронки" },
    ...pipelines.map((pipeline) => ({
      value: pipeline.id,
      label: pipeline.name,
    })),
  ];
  const sourceOptions = [
    { value: "all", label: "Все источники" },
    ...sources.map((source) => ({
      value: source.id,
      label: source.name,
    })),
  ];
  const managerOptions = [
    { value: "all", label: "Все ответственные" },
    ...activeMembers.map((member) => ({
      value: member.id,
      label: getWorkspaceMemberDisplayName(member),
    })),
  ];

  if (!isReady || isLoading) {
    return (
      <main className="min-h-screen bg-slate-50 p-5 text-slate-950 dark:bg-[#0B0F1A] dark:text-white lg:p-8">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-[#121827]">
          CRM-аналитика загружается...
        </div>
      </main>
    );
  }

  if (!hasAccess) {
    return (
      <main className="min-h-screen bg-slate-50 p-5 text-slate-950 dark:bg-[#0B0F1A] dark:text-white lg:p-8">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-[#121827]">
          Нет доступа к CRM-аналитике.
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 p-5 text-slate-950 dark:bg-[#0B0F1A] dark:text-white lg:p-8">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-[#121827]">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <Link
              href="/crm"
              className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-violet-700 dark:text-slate-400 dark:hover:text-violet-200"
            >
              <ArrowLeft className="h-4 w-4" />
              Назад в CRM
            </Link>
            <p className="mt-5 text-sm font-semibold uppercase tracking-[0.18em] text-violet-600 dark:text-violet-300">
              CRM Analytics
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">
              Продажи и маркетинг
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500 dark:text-slate-400">
              По умолчанию показан текущий календарный месяц. Период можно
              менять, чтобы смотреть заявки, новые продажи, источники и нагрузку
              менеджеров за нужные даты.
            </p>
          </div>

          {activeTab === "overview" ? (
          <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-[#0B0F1A] sm:grid-cols-2">
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              С даты
              <input
                type="date"
                value={rangeFrom}
                onChange={(event) => setRangeFrom(event.target.value)}
                className="mt-2 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-violet-400 dark:border-white/10 dark:bg-[#121827] dark:text-white"
              />
            </label>
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              По дату
              <input
                type="date"
                value={rangeTo}
                onChange={(event) => setRangeTo(event.target.value)}
                className="mt-2 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-violet-400 dark:border-white/10 dark:bg-[#121827] dark:text-white"
              />
            </label>
            <button
              type="button"
              onClick={() => {
                const range = getCurrentMonthRange();
                setRangeFrom(range.from);
                setRangeTo(range.to);
              }}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-3 text-sm font-semibold text-violet-700 transition hover:border-violet-300 dark:border-violet-500/20 dark:bg-violet-500/10 dark:text-violet-200 sm:col-span-2"
            >
              <CalendarDays className="h-4 w-4" />
              Текущий месяц
            </button>
          </div>
          ) : null}
        </div>

        <div className="mt-5 flex w-fit flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-1 dark:border-white/10 dark:bg-white/[0.04]">
          {[
            { id: "overview" as const, label: "Обзор" },
            { id: "planfact" as const, label: "План / факт" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                activeTab === tab.id
                  ? "bg-violet-600 text-white shadow-lg shadow-violet-600/20"
                  : "text-slate-500 hover:text-slate-950 dark:text-white/60 dark:hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
          <Link
            href="/crm/team"
            className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-500 transition hover:text-slate-950 dark:text-white/60 dark:hover:text-white"
          >
            Команда
          </Link>
        </div>

        {error ? (
          <div className="mt-5 rounded-2xl border border-rose-300 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
            {error instanceof Error ? error.message : "CRM-аналитика не загрузилась"}
          </div>
        ) : null}

        {activeTab === "overview" ? (
        <>
        <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-[#0B0F1A]">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
            <label className="flex-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
              Воронка
              <CustomSelect
                value={selectedPipelineId}
                options={pipelineOptions}
                onChange={setSelectedPipelineId}
                className="mt-2"
                buttonClassName="h-10 rounded-xl"
              />
            </label>
            <label className="flex-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
              Источник
              <CustomSelect
                value={selectedSourceId}
                options={sourceOptions}
                onChange={setSelectedSourceId}
                className="mt-2"
                buttonClassName="h-10 rounded-xl"
              />
            </label>
            <label className="flex-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
              Ответственный
              <CustomSelect
                value={selectedManagerId}
                options={managerOptions}
                onChange={setSelectedManagerId}
                className="mt-2"
                buttonClassName="h-10 rounded-xl"
              />
            </label>
            <button
              type="button"
              onClick={() => {
                setSelectedPipelineId("all");
                setSelectedSourceId("all");
                setSelectedManagerId("all");
              }}
              className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 transition hover:border-violet-200 hover:text-violet-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-white/70 dark:hover:text-white"
            >
              Сбросить
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {[
            {
              label: "Новых сделок",
              value: analytics.total,
              hint: `В работе: ${analytics.open}`,
              trend: trendLabel(analytics.total, previousAnalytics.total),
              icon: Target,
            },
            {
              label: "Потенциал периода",
              value: money(analytics.periodValue),
              hint: `Активный потенциал: ${money(analytics.openValue)}`,
              trend: trendLabel(
                analytics.periodValue,
                previousAnalytics.periodValue
              ),
              icon: TrendingUp,
            },
            {
              label: "Новые продажи",
              value: money(analytics.wonValue),
              hint: `Выиграно сделок: ${analytics.won}`,
              trend: trendLabel(analytics.wonValue, previousAnalytics.wonValue),
              icon: LineChartIcon,
            },
            {
              label: "Конверсия закрытых",
              value: percent(analytics.conversion),
              hint: `Потеряно: ${analytics.lost}`,
              trend: trendLabel(
                analytics.conversion,
                previousAnalytics.conversion
              ),
              icon: Clock3,
            },
          ].map((card) => {
            const Icon = card.icon;

            return (
              <div
                key={card.label}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm dark:border-white/10 dark:bg-[#0B0F1A]"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                    {card.label}
                  </p>
                  <Icon className="h-4 w-4 text-violet-500" />
                </div>
                <p className="mt-3 text-2xl font-semibold">{card.value}</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {card.hint}
                </p>
                <p
                  className={`mt-3 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                    card.trend.startsWith("+")
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200"
                      : card.trend.startsWith("-")
                        ? "bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-200"
                        : "bg-slate-100 text-slate-600 dark:bg-white/5 dark:text-slate-300"
                  }`}
                >
                  {card.trend}
                </p>
              </div>
            );
          })}
        </div>
        </>
        ) : null}
      </section>

      {activeTab === "overview" ? (
      overviewSignals.length > 0 ? (
      <section className="mt-5 grid gap-3 lg:grid-cols-3">
        {overviewSignals.map((signal) => (
          <div
            key={signal.title}
            className={`rounded-3xl border p-5 shadow-sm ${
              signal.tone === "rose"
                ? "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-100"
                : signal.tone === "amber"
                  ? "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-100"
                  : "border-violet-200 bg-violet-50 text-violet-900 dark:border-violet-500/20 dark:bg-violet-500/10 dark:text-violet-100"
            }`}
          >
            <p className="text-sm font-semibold">{signal.title}</p>
            <p className="mt-2 text-sm opacity-80">{signal.text}</p>
          </div>
        ))}
      </section>
      ) : (
      <section className="mt-5 rounded-3xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-900 shadow-sm dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-100">
        <p className="text-sm font-semibold">Критичных сигналов нет</p>
        <p className="mt-2 text-sm opacity-80">
          По выбранному периоду нет просроченных контактов, долгого ожидания клиентов и заметной просадки продаж.
        </p>
      </section>
      )
      ) : null}

      {activeTab === "overview" && attentionItems.length > 0 ? (
        <section className="mt-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-[#121827]">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                Контроль
              </p>
              <h2 className="mt-1 text-xl font-semibold">Что требует внимания</h2>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Быстрый список сделок, где можно потерять продажу.
            </p>
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-3">
            {attentionItems.map((item) => (
              <Link
                key={item.id}
                href={`/crm?dealId=${item.dealId}&tab=${item.tab}`}
                className={`group rounded-2xl border p-4 transition hover:-translate-y-0.5 hover:shadow-lg ${
                  item.tone === "rose"
                    ? "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-100"
                    : item.tone === "amber"
                      ? "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-100"
                      : "border-violet-200 bg-violet-50 text-violet-900 dark:border-violet-500/20 dark:bg-violet-500/10 dark:text-violet-100"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] opacity-70">
                      {item.label}
                    </p>
                    <h3 className="mt-2 truncate text-base font-semibold">
                      {item.title}
                    </h3>
                    <p className="mt-2 line-clamp-2 text-sm opacity-75">
                      {item.meta}
                    </p>
                  </div>
                  <ArrowLeft className="mt-1 h-4 w-4 shrink-0 rotate-180 opacity-50 transition group-hover:translate-x-1 group-hover:opacity-100" />
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {activeTab === "overview" ? (
      <section className="mt-5">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-[#121827]">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                Динамика
              </p>
              <h2 className="mt-1 text-xl font-semibold">Заявки и новые продажи</h2>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              По дням выбранного периода
            </p>
          </div>

          <div className="mt-5 h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={analytics.dailyDynamics}>
                <defs>
                  <linearGradient id="crmDealsGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#7C3AED" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#7C3AED" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="crmWonGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.22)" />
                <XAxis dataKey="date" tick={{ fill: "#64748B", fontSize: 12 }} />
                <YAxis tick={{ fill: "#64748B", fontSize: 12 }} />
                <Tooltip
                  formatter={(value, name) =>
                    name === "wonValue" ? money(Number(value)) : Number(value)
                  }
                  labelStyle={{ color: "#0F172A" }}
                />
                <Area
                  type="monotone"
                  dataKey="deals"
                  name="Новые сделки"
                  stroke="#7C3AED"
                  fill="url(#crmDealsGradient)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="wonValue"
                  name="Новые продажи"
                  stroke="#10B981"
                  fill="url(#crmWonGradient)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>
      ) : null}

      {activeTab === "planfact" ? (
      <section className="mt-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-[#121827]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                План / факт
              </p>
              <h2 className="mt-1 text-xl font-semibold">План продаж</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {monthLabel(planMonth)}
              </p>
            </div>
            <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
              Месяц плана
              <input
                type="month"
                value={planMonth}
                onChange={(event) => setPlanMonth(event.target.value)}
                className="mt-2 h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold normal-case tracking-normal text-slate-900 outline-none focus:border-violet-400 dark:border-white/10 dark:bg-[#0B0F1A] dark:text-white"
              />
            </label>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {planRows.map((row) => (
              <button
                key={row.key}
                type="button"
                onClick={() => setPlanMetric(row.key)}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  planMetric === row.key
                    ? "bg-violet-600 text-white shadow-lg shadow-violet-600/20"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10"
                }`}
              >
                {row.label}
              </button>
            ))}
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-3">
            {planSignals.map((signal) => (
              <div
                key={signal.title}
                className={`rounded-2xl border p-4 ${
                  signal.tone === "emerald"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-100"
                    : signal.tone === "rose"
                      ? "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-100"
                      : signal.tone === "amber"
                        ? "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-100"
                        : "border-violet-200 bg-violet-50 text-violet-900 dark:border-violet-500/20 dark:bg-violet-500/10 dark:text-violet-100"
                }`}
              >
                <p className="text-sm font-semibold">{signal.title}</p>
                <p className="mt-2 text-xs leading-5 opacity-80">{signal.text}</p>
              </div>
            ))}
          </div>

          <div className="mt-5 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={planFactData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.22)" />
                <XAxis dataKey="name" tick={{ fill: "#64748B", fontSize: 12 }} />
                <YAxis tick={{ fill: "#64748B", fontSize: 12 }} />
                <Tooltip formatter={(value) => selectedPlanRow.format(Number(value))} />
                <Bar dataKey="value" radius={[10, 10, 0, 0]}>
                  {planFactData.map((entry, index) => (
                    <Cell
                      key={entry.name}
                      fill={index === 0 ? "#7C3AED" : "#10B981"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 dark:border-white/10">
            {planRows.map((row) => {
              const progress = row.plan > 0 ? (row.fact / row.plan) * 100 : 0;
              const deviation = row.fact - row.plan;

              return (
                <div
                  key={row.key}
                  className="grid gap-3 border-b border-slate-200 p-4 last:border-b-0 dark:border-white/10 md:grid-cols-[1.1fr_0.9fr_0.8fr_0.8fr_0.8fr]"
                >
                  <div>
                    <p className="text-sm font-semibold">{row.label}</p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      План и факт за выбранный месяц
                    </p>
                  </div>
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    План
                    <input
                      type="number"
                      value={row.plan}
                      onChange={(event) =>
                        updateCrmPlan(row.key, Number(event.target.value))
                      }
                      className="mt-2 h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-900 outline-none focus:border-violet-400 dark:border-white/10 dark:bg-[#0B0F1A] dark:text-white"
                    />
                  </label>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                      Факт
                    </p>
                    <p className="mt-3 text-sm font-semibold">{row.format(row.fact)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                      Отклонение
                    </p>
                    <p
                      className={`mt-3 text-sm font-semibold ${
                        deviation >= 0 ? "text-emerald-500" : "text-amber-500"
                      }`}
                    >
                      {deviation > 0 ? "+" : ""}
                      {row.format(deviation)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                      Выполнение
                    </p>
                    <p className="mt-3 text-sm font-semibold">{percent(progress)}</p>
                  </div>
                </div>
              );
            })}
          </div>
      </section>
      ) : null}

      {activeTab === "overview" ? (
      <>

      <section className="mt-5 grid gap-5 xl:grid-cols-[1fr_1fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-[#121827]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                Маркетинг
              </p>
              <h2 className="mt-1 text-xl font-semibold">Источники заявок</h2>
            </div>
            <MessageSquareText className="h-5 w-5 text-emerald-500" />
          </div>

          <div className="mt-5 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={analytics.bySource}
                  dataKey="count"
                  nameKey="name"
                  innerRadius={64}
                  outerRadius={104}
                  paddingAngle={3}
                >
                  {analytics.bySource.map((source, index) => (
                    <Cell
                      key={source.id}
                      fill={CHART_COLORS[index % CHART_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => `${value} сделок`} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-3 space-y-3">
            {analytics.bySource.map((source, index) => (
              <div
                key={source.id}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-[#0B0F1A]"
              >
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-center gap-3">
                    <span
                      className="h-3 w-3 rounded-full"
                      style={{
                        backgroundColor:
                          CHART_COLORS[index % CHART_COLORS.length],
                      }}
                    />
                    <div>
                      <p className="font-semibold">{source.name}</p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {source.count} сделок · в работе {source.open} · выиграно {source.won}
                      </p>
                    </div>
                  </div>
                  <div className="text-left md:text-right">
                    <p className="font-semibold">{money(source.value)}</p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      Конверсия {percent(source.conversion)}
                    </p>
                  </div>
                </div>
              </div>
            ))}

            {analytics.bySource.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
                Сделок по источникам за выбранный период пока нет.
              </div>
            ) : null}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-[#121827]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                Команда
              </p>
              <h2 className="mt-1 text-xl font-semibold">Эффективность менеджеров</h2>
            </div>
            <Users className="h-5 w-5 text-violet-500" />
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-[#0B0F1A]">
              <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                Менеджеров в работе
              </p>
              <p className="mt-3 text-2xl font-semibold">{teamSummary.managers}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-[#0B0F1A]">
              <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                Продаж команды
              </p>
              <p className="mt-3 text-2xl font-semibold">{money(teamSummary.wonValue)}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-[#0B0F1A]">
              <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                Выигранных сделок
              </p>
              <p className="mt-3 text-2xl font-semibold">{teamSummary.wonDeals}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-[#0B0F1A]">
              <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                Диалогов ждут ответа
              </p>
              <p className="mt-3 text-2xl font-semibold">{teamSummary.waitingDialogs}</p>
            </div>
          </div>

          <div className="mt-5 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.byManager} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.22)" />
                <XAxis type="number" tick={{ fill: "#64748B", fontSize: 12 }} />
                <YAxis
                  dataKey="name"
                  type="category"
                  width={110}
                  tick={{ fill: "#64748B", fontSize: 12 }}
                />
                <Tooltip />
                <Bar dataKey="wonValue" name="Продажи" fill="#10B981" radius={[0, 8, 8, 0]} />
                <Bar dataKey="value" name="Потенциал" fill="#7C3AED" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {topManager ? (
            <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-100">
              <div className="flex items-center gap-3">
                {topManager.avatarUrl ? (
                  <img
                    src={topManager.avatarUrl}
                    alt={topManager.name}
                    className="h-11 w-11 rounded-2xl object-cover"
                  />
                ) : (
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-emerald-400 text-sm font-bold text-white">
                    {getInitials(topManager.name) || "R"}
                  </div>
                )}
                <div>
                  <p className="text-sm font-semibold">
                    Лидер по продажам: {topManager.name}
                  </p>
                  <p className="mt-1 text-sm opacity-80">
                    {topManager.title ? `${topManager.title} · ` : ""}
                    {money(topManager.wonValue)} выручки, {topManager.won} выигранных сделок, конверсия {percent(topManager.conversion)}.
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          <div className="mt-3 space-y-3">
            {analytics.byManager.map((manager) => (
              <div
                key={manager.id}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-[#0B0F1A]"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    {manager.avatarUrl ? (
                      <img
                        src={manager.avatarUrl}
                        alt={manager.name}
                        className="h-10 w-10 rounded-2xl object-cover"
                      />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-emerald-400 text-xs font-bold text-white">
                        {getInitials(manager.name) || "R"}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{manager.name}</p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {manager.title ? `${manager.title} · ` : ""}
                        {manager.count} сделок · в работе {manager.open} · выиграно {manager.won} · потеряно {manager.lost}
                      </p>
                    </div>
                  </div>
                  <div className="text-left md:text-right">
                    <p className="font-semibold">{money(manager.wonValue)}</p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      Потенциал: {money(manager.value)}
                    </p>
                  </div>
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-4">
                  <div className="rounded-xl bg-white px-3 py-2 text-xs dark:bg-white/5">
                    <p className="text-slate-500 dark:text-slate-400">Конверсия</p>
                    <p className="mt-1 font-semibold">{percent(manager.conversion)}</p>
                  </div>
                  <div className="rounded-xl bg-white px-3 py-2 text-xs dark:bg-white/5">
                    <p className="text-slate-500 dark:text-slate-400">Средний чек</p>
                    <p className="mt-1 font-semibold">{money(manager.averageCheck)}</p>
                  </div>
                  <div className="rounded-xl bg-white px-3 py-2 text-xs dark:bg-white/5">
                    <p className="text-slate-500 dark:text-slate-400">Ждут ответа</p>
                    <p className="mt-1 font-semibold">{manager.waitingDialogs}</p>
                  </div>
                  <div className="rounded-xl bg-white px-3 py-2 text-xs dark:bg-white/5">
                    <p className="text-slate-500 dark:text-slate-400">Среднее ожидание</p>
                    <p className="mt-1 font-semibold">
                      {formatMinutes(manager.averageWaitingMinutes)}
                    </p>
                  </div>
                </div>
              </div>
            ))}

            {analytics.byManager.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
                Сделки за выбранный период пока не распределены между менеджерами.
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section className="mt-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-[#121827]">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
              Активность
            </p>
            <h2 className="mt-1 text-xl font-semibold">Движение сделок</h2>
            <p className="mt-2 max-w-3xl text-sm text-slate-500 dark:text-slate-400">
              Показывает, как сделки реально двигались между этапами за выбранный
              период. Это помогает понять, работает ли команда с заявками или
              карточки просто стоят на месте.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-white/10 dark:bg-[#0B0F1A]">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Переходов
              </p>
              <p className="mt-1 text-xl font-semibold">
                {stageMovementAnalytics.total}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-white/10 dark:bg-[#0B0F1A]">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Сделок
              </p>
              <p className="mt-1 text-xl font-semibold">
                {stageMovementAnalytics.uniqueDeals}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-[#0B0F1A]">
            <p className="text-sm font-semibold">Самые частые переходы</p>
            <div className="mt-4 space-y-3">
              {stageMovementAnalytics.topTransitions.map((transition) => (
                <div
                  key={transition.id}
                  className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">
                        {transition.fromName} → {transition.toName}
                      </p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {transition.pipelineName}
                      </p>
                    </div>
                    <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200">
                      {transition.count}
                    </span>
                  </div>
                </div>
              ))}

              {stageMovementAnalytics.topTransitions.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
                  За выбранный период переходов между этапами пока нет.
                </div>
              ) : null}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-[#0B0F1A]">
            <p className="text-sm font-semibold">Последние движения</p>
            <div className="mt-4 space-y-3">
              {stageMovementAnalytics.recent.map((movement) => (
                <div
                  key={movement.id}
                  className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">
                        {movement.fromName} → {movement.toName}
                      </p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {movement.pipelineName}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-slate-500 dark:text-slate-400">
                      {formatDateTime(movement.movedAt)}
                    </span>
                  </div>
                </div>
              ))}

              {stageMovementAnalytics.recent.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
                  Когда менеджеры начнут двигать сделки, здесь появится свежая
                  история переходов.
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <section className="mt-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-[#121827]">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
              Контроль
            </p>
            <h2 className="mt-1 text-xl font-semibold">Застрявшие сделки</h2>
            <p className="mt-2 max-w-3xl text-sm text-slate-500 dark:text-slate-400">
              Здесь попадают открытые сделки, которые не двигались по этапам
              минимум 3 дня. Это помогает быстро найти лиды, где клиент может
              остыть или менеджер забыл сделать следующий шаг.
            </p>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
            {analytics.stuckDeals.length} в зоне внимания
          </div>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          {analytics.stuckDeals.map((deal) => (
            <div
              key={deal.id}
              className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-[#0B0F1A]"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{deal.title}</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {deal.clientName || "Клиент не указан"} · {deal.pipelineName}
                  </p>
                </div>
                <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-500/10 dark:text-amber-200">
                  {deal.daysInStage} дн.
                </span>
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                <div className="rounded-xl bg-white px-3 py-2 text-xs dark:bg-white/5">
                  <p className="text-slate-500 dark:text-slate-400">Этап</p>
                  <p className="mt-1 truncate font-semibold">{deal.stageName}</p>
                </div>
                <div className="rounded-xl bg-white px-3 py-2 text-xs dark:bg-white/5">
                  <p className="text-slate-500 dark:text-slate-400">Потенциал</p>
                  <p className="mt-1 font-semibold">{money(deal.value)}</p>
                </div>
                <div className="rounded-xl bg-white px-3 py-2 text-xs dark:bg-white/5">
                  <p className="text-slate-500 dark:text-slate-400">Движение</p>
                  <p className="mt-1 font-semibold">
                    {formatDateTime(deal.lastMoveAt)}
                  </p>
                </div>
              </div>
              <Link
                href={`/crm?dealId=${deal.id}`}
                className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-violet-500"
              >
                Открыть сделку
              </Link>
            </div>
          ))}

          {analytics.stuckDeals.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-white/10 dark:text-slate-400 lg:col-span-2">
              Отлично: по выбранным фильтрам нет открытых сделок, которые стоят
              на одном этапе 3 дня и дольше.
            </div>
          ) : null}
        </div>
      </section>

      <section className="mt-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-[#121827]">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
              Воронка
            </p>
            <h2 className="mt-1 text-xl font-semibold">
              Конверсия между этапами
            </h2>
            <p className="mt-2 max-w-3xl text-sm text-slate-500 dark:text-slate-400">
              Система берет реальные этапы каждой воронки и показывает, какая
              доля сделок дошла до следующей колонки. Если пользователь
              переименует или добавит этапы, расчет подстроится автоматически.
            </p>
          </div>
          <div className="rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-700 dark:border-violet-500/20 dark:bg-violet-500/10 dark:text-violet-200">
            {stageHistory.length > 0
              ? "Точная история переходов"
              : "Текущий срез за выбранный период"}
          </div>
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          {analytics.stageConversions.map((pipeline) => (
            <div
              key={pipeline.id}
              className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-[#0B0F1A]"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-semibold">{pipeline.name}</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    В расчете: {pipeline.total} сделок ·{" "}
                    {pipeline.hasHistoricalData
                      ? "по истории перемещений"
                      : "по текущему этапу"}
                  </p>
                </div>
                {pipeline.weakestStep ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
                    Узкое место: {pipeline.weakestStep.fromName} →{" "}
                    {pipeline.weakestStep.toName}
                  </div>
                ) : null}
              </div>

              <div className="mt-4 space-y-3">
                {pipeline.steps.map((step) => (
                  <div
                    key={step.id}
                    className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/5"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">
                          {step.fromName} → {step.toName}
                        </p>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          Дошло: {step.toReached} из {step.fromReached} · Потери:{" "}
                          {step.lost}
                        </p>
                      </div>
                      <p className="text-2xl font-semibold text-emerald-500">
                        {percent(step.conversion)}
                      </p>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-violet-500 to-emerald-400"
                        style={{
                          width: `${Math.min(
                            100,
                            Math.max(0, step.conversion)
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {analytics.stageConversions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-white/10 dark:text-slate-400 xl:col-span-2">
              Для расчета конверсии нужны сделки в воронке минимум с двумя
              этапами за выбранный период.
            </div>
          ) : null}
        </div>
      </section>

      <section className="mt-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-[#121827]">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
              Воронка
            </p>
            <h2 className="mt-1 text-xl font-semibold">Сделки по этапам</h2>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            За выбранный период: {money(analytics.periodValue)}
          </p>
        </div>

        <div className="mt-5 h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={analytics.byStage}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.22)" />
              <XAxis
                dataKey="name"
                tick={{ fill: "#64748B", fontSize: 12 }}
                interval={0}
                angle={-15}
                textAnchor="end"
                height={80}
              />
              <YAxis tick={{ fill: "#64748B", fontSize: 12 }} />
              <Tooltip formatter={(value, name) => (name === "value" ? money(Number(value)) : Number(value))} />
              <Bar dataKey="deals" name="Сделки" fill="#7C3AED" radius={[10, 10, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {analytics.byStage.map((stage) => (
            <div
              key={stage.id}
              className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-[#0B0F1A]"
            >
              <p className="text-sm font-semibold">{stage.name}</p>
              <p className="mt-3 text-2xl font-semibold">{stage.deals}</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {money(stage.value)}
              </p>
            </div>
          ))}

          {analytics.byStage.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-white/10 dark:text-slate-400 md:col-span-2 xl:col-span-4">
              Сделок по этапам за выбранный период пока нет.
            </div>
          ) : null}
        </div>
      </section>

      <section className="mt-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-[#121827]">
        <div>
          <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
            Детализация
          </p>
          <h2 className="mt-1 text-xl font-semibold">Полезные показатели периода</h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Эти цифры помогают быстро понять, где деньги, где нагрузка команды и где нужно вмешаться руководителю.
          </p>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {detailCards.map((card) => (
            <div
              key={card.label}
              className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-[#0B0F1A]"
            >
              <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                {card.label}
              </p>
              <p className="mt-3 text-2xl font-semibold">{card.value}</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {card.hint}
              </p>
            </div>
          ))}
        </div>
      </section>
      </>
      ) : null}
    </main>
  );
}
