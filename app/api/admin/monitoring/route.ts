import { apiFailure, apiSuccess } from "@/app/lib/api/errors";
import { requireSuperAdminRoute } from "../_utils";

export const dynamic = "force-dynamic";

type WorkspaceRow = {
  id: string;
  name: string | null;
  owner_user_id: string | null;
  created_at: string | null;
};

type BillingRow = {
  workspace_id: string;
  plan_code: string | null;
  subscription_status: string | null;
  trial_ends_at: string | null;
  subscription_ends_at: string | null;
};

type ProfileRow = {
  id: string;
  email: string | null;
  platform_role?: string | null;
};

type WorkspaceMetricRow = {
  id: string;
  workspace_id: string | null;
  created_at?: string | null;
};

type AvitoAccountRow = {
  id: string;
  client_id: string | null;
  is_active: boolean | null;
  crm_dialogs_enabled?: boolean | null;
};

type AvitoClientRow = {
  id: string;
  workspace_id: string | null;
  is_active: boolean | null;
};

type ReportLogRow = {
  id: string;
  client_id: string | null;
  status: string | null;
  error: string | null;
  created_at: string | null;
};

const FOUR_DAYS_MS = 4 * 24 * 60 * 60 * 1000;
const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

type SupabaseQueryError = {
  message: string;
};

async function safeQuery<T>(
  label: string,
  query: PromiseLike<{ data: unknown; error: SupabaseQueryError | null }>
) {
  const result = await query;

  if (result.error) {
    return {
      label,
      rows: [] as T[],
      warning: result.error.message as string,
    };
  }

  return {
    label,
    rows: (result.data ?? []) as T[],
    warning: "",
  };
}

function getDaysLeft(dateValue: string | null | undefined) {
  if (!dateValue) return null;
  const diff = new Date(dateValue).getTime() - Date.now();
  return Math.ceil(diff / (24 * 60 * 60 * 1000));
}

function isRecent(dateValue: string | null | undefined, rangeMs: number) {
  if (!dateValue) return false;
  return Date.now() - new Date(dateValue).getTime() <= rangeMs;
}

function increment(map: Map<string, number>, key: string | null | undefined) {
  if (!key) return;
  map.set(key, (map.get(key) ?? 0) + 1);
}

