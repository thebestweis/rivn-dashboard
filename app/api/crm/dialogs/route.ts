import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

type DialogPayload = {
  workspaceId?: string;
  channel?: "avito" | "telegram" | "tilda" | "yandex_direct" | "manual";
  avitoUserId?: string | number;
  externalDialogId?: string;
  externalMessageId?: string;
  sourceKind?: string;
  sourceName?: string;
  title?: string;
  clientName?: string;
  phone?: string;
  telegram?: string;
  sourceItemId?: string | number | null;
  sourceItemTitle?: string | null;
  sourceItemUrl?: string | null;
  body?: string;
  attachmentUrl?: string | null;
  senderType?: "client" | "manager" | "system";
  createdAt?: string;
};

type ServiceSupabase = any;
type AssignmentRuleRow = {
  source_kind: string | null;
  mode: "manual" | "round_robin" | "least_loaded" | "fixed_manager";
  target_member_ids: string[] | null;
  settings?: {
    max_open_deals_per_manager?: number | null;
    priority_member_ids?: string[];
    disabled_member_ids?: string[];
  } | null;
};
type ResolvedAssignment = {
  assigneeIds: string[];
  payload: Record<string, unknown>;
};

const DEFAULT_SALES_STAGES = [
  { name: "Заявка получена", kind: "regular" },
  { name: "Первичная квалификация", kind: "regular" },
  { name: "Сбор информации", kind: "regular" },
  { name: "КП отправлено", kind: "regular" },
  { name: "Переговоры", kind: "regular" },
  { name: "Оплата", kind: "payment" },
  { name: "Проект оплачен", kind: "paid_project" },
  { name: "Потеряно", kind: "lost" },
] as const;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function getSupabase() {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase env is missing");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function getExpectedSecrets() {
  return [
    process.env.CRM_WEBHOOK_SECRET,
    process.env.CRON_SECRET,
    process.env.VERCEL_CRON_SECRET,
  ].filter((value): value is string => Boolean(value));
}

function verifyWebhookSecret(request: Request) {
  const url = new URL(request.url);
  const querySecret = url.searchParams.get("secret");
  const authorization = request.headers.get("authorization");
  const bearerSecret = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : null;
  const headerSecret = request.headers.get("x-rivn-secret");
  const expectedSecrets = getExpectedSecrets();

  if (expectedSecrets.length === 0) {
    throw new Error("CRM webhook secret is not configured");
  }

  return [querySecret, bearerSecret, headerSecret].some((secret) =>
    expectedSecrets.includes(secret ?? "")
  );
}

function normalizeText(value: unknown) {
  if (typeof value === "number" || typeof value === "bigint") {
    return String(value).trim();
  }

  return typeof value === "string" ? value.trim() : "";
}

function normalizeIds(ids?: string[] | null) {
  return Array.from(new Set((ids ?? []).map((id) => id.trim()).filter(Boolean)));
}

function getAssignmentCandidates(rule: AssignmentRuleRow) {
  const targetMemberIds = normalizeIds(rule.target_member_ids);
  const disabledIds = new Set(normalizeIds(rule.settings?.disabled_member_ids));
  const priorityIndex = new Map(
    normalizeIds(rule.settings?.priority_member_ids).map((memberId, index) => [
      memberId,
      index,
    ])
  );

  return targetMemberIds
    .filter((memberId) => !disabledIds.has(memberId))
    .sort((left, right) => {
      const leftIndex = priorityIndex.get(left) ?? Number.MAX_SAFE_INTEGER;
      const rightIndex = priorityIndex.get(right) ?? Number.MAX_SAFE_INTEGER;
      return leftIndex - rightIndex;
    });
}

