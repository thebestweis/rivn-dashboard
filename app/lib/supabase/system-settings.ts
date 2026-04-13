import { getAppContext } from "./app-context";

export type SystemSettings = {
  id: string;
  user_id: string;
  workspace_id: string;
  tax_rate: number;
  currency: string;
  payroll_day: number;
  default_employee_pay: string;
  created_at: string;
  updated_at: string;
};

type DbSystemSettingsRow = {
  id: string;
  user_id: string;
  workspace_id: string;
  tax_rate: number | string | null;
  currency: string | null;
  payroll_day: number | string | null;
  default_employee_pay: string | null;
  created_at: string;
  updated_at: string;
};

function mapSystemSettings(row: DbSystemSettingsRow): SystemSettings {
  return {
    id: row.id,
    user_id: row.user_id,
    workspace_id: row.workspace_id,
    tax_rate: Number(row.tax_rate ?? 7),
    currency: row.currency ?? "RUB",
    payroll_day: Number(row.payroll_day ?? 1),
    default_employee_pay: row.default_employee_pay ?? "₽5,000",
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function getSystemSettings(): Promise<SystemSettings | null> {
  const { supabase, workspace } = await getAppContext();

  const { data, error } = await supabase
    .from("system_settings")
    .select("*")
    .eq("workspace_id", workspace.id)
    .maybeSingle();

  if (error) {
    throw new Error(`Не удалось загрузить системные настройки: ${error.message}`);
  }

  if (!data) return null;

  return mapSystemSettings(data as DbSystemSettingsRow);
}

export async function ensureSystemSettings(): Promise<SystemSettings> {
  const existing = await getSystemSettings();

  if (existing) return existing;

  const { supabase, workspace, user } = await getAppContext();

  const { data, error } = await supabase
    .from("system_settings")
    .insert({
      user_id: user.id,
      workspace_id: workspace.id,
      tax_rate: 7,
      currency: "RUB",
      payroll_day: 1,
      default_employee_pay: "₽5,000",
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Не удалось создать системные настройки: ${error.message}`);
  }

  return mapSystemSettings(data as DbSystemSettingsRow);
}

export async function updateSystemSettings(input: {
  tax_rate?: number;
  currency?: string;
  payroll_day?: number;
  default_employee_pay?: string;
}): Promise<SystemSettings> {
  const current = await ensureSystemSettings();
  const { supabase, workspace } = await getAppContext();

  const payload = {
    tax_rate: input.tax_rate ?? current.tax_rate,
    currency: input.currency ?? current.currency,
    payroll_day: input.payroll_day ?? current.payroll_day,
    default_employee_pay:
      input.default_employee_pay ?? current.default_employee_pay,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("system_settings")
    .update(payload)
    .eq("id", current.id)
    .eq("workspace_id", workspace.id)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Не удалось обновить системные настройки: ${error.message}`);
  }

  return mapSystemSettings(data as DbSystemSettingsRow);
}