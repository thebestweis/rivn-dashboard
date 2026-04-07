import { autoCreatePayrollAccrualFromPayment } from "@/app/lib/payroll-auto";
import type { Payment, PaymentFormData } from "@/app/lib/types/payment";
import { getAuthedSupabase } from "./auth-user";

export async function getPaymentsFromSupabase(): Promise<Payment[]> {
  const { supabase, userId } = await getAuthedSupabase();

  const { data, error } = await supabase
    .from("payments")
    .select("*")
    .eq("user_id", userId)
    .order("due_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((item) => ({
    ...item,
    amount: Number(item.amount),
  })) as Payment[];
}

export async function createPaymentInSupabase(
  payload: PaymentFormData
): Promise<Payment> {
  const { supabase, userId } = await getAuthedSupabase();

  const { data, error } = await supabase
    .from("payments")
    .insert({
      user_id: userId,
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
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const createdPayment = {
    ...data,
    amount: Number(data.amount),
  } as Payment;

  if (createdPayment.status === "paid") {
    await autoCreatePayrollAccrualFromPayment({
      paymentId: createdPayment.id,
      clientId: createdPayment.client_id,
      projectId: createdPayment.project_id ?? null,
      periodLabel: createdPayment.period_label ?? null,
      paidDate: createdPayment.paid_date ?? null,
    });
  }

  return createdPayment;
}

export async function updatePaymentInSupabase(
  id: string,
  payload: PaymentFormData
): Promise<Payment> {
  const { supabase, userId } = await getAuthedSupabase();

  const { data: oldPayment, error: oldPaymentError } = await supabase
    .from("payments")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (oldPaymentError) {
    throw new Error(oldPaymentError.message);
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
    .eq("user_id", userId)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const updatedPayment = {
    ...data,
    amount: Number(data.amount),
  } as Payment;

  const becamePaid =
    oldPayment?.status !== "paid" && updatedPayment.status === "paid";

  if (becamePaid) {
    await autoCreatePayrollAccrualFromPayment({
      paymentId: updatedPayment.id,
      clientId: updatedPayment.client_id,
      projectId: updatedPayment.project_id ?? null,
      periodLabel: updatedPayment.period_label ?? null,
      paidDate: updatedPayment.paid_date ?? null,
    });
  }

  return updatedPayment;
}

export async function deletePaymentFromSupabase(id: string): Promise<void> {
  const { supabase, userId } = await getAuthedSupabase();

  const { error } = await supabase
    .from("payments")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) {
    throw new Error(error.message);
  }
}