import { createClient } from "@/app/lib/supabase/client";
import type { Payment, PaymentFormData } from "@/app/lib/types/payment";

export async function getPaymentsFromSupabase(): Promise<Payment[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("payments")
    .select("*")
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
  const supabase = createClient();

  const { data, error } = await supabase
    .from("payments")
    .insert({
      client_id: payload.client_id,
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

  return {
    ...data,
    amount: Number(data.amount),
  } as Payment;
}

export async function updatePaymentInSupabase(
  id: string,
  payload: PaymentFormData
): Promise<Payment> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("payments")
    .update({
      client_id: payload.client_id,
      amount: Number(payload.amount),
      due_date: payload.due_date,
      paid_date: payload.paid_date || null,
      status: payload.status,
      period_label: payload.period_label || null,
      notes: payload.notes || null,
      document_url: payload.document_url ?? null,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return {
    ...data,
    amount: Number(data.amount),
  } as Payment;
}

export async function deletePaymentFromSupabase(id: string): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase
    .from("payments")
    .delete()
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }
}