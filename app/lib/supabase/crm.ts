import { requireBillingAccess } from "../billing-guards";
import {
  canManageCrmSettings,
  canViewAllCrmDeals,
  isAppRole,
  type AppRole,
} from "../permissions";
import { getAppContext } from "./app-context";

export type CrmPipelineKind = "sales" | "delivery";
export type CrmStageKind =
  | "regular"
  | "payment"
  | "paid_project"
  | "lost"
  | "delivery";
export type CrmDealStatus = "open" | "won" | "lost";
export type CrmAssignmentMode =
  | "manual"
  | "round_robin"
  | "least_loaded"
  | "fixed_manager";

export type CrmPipeline = {
  id: string;
  workspace_id: string;
  name: string;
  kind: CrmPipelineKind;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type CrmStage = {
  id: string;
  workspace_id: string;
  pipeline_id: string;
  name: string;
  kind: CrmStageKind;
  sort_order: number;
  color: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type CrmSource = {
  id: string;
  workspace_id: string;
  name: string;
  kind: string;
  is_active: boolean;
  created_at: string;
};

export type CrmLossReason = {
  id: string;
  workspace_id: string;
  name: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
};

export type CrmAssignmentRule = {
  id: string;
  workspace_id: string;
  source_kind: string | null;
  mode: CrmAssignmentMode;
  target_member_ids: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type CrmSalesPlan = {
  id: string;
  workspace_id: string;
  user_id: string | null;
  month: string;
  revenue_plan: number;
  won_deals_plan: number;
  leads_plan: number;
  created_at: string;
  updated_at: string;
};

export type CrmDealAssignee = {
  id: string;
  deal_id: string;
  workspace_member_id: string;
  created_at: string;
};

export type CrmDealStageHistory = {
  id: string;
  workspace_id: string;
  deal_id: string;
  from_pipeline_id: string | null;
  from_stage_id: string | null;
  to_pipeline_id: string;
  to_stage_id: string;
  actor_member_id: string | null;
  moved_at: string;
};

export type CrmDeal = {
  id: string;
  workspace_id: string;
  pipeline_id: string;
  stage_id: string;
  client_id: string | null;
  title: string;
  client_name: string | null;
  phone: string | null;
  telegram: string | null;
  source_id: string | null;
  source_item_id: string | null;
  source_item_title: string | null;
  source_item_url: string | null;
  service_amount: number | null;
  budget: number | null;
  next_contact_at: string | null;
  description: string | null;
  status: CrmDealStatus;
  loss_reason_id: string | null;
  loss_comment: string | null;
  project_id: string | null;
  position: number;
  created_at: string;
  updated_at: string;
  assignees: CrmDealAssignee[];
};

export type CrmDealTaskStatus = "todo" | "in_progress" | "done";

export type CrmDealTask = {
  id: string;
  workspace_id: string;
  deal_id: string;
  title: string;
  assignee_member_id: string | null;
  due_at: string | null;
  status: CrmDealTaskStatus;
  created_at: string;
  updated_at: string;
};

export type CrmDealComment = {
  id: string;
  workspace_id: string;
  deal_id: string;
  author_member_id: string | null;
  body: string;
  file_url: string | null;
  created_at: string;
};

export type CrmDealActivity = {
  id: string;
  workspace_id: string;
  deal_id: string;
  actor_member_id: string | null;
  action: string;
  payload: Record<string, unknown>;
  created_at: string;
};

export type CrmConversationChannel =
  | "avito"
  | "telegram"
  | "tilda"
  | "yandex_direct"
  | "manual";

export type CrmConversation = {
  id: string;
  workspace_id: string;
  deal_id: string | null;
  channel: CrmConversationChannel;
  external_id: string | null;
  title: string | null;
  last_client_message_at?: string | null;
  last_manager_message_at?: string | null;
  read_at?: string | null;
  created_at: string;
  updated_at: string;
};

export type CrmMessageSenderType = "client" | "manager" | "system";

export type CrmMessage = {
  id: string;
  workspace_id: string;
  conversation_id: string;
  deal_id: string | null;
  sender_type: CrmMessageSenderType;
  sender_member_id: string | null;
  body: string | null;
  attachment_url: string | null;
  external_id: string | null;
  created_at: string;
};

export type CreateCrmDealTaskInput = {
  deal_id: string;
  title: string;
  assignee_member_id?: string | null;
  due_at?: string | null;
};

export type CreateCrmDealCommentInput = {
  deal_id: string;
  body: string;
  file_url?: string | null;
};

export type CreateCrmMessageInput = {
  conversation_id: string;
  deal_id?: string | null;
  body: string;
  attachment_url?: string | null;
  external_id?: string | null;
};

export type UpdateCrmDealTaskInput = {
  title?: string;
  assignee_member_id?: string | null;
  due_at?: string | null;
  status?: CrmDealTaskStatus;
};

export type CrmBootstrap = {
  pipelines: CrmPipeline[];
  stages: CrmStage[];
  sources: CrmSource[];
  lossReasons: CrmLossReason[];
  assignmentRules: CrmAssignmentRule[];
  deals: CrmDeal[];
  stageDealCounts: Record<string, number>;
};

export type CrmBootstrapFilters = {
  search?: string;
  sourceId?: string;
  assigneeId?: string;
  status?: "all" | CrmDealStatus;
};

export type CrmStageHistoryFilters = {
  from?: string;
  to?: string;
  pipelineId?: string;
  sourceId?: string;
  assigneeId?: string;
};

export type CrmDealDetails = {
  dealTasks: CrmDealTask[];
  dealComments: CrmDealComment[];
  dealActivities: CrmDealActivity[];
  conversations: CrmConversation[];
  messages: CrmMessage[];
};

export type CrmInboxItem = {
  conversation: CrmConversation;
  deal: CrmDeal;
  lastMessage: CrmMessage;
  needsReply: boolean;
  isUnread: boolean;
  minutesWaiting: number;
  messageCount: number;
};

export type CreateCrmDealInput = {
  pipeline_id: string;
  stage_id: string;
  client_id?: string | null;
  title: string;
  client_name?: string | null;
  phone?: string | null;
  telegram?: string | null;
  source_id?: string | null;
  source_item_id?: string | null;
  source_item_title?: string | null;
  source_item_url?: string | null;
  service_amount?: number | null;
  budget?: number | null;
  next_contact_at?: string | null;
  description?: string | null;
  assignee_ids?: string[];
};

export type CreateCrmPipelineInput = {
  name: string;
  kind: CrmPipelineKind;
};

export type UpsertCrmAssignmentRuleInput = {
  source_kind?: string | null;
  mode: CrmAssignmentMode;
  target_member_ids?: string[];
  is_active?: boolean;
};

export type UpdateCrmPipelineInput = {
  name?: string;
  kind?: CrmPipelineKind;
  sort_order?: number;
  is_active?: boolean;
};

export type UpdateCrmDealInput = Partial<CreateCrmDealInput> & {
  status?: CrmDealStatus;
  loss_reason_id?: string | null;
  loss_comment?: string | null;
  project_id?: string | null;
  position?: number;
};

export type MoveCrmDealInput = {
  dealId: string;
  pipelineId: string;
  stageId: string;
  position: number;
  status?: CrmDealStatus;
  loss_reason_id?: string | null;
  loss_comment?: string | null;
};

export type CreateCrmStageInput = {
  pipeline_id: string;
  name: string;
  kind?: CrmStageKind;
  sort_order?: number;
};

export type UpdateCrmStageInput = {
  name?: string;
  kind?: CrmStageKind;
  sort_order?: number;
  is_active?: boolean;
};

export type UpdateCrmStageOrderInput = {
  stageId: string;
  sortOrder: number;
};

type DbCrmPipelineRow = Omit<CrmPipeline, "sort_order"> & {
  sort_order: number | string | null;
};

type DbCrmStageRow = Omit<CrmStage, "sort_order"> & {
  sort_order: number | string | null;
};

type DbCrmLossReasonRow = Omit<CrmLossReason, "sort_order"> & {
  sort_order: number | string | null;
};

type DbCrmDealRow = Omit<CrmDeal, "assignees" | "position" | "service_amount" | "budget"> & {
  position: number | string | null;
  service_amount: number | string | null;
  budget: number | string | null;
};

type DbCrmAssignmentRuleRow = Omit<
  CrmAssignmentRule,
  "target_member_ids"
> & {
  target_member_ids: string[] | null;
};

type DbCrmSalesPlanRow = Omit<
  CrmSalesPlan,
  "revenue_plan" | "won_deals_plan" | "leads_plan"
> & {
  revenue_plan: number | string | null;
  won_deals_plan: number | string | null;
  leads_plan: number | string | null;
};

const CRM_STAGE_DEAL_LIMIT = 80;

function normalizeFilterValue(value?: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized : "";
}

function escapeIlikeValue(value: string) {
  return value.replace(/[%_]/g, "\\$&");
}

const DEFAULT_SOURCES = [
  { name: "Авито", kind: "avito" },
  { name: "Tilda", kind: "tilda" },
  { name: "Яндекс Директ", kind: "yandex_direct" },
  { name: "Telegram", kind: "telegram" },
  { name: "Ручная заявка", kind: "manual" },
];

const DEFAULT_LOSS_REASONS = [
  "Цена",
  "Нет бюджета",
  "Выбрали конкурента",
  "Неактуально",
  "Не вышли на связь",
  "Другое",
];

const DEFAULT_SALES_STAGES = [
  { name: "Заявка получена", kind: "regular" as const },
  { name: "Первичная квалификация", kind: "regular" as const },
  { name: "Сбор информации", kind: "regular" as const },
  { name: "КП отправлено", kind: "regular" as const },
  { name: "Переговоры", kind: "regular" as const },
  { name: "Оплата", kind: "payment" as const },
  { name: "Проект оплачен", kind: "paid_project" as const },
  { name: "Потеряно", kind: "lost" as const },
];

const DEFAULT_DELIVERY_STAGES = [
  "Подготовка коммуникаций по проекту",
  "Брифинг",
  "Техническая подготовка проекта",
  "Запуск рекламной кампании",
  "Активная работа по проекту",
  "Проект на паузе",
  "Проект завершён",
];

function mapPipeline(row: DbCrmPipelineRow): CrmPipeline {
  return {
    ...row,
    sort_order: Number(row.sort_order ?? 0),
    is_active: row.is_active ?? true,
  };
}

function mapStage(row: DbCrmStageRow): CrmStage {
  return {
    ...row,
    sort_order: Number(row.sort_order ?? 0),
    is_active: row.is_active ?? true,
  };
}

function mapLossReason(row: DbCrmLossReasonRow): CrmLossReason {
  return {
    ...row,
    sort_order: Number(row.sort_order ?? 0),
    is_active: row.is_active ?? true,
  };
}

function mapDeal(row: DbCrmDealRow, assignees: CrmDealAssignee[]): CrmDeal {
  return {
    ...row,
    position: Number(row.position ?? 0),
    service_amount:
      row.service_amount === null ? null : Number(row.service_amount ?? 0),
    budget: row.budget === null ? null : Number(row.budget ?? 0),
    assignees,
  };
}

function mapAssignmentRule(row: DbCrmAssignmentRuleRow): CrmAssignmentRule {
  return {
    ...row,
    target_member_ids: Array.isArray(row.target_member_ids)
      ? row.target_member_ids
      : [],
    is_active: row.is_active ?? true,
  };
}

function mapSalesPlan(row: DbCrmSalesPlanRow): CrmSalesPlan {
  return {
    ...row,
    revenue_plan: Number(row.revenue_plan ?? 0),
    won_deals_plan: Number(row.won_deals_plan ?? 0),
    leads_plan: Number(row.leads_plan ?? 0),
  };
}

function normalizeIds(ids?: string[]) {
  return Array.from(new Set((ids ?? []).map((id) => id.trim()).filter(Boolean)));
}

function resolveRole(role: string | null | undefined): AppRole | null {
  return isAppRole(role) ? role : null;
}

function roleCanViewAllCrmDeals(role: string | null | undefined) {
  const resolvedRole = resolveRole(role);
  return resolvedRole ? canViewAllCrmDeals(resolvedRole) : false;
}

async function requireCanManageCrmSettings() {
  const { membership } = await getAppContext();
  const role = resolveRole(membership?.role);

  if (!role || !canManageCrmSettings(role)) {
    throw new Error("Нет прав на настройку CRM");
  }
}

async function canAccessCrmDeal(params: {
  supabase: any;
  workspaceId: string;
  membership: { id?: string | null; role?: string | null } | null | undefined;
  dealId: string;
}) {
  if (roleCanViewAllCrmDeals(params.membership?.role)) {
    return true;
  }

  if (!params.membership?.id) {
    return false;
  }

  const { data, error } = await params.supabase
    .from("crm_deal_assignees")
    .select("id")
    .eq("workspace_id", params.workspaceId)
    .eq("deal_id", params.dealId)
    .eq("workspace_member_id", params.membership.id)
    .maybeSingle();

  if (error) {
    throw new Error(`Не удалось проверить доступ к сделке CRM: ${error.message}`);
  }

  return Boolean(data);
}

async function requireCanAccessCrmDeal(params: {
  supabase: any;
  workspaceId: string;
  membership: { id?: string | null; role?: string | null } | null | undefined;
  dealId: string;
}) {
  const hasAccess = await canAccessCrmDeal(params);

  if (!hasAccess) {
    throw new Error("Нет доступа к этой сделке CRM");
  }
}

function isAfter(left?: string | null, right?: string | null) {
  if (!left) return false;
  if (!right) return true;

  return new Date(left).getTime() > new Date(right).getTime();
}

async function createCrmActivity(params: {
  dealId: string;
  action: string;
  payload?: Record<string, unknown>;
}) {
  const { supabase, workspace, membership } = await getAppContext();

  const { error } = await supabase.from("crm_deal_activities").insert({
    workspace_id: workspace.id,
    deal_id: params.dealId,
    actor_member_id: membership?.id ?? null,
    action: params.action,
    payload: params.payload ?? {},
  });

  if (error) {
    console.error("CRM activity was not saved:", error.message);
  }
}

async function createCrmStageHistory(params: {
  dealId: string;
  fromPipelineId?: string | null;
  fromStageId?: string | null;
  toPipelineId: string;
  toStageId: string;
}) {
  const { supabase, workspace, membership } = await getAppContext();

  const { error } = await supabase.from("crm_deal_stage_history").insert({
    workspace_id: workspace.id,
    deal_id: params.dealId,
    from_pipeline_id: params.fromPipelineId ?? null,
    from_stage_id: params.fromStageId ?? null,
    to_pipeline_id: params.toPipelineId,
    to_stage_id: params.toStageId,
    actor_member_id: membership?.id ?? null,
  });

  if (error) {
    console.error("CRM stage history was not saved:", error.message);
  }
}

async function ensureCrmDefaults(workspaceId: string) {
  const { supabase } = await getAppContext();

  const { data: existingPipelines, error: pipelinesError } = await supabase
    .from("crm_pipelines")
    .select("id")
    .eq("workspace_id", workspaceId)
    .limit(1);

  if (pipelinesError) {
    throw new Error(`Не удалось проверить CRM-воронки: ${pipelinesError.message}`);
  }

  if ((existingPipelines ?? []).length > 0) {
    return;
  }

  const { data: salesPipeline, error: salesPipelineError } = await supabase
    .from("crm_pipelines")
    .insert({
      workspace_id: workspaceId,
      name: "Общая воронка продаж",
      kind: "sales",
      sort_order: 10,
      is_active: true,
    })
    .select("*")
    .single();

  if (salesPipelineError || !salesPipeline) {
    throw new Error(
      `Не удалось создать базовую CRM-воронку: ${salesPipelineError?.message ?? "нет данных"}`
    );
  }

  const { data: deliveryPipeline, error: deliveryPipelineError } = await supabase
    .from("crm_pipelines")
    .insert({
      workspace_id: workspaceId,
      name: "Запуск и реализация проекта",
      kind: "delivery",
      sort_order: 20,
      is_active: true,
    })
    .select("*")
    .single();

  if (deliveryPipelineError || !deliveryPipeline) {
    throw new Error(
      `Не удалось создать проектную CRM-воронку: ${deliveryPipelineError?.message ?? "нет данных"}`
    );
  }

  const salesStagePayload = DEFAULT_SALES_STAGES.map((stage, index) => ({
    workspace_id: workspaceId,
    pipeline_id: salesPipeline.id,
    name: stage.name,
    kind: stage.kind,
    sort_order: (index + 1) * 10,
    is_active: true,
  }));

  const deliveryStagePayload = DEFAULT_DELIVERY_STAGES.map((name, index) => ({
    workspace_id: workspaceId,
    pipeline_id: deliveryPipeline.id,
    name,
    kind: "delivery",
    sort_order: (index + 1) * 10,
    is_active: true,
  }));

  const { error: stagesError } = await supabase
    .from("crm_pipeline_stages")
    .insert([...salesStagePayload, ...deliveryStagePayload]);

  if (stagesError) {
    throw new Error(`Не удалось создать этапы CRM: ${stagesError.message}`);
  }

  const { error: sourcesError } = await supabase.from("crm_sources").insert(
    DEFAULT_SOURCES.map((source) => ({
      workspace_id: workspaceId,
      ...source,
      is_active: true,
    }))
  );

  if (sourcesError) {
    throw new Error(`Не удалось создать источники CRM: ${sourcesError.message}`);
  }

  const { error: lossReasonsError } = await supabase
    .from("crm_loss_reasons")
    .insert(
      DEFAULT_LOSS_REASONS.map((name, index) => ({
        workspace_id: workspaceId,
        name,
        sort_order: (index + 1) * 10,
        is_active: true,
      }))
    );

  if (lossReasonsError) {
    throw new Error(
      `Не удалось создать причины отказа CRM: ${lossReasonsError.message}`
    );
  }
}

export async function getCrmBootstrap(
  filters: CrmBootstrapFilters = {}
): Promise<CrmBootstrap> {
  const { supabase, workspace, membership } = await getAppContext();

  await ensureCrmDefaults(workspace.id);

  const [
    pipelinesResult,
    stagesResult,
    sourcesResult,
    lossReasonsResult,
    assignmentRulesResult,
  ] =
    await Promise.all([
      supabase
        .from("crm_pipelines")
        .select("*")
        .eq("workspace_id", workspace.id)
        .eq("is_active", true)
        .order("sort_order", { ascending: true }),
      supabase
        .from("crm_pipeline_stages")
        .select("*")
        .eq("workspace_id", workspace.id)
        .eq("is_active", true)
        .order("sort_order", { ascending: true }),
      supabase
        .from("crm_sources")
        .select("*")
        .eq("workspace_id", workspace.id)
        .eq("is_active", true)
        .order("created_at", { ascending: true }),
      supabase
        .from("crm_loss_reasons")
        .select("*")
        .eq("workspace_id", workspace.id)
        .eq("is_active", true)
        .order("sort_order", { ascending: true }),
      supabase
        .from("crm_assignment_rules")
        .select("*")
        .eq("workspace_id", workspace.id)
        .eq("is_active", true)
        .order("created_at", { ascending: true }),
    ]);

  if (pipelinesResult.error) {
    throw new Error(`Не удалось загрузить CRM-воронки: ${pipelinesResult.error.message}`);
  }

  if (stagesResult.error) {
    throw new Error(`Не удалось загрузить этапы CRM: ${stagesResult.error.message}`);
  }

  if (sourcesResult.error) {
    throw new Error(`Не удалось загрузить источники CRM: ${sourcesResult.error.message}`);
  }

  if (lossReasonsResult.error) {
    throw new Error(
      `Не удалось загрузить причины отказа CRM: ${lossReasonsResult.error.message}`
    );
  }

  if (assignmentRulesResult.error) {
    throw new Error(
      `Не удалось загрузить правила распределения CRM: ${assignmentRulesResult.error.message}`
    );
  }

  const { data: assigneesData, error: assigneesError } = await supabase
    .from("crm_deal_assignees")
    .select("*")
    .eq("workspace_id", workspace.id);

  if (assigneesError) {
    throw new Error(`Не удалось загрузить ответственных CRM: ${assigneesError.message}`);
  }

  const role = resolveRole(membership?.role);
  const search = normalizeFilterValue(filters.search);
  const sourceId = normalizeFilterValue(filters.sourceId);
  const assigneeId = normalizeFilterValue(filters.assigneeId);
  const status = filters.status && filters.status !== "all" ? filters.status : "";
  const visibleDealIds = (assigneesData ?? [])
    .filter((assignee) => {
      if (assigneeId) {
        return assignee.workspace_member_id === assigneeId;
      }

      return assignee.workspace_member_id === membership?.id;
    })
    .map((assignee) => assignee.deal_id);
  const stages = ((stagesResult.data ?? []) as DbCrmStageRow[]).map(mapStage);

  if (
    ((!role || !canViewAllCrmDeals(role)) || assigneeId) &&
    visibleDealIds.length === 0
  ) {
    return {
      pipelines: ((pipelinesResult.data ?? []) as DbCrmPipelineRow[]).map(
        mapPipeline
      ),
      stages,
      sources: (sourcesResult.data ?? []) as CrmSource[],
      lossReasons: ((lossReasonsResult.data ?? []) as DbCrmLossReasonRow[]).map(
        mapLossReason
      ),
      assignmentRules: (
        (assignmentRulesResult.data ?? []) as DbCrmAssignmentRuleRow[]
      ).map(mapAssignmentRule),
      deals: [],
      stageDealCounts: {},
    };
  }

  let dealsQuery = supabase
    .from("crm_deals")
    .select("id,stage_id", { count: "exact" })
    .eq("workspace_id", workspace.id)
    .order("position", { ascending: true })
    .order("created_at", { ascending: false });

  if (!role || !canViewAllCrmDeals(role) || assigneeId) {
    dealsQuery = dealsQuery.in("id", visibleDealIds);
  }

  if (sourceId) {
    dealsQuery = dealsQuery.eq("source_id", sourceId);
  }

  if (status) {
    dealsQuery = dealsQuery.eq("status", status);
  }

  if (search) {
    const term = `%${escapeIlikeValue(search)}%`;
    dealsQuery = dealsQuery.or(
      [
        `title.ilike.${term}`,
        `client_name.ilike.${term}`,
        `phone.ilike.${term}`,
        `telegram.ilike.${term}`,
        `description.ilike.${term}`,
      ].join(",")
    );
  }

  const { data: dealsData, error: dealsError, count: dealsCount } =
    await dealsQuery.range(0, 0);

  if (dealsError) {
    throw new Error(`Не удалось загрузить сделки CRM: ${dealsError.message}`);
  }

  const stageDealCounts = stages.reduce<Record<string, number>>((acc, stage) => {
    acc[stage.id] = (dealsData ?? []).filter(
      (deal) => deal.stage_id === stage.id
    ).length;
    return acc;
  }, {});

  if (stages.length === 1 && typeof dealsCount === "number") {
    stageDealCounts[stages[0].id] = dealsCount;
  }

  const canViewAllDeals = role ? canViewAllCrmDeals(role) : false;
  const stageDealResults = await Promise.all(
    stages.map(async (stage) => {
      let stageQuery = supabase
        .from("crm_deals")
        .select("*", { count: "exact" })
        .eq("workspace_id", workspace.id)
        .eq("stage_id", stage.id)
        .order("position", { ascending: true })
        .order("created_at", { ascending: false })
        .range(0, CRM_STAGE_DEAL_LIMIT - 1);

      if (!canViewAllDeals || assigneeId) {
        stageQuery = stageQuery.in("id", visibleDealIds);
      }

      if (sourceId) {
        stageQuery = stageQuery.eq("source_id", sourceId);
      }

      if (status) {
        stageQuery = stageQuery.eq("status", status);
      }

      if (search) {
        const term = `%${escapeIlikeValue(search)}%`;
        stageQuery = stageQuery.or(
          [
            `title.ilike.${term}`,
            `client_name.ilike.${term}`,
            `phone.ilike.${term}`,
            `telegram.ilike.${term}`,
            `description.ilike.${term}`,
          ].join(",")
        );
      }

      const { data, error, count } = await stageQuery;

      if (error) {
        throw new Error(`Не удалось загрузить сделки CRM: ${error.message}`);
      }

      return {
        stageId: stage.id,
        count: count ?? (data ?? []).length,
        deals: (data ?? []) as DbCrmDealRow[],
      };
    })
  );

  const limitedDealsData = stageDealResults.flatMap((result) => result.deals);
  const exactStageDealCounts = Object.fromEntries(
    stageDealResults.map((result) => [result.stageId, result.count])
  );

  const assignees = (assigneesData ?? []) as CrmDealAssignee[];
  const assigneesByDeal = new Map<string, CrmDealAssignee[]>();

  for (const assignee of assignees) {
    const current = assigneesByDeal.get(assignee.deal_id) ?? [];
    current.push(assignee);
    assigneesByDeal.set(assignee.deal_id, current);
  }

  return {
    pipelines: ((pipelinesResult.data ?? []) as DbCrmPipelineRow[]).map(
      mapPipeline
    ),
    stages,
    sources: (sourcesResult.data ?? []) as CrmSource[],
    lossReasons: ((lossReasonsResult.data ?? []) as DbCrmLossReasonRow[]).map(
      mapLossReason
    ),
    assignmentRules: (
      (assignmentRulesResult.data ?? []) as DbCrmAssignmentRuleRow[]
    ).map(mapAssignmentRule),
    deals: limitedDealsData.map((deal) =>
      mapDeal(deal, assigneesByDeal.get(deal.id) ?? [])
    ),
    stageDealCounts: exactStageDealCounts,
  };
}

export async function getCrmSalesPlans(): Promise<CrmSalesPlan[]> {
  const { supabase, workspace } = await getAppContext();

  const { data, error } = await supabase
    .from("crm_sales_plans")
    .select("*")
    .eq("workspace_id", workspace.id)
    .order("month", { ascending: true });

  if (error) {
    throw new Error(`Не удалось загрузить планы CRM: ${error.message}`);
  }

  return ((data ?? []) as DbCrmSalesPlanRow[]).map(mapSalesPlan);
}

export async function getCrmStageHistory(
  filters: CrmStageHistoryFilters = {}
): Promise<CrmDealStageHistory[]> {
  const { supabase, workspace, membership } = await getAppContext();
  const role = resolveRole(membership?.role);
  const canViewAllDeals = role ? canViewAllCrmDeals(role) : false;
  const sourceId = normalizeFilterValue(filters.sourceId);
  const assigneeId = normalizeFilterValue(filters.assigneeId);
  let visibleDealIds: string[] | null = null;

  if (!canViewAllDeals || assigneeId || sourceId) {
    let dealsQuery = supabase
      .from("crm_deals")
      .select("id")
      .eq("workspace_id", workspace.id);

    if (sourceId) {
      dealsQuery = dealsQuery.eq("source_id", sourceId);
    }

    if (!canViewAllDeals || assigneeId) {
      const { data: assigneeData, error: assigneeError } = await supabase
        .from("crm_deal_assignees")
        .select("deal_id")
        .eq("workspace_id", workspace.id)
        .eq("workspace_member_id", assigneeId || membership?.id);

      if (assigneeError) {
        throw new Error(
          `Не удалось загрузить ответственных CRM: ${assigneeError.message}`
        );
      }

      const assignedDealIds = (assigneeData ?? []).map(
        (assignee) => assignee.deal_id
      );

      if (assignedDealIds.length === 0) {
        return [];
      }

      dealsQuery = dealsQuery.in("id", assignedDealIds);
    }

    const { data: visibleDeals, error: visibleDealsError } = await dealsQuery;

    if (visibleDealsError) {
      throw new Error(
        `Не удалось загрузить сделки для CRM-аналитики: ${visibleDealsError.message}`
      );
    }

    visibleDealIds = (visibleDeals ?? []).map((deal) => deal.id);

    if (visibleDealIds.length === 0) {
      return [];
    }
  }

  let historyQuery = supabase
    .from("crm_deal_stage_history")
    .select("*")
    .eq("workspace_id", workspace.id)
    .order("moved_at", { ascending: true });

  if (filters.from) {
    historyQuery = historyQuery.gte("moved_at", `${filters.from}T00:00:00`);
  }

  if (filters.to) {
    historyQuery = historyQuery.lte("moved_at", `${filters.to}T23:59:59`);
  }

  if (filters.pipelineId && filters.pipelineId !== "all") {
    historyQuery = historyQuery.eq("to_pipeline_id", filters.pipelineId);
  }

  if (visibleDealIds) {
    historyQuery = historyQuery.in("deal_id", visibleDealIds);
  }

  const { data, error } = await historyQuery.limit(5000);

  if (error) {
    if (
      error.code === "42P01" ||
      error.code === "PGRST205" ||
      error.message.toLowerCase().includes("crm_deal_stage_history")
    ) {
      return [];
    }

    throw new Error(`Не удалось загрузить историю этапов CRM: ${error.message}`);
  }

  return (data ?? []) as CrmDealStageHistory[];
}

export async function upsertCrmSalesPlan(input: {
  month: string;
  revenue_plan: number;
  won_deals_plan: number;
  leads_plan: number;
}): Promise<CrmSalesPlan> {
  await requireBillingAccess();

  const { supabase, workspace, user } = await getAppContext();

  const { data, error } = await supabase
    .from("crm_sales_plans")
    .upsert(
      {
        workspace_id: workspace.id,
        user_id: user.id,
        month: input.month,
        revenue_plan: input.revenue_plan,
        won_deals_plan: input.won_deals_plan,
        leads_plan: input.leads_plan,
      },
      { onConflict: "workspace_id,month" }
    )
    .select("*")
    .single();

  if (error) {
    throw new Error(`Не удалось сохранить план CRM: ${error.message}`);
  }

  return mapSalesPlan(data as DbCrmSalesPlanRow);
}

export async function getCrmDealDetails(
  dealId: string
): Promise<CrmDealDetails> {
  const { supabase, workspace, membership } = await getAppContext();

  await requireCanAccessCrmDeal({
    supabase,
    workspaceId: workspace.id,
    membership,
    dealId,
  });

  const [
    tasksResult,
    commentsResult,
    activitiesResult,
    conversationsResult,
    messagesResult,
  ] = await Promise.all([
    supabase
      .from("crm_deal_tasks")
      .select("*")
      .eq("workspace_id", workspace.id)
      .eq("deal_id", dealId)
      .order("created_at", { ascending: false }),
    supabase
      .from("crm_deal_comments")
      .select("*")
      .eq("workspace_id", workspace.id)
      .eq("deal_id", dealId)
      .order("created_at", { ascending: true }),
    supabase
      .from("crm_deal_activities")
      .select("*")
      .eq("workspace_id", workspace.id)
      .eq("deal_id", dealId)
      .order("created_at", { ascending: false }),
    supabase
      .from("crm_conversations")
      .select("*")
      .eq("workspace_id", workspace.id)
      .eq("deal_id", dealId)
      .order("created_at", { ascending: true }),
    supabase
      .from("crm_messages")
      .select("*")
      .eq("workspace_id", workspace.id)
      .eq("deal_id", dealId)
      .order("created_at", { ascending: true }),
  ]);

  if (tasksResult.error) {
    throw new Error(`Не удалось загрузить задачи сделки: ${tasksResult.error.message}`);
  }

  if (commentsResult.error) {
    throw new Error(
      `Не удалось загрузить комментарии сделки: ${commentsResult.error.message}`
    );
  }

  if (activitiesResult.error) {
    throw new Error(
      `Не удалось загрузить историю сделки: ${activitiesResult.error.message}`
    );
  }

  if (conversationsResult.error) {
    throw new Error(
      `Не удалось загрузить диалоги сделки: ${conversationsResult.error.message}`
    );
  }

  if (messagesResult.error) {
    throw new Error(
      `Не удалось загрузить сообщения сделки: ${messagesResult.error.message}`
    );
  }

  return {
    dealTasks: (tasksResult.data ?? []) as CrmDealTask[],
    dealComments: (commentsResult.data ?? []) as CrmDealComment[],
    dealActivities: (activitiesResult.data ?? []) as CrmDealActivity[],
    conversations: (conversationsResult.data ?? []) as CrmConversation[],
    messages: (messagesResult.data ?? []) as CrmMessage[],
  };
}

export async function getCrmInbox(): Promise<CrmInboxItem[]> {
  const { supabase, workspace, membership } = await getAppContext();

  const { data: messagesData, error: messagesError } = await supabase
    .from("crm_messages")
    .select("*")
    .eq("workspace_id", workspace.id)
    .not("deal_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(300);

  if (messagesError) {
    throw new Error(`Не удалось загрузить входящие CRM: ${messagesError.message}`);
  }

  const messages = (messagesData ?? []) as CrmMessage[];
  const latestByConversation = new Map<string, CrmMessage>();
  const messageCountByConversation = new Map<string, number>();

  for (const message of messages) {
    if (!latestByConversation.has(message.conversation_id)) {
      latestByConversation.set(message.conversation_id, message);
    }

    messageCountByConversation.set(
      message.conversation_id,
      (messageCountByConversation.get(message.conversation_id) ?? 0) + 1
    );
  }

  const conversationIds = Array.from(latestByConversation.keys());
  if (conversationIds.length === 0) {
    return [];
  }

  const { data: conversationsData, error: conversationsError } = await supabase
    .from("crm_conversations")
    .select("*")
    .eq("workspace_id", workspace.id)
    .in("id", conversationIds);

  if (conversationsError) {
    throw new Error(
      `Не удалось загрузить диалоги CRM: ${conversationsError.message}`
    );
  }

  const conversations = (conversationsData ?? []) as CrmConversation[];
  const dealIds = Array.from(
    new Set(conversations.map((conversation) => conversation.deal_id).filter(Boolean))
  ) as string[];

  if (dealIds.length === 0) {
    return [];
  }

  const [
    dealsResult,
    assigneesResult,
  ] = await Promise.all([
    supabase
      .from("crm_deals")
      .select("*")
      .eq("workspace_id", workspace.id)
      .in("id", dealIds),
    supabase
      .from("crm_deal_assignees")
      .select("*")
      .eq("workspace_id", workspace.id)
      .in("deal_id", dealIds),
  ]);

  if (dealsResult.error) {
    throw new Error(`Не удалось загрузить сделки входящих: ${dealsResult.error.message}`);
  }

  if (assigneesResult.error) {
    throw new Error(
      `Не удалось загрузить ответственных входящих: ${assigneesResult.error.message}`
    );
  }

  const assignees = (assigneesResult.data ?? []) as CrmDealAssignee[];
  const assigneesByDeal = new Map<string, CrmDealAssignee[]>();

  for (const assignee of assignees) {
    const current = assigneesByDeal.get(assignee.deal_id) ?? [];
    current.push(assignee);
    assigneesByDeal.set(assignee.deal_id, current);
  }

  const role = resolveRole(membership?.role);
  const canViewAllDeals = role ? canViewAllCrmDeals(role) : false;
  const dealsById = new Map(
    ((dealsResult.data ?? []) as DbCrmDealRow[]).map((deal) => [
      deal.id,
      mapDeal(deal, assigneesByDeal.get(deal.id) ?? []),
    ])
  );
  const now = Date.now();

  return conversations
    .map((conversation) => {
      const deal = conversation.deal_id
        ? dealsById.get(conversation.deal_id)
        : null;
      const lastMessage = latestByConversation.get(conversation.id);

      if (!deal || !lastMessage) {
        return null;
      }

      if (
        !canViewAllDeals &&
        !deal.assignees.some(
          (assignee) => assignee.workspace_member_id === membership?.id
        )
      ) {
        return null;
      }

      const minutesWaiting = Math.max(
        0,
        Math.round((now - new Date(lastMessage.created_at).getTime()) / 60000)
      );
      const lastClientMessageAt =
        conversation.last_client_message_at ??
        (lastMessage.sender_type === "client" ? lastMessage.created_at : null);
      const lastManagerMessageAt =
        conversation.last_manager_message_at ??
        (lastMessage.sender_type === "manager" ? lastMessage.created_at : null);
      const needsReply =
        deal.status === "open" &&
        isAfter(lastClientMessageAt, lastManagerMessageAt);
      const isUnread = isAfter(lastClientMessageAt, conversation.read_at);

      return {
        conversation,
        deal,
        lastMessage,
        needsReply,
        isUnread,
        minutesWaiting,
        messageCount: messageCountByConversation.get(conversation.id) ?? 1,
      };
    })
    .filter((item): item is CrmInboxItem => Boolean(item))
    .sort((a, b) => {
      if (a.needsReply !== b.needsReply) {
        return a.needsReply ? -1 : 1;
      }

      if (a.isUnread !== b.isUnread) {
        return a.isUnread ? -1 : 1;
      }

      return (
        new Date(b.lastMessage.created_at).getTime() -
        new Date(a.lastMessage.created_at).getTime()
      );
    });
}

export async function markCrmConversationRead(
  conversationId: string
): Promise<CrmConversation> {
  const { supabase, workspace } = await getAppContext();
  const readAt = new Date().toISOString();

  const { data, error } = await supabase
    .from("crm_conversations")
    .update({
      read_at: readAt,
      updated_at: readAt,
    })
    .eq("id", conversationId)
    .eq("workspace_id", workspace.id)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(
      `Не удалось отметить диалог прочитанным: ${error?.message ?? "нет данных"}`
    );
  }

  return data as CrmConversation;
}

async function resolveAutoAssigneeIds(params: {
  sourceId?: string | null;
}) {
  if (!params.sourceId) {
    return [];
  }

  const { supabase, workspace } = await getAppContext();

  const { data: source } = await supabase
    .from("crm_sources")
    .select("kind")
    .eq("id", params.sourceId)
    .eq("workspace_id", workspace.id)
    .maybeSingle();

  const sourceKind = String(source?.kind || "");

  if (!sourceKind) {
    return [];
  }

  const { data: rule } = await supabase
    .from("crm_assignment_rules")
    .select("*")
    .eq("workspace_id", workspace.id)
    .eq("source_kind", sourceKind)
    .eq("is_active", true)
    .maybeSingle();

  const mappedRule = rule
    ? mapAssignmentRule(rule as DbCrmAssignmentRuleRow)
    : null;

  if (
    !mappedRule ||
    mappedRule.mode === "manual" ||
    mappedRule.target_member_ids.length === 0
  ) {
    return [];
  }

  if (mappedRule.mode === "fixed_manager") {
    return mappedRule.target_member_ids;
  }

  const { data: assignees } = await supabase
    .from("crm_deal_assignees")
    .select("workspace_member_id, crm_deals!inner(status)")
    .eq("workspace_id", workspace.id)
    .in("workspace_member_id", mappedRule.target_member_ids)
    .eq("crm_deals.status", "open");

  const loadByMemberId = new Map(
    mappedRule.target_member_ids.map((memberId) => [memberId, 0])
  );

  for (const assignee of assignees ?? []) {
    const memberId = String(assignee.workspace_member_id);
    loadByMemberId.set(memberId, (loadByMemberId.get(memberId) ?? 0) + 1);
  }

  const [selectedMemberId] = [...loadByMemberId.entries()].sort(
    (a, b) => a[1] - b[1]
  )[0] ?? [mappedRule.target_member_ids[0]];

  return selectedMemberId ? [selectedMemberId] : [];
}

export async function createCrmDeal(input: CreateCrmDealInput): Promise<CrmDeal> {
  await requireBillingAccess();

  const { supabase, workspace, user, membership } = await getAppContext();
  const assigneeIds = normalizeIds(input.assignee_ids);
  let resolvedAssigneeIds =
    assigneeIds.length > 0
      ? assigneeIds
      : await resolveAutoAssigneeIds({ sourceId: input.source_id });

  if (!roleCanViewAllCrmDeals(membership?.role)) {
    if (!membership?.id) {
      throw new Error("Нет доступа к созданию сделки CRM");
    }

    resolvedAssigneeIds = [membership.id];
  }

  const { data, error } = await supabase
    .from("crm_deals")
    .insert({
      workspace_id: workspace.id,
      created_by: user.id,
      pipeline_id: input.pipeline_id,
      stage_id: input.stage_id,
      client_id: input.client_id ?? null,
      title: input.title.trim(),
      client_name: input.client_name?.trim() || null,
      phone: input.phone?.trim() || null,
      telegram: input.telegram?.trim() || null,
      source_id: input.source_id || null,
      service_amount: input.service_amount ?? null,
      budget: input.budget ?? null,
      next_contact_at: input.next_contact_at || null,
      description: input.description?.trim() || null,
      status: "open",
      position: Date.now(),
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(`Не удалось создать сделку CRM: ${error?.message ?? "нет данных"}`);
  }

  let assignees: CrmDealAssignee[] = [];

  if (resolvedAssigneeIds.length > 0) {
    const { data: assigneeData, error: assigneeError } = await supabase
      .from("crm_deal_assignees")
      .insert(
        resolvedAssigneeIds.map((workspaceMemberId) => ({
          workspace_id: workspace.id,
          deal_id: data.id,
          workspace_member_id: workspaceMemberId,
        }))
      )
      .select("*");

    if (assigneeError) {
      throw new Error(
        `Сделка создана, но ответственные не сохранились: ${assigneeError.message}`
      );
    }

    assignees = (assigneeData ?? []) as CrmDealAssignee[];
  }

  await createCrmActivity({
    dealId: data.id,
    action: "deal_created",
    payload: {
      title: input.title,
      client_name: input.client_name ?? null,
    },
  });
  await createCrmStageHistory({
    dealId: data.id,
    fromPipelineId: null,
    fromStageId: null,
    toPipelineId: input.pipeline_id,
    toStageId: input.stage_id,
  });

  return mapDeal(data as DbCrmDealRow, assignees);
}

export async function updateCrmDeal(
  dealId: string,
  input: UpdateCrmDealInput
): Promise<CrmDeal> {
  await requireBillingAccess();

  const { supabase, workspace, membership } = await getAppContext();
  await requireCanAccessCrmDeal({
    supabase,
    workspaceId: workspace.id,
    membership,
    dealId,
  });

  const canManageAllDeals = roleCanViewAllCrmDeals(membership?.role);
  const assigneeIds =
    input.assignee_ids === undefined || !canManageAllDeals
      ? undefined
      : normalizeIds(input.assignee_ids);

  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  for (const key of [
    "pipeline_id",
    "stage_id",
    "client_id",
    "title",
    "client_name",
    "phone",
    "telegram",
    "source_id",
    "source_item_id",
    "source_item_title",
    "source_item_url",
    "service_amount",
    "budget",
    "next_contact_at",
    "description",
    "status",
    "loss_reason_id",
    "loss_comment",
    "project_id",
    "position",
  ] as const) {
    if (input[key] !== undefined) {
      payload[key] = input[key];
    }
  }

  const { data, error } = await supabase
    .from("crm_deals")
    .update(payload)
    .eq("id", dealId)
    .eq("workspace_id", workspace.id)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(`Не удалось обновить сделку CRM: ${error?.message ?? "нет данных"}`);
  }

  if (assigneeIds) {
    const { error: deleteError } = await supabase
      .from("crm_deal_assignees")
      .delete()
      .eq("deal_id", dealId)
      .eq("workspace_id", workspace.id);

    if (deleteError) {
      throw new Error(`Не удалось обновить ответственных CRM: ${deleteError.message}`);
    }

    if (assigneeIds.length > 0) {
      const { error: insertError } = await supabase
        .from("crm_deal_assignees")
        .insert(
          assigneeIds.map((workspaceMemberId) => ({
            workspace_id: workspace.id,
            deal_id: dealId,
            workspace_member_id: workspaceMemberId,
          }))
        );

      if (insertError) {
        throw new Error(
          `Не удалось сохранить ответственных CRM: ${insertError.message}`
        );
      }
    }
  }

  const { data: assigneesData, error: assigneesError } = await supabase
    .from("crm_deal_assignees")
    .select("*")
    .eq("deal_id", dealId)
    .eq("workspace_id", workspace.id);

  if (assigneesError) {
    throw new Error(`Не удалось загрузить ответственных CRM: ${assigneesError.message}`);
  }

  await createCrmActivity({
    dealId,
    action: "deal_updated",
    payload: {
      changed_fields: Object.keys(payload).filter((key) => key !== "updated_at"),
    },
  });

  return mapDeal(data as DbCrmDealRow, (assigneesData ?? []) as CrmDealAssignee[]);
}

export async function moveCrmDeal(input: MoveCrmDealInput): Promise<CrmDeal> {
  const { supabase, workspace } = await getAppContext();
  const { data: previousDeal, error: previousDealError } = await supabase
    .from("crm_deals")
    .select("pipeline_id, stage_id")
    .eq("workspace_id", workspace.id)
    .eq("id", input.dealId)
    .single();

  if (previousDealError) {
    throw new Error(
      `Не удалось проверить текущий этап сделки: ${previousDealError.message}`
    );
  }

  const deal = await updateCrmDeal(input.dealId, {
    pipeline_id: input.pipelineId,
    stage_id: input.stageId,
    position: input.position,
    status: input.status ?? "open",
    loss_reason_id: input.loss_reason_id ?? null,
    loss_comment: input.loss_comment ?? null,
  });

  await createCrmActivity({
    dealId: input.dealId,
    action: input.status === "lost" ? "deal_lost" : "deal_moved",
    payload: {
      stage_id: input.stageId,
      status: input.status ?? "open",
      loss_reason_id: input.loss_reason_id ?? null,
    },
  });
  const previousPipelineId = previousDeal?.pipeline_id ?? null;
  const previousStageId = previousDeal?.stage_id ?? null;

  if (previousPipelineId !== input.pipelineId || previousStageId !== input.stageId) {
    await createCrmStageHistory({
      dealId: input.dealId,
      fromPipelineId: previousPipelineId,
      fromStageId: previousStageId,
      toPipelineId: input.pipelineId,
      toStageId: input.stageId,
    });
  }

  return deal;
}

export async function createCrmPipeline(
  input: CreateCrmPipelineInput
): Promise<CrmPipeline> {
  await requireBillingAccess();
  await requireCanManageCrmSettings();

  const { supabase, workspace } = await getAppContext();
  const name = input.name.trim();

  if (!name) {
    throw new Error("Укажи название CRM-воронки");
  }

  const { count, error: countError } = await supabase
    .from("crm_pipelines")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspace.id)
    .eq("is_active", true);

  if (countError) {
    throw new Error(`Не удалось проверить CRM-воронки: ${countError.message}`);
  }

  const { data, error } = await supabase
    .from("crm_pipelines")
    .insert({
      workspace_id: workspace.id,
      name,
      kind: input.kind,
      sort_order: ((count ?? 0) + 1) * 10,
      is_active: true,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(
      `Не удалось создать CRM-воронку: ${error?.message ?? "нет данных"}`
    );
  }

  const pipeline = mapPipeline(data as DbCrmPipelineRow);
  const stagePayload =
    input.kind === "delivery"
      ? DEFAULT_DELIVERY_STAGES.map((stageName, index) => ({
          workspace_id: workspace.id,
          pipeline_id: pipeline.id,
          name: stageName,
          kind: "delivery",
          sort_order: (index + 1) * 10,
          is_active: true,
        }))
      : DEFAULT_SALES_STAGES.map((stage, index) => ({
          workspace_id: workspace.id,
          pipeline_id: pipeline.id,
          name: stage.name,
          kind: stage.kind,
          sort_order: (index + 1) * 10,
          is_active: true,
        }));

  const { error: stagesError } = await supabase
    .from("crm_pipeline_stages")
    .insert(stagePayload);

  if (stagesError) {
    await supabase
      .from("crm_pipelines")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("id", pipeline.id)
      .eq("workspace_id", workspace.id);

    throw new Error(`Не удалось создать этапы CRM: ${stagesError.message}`);
  }

  return pipeline;
}

export async function updateCrmPipeline(
  pipelineId: string,
  input: UpdateCrmPipelineInput
): Promise<CrmPipeline> {
  await requireBillingAccess();
  await requireCanManageCrmSettings();

  const { supabase, workspace } = await getAppContext();
  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) {
      throw new Error("Укажи название CRM-воронки");
    }
    payload.name = name;
  }

  for (const key of ["kind", "sort_order", "is_active"] as const) {
    if (input[key] !== undefined) {
      payload[key] = input[key];
    }
  }

  const { data, error } = await supabase
    .from("crm_pipelines")
    .update(payload)
    .eq("id", pipelineId)
    .eq("workspace_id", workspace.id)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(
      `Не удалось обновить CRM-воронку: ${error?.message ?? "нет данных"}`
    );
  }

  return mapPipeline(data as DbCrmPipelineRow);
}

