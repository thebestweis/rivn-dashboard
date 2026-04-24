import { getAppContext } from "./app-context";

export async function getAvitoMetrics(params: {
  clientId: string;
  from: string;
  to: string;
}) {
  const { supabase, workspace } = await getAppContext();

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