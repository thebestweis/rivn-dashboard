type SupabaseLike = {
  from: (table: string) => any;
};

export type AvitoReportType = "daily" | "weekly";
export type AvitoSnapshotStatus = "pending" | "success" | "partial" | "failed";
export type AvitoQualityStatus = "pending" | "ok" | "warning" | "critical";

export type AvitoReportPeriodStats = {
  views: number;
  contacts: number;
  favorites: number;
  expenses: number;
  conversion: number;
  costPerContact: number;
};

export function assessAvitoReportQuality(params: {
  current: AvitoReportPeriodStats;
  previous?: AvitoReportPeriodStats;
  statsStatus: AvitoSnapshotStatus;
  expensesStatus: AvitoSnapshotStatus;
  warnings?: string[];
}) {
  const warnings = [...(params.warnings ?? [])];

  if (params.statsStatus === "failed" && params.expensesStatus === "failed") {
    return {
      qualityStatus: "critical" as AvitoQualityStatus,
      warnings,
    };
  }

  if (
    params.statsStatus !== "success" ||
    params.expensesStatus !== "success"
  ) {
    return {
      qualityStatus: "warning" as AvitoQualityStatus,
      warnings,
    };
  }

  const previous = params.previous;
  const hasSpend = params.current.expenses > 0;
  const hasZeroStats =
    params.current.views === 0 &&
    params.current.contacts === 0 &&
    params.current.favorites === 0;

  if (hasSpend && hasZeroStats) {
    warnings.push(
      "Avito вернул расходы, но просмотры и контакты пришли нулевыми. Данные нужно перепроверить."
    );
  }

  if (
    previous &&
    previous.contacts > 0 &&
    params.current.contacts === 0 &&
    hasSpend
  ) {
    warnings.push(
      "Контакты упали до нуля при наличии расходов. Данные нужно перепроверить."
    );
  }

  return {
    qualityStatus:
      warnings.length > 0
        ? ("warning" as AvitoQualityStatus)
        : ("ok" as AvitoQualityStatus),
    warnings,
  };
}

export async function upsertAvitoReportSnapshot(params: {
  supabase: SupabaseLike;
  clientId: string;
  accountId: string;
  reportType: AvitoReportType;
  periodStart: string;
  periodEnd: string;
  current: AvitoReportPeriodStats;
  previous?: AvitoReportPeriodStats;
  statsStatus: AvitoSnapshotStatus;
  expensesStatus: AvitoSnapshotStatus;
  warnings?: string[];
  lastError?: string | null;
  raw?: Record<string, unknown>;
}) {
  const quality = assessAvitoReportQuality({
    current: params.current,
    previous: params.previous,
    statsStatus: params.statsStatus,
    expensesStatus: params.expensesStatus,
    warnings: params.warnings,
  });

  const payload = {
    client_id: params.clientId,
    account_id: params.accountId,
    report_type: params.reportType,
    period_type: params.reportType,
    period_start: params.periodStart,
    period_end: params.periodEnd,
    views: Math.round(params.current.views),
    contacts: Math.round(params.current.contacts),
    favorites: Math.round(params.current.favorites),
    expenses: params.current.expenses,
    conversion: params.current.conversion,
    cost_per_contact: params.current.costPerContact,
    stats_status: params.statsStatus,
    expenses_status: params.expensesStatus,
    quality_status: quality.qualityStatus,
    warnings: quality.warnings,
    last_error: params.lastError ?? null,
    raw: params.raw ?? {},
    fetched_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  try {
    const { data, error } = await params.supabase
      .from("avito_report_snapshots")
      .upsert(payload, {
        onConflict: "account_id,report_type,period_start,period_end",
      })
      .select("id, quality_status, warnings")
      .limit(1);

    if (error) {
      console.warn("[avito:report-snapshot] save skipped", error.message);
      return {
        saved: false,
        qualityStatus: quality.qualityStatus,
        warnings: quality.warnings,
      };
    }

    return {
      saved: true,
      id: data?.[0]?.id as string | undefined,
      qualityStatus: quality.qualityStatus,
      warnings: quality.warnings,
    };
  } catch (error) {
    console.warn("[avito:report-snapshot] save failed", error);
    return {
      saved: false,
      qualityStatus: quality.qualityStatus,
      warnings: quality.warnings,
    };
  }
}

export async function loadAvitoReportSnapshot(params: {
  supabase: SupabaseLike;
  accountId: string;
  reportType: AvitoReportType;
  periodStart: string;
  periodEnd: string;
}) {
  try {
    const { data, error } = await params.supabase
      .from("avito_report_snapshots")
      .select(
        "id, views, contacts, favorites, expenses, conversion, cost_per_contact, stats_status, expenses_status, quality_status, warnings, raw, fetched_at"
      )
      .eq("account_id", params.accountId)
      .eq("report_type", params.reportType)
      .eq("period_start", params.periodStart)
      .eq("period_end", params.periodEnd)
      .order("updated_at", { ascending: false })
      .limit(1);

    if (error || !data?.[0]) {
      return null;
    }

    const snapshot = data[0];

    return {
      id: snapshot.id as string,
      views: Number(snapshot.views || 0),
      contacts: Number(snapshot.contacts || 0),
      favorites: Number(snapshot.favorites || 0),
      expenses: Number(snapshot.expenses || 0),
      conversion: Number(snapshot.conversion || 0),
      costPerContact: Number(snapshot.cost_per_contact || 0),
      statsStatus: snapshot.stats_status as AvitoSnapshotStatus,
      expensesStatus: snapshot.expenses_status as AvitoSnapshotStatus,
      qualityStatus: snapshot.quality_status as AvitoQualityStatus,
      warnings: Array.isArray(snapshot.warnings) ? snapshot.warnings : [],
      raw: snapshot.raw as Record<string, unknown>,
      fetchedAt: snapshot.fetched_at as string | null,
    };
  } catch (error) {
    console.warn("[avito:report-snapshot] load failed", error);
    return null;
  }
}

export async function enqueueAvitoReportRetryJob(params: {
  supabase: SupabaseLike;
  clientId: string;
  accountId: string;
  reportType: AvitoReportType;
  periodStart: string;
  periodEnd: string;
  priority?: number;
  delayMinutes?: number;
  lastError?: string | null;
}) {
  const nextRunAt = new Date(
    Date.now() + (params.delayMinutes ?? 20) * 60 * 1000
  ).toISOString();

  try {
    const { error } = await params.supabase
      .from("avito_report_sync_jobs")
      .upsert(
        {
          client_id: params.clientId,
          account_id: params.accountId,
          report_type: params.reportType,
          period_start: params.periodStart,
          period_end: params.periodEnd,
          status: "pending",
          priority: params.priority ?? 100,
          next_run_at: nextRunAt,
          last_error: params.lastError ?? null,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "account_id,report_type,period_start,period_end",
        }
      );

    if (error) {
      console.warn("[avito:report-job] enqueue skipped", error.message);
      return false;
    }

    return true;
  } catch (error) {
    console.warn("[avito:report-job] enqueue failed", error);
    return false;
  }
}