export async function upsertCrmAssignmentRule(
  input: UpsertCrmAssignmentRuleInput
): Promise<CrmAssignmentRule> {
  await requireBillingAccess();
  await requireCanManageCrmSettings();

  const { supabase, workspace } = await getAppContext();
  const sourceKind = input.source_kind?.trim() || null;
  const targetMemberIds = normalizeIds(input.target_member_ids);

  const { data: existing, error: existingError } = await supabase
    .from("crm_assignment_rules")
    .select("id")
    .eq("workspace_id", workspace.id)
    .eq("source_kind", sourceKind)
    .maybeSingle();

  if (existingError) {
    throw new Error(
      `Не удалось проверить правило распределения CRM: ${existingError.message}`
    );
  }

  const payload = {
    workspace_id: workspace.id,
    source_kind: sourceKind,
    mode: input.mode,
    target_member_ids: targetMemberIds,
    is_active: input.is_active ?? true,
    updated_at: new Date().toISOString(),
  };

  const query = existing?.id
    ? supabase
        .from("crm_assignment_rules")
        .update(payload)
        .eq("id", existing.id)
        .eq("workspace_id", workspace.id)
    : supabase.from("crm_assignment_rules").insert(payload);

  const { data, error } = await query.select("*").single();

  if (error || !data) {
    throw new Error(
      `Не удалось сохранить правило распределения CRM: ${
        error?.message ?? "нет данных"
      }`
    );
  }

  return mapAssignmentRule(data as DbCrmAssignmentRuleRow);
}

