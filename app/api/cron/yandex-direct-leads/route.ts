import { createClient } from "@supabase/supabase-js";
import { sendCronErrorNotification } from "../send-cron-error-notification";
import { getCronSecret, verifyCronSecret } from "../verify-cron-secret";

export const dynamic = "force-dynamic";

type DirectIntegration = {
  id: string;
  workspace_id: string;
  name: string | null;
  oauth_token: string;
  client_login: string | null;
  turbo_page_ids: Array<number | string> | null;
  last_synced_at: string | null;
};

type DirectLead = {
  Id: string;
  SubmittedAt: string;
  TurboPageId: string;
  TurboPageName: string;
  Data?: Array<{ Name: string; Value: string }>;
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

function toDirectDate(value: Date) {
  return value.toISOString().replace(/\.\d{3}Z$/, "Z");
}

function normalizeText(value: unknown) {
  if (typeof value === "number" || typeof value === "bigint") {
    return String(value).trim();
  }

  return typeof value === "string" ? value.trim() : "";
}

function findField(fields: Record<string, string>, names: string[]) {
  const lowerFields = new Map(
    Object.entries(fields).map(([key, value]) => [key.toLowerCase(), value])
  );

  for (const name of names) {
    const directValue = fields[name];

    if (directValue) {
      return directValue;
    }

    const lowerValue = lowerFields.get(name.toLowerCase());

    if (lowerValue) {
      return lowerValue;
    }
  }

  return "";
}

function toNumberOrNull(value: string) {
  if (!value) return null;

  const parsed = Number(value.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

async function fetchDirectLeads(params: {
  integration: DirectIntegration;
  dateTimeFrom: string;
  dateTimeTo: string;
}) {
  const turboPageIds = (params.integration.turbo_page_ids ?? [])
    .map((id) => Number(id))
    .filter((id) => Number.isFinite(id));

  if (turboPageIds.length === 0) {
    return [];
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${params.integration.oauth_token}`,
    "Content-Type": "application/json; charset=utf-8",
    Accept: "application/json",
  };

  if (params.integration.client_login) {
    headers["Client-Login"] = params.integration.client_login;
  }

  const response = await fetch("https://api.direct.yandex.com/json/v5/leads", {
    method: "POST",
    headers,
    body: JSON.stringify({
      method: "get",
      params: {
        SelectionCriteria: {
          TurboPageIds: turboPageIds,
          DateTimeFrom: params.dateTimeFrom,
          DateTimeTo: params.dateTimeTo,
        },
        FieldNames: ["Id", "SubmittedAt", "TurboPageId", "TurboPageName", "Data"],
        Page: {
          Limit: 10000,
          Offset: 0,
        },
      },
    }),
    cache: "no-store",
  });

  const data = await response.json().catch(() => null);

  if (!response.ok || data?.error) {
    throw new Error(
      `Yandex Direct Leads API error: ${response.status} ${JSON.stringify(data)}`
    );
  }

  return (data?.result?.Leads ?? []) as DirectLead[];
}

async function createCrmDealFromLead(params: {
  request: Request;
  integration: DirectIntegration;
  lead: DirectLead;
}) {
  const leadFields = Array.isArray(params.lead.Data) ? params.lead.Data : [];
  const fields = Object.fromEntries(
    leadFields.map((item) => [item.Name, item.Value])
  );
  const clientName = findField(fields, ["name", "Name", "Имя", "ФИО"]);
  const phone = findField(fields, ["phone", "Phone", "Телефон", "tel"]);
  const telegram = findField(fields, ["telegram", "Telegram", "tg"]);
  const budget = toNumberOrNull(findField(fields, ["budget", "Бюджет"]));
  const serviceAmount = toNumberOrNull(
    findField(fields, ["serviceAmount", "Стоимость услуги"])
  );
  const descriptionLines = Object.entries(fields)
    .filter(([, value]) => normalizeText(value))
    .map(([key, value]) => `${key}: ${value}`);

  const response = await fetch(new URL("/api/crm/leads", params.request.url), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getCronSecret()}`,
    },
    body: JSON.stringify({
      workspaceId: params.integration.workspace_id,
      sourceKind: "yandex_direct",
      sourceName: "Яндекс Директ",
      title: params.lead.TurboPageName
        ? `Заявка Яндекс Директ: ${params.lead.TurboPageName}`
        : clientName
          ? `Заявка Яндекс Директ: ${clientName}`
          : "Заявка Яндекс Директ",
      clientName,
      phone,
      telegram,
      serviceAmount,
      budget,
      nextContactAt: params.lead.SubmittedAt,
      description: [
        "Заявка автоматически получена из Yandex Direct Leads API.",
        `TurboPageId: ${params.lead.TurboPageId}`,
        params.lead.TurboPageName
          ? `Страница: ${params.lead.TurboPageName}`
          : null,
        "",
        ...descriptionLines,
      ]
        .filter((line) => line !== null)
        .join("\n"),
    }),
    cache: "no-store",
  });

  const result = await response.json().catch(() => null);

  if (!response.ok || !result?.ok) {
    throw new Error(
      `CRM lead create failed: ${response.status} ${JSON.stringify(result)}`
    );
  }

  return result as { dealId: string };
}

export async function GET(request: Request) {
  if (!verifyCronSecret(request)) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabase();
  const startedAt = new Date();

  try {
    const { data: integrations, error } = await supabase
      .from("crm_yandex_direct_integrations")
      .select("*")
      .eq("is_active", true);

    if (error) {
      throw new Error(`Yandex Direct integrations load failed: ${error.message}`);
    }

    let createdDeals = 0;
    let skippedDuplicates = 0;
    const errors: Array<{ integrationId: string; error: string }> = [];

    for (const integration of (integrations ?? []) as DirectIntegration[]) {
      try {
        const fromDate = integration.last_synced_at
          ? new Date(new Date(integration.last_synced_at).getTime() - 10 * 60 * 1000)
          : new Date(startedAt.getTime() - 24 * 60 * 60 * 1000);
        const dateTimeFrom = toDirectDate(fromDate);
        const dateTimeTo = toDirectDate(startedAt);
        const leads = await fetchDirectLeads({
          integration,
          dateTimeFrom,
          dateTimeTo,
        });

        for (const lead of leads) {
          const externalLeadId = String(lead.Id);
          const { data: existingImport, error: existingImportError } =
            await supabase
              .from("crm_yandex_direct_imports")
              .select("id")
              .eq("integration_id", integration.id)
              .eq("external_lead_id", externalLeadId)
              .maybeSingle();

          if (existingImportError) {
            throw new Error(
              `Yandex Direct import lookup failed: ${existingImportError.message}`
            );
          }

          if (existingImport) {
            skippedDuplicates += 1;
            continue;
          }

          const crmResult = await createCrmDealFromLead({
            request,
            integration,
            lead,
          });

          const { error: insertImportError } = await supabase
            .from("crm_yandex_direct_imports")
            .insert({
              workspace_id: integration.workspace_id,
              integration_id: integration.id,
              external_lead_id: externalLeadId,
              deal_id: crmResult.dealId,
              submitted_at: lead.SubmittedAt,
              raw: lead,
            });

          if (insertImportError) {
            throw new Error(
              `Yandex Direct import save failed: ${insertImportError.message}`
            );
          }

          createdDeals += 1;
        }

        await supabase
          .from("crm_yandex_direct_integrations")
          .update({
            last_synced_at: startedAt.toISOString(),
            updated_at: startedAt.toISOString(),
          })
          .eq("id", integration.id);
      } catch (error) {
        errors.push({
          integrationId: integration.id,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    if (errors.length > 0) {
      await sendCronErrorNotification({
        title: "Ошибка Yandex Direct Leads Sync",
        route: "/api/cron/yandex-direct-leads",
        error: JSON.stringify(errors),
      });
    }

    return Response.json({
      ok: errors.length === 0,
      integrations: integrations?.length ?? 0,
      createdDeals,
      skippedDuplicates,
      errors,
    });
  } catch (error) {
    await sendCronErrorNotification({
      title: "Ошибка Yandex Direct Leads Cron",
      route: "/api/cron/yandex-direct-leads",
      error,
    });

    return Response.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Yandex Direct leads sync failed",
      },
      { status: 500 }
    );
  }
}
