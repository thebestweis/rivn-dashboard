import { createClient } from "@/app/lib/supabase/client";

type SendPaymentReceivedNotificationParams = {
  paymentId: string;
  clientName: string;
  projectName: string;
  amount: string;
  paidAt: string;
};

export async function sendPaymentReceivedNotification(
  params: SendPaymentReceivedNotificationParams
) {
  const supabase = createClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error("Нет access token");
  }

  const response = await fetch("/api/notifications/payment-received", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(params),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data?.error || "Не удалось отправить уведомление о полученной оплате"
    );
  }

  return data;
}

type SendInvoiceCreatedNotificationParams = {
  paymentId: string;
  clientName: string;
  projectName: string;
  amount: string;
  dueDate: string;
};

export async function sendInvoiceCreatedNotification(
  params: SendInvoiceCreatedNotificationParams
) {
  const supabase = createClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error("Нет access token");
  }

  const response = await fetch("/api/notifications/invoice-created", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(params),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data?.error || "Не удалось отправить уведомление о создании счёта"
    );
  }

  return data;
}

type SendSalaryAccruedNotificationParams = {
  accrualMonth: string;
  employeesCount: number;
  totalAmount: string;
};

export async function sendSalaryAccruedNotification(
  params: SendSalaryAccruedNotificationParams
) {
  const supabase = createClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error("Нет access token");
  }

  const response = await fetch("/api/notifications/salary-accrued", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(params),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data?.error || "Не удалось отправить уведомление о начислении окладов"
    );
  }

  return data;
}

type SendSalaryPaidNotificationParams = {
  payoutId: string;
  employeeName: string;
  amount: string;
  payoutDate: string;
  monthLabel: string;
};

export async function sendSalaryPaidNotification(
  params: SendSalaryPaidNotificationParams
) {
  const supabase = createClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error("Нет access token");
  }

  const response = await fetch("/api/notifications/salary-paid", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(params),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data?.error || "Не удалось отправить уведомление о выплате зарплаты"
    );
  }

  return data;
}

type SendClientStatusChangedNotificationParams = {
  clientId: string;
  clientName: string;
  previousStatus: string;
  nextStatus: string;
};

export async function sendClientStatusChangedNotification(
  params: SendClientStatusChangedNotificationParams
) {
  const supabase = createClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error("Нет access token");
  }

  const response = await fetch("/api/notifications/client-status-changed", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(params),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data?.error || "Не удалось отправить уведомление об изменении статуса клиента"
    );
  }

  return data;
}