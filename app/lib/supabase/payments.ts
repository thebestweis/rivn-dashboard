import { syncPayrollAccrualFromPayment } from "@/app/lib/payroll-auto";
import type {
  Payment,
  PaymentFormData,
  PaymentStatus,
} from "@/app/lib/types/payment";
import { getAppContext } from "./app-context";


type DbPaymentRow = {
  id: string;
  user_id: string;
  workspace_id: string;
  client_id: string;
  project_id: string | null;
  amount: number | string;
  due_date: string;
  paid_date: string | null;
  status: PaymentStatus;
  period_label: string | null;
  notes: string | null;
  document_url: string | null;
  created_at: string;
  updated_at: string;
};

export type PaymentListStatus = "planned" | "paid" | "all";
export type PaymentSortField =
  | "client"
  | "project"
  | "created_at"
  | "due_date"
  | "paid_date"
  | "amount"
  | "status";
export type PaymentSortDirection = "asc" | "desc";

export type PaymentListFilters = {
  status?: PaymentListStatus;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: PaymentSortField;
  sortDirection?: PaymentSortDirection;
};

function mapPayment(item: DbPaymentRow): Payment {
  return {
    id: item.id,
    user_id: item.user_id,
    client_id: item.client_id,
    project_id: item.project_id,
    amount: Number(item.amount),
    due_date: item.due_date,
    paid_date: item.paid_date,
    status: item.status,
    period_label: item.period_label,
    notes: item.notes,
    document_url: item.document_url,
    created_at: item.created_at,
    updated_at: item.updated_at,
  };
}

function getPaymentDateColumn(status: PaymentListStatus) {
  return status === "paid" ? "paid_date" : "due_date";
}

function getDbSortColumn(
  sortBy: PaymentSortField | undefined,
  status: PaymentListStatus
) {
  if (sortBy === "amount" || sortBy === "status" || sortBy === "created_at") {
    return sortBy;
  }

  if (sortBy === "paid_date") return "paid_date";
  if (sortBy === "due_date") return "due_date";

  return getPaymentDateColumn(status);
}

export async function getPaymentsFromSupabase(
  filters: PaymentListFilters = {}
): Promise<Payment[]> {
  const { supabase, workspace } = await getAppContext();
  const status = filters.status ?? "all";
  const dateColumn = getPaymentDateColumn(status);
  const sortColumn = getDbSortColumn(filters.sortBy, status);
  const ascending = filters.sortDirection === "asc";

  let query = supabase
    .from("payments")
    .select("*")
    .eq("workspace_id", workspace.id);

  if (status === "paid") {
    query = query.eq("status", "paid");
  }

  if (status === "planned") {
    query = query.neq("status", "paid");
  }

  if (filters.dateFrom) {
    query = query.gte(dateColumn, filters.dateFrom);
  }

  if (filters.dateTo) {
    query = query.lte(dateColumn, filters.dateTo);
  }

  const { data, error } = await query
    .order(sortColumn, { ascending, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Не удалось загрузить платежи: ${error.message}`);
  }

  return ((data ?? []) as DbPaymentRow[]).map(mapPayment);
}

export async function createPaymentInSupabase(
  payload: PaymentFormData
): Promise<Payment> {
  const { supabase, workspace, user } = await getAppContext();

  const { data, error } = await supabase
    .from("payments")
    .insert({
      user_id: user.id,
      workspace_id: workspace.id,
      client_id: payload.client_id,
      project_id: payload.project_id || null,
      amount: Number(payload.amount),
      due_date: payload.due_date,
      paid_date: payload.paid_date || null,
      status: payload.status,
      period_label: payload.period_label || null,
      notes: payload.notes || null,
      document_url: payload.document_url ?? null,
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Не удалось создать платёж: ${error.message}`);
  }

  const createdPayment = mapPayment(data as DbPaymentRow);

  await syncPayrollAccrualFromPayment({
    paymentId: createdPayment.id,
    clientId: createdPayment.client_id,
    projectId: createdPayment.project_id ?? null,
    periodLabel: createdPayment.period_label ?? null,
    paidDate: createdPayment.paid_date ?? null,
    shouldExist: createdPayment.status === "paid",
  });

  return createdPayment;
}

export async function updatePaymentInSupabase(
  id: string,
  payload: PaymentFormData
): Promise<Payment> {
  const { supabase, workspace } = await getAppContext();

  const { data: oldPayment, error: oldPaymentError } = await supabase
    .from("payments")
    .select("*")
    .eq("id", id)
    .eq("workspace_id", workspace.id)
    .single();

  if (oldPaymentError) {
    throw new Error(
      `Не удалось загрузить текущий платёж: ${oldPaymentError.message}`
    );
  }

  const { data, error } = await supabase
    .from("payments")
    .update({
      client_id: payload.client_id,
      project_id: payload.project_id || null,
      amount: Number(payload.amount),
      due_date: payload.due_date,
      paid_date: payload.paid_date || null,
      status: payload.status,
      period_label: payload.period_label || null,
      notes: payload.notes || null,
      document_url: payload.document_url ?? null,
    })
    .eq("id", id)
    .eq("workspace_id", workspace.id)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Не удалось обновить платёж: ${error.message}`);
  }

  const updatedPayment = mapPayment(data as DbPaymentRow);

  await syncPayrollAccrualFromPayment({
    paymentId: updatedPayment.id,
    clientId: updatedPayment.client_id,
    projectId: updatedPayment.project_id ?? null,
    periodLabel: updatedPayment.period_label ?? null,
    paidDate: updatedPayment.paid_date ?? null,
    shouldExist: updatedPayment.status === "paid",
  });

  return updatedPayment;
}

export async function deletePaymentFromSupabase(id: string): Promise<void> {
  const { supabase, workspace } = await getAppContext();

  await syncPayrollAccrualFromPayment({
    paymentId: id,
    clientId: null,
    projectId: null,
    periodLabel: null,
    paidDate: null,
    shouldExist: false,
  });

  const { error } = await supabase
    .from("payments")
    .delete()
    .eq("id", id)
    .eq("workspace_id", workspace.id);

  if (error) {
    throw new Error(`Не удалось удалить платёж: ${error.message}`);
  }
}
