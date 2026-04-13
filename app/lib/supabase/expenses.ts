import type { Expense, ExpenseFormData } from "@/app/lib/types/expense";
import { getAppContext } from "./app-context";

type DbExpenseRow = {
  id: string;
  user_id: string;
  workspace_id: string;
  title: string;
  amount: number | string;
  category: string;
  expense_date: string;
  client_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

function mapExpense(item: DbExpenseRow): Expense {
  return {
    id: item.id,
    title: item.title,
    amount: Number(item.amount),
    category: item.category,
    expense_date: item.expense_date,
    client_id: item.client_id,
    notes: item.notes,
    created_at: item.created_at,
    updated_at: item.updated_at,
  };
}

export async function getExpensesFromSupabase(): Promise<Expense[]> {
  const { supabase, workspace } = await getAppContext();

  const { data, error } = await supabase
    .from("expenses")
    .select("*")
    .eq("workspace_id", workspace.id)
    .order("expense_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Не удалось загрузить расходы: ${error.message}`);
  }

  return ((data ?? []) as DbExpenseRow[]).map(mapExpense);
}

export async function createExpenseInSupabase(
  payload: ExpenseFormData
): Promise<Expense> {
  const { supabase, workspace, user } = await getAppContext();

  const { data, error } = await supabase
    .from("expenses")
    .insert({
      user_id: user.id,
      workspace_id: workspace.id,
      title: payload.title,
      amount: Number(payload.amount),
      category: payload.category,
      expense_date: payload.expense_date,
      client_id: payload.client_id || null,
      notes: payload.notes || null,
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Не удалось создать расход: ${error.message}`);
  }

  return mapExpense(data as DbExpenseRow);
}

export async function updateExpenseInSupabase(
  id: string,
  payload: ExpenseFormData
): Promise<Expense> {
  const { supabase, workspace } = await getAppContext();

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
    .eq("workspace_id", workspace.id)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Не удалось обновить расход: ${error.message}`);
  }

  return mapExpense(data as DbExpenseRow);
}

export async function deleteExpenseFromSupabase(id: string): Promise<void> {
  const { supabase, workspace } = await getAppContext();

  const { error } = await supabase
    .from("expenses")
    .delete()
    .eq("id", id)
    .eq("workspace_id", workspace.id);

  if (error) {
    throw new Error(`Не удалось удалить расход: ${error.message}`);
  }
}