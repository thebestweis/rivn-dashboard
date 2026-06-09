import { createClient } from "@supabase/supabase-js";
import { ApiAccessError } from "@/app/api/_guards";
import { readJsonWithLimit } from "@/app/api/_request";
import { matchesAnySecret } from "@/app/api/_secrets";

export const dynamic = "force-dynamic";

type LeadPayload = {
  workspaceId?: string;
  sourceKind?: string;
  sourceName?: string;
  title?: string;
  clientName?: string;
  phone?: string;
  telegram?: string;
  serviceAmount?: number | string | null;
  budget?: number | string | null;
  nextContactAt?: string | null;
  description?: string | null;
};

type ServiceSupabase = ReturnType<typeof getSupabase>;
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

  return matchesAnySecret([querySecret, bearerSecret, headerSecret], expectedSecrets);
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function toNumberOrNull(value: unknown) {
  if (value === null || value === undefined || value === "") return null;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
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
  const { data: pipeline, error: pipelineError } = await params.supabase
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
    throw new Error("Active CRM sales pipeline not found");
  }

  const { data: stage, error: stageError } = await params.supabase
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
    throw new Error("Active CRM first stage not found");
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

export async function POST(request: Request) {
  if (!verifyWebhookSecret(request)) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const payload = await readJsonWithLimit<LeadPayload>(request, 256 * 1024);
    const workspaceId = normalizeText(payload.workspaceId);
    const sourceKind = normalizeText(payload.sourceKind) || "manual";
    const sourceName = normalizeText(payload.sourceName) || sourceKind;
    const title = normalizeText(payload.title);
    const clientName = normalizeText(payload.clientName);

    if (!workspaceId) {
      return Response.json(
        { ok: false, error: "workspaceId is required" },
        { status: 400 }
      );
    }

    if (!title && !clientName) {
      return Response.json(
        { ok: false, error: "title or clientName is required" },
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

    const [source, pipelineContext, assignment] = await Promise.all([
      resolveSource({ supabase, workspaceId, sourceKind, sourceName }),
      resolveSalesPipeline({ supabase, workspaceId }),
      resolveAssigneeIds({ supabase, workspaceId, sourceKind }),
    ]);

    const { pipeline, stage } = pipelineContext;
    const assigneeIds = assignment.assigneeIds;
    const { data: deal, error: dealError } = await supabase
      .from("crm_deals")
      .insert({
        workspace_id: workspaceId,
        created_by: null,
        pipeline_id: pipeline.id,
        stage_id: stage.id,
        client_id: null,
        title: title || clientName || "Новая заявка",
        client_name: clientName || null,
        phone: normalizeText(payload.phone) || null,
        telegram: normalizeText(payload.telegram) || null,
        source_id: source.id,
        service_amount: toNumberOrNull(payload.serviceAmount),
        budget: toNumberOrNull(payload.budget),
        next_contact_at: payload.nextContactAt || null,
        description: normalizeText(payload.description) || null,
        status: "open",
        position: Date.now(),
      })
      .select("*")
      .single();

    if (dealError || !deal) {
      throw new Error(`CRM deal create failed: ${dealError?.message ?? "no data"}`);
    }

    if (assigneeIds.length > 0) {
      const { error: assigneeError } = await supabase
        .from("crm_deal_assignees")
        .insert(
          assigneeIds.map((memberId: string) => ({
            workspace_id: workspaceId,
            deal_id: deal.id,
            workspace_member_id: memberId,
          }))
        );

      if (assigneeError) {
        throw new Error(`CRM deal assignees failed: ${assigneeError.message}`);
      }
    }

    await supabase.from("crm_deal_activities").insert({
      workspace_id: workspaceId,
      deal_id: deal.id,
      actor_member_id: null,
      action: "external_lead_created",
      payload: {
        source_kind: sourceKind,
        source_name: sourceName,
        assignee_ids: assigneeIds,
      },
    });
    await supabase.from("crm_deal_activities").insert({
      workspace_id: workspaceId,
      deal_id: deal.id,
      actor_member_id: null,
      action: "assignment_resolved",
      payload: {
        ...assignment.payload,
        source_name: sourceName,
        deal_title: title || clientName || "Новая заявка",
        client_name: clientName || null,
      },
    });

    return Response.json({
      ok: true,
      dealId: deal.id,
      workspaceId,
      sourceId: source.id,
      pipelineId: pipeline.id,
      stageId: stage.id,
      assigneeIds,
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "CRM lead create failed",
      },
      { status: error instanceof ApiAccessError ? error.status : 500 }
    );
  }
}
