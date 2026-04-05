import { createClient } from "./client";

const supabase = createClient();

export type SupabaseMonthlyPlan = {
  id: string;
  month: string;
  revenue_plan: number;
  profit_plan: number;
  expenses_plan: number;
  fot_plan: number;
  created_at: string;
  updated_at: string;
};

export async function getMonthlyPlansFromSupabase() {
  const { data, error } = await supabase
    .from("monthly_plans")
    .select("*")
    .order("month", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as SupabaseMonthlyPlan[];
}

export async function upsertMonthlyPlanInSupabase(params: {
  month: string;
  revenue: number;
  profit: number;
  expenses: number;
  fot: number;
}) {
  const payload = {
    month: params.month,
    revenue_plan: params.revenue,
    profit_plan: params.profit,
    expenses_plan: params.expenses,
    fot_plan: params.fot,
  };

  const { data, error } = await supabase
    .from("monthly_plans")
    .upsert(payload, {
      onConflict: "month",
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data as SupabaseMonthlyPlan;
}