export async function createCrmStage(
  input: CreateCrmStageInput
): Promise<CrmStage> {
  await requireBillingAccess();
  await requireCanManageCrmSettings();

  const { supabase, workspace } = await getAppContext();

  const { data, error } = await supabase
    .from("crm_pipeline_stages")
    .insert({
      workspace_id: workspace.id,
      pipeline_id: input.pipeline_id,
      name: input.name.trim(),
      kind: input.kind ?? "regular",
      sort_order: input.sort_order ?? Date.now(),
      is_active: true,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(
      `Не удалось создать этап CRM: ${error?.message ?? "нет данных"}`
    );
  }

  return mapStage(data as DbCrmStageRow);
}

export async function updateCrmStage(
  stageId: string,
  input: UpdateCrmStageInput
): Promise<CrmStage> {
  await requireBillingAccess();
  await requireCanManageCrmSettings();

  const { supabase, workspace } = await getAppContext();

  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  for (const key of [
    "name",
    "kind",
    "sort_order",
    "is_active",
  ] as const) {
    if (input[key] !== undefined) {
      payload[key] = input[key];
    }
  }

  const { data, error } = await supabase
    .from("crm_pipeline_stages")
    .update(payload)
    .eq("id", stageId)
    .eq("workspace_id", workspace.id)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(
      `Не удалось обновить этап CRM: ${error?.message ?? "нет данных"}`
    );
  }

  return mapStage(data as DbCrmStageRow);
}

