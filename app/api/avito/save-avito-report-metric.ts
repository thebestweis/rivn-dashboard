import { createAvitoReportsClient } from "@/app/lib/avito-reports/storage";

type SaveAvitoReportMetricParams = {
  clientId: string;
  accountId: string | null;
  reportType: "daily" | "weekly";
  periodStart: string;
  periodEnd: string;
  views: number;
  contacts: number;
  favorites: number;
  expenses: number;
  conversion: number;
  costPerContact: number;
  raw?: Record<string, unknown>;
};

export async function saveAvitoReportMetric({
  clientId,
  accountId,
  reportType,
  periodStart,
  periodEnd,
  views,
  contacts,
  favorites,
  expenses,
  conversion,
  costPerContact,
  raw = {},
}: SaveAvitoReportMetricParams) {
  const supabase = createAvitoReportsClient();

  const { error } = await supabase.from("avito_report_metrics").upsert(
    {
      client_id: clientId,
      account_id: accountId,
      report_type: reportType,
      period_start: periodStart,
      period_end: periodEnd,
      views,
      contacts,
      favorites,
      expenses,
      conversion,
      cost_per_contact: costPerContact,
      raw,
    },
    {
      onConflict: "client_id,account_id,report_type,period_start,period_end",
    }
  );

  if (error) {
    throw new Error(`Ошибка сохранения Avito metrics: ${error.message}`);
  }
}
