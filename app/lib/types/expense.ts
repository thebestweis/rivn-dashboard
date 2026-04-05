export type Expense = {
  id: string;
  title: string;
  amount: number;
  category: string;
  expense_date: string;
  client_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type ExpenseFormData = {
  title: string;
  amount: number;
  category: string;
  expense_date: string;
  client_id: string | null;
  notes: string;
};