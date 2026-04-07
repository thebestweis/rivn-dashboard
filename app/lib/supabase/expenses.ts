import type { Expense, ExpenseFormData } from "@/app/lib/types/expense";
import { getAuthedSupabase } from "./auth-user";

export async function getExpensesFromSupabase(): Promise<Expense[]> {
  const { supabase, userId } = await getAuthedSupabase();

  const { data, error } = await supabase
    .from("expenses")
    .select("*")
    .eq("user_id", userId)
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
  const { supabase, userId } = await getAuthedSupabase();

  const { data, error } = await supabase
    .from("expenses")
    .insert({
      user_id: userId,
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
  const { supabase, userId } = await getAuthedSupabase();

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
    .eq("user_id", userId)
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
  const { supabase, userId } = await getAuthedSupabase();

  const { error } = await supabase
    .from("expenses")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) {
    throw new Error(error.message);
  }
}