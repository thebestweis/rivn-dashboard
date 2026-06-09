import { createClient } from "@supabase/supabase-js";
import {
  apiAccessErrorResponse,
  requireAuthenticatedUser,
  requireWorkspaceMember,
} from "@/app/api/_guards";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function getSupabase() {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Supabase env variables are missing");
  }

  return createClient(supabaseUrl, supabaseKey);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get("workspaceId");

  if (!workspaceId) {
    return Response.json(
      { ok: false, error: "workspaceId is required" },
      { status: 400 }
    );
  }

  try {
    const supabase = getSupabase();
    const user = await requireAuthenticatedUser();
    await requireWorkspaceMember({
      serviceSupabase: supabase,
      workspaceId,
      userId: user.id,
    });

    const { data: clients, error: clientsError } = await supabase
      .from("avito_report_clients")
      .select("id, name, is_active, daily_reports_enabled, weekly_reports_enabled")
      .or(`workspace_id.eq.${workspaceId},workspace_id.is.null`)
      .order("name", { ascending: true });

    if (clientsError) {
      throw new Error(clientsError.message);
    }

    const clientIds = (clients ?? []).map((client) => client.id);

    if (clientIds.length === 0) {
      return Response.json({
        ok: true,
        clients: [],
        snapshots: [],
        jobs: [],
      });
    }

    const { data: snapshots, error: snapshotsError } = await supabase
      .from("avito_report_snapshots")
      .select(
        "id, client_id, account_id, report_type, period_start, period_end, views, contacts, expenses, stats_status, expenses_status, quality_status, warnings, fetched_at, updated_at"
      )
      .in("client_id", clientIds)
      .order("period_end", { ascending: false })
      .order("updated_at", { ascending: false })
      .limit(100);

    if (snapshotsError) {
      throw new Error(snapshotsError.message);
    }

    const { data: jobs, error: jobsError } = await supabase
      .from("avito_report_sync_jobs")
      .select(
        "id, client_id, account_id, report_type, period_start, period_end, status, attempts, next_run_at, last_error, updated_at"
      )
      .in("client_id", clientIds)
      .neq("status", "success")
      .order("next_run_at", { ascending: true })
      .limit(100);

    if (jobsError) {
      throw new Error(jobsError.message);
    }

    return Response.json({
      ok: true,
      clients,
      snapshots,
      jobs,
      summary: {
        snapshotsTotal: snapshots?.length ?? 0,
        warningSnapshots:
          snapshots?.filter((snapshot) => snapshot.quality_status === "warning")
            .length ?? 0,
        criticalSnapshots:
          snapshots?.filter((snapshot) => snapshot.quality_status === "critical")
            .length ?? 0,
        pendingJobs: jobs?.filter((job) => job.status === "pending").length ?? 0,
        failedJobs: jobs?.filter((job) => job.status === "failed").length ?? 0,
      },
    });
  } catch (error) {
    return apiAccessErrorResponse(error);
  }
}
