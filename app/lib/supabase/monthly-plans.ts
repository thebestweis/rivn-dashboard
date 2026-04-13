import { getAppContext } from "./app-context";

export type SupabaseMonthlyPlan = {
  id: string;
  user_id: string;
  workspace_id: string;
  month: string;
  revenue_plan: number;
  profit_plan: number;
  expenses_plan: number;
  fot_plan: number;
  created_at: string;
  updated_at: string;
};

type DbMonthlyPlanRow = {
  id: string;
  user_id: string;
  workspace_id: string;
  month: string;
  revenue_plan: number | string | null;
  profit_plan: number | string | null;
  expenses_plan: number | string | null;
  fot_plan: number | string | null;
  created_at: string;
  updated_at: string;
};

function mapMonthlyPlan(row: DbMonthlyPlanRow): SupabaseMonthlyPlan {
  return {
    id: row.id,
    user_id: row.user_id,
    workspace_id: row.workspace_id,
    month: row.month,
    revenue_plan: Number(row.revenue_plan ?? 0),
    profit_plan: Number(row.profit_plan ?? 0),
    expenses_plan: Number(row.expenses_plan ?? 0),
    fot_plan: Number(row.fot_plan ?? 0),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function getMonthlyPlansFromSupabase() {
  const { supabase, workspace } = await getAppContext();

  const { data, error } = await supabase
    .from("monthly_plans")
    .select("*")
    .eq("workspace_id", workspace.id)
    .order("month", { ascending: true });

  if (error) {
    throw new Error(`Не удалось загрузить месячные планы: ${error.message}`);
  }

  return ((data ?? []) as DbMonthlyPlanRow[]).map(mapMonthlyPlan);
}

export async function upsertMonthlyPlanInSupabase(params: {
  month: string;
  revenue: number;
  profit: number;
  expenses: number;
  fot: number;
}) {
  const { supabase, workspace, user } = await getAppContext();

  const payload = {
    user_id: user.id,
    workspace_id: workspace.id,
    month: params.month,
    revenue_plan: params.revenue,
    profit_plan: params.profit,
    expenses_plan: params.expenses,
    fot_plan: params.fot,
  };

  const { data, error } = await supabase
    .from("monthly_plans")
    .upsert(payload, {
      onConflict: "workspace_id,month",
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Не удалось сохранить месячный план: ${error.message}`);
  }

  return mapMonthlyPlan(data as DbMonthlyPlanRow);
}