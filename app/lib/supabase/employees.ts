import { getAppContext } from "./app-context";
import type { EmployeePayType, StoredEmployee } from "../storage";

type DbEmployeeRow = {
  id: string;
  user_id: string;
  workspace_id: string;
  name: string;
  role: string;
  email: string | null; // ✅ ДОБАВИЛИ
  pay_type: EmployeePayType;
  pay_value: string;
  fixed_salary: string | null;
  payout_day: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

function mapEmployee(row: DbEmployeeRow): StoredEmployee {
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    payType: row.pay_type,
    payValue: row.pay_value,
    fixedSalary: row.fixed_salary ?? "",
    payoutDay: row.payout_day ?? undefined,
    isActive: row.is_active,
  };
}

export async function fetchEmployeesFromSupabase(): Promise<StoredEmployee[]> {
  const { supabase, workspace } = await getAppContext();

  const { data, error } = await supabase
    .from("employees")
    .select("*")
    .eq("workspace_id", workspace.id)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Не удалось загрузить сотрудников: ${error.message}`);
  }

  return ((data ?? []) as DbEmployeeRow[]).map(mapEmployee);
}

export async function createEmployeeInSupabase(
  employee: Omit<StoredEmployee, "id">
): Promise<StoredEmployee> {
  const { supabase, workspace, user } = await getAppContext();

  const payload = {
    user_id: user.id,
    workspace_id: workspace.id,
    name: employee.name,
    role: employee.role,
    email: "temp@email.com", // 🔥 ВРЕМЕННЫЙ ФИКС
    pay_type: employee.payType,
    pay_value: employee.payValue,
    fixed_salary: employee.fixedSalary?.trim() || null,
    payout_day: employee.payoutDay ?? null,
    is_active: employee.isActive,
  };

  const { data, error } = await supabase
    .from("employees")
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    throw new Error(
      `Не удалось создать сотрудника: ${error.message} (${error.code ?? "no_code"})`
    );
  }

  return mapEmployee(data as DbEmployeeRow);
}

export async function updateEmployeeInSupabase(
  id: string,
  employee: Omit<StoredEmployee, "id">
): Promise<StoredEmployee> {
  const { supabase, workspace } = await getAppContext();

  const payload = {
    name: employee.name,
    role: employee.role,
    pay_type: employee.payType,
    pay_value: employee.payValue,
    fixed_salary: employee.fixedSalary?.trim() || null,
    payout_day: employee.payoutDay ?? null,
    is_active: employee.isActive,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("employees")
    .update(payload)
    .eq("id", id)
    .eq("workspace_id", workspace.id)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Не удалось обновить сотрудника: ${error.message}`);
  }

  return mapEmployee(data as DbEmployeeRow);
}

export async function deleteEmployeeFromSupabase(id: string): Promise<void> {
  const { supabase, workspace } = await getAppContext();

  const { error } = await supabase
    .from("employees")
    .delete()
    .eq("id", id)
    .eq("workspace_id", workspace.id);

  if (error) {
    throw new Error(`Не удалось удалить сотрудника: ${error.message}`);
  }
}