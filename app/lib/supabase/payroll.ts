import type {
  StoredPayrollAccrual,
  StoredPayrollExtraPayment,
  StoredPayrollPayout,
} from "../storage";
import { getAppContext } from "./app-context";

type DbPayrollAccrualRow = {
  id: string;
  user_id: string;
  workspace_id: string;
  employee: string;
  employee_id: string | null;
  client: string;
  client_id: string | null;
  project: string;
  project_id: string | null;
  payment_id: string | null;
  amount: string;
  date: string;
  status: "accrued" | "paid";
};

type DbPayrollPayoutRow = {
  id: string;
  user_id: string;
  workspace_id: string;
  employee: string;
  employee_id: string | null;
  payout_date: string;
  amount: string;
  month: string;
  status: "scheduled" | "paid";
};

type DbPayrollExtraPaymentRow = {
  id: string;
  user_id: string;
  workspace_id: string;
  employee: string;
  employee_id: string | null;
  reason: string;
  date: string;
  amount: string;
};

function mapPayrollAccrual(row: DbPayrollAccrualRow): StoredPayrollAccrual {
  return {
    id: row.id,
    employee: row.employee,
    employeeId: row.employee_id,
    client: row.client,
    clientId: row.client_id,
    project: row.project,
    projectId: row.project_id,
    paymentId: row.payment_id,
    amount: row.amount,
    date: row.date,
    status: row.status,
  };
}

function mapPayrollPayout(row: DbPayrollPayoutRow): StoredPayrollPayout {
  return {
    id: row.id,
    employee: row.employee,
    employeeId: row.employee_id,
    payoutDate: row.payout_date,
    amount: row.amount,
    month: row.month,
    status: row.status,
  };
}

function mapPayrollExtraPayment(
  row: DbPayrollExtraPaymentRow
): StoredPayrollExtraPayment {
  return {
    id: row.id,
    employee: row.employee,
    employeeId: row.employee_id,
    reason: row.reason,
    date: row.date,
    amount: row.amount,
  };
}

function normalizeMoneyString(value: string) {
  return String(parseInt(String(value).replace(/[^\d]/g, "")));
}

export async function fetchPayrollAccrualsFromSupabase(): Promise<
  StoredPayrollAccrual[]
> {
  const { supabase, workspace } = await getAppContext();

  const { data, error } = await supabase
    .from("payroll_accruals")
    .select("*")
    .eq("workspace_id", workspace.id)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Не удалось загрузить начисления: ${error.message}`);
  }

  return (data as DbPayrollAccrualRow[]).map(mapPayrollAccrual);
}

export async function createPayrollAccrualInSupabase(
  accrual: StoredPayrollAccrual
): Promise<StoredPayrollAccrual> {
  const { supabase, workspace, user } = await getAppContext();

  const payload = {
    id: accrual.id,
    user_id: user.id,
    workspace_id: workspace.id,
    employee: accrual.employee,
    employee_id: accrual.employeeId ?? null,
    client: accrual.client,
    client_id: accrual.clientId ?? null,
    project: accrual.project,
    project_id: accrual.projectId ?? null,
    payment_id: accrual.paymentId ?? null,
        amount: normalizeMoneyString(accrual.amount),
    date: accrual.date,
    status: accrual.status,
  };

  const { data, error } = await supabase
    .from("payroll_accruals")
    .insert(payload)
    .select()
    .single();

  if (error) {
    throw new Error(`Не удалось создать начисление: ${error.message}`);
  }

  return mapPayrollAccrual(data as DbPayrollAccrualRow);
}

export async function updatePayrollAccrualInSupabase(
  id: string,
  accrual: Omit<StoredPayrollAccrual, "id">
): Promise<StoredPayrollAccrual> {
  const { supabase, workspace } = await getAppContext();

  const payload = {
    employee: accrual.employee,
    employee_id: accrual.employeeId ?? null,
    client: accrual.client,
    client_id: accrual.clientId ?? null,
    project: accrual.project,
    project_id: accrual.projectId ?? null,
    payment_id: accrual.paymentId ?? null,
        amount: normalizeMoneyString(accrual.amount),
    date: accrual.date,
    status: accrual.status,
  };

  const { data, error } = await supabase
    .from("payroll_accruals")
    .update(payload)
    .eq("id", id)
    .eq("workspace_id", workspace.id)
    .select()
    .single();

  if (error) {
    throw new Error(`Не удалось обновить начисление: ${error.message}`);
  }

  return mapPayrollAccrual(data as DbPayrollAccrualRow);
}

export async function deletePayrollAccrualFromSupabase(id: string): Promise<void> {
  const { supabase, workspace } = await getAppContext();

  const { error } = await supabase
    .from("payroll_accruals")
    .delete()
    .eq("id", id)
    .eq("workspace_id", workspace.id);

  if (error) {
    throw new Error(`Не удалось удалить начисление: ${error.message}`);
  }
}

export async function fetchPayrollPayoutsFromSupabase(): Promise<
  StoredPayrollPayout[]
> {
  const { supabase, workspace } = await getAppContext();

  const { data, error } = await supabase
    .from("payroll_payouts")
    .select("*")
    .eq("workspace_id", workspace.id)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Не удалось загрузить выплаты: ${error.message}`);
  }

  return (data as DbPayrollPayoutRow[]).map(mapPayrollPayout);
}