export async function GET() {
  try {
    const { serviceSupabase } = await requireSuperAdminRoute();

    const [
      workspacesResult,
      billingResult,
      profilesResult,
      clientsResult,
      projectsResult,
      dealsResult,
      avitoClientsResult,
      avitoAccountsResult,
      logsResult,
      authUsersResult,
    ] = await Promise.all([
      safeQuery<WorkspaceRow>(
        "workspaces",
        serviceSupabase
          .from("workspaces")
          .select("id,name,owner_user_id,created_at")
          .order("created_at", { ascending: false })
      ),
      safeQuery<BillingRow>(
        "workspace_billing",
        serviceSupabase
          .from("workspace_billing")
          .select("workspace_id,plan_code,subscription_status,trial_ends_at,subscription_ends_at")
      ),
      safeQuery<ProfileRow>(
        "profiles",
        serviceSupabase.from("profiles").select("id,email,platform_role")
      ),
      safeQuery<WorkspaceMetricRow>(
        "clients",
        serviceSupabase.from("clients").select("id,workspace_id,created_at")
      ),
      safeQuery<WorkspaceMetricRow>(
        "projects",
        serviceSupabase.from("projects").select("id,workspace_id,created_at")
      ),
      safeQuery<WorkspaceMetricRow>(
        "crm_deals",
        serviceSupabase.from("crm_deals").select("id,workspace_id,created_at")
      ),
      safeQuery<AvitoClientRow>(
        "avito_report_clients",
        serviceSupabase.from("avito_report_clients").select("id,workspace_id,is_active")
      ),
      safeQuery<AvitoAccountRow>(
        "avito_report_accounts",
        serviceSupabase
          .from("avito_report_accounts")
          .select("id,client_id,is_active,crm_dialogs_enabled")
      ),
      safeQuery<ReportLogRow>(
        "avito_report_logs",
        serviceSupabase
          .from("avito_report_logs")
          .select("id,client_id,status,error,created_at")
          .order("created_at", { ascending: false })
          .limit(1000)
      ),
      serviceSupabase.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    ]);

    const warnings = [
      workspacesResult.warning,
      billingResult.warning,
      profilesResult.warning,
      clientsResult.warning,
      projectsResult.warning,
      dealsResult.warning,
      avitoClientsResult.warning,
      avitoAccountsResult.warning,
      logsResult.warning,
      authUsersResult.error?.message ?? "",
    ].filter(Boolean);

    const profilesById = new Map(
      profilesResult.rows.map((profile) => [profile.id, profile])
    );
    const billingByWorkspaceId = new Map(
      billingResult.rows.map((billing) => [billing.workspace_id, billing])
    );
    const authUserById = new Map(
      (authUsersResult.data?.users ?? []).map((user) => [user.id, user])
    );

    const clientsByWorkspace = new Map<string, number>();
    const projectsByWorkspace = new Map<string, number>();
    const dealsByWorkspace = new Map<string, number>();
    const avitoClientsByWorkspace = new Map<string, number>();
    const avitoAccountsByWorkspace = new Map<string, number>();
    const avitoCrmAccountsByWorkspace = new Map<string, number>();
    const reportErrorsByWorkspace = new Map<string, number>();

    for (const client of clientsResult.rows) increment(clientsByWorkspace, client.workspace_id);
    for (const project of projectsResult.rows) increment(projectsByWorkspace, project.workspace_id);
    for (const deal of dealsResult.rows) increment(dealsByWorkspace, deal.workspace_id);

    const workspaceByAvitoClientId = new Map<string, string>();
    for (const client of avitoClientsResult.rows) {
      if (!client.id || !client.workspace_id) continue;
      workspaceByAvitoClientId.set(client.id, client.workspace_id);
      if (client.is_active !== false) increment(avitoClientsByWorkspace, client.workspace_id);
    }

    for (const account of avitoAccountsResult.rows) {
      const workspaceId = account.client_id
        ? workspaceByAvitoClientId.get(account.client_id)
        : null;
      if (!workspaceId || account.is_active === false) continue;

      increment(avitoAccountsByWorkspace, workspaceId);
      if (account.crm_dialogs_enabled) increment(avitoCrmAccountsByWorkspace, workspaceId);
    }

    for (const log of logsResult.rows) {
      if (!log.client_id || !isRecent(log.created_at, 7 * 24 * 60 * 60 * 1000)) {
        continue;
      }

      const workspaceId = workspaceByAvitoClientId.get(log.client_id);
      const hasProblem =
        String(log.status ?? "").toLowerCase().includes("error") ||
        String(log.status ?? "").toLowerCase().includes("failed") ||
        Boolean(log.error);

      if (workspaceId && hasProblem) increment(reportErrorsByWorkspace, workspaceId);
    }

    const rows = workspacesResult.rows.map((workspace) => {
      const ownerProfile = workspace.owner_user_id
        ? profilesById.get(workspace.owner_user_id)
        : null;
      const authUser = workspace.owner_user_id
        ? authUserById.get(workspace.owner_user_id)
        : null;
      const billing = billingByWorkspaceId.get(workspace.id) ?? null;
      const trialEndsAt = billing?.trial_ends_at ?? null;
      const trialDaysLeft = getDaysLeft(trialEndsAt);
      const subscriptionEndsAt = billing?.subscription_ends_at ?? null;
      const clientsCount = clientsByWorkspace.get(workspace.id) ?? 0;
      const projectsCount = projectsByWorkspace.get(workspace.id) ?? 0;
      const dealsCount = dealsByWorkspace.get(workspace.id) ?? 0;
      const avitoAccountsCount = avitoAccountsByWorkspace.get(workspace.id) ?? 0;
      const avitoCrmAccountsCount = avitoCrmAccountsByWorkspace.get(workspace.id) ?? 0;
      const reportErrorsCount = reportErrorsByWorkspace.get(workspace.id) ?? 0;
      const lastSeenAt = authUser?.last_sign_in_at ?? authUser?.created_at ?? null;
      const inactive = !lastSeenAt || Date.now() - new Date(lastSeenAt).getTime() > FOURTEEN_DAYS_MS;

      const segments: string[] = [];

      if (billing?.subscription_status === "trial" && (trialDaysLeft ?? 999) >= 0) {
        segments.push("trial_active");
      }

      if (
        billing?.subscription_status === "trial" &&
        trialEndsAt &&
        new Date(trialEndsAt).getTime() - Date.now() <= FOUR_DAYS_MS &&
        (trialDaysLeft ?? -1) >= 0
      ) {
        segments.push("trial_ending");
      }

      if (billing?.subscription_status === "active") segments.push("active_plan");
      if (clientsCount === 0) segments.push("no_clients");
      if (avitoAccountsCount === 0) segments.push("no_avito");
      if (dealsCount === 0) segments.push("crm_no_deals");
      if (reportErrorsCount > 0) segments.push("report_errors");
      if (inactive) segments.push("inactive_14d");

      const stuckReason =
        clientsCount === 0
          ? "Не создал клиента"
          : projectsCount === 0
          ? "Есть клиент, но нет проекта"
          : avitoAccountsCount === 0
          ? "Не подключил Avito"
          : dealsCount === 0
          ? "CRM без сделок"
          : "";

      return {
        workspaceId: workspace.id,
        workspaceName: workspace.name || "Без названия",
        ownerUserId: workspace.owner_user_id,
        ownerEmail: ownerProfile?.email ?? authUser?.email ?? null,
        registeredAt: workspace.created_at ?? authUser?.created_at ?? null,
        lastSeenAt,
        planCode: billing?.plan_code ?? null,
        billingStatus: billing?.subscription_status ?? null,
        trialEndsAt,
        trialDaysLeft,
        subscriptionEndsAt,
        clientsCount,
        projectsCount,
        avitoClientsCount: avitoClientsByWorkspace.get(workspace.id) ?? 0,
        avitoAccountsCount,
        avitoCrmAccountsCount,
        dealsCount,
        reportErrorsCount,
        stuckReason,
        segments,
      };
    });

    const segmentDefinitions = [
      { key: "trial_active", label: "Trial активен" },
      { key: "trial_ending", label: "Trial заканчивается" },
      { key: "active_plan", label: "Активный тариф" },
      { key: "no_avito", label: "Не подключил Avito" },
      { key: "crm_no_deals", label: "CRM без сделок" },
      { key: "report_errors", label: "Есть ошибки отчётов" },
      { key: "no_clients", label: "Не создал клиента" },
      { key: "inactive_14d", label: "Давно не заходил" },
    ].map((segment) => ({
      ...segment,
      count: rows.filter((row) => row.segments.includes(segment.key)).length,
    }));

    const totals = {
      registeredUsers: authUsersResult.data?.users.length ?? profilesResult.rows.length,
      workspaces: rows.length,
      createdClient: rows.filter((row) => row.clientsCount > 0).length,
      connectedAvito: rows.filter((row) => row.avitoAccountsCount > 0).length,
      activeTariffs: rows.filter((row) => row.billingStatus === "active").length,
      stuck: rows.filter((row) => Boolean(row.stuckReason)).length,
      inactive: rows.filter((row) => row.segments.includes("inactive_14d")).length,
    };

    return apiSuccess({
      totals,
      segments: segmentDefinitions,
      rows,
      warnings,
    });
  } catch (error) {
    console.error("GET /api/admin/monitoring error:", error);
    return apiFailure({ error, code: "DATABASE_ERROR" });
  }
}
