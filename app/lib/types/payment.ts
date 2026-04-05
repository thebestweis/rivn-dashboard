export type PaymentStatus = "pending" | "paid" | "overdue";

export type Payment = {
  id: string;
  client_id: string;
  amount: number;
  due_date: string;
  paid_date: string | null;
  status: PaymentStatus;
  period_label: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type PaymentFormData = {
  client_id: string;
  amount: number;
  due_date: string;
  paid_date: string | null;
  status: PaymentStatus;
  period_label: string;
  notes: string;
  document_url?: string | null;
};