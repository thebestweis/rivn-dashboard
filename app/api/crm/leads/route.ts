import { createClient } from "@supabase/supabase-js";

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

type ServiceSupabase = any;

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
  return typeof value === "string" ? value.trim() : "";
}

function toNumberOrNull(value: unknown) {
  if (value === null || value === undefined || value === "") return null;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
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
}) {
  const { data: rule, error: ruleError } = await params.supabase
    .from("crm_assignment_rules")
    .select("*")
    .eq("workspace_id", params.workspaceId)
    .eq("source_kind", params.sourceKind)
    .eq("is_active", true)
    .maybeSingle();

  if (ruleError) {
    throw new Error(`CRM assignment rule lookup failed: ${ruleError.message}`);
  }

  const targetMemberIds = Array.isArray(rule?.target_member_ids)
    ? rule.target_member_ids.filter(Boolean)
    : [];

  if (!rule || rule.mode === "manual" || targetMemberIds.length === 0) {
    return [];
  }

  if (rule.mode === "fixed_manager") {
    return targetMemberIds;
  }

  const { data: assignees } = await params.supabase
    .from("crm_deal_assignees")
    .select("workspace_member_id, crm_deals!inner(status)")
    .eq("workspace_id", params.workspaceId)
    .in("workspace_member_id", targetMemberIds)
    .eq("crm_deals.status", "open");

  const loadByMemberId = new Map<string, number>(
    targetMemberIds.map((memberId: string) => [memberId, 0])
  );

  for (const assignee of assignees ?? []) {
    const memberId = String(assignee.workspace_member_id);
    loadByMemberId.set(memberId, (loadByMemberId.get(memberId) ?? 0) + 1);
  }

  const [selectedMemberId] = [...loadByMemberId.entries()].sort(
    (a, b) => a[1] - b[1]
  )[0] ?? [targetMemberIds[0], 0];

  return selectedMemberId ? [selectedMemberId] : [];
}

export async function POST(request: Request) {
  if (!verifyWebhookSecret(request)) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const payload = (await request.json()) as LeadPayload;
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
    const [source, pipelineContext, assigneeIds] = await Promise.all([
      resolveSource({ supabase, workspaceId, sourceKind, sourceName }),
      resolveSalesPipeline({ supabase, workspaceId }),
      resolveAssigneeIds({ supabase, workspaceId, sourceKind }),
    ]);

    const { pipeline, stage } = pipelineContext;
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
      { status: 500 }
    );
  }
}
