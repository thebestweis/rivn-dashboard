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
  senderType?: "client" | "manager" | "system";
  createdAt?: string;
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
  if (typeof value === "number" || typeof value === "bigint") {
    return String(value).trim();
  }

  return typeof value === "string" ? value.trim() : "";
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
  const [source, pipelineContext, assigneeIds] = await Promise.all([
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
    const { data: existingConversation, error: conversationLookupError } =
      await supabase
        .from("crm_conversations")
        .select("*")
        .eq("workspace_id", workspaceId)
        .eq("channel", channel)
        .eq("external_id", externalDialogId)
        .maybeSingle();

    if (conversationLookupError) {
      throw new Error(
        `CRM conversation lookup failed: ${conversationLookupError.message}`
      );
    }

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
      const { data: duplicate, error: duplicateError } = await supabase
        .from("crm_messages")
        .select("id")
        .eq("workspace_id", workspaceId)
        .eq("conversation_id", conversation.id)
        .eq("external_id", externalMessageId)
        .maybeSingle();

      if (duplicateError) {
        throw new Error(`CRM message lookup failed: ${duplicateError.message}`);
      }

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
        attachment_url: null,
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
      .update({ updated_at: new Date().toISOString() })
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
