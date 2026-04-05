import { createClient } from "@/app/lib/supabase/client";
import type { Expense, ExpenseFormData } from "@/app/lib/types/expense";

export async function getExpensesFromSupabase(): Promise<Expense[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("expenses")
    .select("*")
    .order("expense_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((item) => ({
    ...item,
    amount: Number(item.amount),
  })) as Expense[];
}

export async function createExpenseInSupabase(
  payload: ExpenseFormData
): Promise<Expense> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("expenses")
    .insert({
      title: payload.title,
      amount: Number(payload.amount),
      category: payload.category,
      expense_date: payload.expense_date,
      client_id: payload.client_id || null,
      notes: payload.notes || null,
    })
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return {
    ...data,
    amount: Number(data.amount),
  } as Expense;
}

export async function updateExpenseInSupabase(
  id: string,
  payload: ExpenseFormData
): Promise<Expense> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("expenses")
    .update({
      title: payload.title,
      amount: Number(payload.amount),
      category: payload.category,
      expense_date: payload.expense_date,
      client_id: payload.client_id || null,
      notes: payload.notes || null,
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
  } as Expense;
}

export async function deleteExpenseFromSupabase(id: string): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase
    .from("expenses")
    .delete()
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }
}