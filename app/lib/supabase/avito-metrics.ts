import { getAppContext } from "./app-context";

export async function getAvitoMetrics(params: {
  clientId: string;
  workspaceId: string;
  from: string;
  to: string;
}) {
  const { supabase, workspace } = await getAppContext();

  if (!workspace?.id || workspace.id !== params.workspaceId) {
    throw new Error("Workspace mismatch");
  }

  const { data: client, error: clientError } = await supabase
    .from("avito_report_clients")
    .select("id")
    .eq("id", params.clientId)
    .eq("workspace_id", params.workspaceId)
    .maybeSingle();

  if (clientError || !client) {
    throw new Error("Avito project not found in current workspace");
  }

  const { data, error } = await supabase
    .from("avito_report_metrics")
    .select("*")
    .eq("client_id", params.clientId)
    .is("account_id", null)
    .eq("report_type", "daily")
    .gte("period_start", params.from)
    .lte("period_end", params.to)
    .order("period_start", { ascending: true });

  if (error) {
    throw new Error("Ошибка загрузки метрик");
  }

  return data;
}