async function resolveSource(params: {
  supabase: ServiceSupabase;
  workspaceId: string;
  sourceKind: string;
  sourceName: string;
}) {
  const { data: existing, error: existingError } = await params.supabase
    .from("crm_sources")
    .select("*")
    .eq("workspace_id", params.workspaceId)
    .eq("kind", params.sourceKind)
    .eq("is_active", true)
    .maybeSingle();

  if (existingError) {
    throw new Error(`CRM source lookup failed: ${existingError.message}`);
  }

  if (existing) {
    return existing;
  }

  const { data, error } = await params.supabase
    .from("crm_sources")
    .insert({
      workspace_id: params.workspaceId,
      name: params.sourceName,
      kind: params.sourceKind,
      is_active: true,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(`CRM source create failed: ${error?.message ?? "no data"}`);
  }

  return data;
}

async function isLeadIngestionEnabled(params: {
  supabase: ServiceSupabase;
  workspaceId: string;
  sourceKind: string;
}) {
  if (params.sourceKind === "manual") {
    return true;
  }

  const { data, error } = await params.supabase
    .from("crm_integration_settings")
    .select("is_lead_ingestion_enabled")
    .eq("workspace_id", params.workspaceId)
    .eq("source_kind", params.sourceKind)
    .maybeSingle();

  if (error) {
    throw new Error(`CRM integration setting lookup failed: ${error.message}`);
  }

  return data?.is_lead_ingestion_enabled !== false;
}

async function resolveSalesPipeline(params: {
  supabase: ServiceSupabase;
  workspaceId: string;
}) {
  let { data: pipeline, error: pipelineError } = await params.supabase
    .from("crm_pipelines")
    .select("*")
    .eq("workspace_id", params.workspaceId)
    .eq("kind", "sales")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (pipelineError) {
    throw new Error(`CRM pipeline lookup failed: ${pipelineError.message}`);
  }

  if (!pipeline) {
    const { data: createdPipeline, error: createPipelineError } = await params.supabase
      .from("crm_pipelines")
      .insert({
        workspace_id: params.workspaceId,
        name: "Общая воронка продаж",
        kind: "sales",
        sort_order: 10,
        is_active: true,
      })
      .select("*")
      .single();

    if (createPipelineError || !createdPipeline) {
      throw new Error(
        `CRM sales pipeline create failed: ${createPipelineError?.message ?? "no data"}`
      );
    }

    pipeline = createdPipeline;
  }

  let { data: stage, error: stageError } = await params.supabase
    .from("crm_pipeline_stages")
    .select("*")
    .eq("workspace_id", params.workspaceId)
    .eq("pipeline_id", pipeline.id)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (stageError) {
    throw new Error(`CRM stage lookup failed: ${stageError.message}`);
  }

  if (!stage) {
    const { error: createStagesError } = await params.supabase
      .from("crm_pipeline_stages")
      .insert(
        DEFAULT_SALES_STAGES.map((item, index) => ({
          workspace_id: params.workspaceId,
          pipeline_id: pipeline.id,
          name: item.name,
          kind: item.kind,
          sort_order: (index + 1) * 10,
          is_active: true,
        }))
      );

    if (createStagesError) {
      throw new Error(`CRM sales stages create failed: ${createStagesError.message}`);
    }

    const { data: createdStage, error: createdStageError } = await params.supabase
      .from("crm_pipeline_stages")
      .select("*")
      .eq("workspace_id", params.workspaceId)
      .eq("pipeline_id", pipeline.id)
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (createdStageError || !createdStage) {
      throw new Error(
        `CRM first sales stage lookup failed: ${createdStageError?.message ?? "no data"}`
      );
    }

    stage = createdStage;
  }

  return { pipeline, stage };
}

async function resolveAssigneeIds(params: {
  supabase: ServiceSupabase;
  workspaceId: string;
  sourceKind: string;
}): Promise<ResolvedAssignment> {
  const { data: rules, error: ruleError } = await params.supabase
    .from("crm_assignment_rules")
    .select("*")
    .eq("workspace_id", params.workspaceId)
    .eq("is_active", true)
    .or(`source_kind.eq.${params.sourceKind},source_kind.is.null`);

  if (ruleError) {
    throw new Error(`CRM assignment rule lookup failed: ${ruleError.message}`);
  }

  const typedRules = (rules ?? []) as AssignmentRuleRow[];
  const rule =
    typedRules.find((item) => item.source_kind === params.sourceKind) ??
    typedRules.find((item) => !item.source_kind);
  const targetMemberIds = Array.isArray(rule?.target_member_ids)
    ? rule.target_member_ids.filter(Boolean)
    : [];
  const candidateMemberIds = rule ? getAssignmentCandidates(rule) : [];

  if (
    !rule ||
    rule.mode === "manual" ||
    targetMemberIds.length === 0 ||
    candidateMemberIds.length === 0
  ) {
    return {
      assigneeIds: [],
      payload: {
        source_kind: params.sourceKind,
        mode: rule?.mode ?? "manual",
        rule_source_kind: rule?.source_kind ?? null,
        target_member_ids: targetMemberIds,
        disabled_member_ids: rule?.settings?.disabled_member_ids ?? [],
        reason: !rule
          ? "rule_missing"
          : rule.mode === "manual"
            ? "manual_mode"
            : targetMemberIds.length === 0
              ? "target_members_missing"
              : "all_managers_disabled",
      },
    };
  }

  if (rule.mode === "fixed_manager") {
    return {
      assigneeIds: candidateMemberIds,
      payload: {
        source_kind: params.sourceKind,
        mode: rule.mode,
        rule_source_kind: rule.source_kind,
        target_member_ids: targetMemberIds,
        disabled_member_ids: rule.settings?.disabled_member_ids ?? [],
        selected_member_ids: candidateMemberIds,
        reason: "fixed_manager",
      },
    };
  }

  let assigneesQuery = params.supabase
    .from("crm_deal_assignees")
    .select("workspace_member_id, crm_deals!inner(status)")
    .eq("workspace_id", params.workspaceId)
    .in("workspace_member_id", candidateMemberIds);

  if (rule.mode === "least_loaded") {
    assigneesQuery = assigneesQuery.eq("crm_deals.status", "open");
  }

  const { data: assignees } = await assigneesQuery;

  const loadByMemberId = new Map<string, number>(
    candidateMemberIds.map((memberId: string) => [memberId, 0])
  );

  for (const assignee of assignees ?? []) {
    const memberId = String(assignee.workspace_member_id);
    loadByMemberId.set(memberId, (loadByMemberId.get(memberId) ?? 0) + 1);
  }

  const maxOpenDeals = rule.settings?.max_open_deals_per_manager;
  const priorityIndex = new Map(
    normalizeIds(rule.settings?.priority_member_ids).map((memberId, index) => [
      memberId,
      index,
    ])
  );
  const availableEntries = [...loadByMemberId.entries()].filter(
    ([, load]) =>
      typeof maxOpenDeals !== "number" || maxOpenDeals <= 0 || load < maxOpenDeals
  );
  const [selectedMemberId] = (availableEntries.length > 0
    ? availableEntries
    : [...loadByMemberId.entries()]
  ).sort(
    (a, b) =>
      a[1] - b[1] ||
      (priorityIndex.get(a[0]) ?? Number.MAX_SAFE_INTEGER) -
        (priorityIndex.get(b[0]) ?? Number.MAX_SAFE_INTEGER)
  )[0] ?? [candidateMemberIds[0], 0];

  return {
    assigneeIds: selectedMemberId ? [selectedMemberId] : [],
    payload: {
      source_kind: params.sourceKind,
      mode: rule.mode,
      rule_source_kind: rule.source_kind,
      target_member_ids: targetMemberIds,
      disabled_member_ids: rule.settings?.disabled_member_ids ?? [],
      priority_member_ids: rule.settings?.priority_member_ids ?? [],
      max_open_deals_per_manager: maxOpenDeals ?? null,
      selected_member_ids: selectedMemberId ? [selectedMemberId] : [],
      load_by_member_id: Object.fromEntries(loadByMemberId),
      reason:
        availableEntries.length === 0 && typeof maxOpenDeals === "number"
          ? "capacity_limit_overridden"
          : rule.mode === "least_loaded"
          ? "least_open_deals"
          : "equal_distribution",
    },
  };
}

async function createDealForDialog(params: {
  supabase: ServiceSupabase;
  workspaceId: string;
  sourceKind: string;
  sourceName: string;
  title: string;
  clientName: string;
  phone: string | null;
  telegram: string | null;
  sourceItemId: string | null;
  sourceItemTitle: string | null;
  sourceItemUrl: string | null;
}) {
  const [source, pipelineContext, assignment] = await Promise.all([
    resolveSource({
      supabase: params.supabase,
      workspaceId: params.workspaceId,
      sourceKind: params.sourceKind,
      sourceName: params.sourceName,
    }),
    resolveSalesPipeline({
      supabase: params.supabase,
      workspaceId: params.workspaceId,
    }),
    resolveAssigneeIds({
      supabase: params.supabase,
      workspaceId: params.workspaceId,
      sourceKind: params.sourceKind,
    }),
  ]);
  const assigneeIds = assignment.assigneeIds;

  const { data: deal, error: dealError } = await params.supabase
    .from("crm_deals")
    .insert({
      workspace_id: params.workspaceId,
      created_by: null,
      pipeline_id: pipelineContext.pipeline.id,
      stage_id: pipelineContext.stage.id,
      client_id: null,
      title: params.title,
      client_name: params.clientName || null,
      phone: params.phone,
      telegram: params.telegram,
      source_id: source.id,
      source_item_id: params.sourceItemId,
      source_item_title: params.sourceItemTitle,
      source_item_url: params.sourceItemUrl,
      description: "Создано автоматически из входящего диалога.",
      status: "open",
      position: Date.now(),
    })
    .select("*")
    .single();

  if (dealError || !deal) {
    throw new Error(`CRM deal create failed: ${dealError?.message ?? "no data"}`);
  }

  if (assigneeIds.length > 0) {
    const { error: assigneeError } = await params.supabase
      .from("crm_deal_assignees")
      .insert(
        assigneeIds.map((memberId: string) => ({
          workspace_id: params.workspaceId,
          deal_id: deal.id,
          workspace_member_id: memberId,
        }))
      );

    if (assigneeError) {
      throw new Error(`CRM deal assignees failed: ${assigneeError.message}`);
    }
  }

  await params.supabase.from("crm_deal_activities").insert({
    workspace_id: params.workspaceId,
    deal_id: deal.id,
    actor_member_id: null,
    action: "external_dialog_created",
    payload: {
      source_kind: params.sourceKind,
      source_name: params.sourceName,
      assignee_ids: assigneeIds,
    },
  });
  await params.supabase.from("crm_deal_activities").insert({
    workspace_id: params.workspaceId,
    deal_id: deal.id,
    actor_member_id: null,
    action: "assignment_resolved",
    payload: {
      ...assignment.payload,
      source_name: params.sourceName,
      deal_title: params.title,
      client_name: params.clientName || null,
    },
  });

  return deal;
}

export async function POST(request: Request) {
  if (!verifyWebhookSecret(request)) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const payload = (await request.json()) as DialogPayload;
    const workspaceId = normalizeText(payload.workspaceId);
    const channel = payload.channel || "avito";
    const rawExternalDialogId = normalizeText(payload.externalDialogId);
    const avitoUserId = normalizeText(payload.avitoUserId);
    const externalDialogId =
      channel === "avito" && avitoUserId && !rawExternalDialogId.includes(":")
        ? `${avitoUserId}:${rawExternalDialogId}`
        : rawExternalDialogId;
    const externalMessageId = normalizeText(payload.externalMessageId);
    const body = normalizeText(payload.body);
    const sourceKind = normalizeText(payload.sourceKind) || channel;
    const sourceName = normalizeText(payload.sourceName) || sourceKind;
    const clientName = normalizeText(payload.clientName);
    const title =
      normalizeText(payload.title) ||
      clientName ||
      `Новый диалог: ${sourceName}`;

    if (!workspaceId) {
      return Response.json(
        { ok: false, error: "workspaceId is required" },
        { status: 400 }
      );
    }

    if (!externalDialogId) {
      return Response.json(
        { ok: false, error: "externalDialogId is required" },
        { status: 400 }
      );
    }

    if (!body) {
      return Response.json(
        { ok: false, error: "body is required" },
        { status: 400 }
      );
    }

    const supabase = getSupabase();
    const ingestionEnabled = await isLeadIngestionEnabled({
      supabase,
      workspaceId,
      sourceKind,
    });

    if (!ingestionEnabled) {
      return Response.json({
        ok: true,
        skipped: true,
        reason: "lead_ingestion_disabled",
        workspaceId,
        sourceKind,
      });
    }

    const { data: existingConversations, error: conversationLookupError } =
      await supabase
        .from("crm_conversations")
        .select("*")
        .eq("workspace_id", workspaceId)
        .eq("channel", channel)
        .eq("external_id", externalDialogId)
        .order("created_at", { ascending: true })
        .limit(1);

    if (conversationLookupError) {
      throw new Error(
        `CRM conversation lookup failed: ${conversationLookupError.message}`
      );
    }

    const existingConversation = existingConversations?.[0] ?? null;
    let dealId = existingConversation?.deal_id ?? null;

    if (!dealId) {
      const deal = await createDealForDialog({
        supabase,
        workspaceId,
        sourceKind,
        sourceName,
        title,
        clientName,
        phone: normalizeText(payload.phone) || null,
        telegram: normalizeText(payload.telegram) || null,
        sourceItemId: normalizeText(payload.sourceItemId) || null,
        sourceItemTitle: normalizeText(payload.sourceItemTitle) || null,
        sourceItemUrl: normalizeText(payload.sourceItemUrl) || null,
      });

      dealId = deal.id;
    }

    let conversation = existingConversation;

    if (!conversation) {
      const { data, error } = await supabase
        .from("crm_conversations")
        .insert({
          workspace_id: workspaceId,
          deal_id: dealId,
          channel,
          external_id: externalDialogId,
          title,
        })
        .select("*")
        .single();

      if (error || !data) {
        throw new Error(
          `CRM conversation create failed: ${error?.message ?? "no data"}`
        );
      }

      conversation = data;
    }

    if (externalMessageId) {
      const { data: duplicateMessages, error: duplicateError } = await supabase
        .from("crm_messages")
        .select("id")
        .eq("workspace_id", workspaceId)
        .eq("conversation_id", conversation.id)
        .eq("external_id", externalMessageId)
        .order("created_at", { ascending: true })
        .limit(1);

      if (duplicateError) {
        throw new Error(`CRM message lookup failed: ${duplicateError.message}`);
      }

      const duplicate = duplicateMessages?.[0] ?? null;

      if (duplicate) {
        return Response.json({
          ok: true,
          duplicate: true,
          dealId,
          conversationId: conversation.id,
          messageId: duplicate.id,
        });
      }
    }

    const { data: message, error: messageError } = await supabase
      .from("crm_messages")
      .insert({
        workspace_id: workspaceId,
        conversation_id: conversation.id,
        deal_id: dealId,
        sender_type: payload.senderType || "client",
        sender_member_id: null,
        body,
        attachment_url: normalizeText(payload.attachmentUrl) || null,
        external_id: externalMessageId || null,
        created_at: payload.createdAt || new Date().toISOString(),
      })
      .select("*")
      .single();

    if (messageError || !message) {
      throw new Error(
        `CRM message create failed: ${messageError?.message ?? "no data"}`
      );
    }

    await supabase
      .from("crm_conversations")
      .update({
        updated_at: message.created_at,
        last_client_message_at:
          (payload.senderType || "client") === "client"
            ? message.created_at
            : conversation.last_client_message_at ?? null,
        last_manager_message_at:
          payload.senderType === "manager"
            ? message.created_at
            : conversation.last_manager_message_at ?? null,
        read_at:
          payload.senderType === "manager"
            ? message.created_at
            : conversation.read_at ?? null,
      })
      .eq("id", conversation.id)
      .eq("workspace_id", workspaceId);

    await supabase.from("crm_deal_activities").insert({
      workspace_id: workspaceId,
      deal_id: dealId,
      actor_member_id: null,
      action: "external_message_received",
      payload: {
        channel,
        external_dialog_id: externalDialogId,
        external_message_id: externalMessageId || null,
      },
    });

    return Response.json({
      ok: true,
      dealId,
      conversationId: conversation.id,
      messageId: message.id,
    });
  } catch (error) {
    console.error("CRM dialog sync failed:", error);

    return Response.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "CRM dialog sync failed",
      },
      { status: 500 }
    );
  }
}
