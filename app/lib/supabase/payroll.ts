import { createClient } from "./client";
import type {
  StoredPayrollAccrual,
  StoredPayrollExtraPayment,
  StoredPayrollPayout,
} from "../storage";

type DbPayrollAccrualRow = {
  id: string;
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
  employee: string;
  employee_id: string | null;
  payout_date: string;
  amount: string;
  month: string;
  status: "scheduled" | "paid";
};

type DbPayrollExtraPaymentRow = {
  id: string;
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

export async function fetchPayrollAccrualsFromSupabase(): Promise<
  StoredPayrollAccrual[]
> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("payroll_accruals")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data as DbPayrollAccrualRow[]).map(mapPayrollAccrual);
}

export async function createPayrollAccrualInSupabase(
  accrual: StoredPayrollAccrual
): Promise<StoredPayrollAccrual> {
  const supabase = createClient();

  const payload = {
    id: accrual.id,
    employee: accrual.employee,
    employee_id: accrual.employeeId ?? null,
    client: accrual.client,
    client_id: accrual.clientId ?? null,
    project: accrual.project,
    project_id: accrual.projectId ?? null,
    payment_id: accrual.paymentId ?? null,
    amount: accrual.amount,
    date: accrual.date,
    status: accrual.status,
  };

  const { data, error } = await supabase
    .from("payroll_accruals")
    .insert(payload)
    .select()
    .single();

  if (error) throw error;

  return mapPayrollAccrual(data as DbPayrollAccrualRow);
}

export async function updatePayrollAccrualInSupabase(
  id: string,
  accrual: Omit<StoredPayrollAccrual, "id">
): Promise<StoredPayrollAccrual> {
  const supabase = createClient();

  const payload = {
    employee: accrual.employee,
    employee_id: accrual.employeeId ?? null,
    client: accrual.client,
    client_id: accrual.clientId ?? null,
    project: accrual.project,
    project_id: accrual.projectId ?? null,
    payment_id: accrual.paymentId ?? null,
    amount: accrual.amount,
    date: accrual.date,
    status: accrual.status,
  };

  const { data, error } = await supabase
    .from("payroll_accruals")
    .update(payload)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;

  return mapPayrollAccrual(data as DbPayrollAccrualRow);
}

export async function deletePayrollAccrualFromSupabase(id: string): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase.from("payroll_accruals").delete().eq("id", id);

  if (error) throw error;
}

export async function fetchPayrollPayoutsFromSupabase(): Promise<
  StoredPayrollPayout[]
> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("payroll_payouts")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data as DbPayrollPayoutRow[]).map(mapPayrollPayout);
}

export async function createPayrollPayoutInSupabase(
  payout: StoredPayrollPayout
): Promise<StoredPayrollPayout> {
  const supabase = createClient();

  const payload = {
    id: payout.id,
    employee: payout.employee,
    employee_id: payout.employeeId ?? null,
    payout_date: payout.payoutDate,
    amount: payout.amount,
    month: payout.month,
    status: payout.status,
  };

  const { data, error } = await supabase
    .from("payroll_payouts")
    .insert(payload)
    .select()
    .single();

  if (error) throw error;

  return mapPayrollPayout(data as DbPayrollPayoutRow);
}

export async function updatePayrollPayoutInSupabase(
  id: string,
  payout: Omit<StoredPayrollPayout, "id">
): Promise<StoredPayrollPayout> {
  const supabase = createClient();

  const payload = {
    employee: payout.employee,
    employee_id: payout.employeeId ?? null,
    payout_date: payout.payoutDate,
    amount: payout.amount,
    month: payout.month,
    status: payout.status,
  };

  const { data, error } = await supabase
    .from("payroll_payouts")
    .update(payload)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;

  return mapPayrollPayout(data as DbPayrollPayoutRow);
}

export async function deletePayrollPayoutFromSupabase(id: string): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase.from("payroll_payouts").delete().eq("id", id);

  if (error) throw error;
}

export async function fetchPayrollExtraPaymentsFromSupabase(): Promise<
  StoredPayrollExtraPayment[]
> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("payroll_extra_payments")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data as DbPayrollExtraPaymentRow[]).map(mapPayrollExtraPayment);
}

export async function createPayrollExtraPaymentInSupabase(
  extra: StoredPayrollExtraPayment
): Promise<StoredPayrollExtraPayment> {
  const supabase = createClient();

  const payload = {
    id: extra.id,
    employee: extra.employee,
    employee_id: extra.employeeId ?? null,
    reason: extra.reason,
    date: extra.date,
    amount: extra.amount,
  };

  const { data, error } = await supabase
    .from("payroll_extra_payments")
    .insert(payload)
    .select()
    .single();

  if (error) throw error;

  return mapPayrollExtraPayment(data as DbPayrollExtraPaymentRow);
}

export async function updatePayrollExtraPaymentInSupabase(
  id: string,
  extra: Omit<StoredPayrollExtraPayment, "id">
): Promise<StoredPayrollExtraPayment> {
  const supabase = createClient();

  const payload = {
    employee: extra.employee,
    employee_id: extra.employeeId ?? null,
    reason: extra.reason,
    date: extra.date,
    amount: extra.amount,
  };

  const { data, error } = await supabase
    .from("payroll_extra_payments")
    .update(payload)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;

  return mapPayrollExtraPayment(data as DbPayrollExtraPaymentRow);
}

export async function deletePayrollExtraPaymentFromSupabase(
  id: string
): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase
    .from("payroll_extra_payments")
    .delete()
    .eq("id", id);

  if (error) throw error;
}