export async function createPayrollPayoutInSupabase(
  payout: StoredPayrollPayout
): Promise<StoredPayrollPayout> {
  const { supabase, workspace, user } = await getAppContext();

  const payload = {
    id: payout.id,
    user_id: user.id,
    workspace_id: workspace.id,
    employee: payout.employee,
    employee_id: payout.employeeId ?? null,
    payout_date: payout.payoutDate,
    amount: normalizeMoneyString(payout.amount),
    month: payout.month,
    status: payout.status,
  };

  const { data, error } = await supabase
    .from("payroll_payouts")
    .insert(payload)
    .select()
    .single();

  if (error) {
    throw new Error(`Не удалось создать выплату: ${error.message}`);
  }

  return mapPayrollPayout(data as DbPayrollPayoutRow);
}

export async function updatePayrollPayoutInSupabase(
  id: string,
  payout: Omit<StoredPayrollPayout, "id">
): Promise<StoredPayrollPayout> {
  const { supabase, workspace } = await getAppContext();

  const payload = {
    employee: payout.employee,
    employee_id: payout.employeeId ?? null,
    payout_date: payout.payoutDate,
    amount: normalizeMoneyString(payout.amount),
    month: payout.month,
    status: payout.status,
  };

  const { data, error } = await supabase
    .from("payroll_payouts")
    .update(payload)
    .eq("id", id)
    .eq("workspace_id", workspace.id)
    .select()
    .single();

  if (error) {
    throw new Error(`Не удалось обновить выплату: ${error.message}`);
  }

  return mapPayrollPayout(data as DbPayrollPayoutRow);
}

export async function deletePayrollPayoutFromSupabase(id: string): Promise<void> {
  const { supabase, workspace } = await getAppContext();

  const { error } = await supabase
    .from("payroll_payouts")
    .delete()
    .eq("id", id)
    .eq("workspace_id", workspace.id);

  if (error) {
    throw new Error(`Не удалось удалить выплату: ${error.message}`);
  }
}

export async function fetchPayrollExtraPaymentsFromSupabase(): Promise<
  StoredPayrollExtraPayment[]
> {
  const { supabase, workspace } = await getAppContext();

  const { data, error } = await supabase
    .from("payroll_extra_payments")
    .select("*")
    .eq("workspace_id", workspace.id)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Не удалось загрузить внеплановые выплаты: ${error.message}`);
  }

  return (data as DbPayrollExtraPaymentRow[]).map(mapPayrollExtraPayment);
}

export async function createPayrollExtraPaymentInSupabase(
  extra: StoredPayrollExtraPayment
): Promise<StoredPayrollExtraPayment> {
  const { supabase, workspace, user } = await getAppContext();

  const payload = {
    id: extra.id,
    user_id: user.id,
    workspace_id: workspace.id,
    employee: extra.employee,
    employee_id: extra.employeeId ?? null,
    reason: extra.reason,
    date: extra.date,
    amount: normalizeMoneyString(extra.amount),
  };

  const { data, error } = await supabase
    .from("payroll_extra_payments")
    .insert(payload)
    .select()
    .single();

  if (error) {
    throw new Error(`Не удалось создать внеплановую выплату: ${error.message}`);
  }

  return mapPayrollExtraPayment(data as DbPayrollExtraPaymentRow);
}

export async function updatePayrollExtraPaymentInSupabase(
  id: string,
  extra: Omit<StoredPayrollExtraPayment, "id">
): Promise<StoredPayrollExtraPayment> {
  const { supabase, workspace } = await getAppContext();

  const payload = {
    employee: extra.employee,
    employee_id: extra.employeeId ?? null,
    reason: extra.reason,
    date: extra.date,
    amount: normalizeMoneyString(extra.amount),
  };

  const { data, error } = await supabase
    .from("payroll_extra_payments")
    .update(payload)
    .eq("id", id)
    .eq("workspace_id", workspace.id)
    .select()
    .single();

  if (error) {
    throw new Error(`Не удалось обновить внеплановую выплату: ${error.message}`);
  }

  return mapPayrollExtraPayment(data as DbPayrollExtraPaymentRow);
}

export async function deletePayrollExtraPaymentFromSupabase(
  id: string
): Promise<void> {
  const { supabase, workspace } = await getAppContext();

  const { error } = await supabase
    .from("payroll_extra_payments")
    .delete()
    .eq("id", id)
    .eq("workspace_id", workspace.id);

  if (error) {
    throw new Error(`Не удалось удалить внеплановую выплату: ${error.message}`);
  }
}

export async function findPayrollAccrualByPaymentId(
  paymentId: string
): Promise<StoredPayrollAccrual | null> {
  const { supabase, workspace } = await getAppContext();

  const { data, error } = await supabase
    .from("payroll_accruals")
    .select("*")
    .eq("payment_id", paymentId)
    .eq("workspace_id", workspace.id)
    .maybeSingle();

  if (error) {
    throw new Error(`Не удалось найти начисление по payment_id: ${error.message}`);
  }

  if (!data) return null;

  return mapPayrollAccrual(data as DbPayrollAccrualRow);
}