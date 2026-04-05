export type ClientStatus = "active" | "paused" | "problem" | "completed";

export type ExpenseCategory =
  | "marketing"
  | "contractor"
  | "service"
  | "tax"
  | "other";

export interface StoredClient {
  id: string;
  name: string;
  status: ClientStatus;
  owner: string;
  model: string;
  nextInvoice: string;
  amount: string;
  profit: string;
}

export interface StoredExpense {
  id: string;
  title: string;
  category: ExpenseCategory;
  amount: string;
  date: string;
  client: string;
}

export interface StoredPayment {
  id: string;
  client: string;
  project: string;
  paidAt: string;
  amount: string;
  source: string;
}

export interface StoredPayrollPayout {
  id: string;
  employee: string;
  payoutDate: string;
  amount: string;
  month: string;
  status: "scheduled" | "paid";
}

const CLIENTS_KEY = "clients";
const EXPENSES_KEY = "expenses";
const PAYMENTS_KEY = "payments";
const PAYROLL_PAYOUTS_KEY = "payroll_payouts";

const defaultClients: StoredClient[] = [
  {
    id: "1",
    name: "Client Orion",
    status: "active",
    owner: "Дмитрий",
    model: "Fixed monthly",
    nextInvoice: "08.04",
    amount: "₽30,000",
    profit: "₽112,300",
  },
  {
    id: "2",
    name: "Client Nova",
    status: "active",
    owner: "Антон",
    model: "Split",
    nextInvoice: "10.04",
    amount: "₽15,000",
    profit: "₽86,900",
  },
  {
    id: "3",
    name: "Client Delta",
    status: "paused",
    owner: "Дмитрий",
    model: "Hybrid",
    nextInvoice: "—",
    amount: "—",
    profit: "₽24,100",
  },
  {
    id: "4",
    name: "Client Alpha",
    status: "problem",
    owner: "Антон",
    model: "Percent",
    nextInvoice: "05.04",
    amount: "₽22,000",
    profit: "₽9,800",
  },
];

const defaultExpenses: StoredExpense[] = [
  {
    id: "1",
    title: "Telegram Ads",
    category: "marketing",
    amount: "₽25,000",
    date: "03.04",
    client: "RIVN media",
  },
  {
    id: "2",
    title: "Дизайнер",
    category: "contractor",
    amount: "₽18,000",
    date: "02.04",
    client: "Client Orion",
  },
  {
    id: "3",
    title: "Figma / сервисы",
    category: "service",
    amount: "₽4,500",
    date: "01.04",
    client: "Internal",
  },
  {
    id: "4",
    title: "Налог",
    category: "tax",
    amount: "₽29,960",
    date: "01.04",
    client: "Agency",
  },
  {
    id: "5",
    title: "Прочие расходы",
    category: "other",
    amount: "₽6,300",
    date: "29.03",
    client: "Internal",
  },
];

const defaultPayments: StoredPayment[] = [
  {
    id: "1",
    client: "Client Orion",
    project: "Avito Leadgen",
    paidAt: "01.04",
    amount: "₽30,000",
    source: "Bank transfer",
  },
  {
    id: "2",
    client: "Client Nova",
    project: "Ads Growth",
    paidAt: "28.03",
    amount: "₽15,000",
    source: "Card",
  },
  {
    id: "3",
    client: "Client Delta",
    project: "Hybrid Model",
    paidAt: "20.03",
    amount: "₽25,000",
    source: "Bank transfer",
  },
];

const defaultPayrollPayouts: StoredPayrollPayout[] = [
  {
    id: "1",
    employee: "Дмитрий",
    payoutDate: "01.05",
    amount: "₽25,000",
    month: "Апрель",
    status: "scheduled",
  },
  {
    id: "2",
    employee: "Антон",
    payoutDate: "01.04",
    amount: "₽20,000",
    month: "Март",
    status: "paid",
  },
];

function isBrowser() {
  return typeof window !== "undefined";
}

function readStorage<T>(key: string, fallback: T): T {
  if (!isBrowser()) return fallback;

  const stored = localStorage.getItem(key);

  if (!stored) return fallback;

  try {
    return JSON.parse(stored) as T;
  } catch {
    return fallback;
  }
}

function writeStorage<T>(key: string, value: T) {
  if (!isBrowser()) return;
  localStorage.setItem(key, JSON.stringify(value));
}

export function getClients(): StoredClient[] {
  return readStorage(CLIENTS_KEY, defaultClients);
}

export function saveClients(clients: StoredClient[]) {
  writeStorage(CLIENTS_KEY, clients);
}

export function getExpenses(): StoredExpense[] {
  return readStorage(EXPENSES_KEY, defaultExpenses);
}

export function saveExpenses(expenses: StoredExpense[]) {
  writeStorage(EXPENSES_KEY, expenses);
}

export function getPayments(): StoredPayment[] {
  return readStorage(PAYMENTS_KEY, defaultPayments);
}

export function savePayments(payments: StoredPayment[]) {
  writeStorage(PAYMENTS_KEY, payments);
}

export function getPayrollPayouts(): StoredPayrollPayout[] {
  return readStorage(PAYROLL_PAYOUTS_KEY, defaultPayrollPayouts);
}

export function savePayrollPayouts(payouts: StoredPayrollPayout[]) {
  writeStorage(PAYROLL_PAYOUTS_KEY, payouts);
}

export function parseRubAmount(value: string) {
  const num = Number(value.replace(/[^\d.-]/g, ""));
  return Number.isFinite(num) ? num : 0;
}

export function formatRub(value: number) {
  const rounded = Math.round(value || 0);

  return new Intl.NumberFormat("ru-RU").format(rounded) + " ₽";
}
export function formatDisplayDate(value: string) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
  });
}

export function normalizeDateInput(value: string) {
  if (!value) return "";
  return value;
}