export async function updateCrmStageOrder(
  updates: UpdateCrmStageOrderInput[]
): Promise<CrmStage[]> {
  await requireBillingAccess();
  await requireCanManageCrmSettings();

  const { supabase, workspace } = await getAppContext();

  const updatedStages: CrmStage[] = [];

  for (const item of updates) {
    const { data, error } = await supabase
      .from("crm_pipeline_stages")
      .update({
        sort_order: item.sortOrder,
        updated_at: new Date().toISOString(),
      })
      .eq("id", item.stageId)
      .eq("workspace_id", workspace.id)
      .select("*")
      .single();

    if (error || !data) {
      throw new Error(
        `Не удалось обновить порядок этапов CRM: ${
          error?.message ?? "нет данных"
        }`
      );
    }

    updatedStages.push(mapStage(data as DbCrmStageRow));
  }

  return updatedStages;
}

export async function createCrmDealTask(
  input: CreateCrmDealTaskInput
): Promise<CrmDealTask> {
  await requireBillingAccess();

  const { supabase, workspace, membership } = await getAppContext();
  await requireCanAccessCrmDeal({
    supabase,
    workspaceId: workspace.id,
    membership,
    dealId: input.deal_id,
  });

  const { data, error } = await supabase
    .from("crm_deal_tasks")
    .insert({
      workspace_id: workspace.id,
      deal_id: input.deal_id,
      title: input.title.trim(),
      assignee_member_id: input.assignee_member_id || null,
      due_at: input.due_at || null,
      status: "todo",
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(
      `Не удалось создать задачу по сделке: ${error?.message ?? "нет данных"}`
    );
  }

  await createCrmActivity({
    dealId: input.deal_id,
    action: "task_created",
    payload: {
      task_id: data.id,
      title: input.title,
    },
  });

  return data as CrmDealTask;
}

export async function updateCrmDealTask(
  taskId: string,
  input: UpdateCrmDealTaskInput
): Promise<CrmDealTask> {
  await requireBillingAccess();

  const { supabase, workspace, membership } = await getAppContext();
  const { data: existingTask, error: existingTaskError } = await supabase
    .from("crm_deal_tasks")
    .select("deal_id")
    .eq("id", taskId)
    .eq("workspace_id", workspace.id)
    .maybeSingle();

  if (existingTaskError) {
    throw new Error(
      `Не удалось проверить задачу по сделке: ${existingTaskError.message}`
    );
  }

  if (!existingTask?.deal_id) {
    throw new Error("Задача по сделке не найдена");
  }

  await requireCanAccessCrmDeal({
    supabase,
    workspaceId: workspace.id,
    membership,
    dealId: existingTask.deal_id,
  });

  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  for (const key of [
    "title",
    "assignee_member_id",
    "due_at",
    "status",
  ] as const) {
    if (input[key] !== undefined) {
      payload[key] = input[key];
    }
  }

  const { data, error } = await supabase
    .from("crm_deal_tasks")
    .update(payload)
    .eq("id", taskId)
    .eq("workspace_id", workspace.id)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(
      `Не удалось обновить задачу по сделке: ${error?.message ?? "нет данных"}`
    );
  }

  await createCrmActivity({
    dealId: data.deal_id,
    action: input.status === "done" ? "task_completed" : "task_updated",
    payload: {
      task_id: data.id,
      changed_fields: Object.keys(payload).filter((key) => key !== "updated_at"),
    },
  });

  return data as CrmDealTask;
}

export async function createCrmDealComment(
  input: CreateCrmDealCommentInput
): Promise<CrmDealComment> {
  await requireBillingAccess();

  const { supabase, workspace, membership } = await getAppContext();
  await requireCanAccessCrmDeal({
    supabase,
    workspaceId: workspace.id,
    membership,
    dealId: input.deal_id,
  });

  const { data, error } = await supabase
    .from("crm_deal_comments")
    .insert({
      workspace_id: workspace.id,
      deal_id: input.deal_id,
      author_member_id: membership?.id ?? null,
      body: input.body.trim(),
      file_url: input.file_url ?? null,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(
      `Не удалось сохранить комментарий по сделке: ${
        error?.message ?? "нет данных"
      }`
    );
  }

  await createCrmActivity({
    dealId: input.deal_id,
    action: "comment_created",
    payload: {
      comment_id: data.id,
    },
  });

  return data as CrmDealComment;
}

export async function createCrmMessage(
  input: CreateCrmMessageInput
): Promise<CrmMessage> {
  const response = await fetch("/api/crm/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  const data = await response.json();

  if (!response.ok || !data.ok) {
    throw new Error(data.error || "Не удалось отправить сообщение CRM");
  }

  return data.message as CrmMessage;
}
