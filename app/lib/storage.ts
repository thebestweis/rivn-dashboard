

export type ClientStatus = "active" | "paused" | "problem" | "completed";

export const CLIENT_STATUS_LABELS: Record<ClientStatus, string> = {
  active: "Активный",
  paused: "На паузе",
  problem: "Проблемный",
  completed: "Завершён",
};

export type ExpenseCategory =
  | "marketing"
  | "contractor"
  | "service"
  | "tax"
  | "other";

export type EmployeePayType =
  | "fixed_per_paid_project"
  | "fixed_salary"
  | "fixed_salary_plus_project";

export interface StoredEmployee {
  id: string;
  name: string;
  role: string;
  payType: EmployeePayType;
  payValue: string;
  fixedSalary?: string;
  payoutDay?: number;
  isActive: boolean;
}

export interface StoredClient {
  id: string;
  name: string;
  status: ClientStatus;
  owner: string;
  ownerId?: string | null;
  model: string;
  nextInvoice: string;
  amount: string;
  profit: string;
  notes?: string;
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
  clientId?: string | null;
  project: string;
  projectId?: string | null;
  paidAt: string;
  amount: string;
  source: string;
}

export interface StoredPayrollAccrual {
  id: string;
  employee: string;
  employeeId?: string | null;
  client: string;
  clientId?: string | null;
  project: string;
  projectId?: string | null;
  paymentId?: string | null;
  amount: string;
  date: string;
  status: "accrued" | "paid";
}

export interface StoredPayrollPayout {
  id: string;
  employee: string;
  employeeId?: string | null;
  payoutDate: string;
  amount: string;
  month: string;
  status: "scheduled" | "paid";
}

export interface StoredPayrollExtraPayment {
  id: string;
  employee: string;
  employeeId?: string | null;
  reason: string;
  date: string;
  amount: string;
}

const CLIENTS_KEY = "clients";
const EXPENSES_KEY = "expenses";
const PAYMENTS_KEY = "payments";
const EMPLOYEES_KEY = "employees";
const PAYROLL_ACCRUALS_KEY = "payroll_accruals";
const PAYROLL_PAYOUTS_KEY = "payroll_payouts";
const PAYROLL_EXTRA_PAYMENTS_KEY = "payroll_extra_payments";

const defaultEmployees: StoredEmployee[] = [
  {
    id: "1",
    name: "Дмитрий",
    role: "Аккаунт-менеджер",
    payType: "fixed_per_paid_project",
    payValue: "₽5,000",
    isActive: true,
  },
  {
    id: "2",
    name: "Антон",
    role: "Проектный менеджер",
    payType: "fixed_per_paid_project",
    payValue: "₽5,000",
    isActive: true,
  },
];

const defaultClients: StoredClient[] = [
  {
    id: "1",
    name: "Client Orion",
    status: "active",
    owner: "Дмитрий",
    ownerId: "1",
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
    ownerId: "2",
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
    ownerId: "1",
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
    ownerId: "2",
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
    clientId: "1",
    project: "Avito Leadgen",
    paidAt: "01.04",
    amount: "₽30,000",
    source: "Bank transfer",
  },
  {
    id: "2",
    client: "Client Nova",
    clientId: "2",
    project: "Ads Growth",
    paidAt: "28.03",
    amount: "₽15,000",
    source: "Card",
  },
  {
    id: "3",
    client: "Client Delta",
    clientId: "3",
    project: "Hybrid Model",
    paidAt: "20.03",
    amount: "₽25,000",
    source: "Bank transfer",
  },
];

const defaultPayrollAccruals: StoredPayrollAccrual[] = [
  {
    id: "1",
    employee: "Дмитрий",
    employeeId: "1",
    client: "Client Orion",
    clientId: "1",
    project: "Avito Leadgen",
    paymentId: "1",
    amount: "₽5,000",
    date: "01.04",
    status: "accrued",
  },
  {
    id: "2",
    employee: "Антон",
    employeeId: "2",
    client: "Client Nova",
    clientId: "2",
    project: "Ads Growth",
    paymentId: "2",
    amount: "₽5,000",
    date: "28.03",
    status: "paid",
  },
];

const defaultPayrollPayouts: StoredPayrollPayout[] = [
  {
    id: "1",
    employee: "Дмитрий",
    employeeId: "1",
    payoutDate: "01.05",
    amount: "₽25,000",
    month: "Апрель",
    status: "scheduled",
  },
  {
    id: "2",
    employee: "Антон",
    employeeId: "2",
    payoutDate: "01.04",
    amount: "₽20,000",
    month: "Март",
    status: "paid",
  },
];

const defaultPayrollExtraPayments: StoredPayrollExtraPayment[] = [
  {
    id: "1",
    employee: "Дмитрий",
    employeeId: "1",
    reason: "Бонус за перевыполнение",
    date: "03.04",
    amount: "₽10,000",
  },
  {
    id: "2",
    employee: "Антон",
    employeeId: "2",
    reason: "Разовая компенсация",
    date: "28.03",
    amount: "₽4,000",
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

export function saveEmployees(employees: StoredEmployee[]) {
  writeStorage(EMPLOYEES_KEY, employees);
}

export function getEmployees(): StoredEmployee[] {
  return readStorage(EMPLOYEES_KEY, defaultEmployees);
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

export function getPayrollAccruals(): StoredPayrollAccrual[] {
  return readStorage(PAYROLL_ACCRUALS_KEY, defaultPayrollAccruals);
}

export function savePayrollAccruals(accruals: StoredPayrollAccrual[]) {
  writeStorage(PAYROLL_ACCRUALS_KEY, accruals);
}

export function getPayrollPayouts(): StoredPayrollPayout[] {
  return readStorage(PAYROLL_PAYOUTS_KEY, defaultPayrollPayouts);
}

export function savePayrollPayouts(payouts: StoredPayrollPayout[]) {
  writeStorage(PAYROLL_PAYOUTS_KEY, payouts);
}

export function getPayrollExtraPayments(): StoredPayrollExtraPayment[] {
  return readStorage(PAYROLL_EXTRA_PAYMENTS_KEY, defaultPayrollExtraPayments);
}

export function savePayrollExtraPayments(
  extraPayments: StoredPayrollExtraPayment[]
) {
  writeStorage(PAYROLL_EXTRA_PAYMENTS_KEY, extraPayments);
}

export function parseRubAmount(value: string | number | null | undefined) {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;

  const normalized = String(value)
    .replace(/\s/g, "")
    .replace(/₽/g, "")
    .replace(/,/g, ".");

  const num = Number(normalized.replace(/[^\d.-]/g, ""));
  return Number.isFinite(num) ? num : 0;
}

export function formatRub(value: number) {
  const rounded = Math.round(value || 0);
  return new Intl.NumberFormat("ru-RU").format(rounded) + " ₽";
}

export function calculateEmployeePayrollAmount(employee: StoredEmployee) {
  const projectRate = parseRubAmount(employee.payValue ?? "");
  const fixedSalary = parseRubAmount(employee.fixedSalary ?? "");

  if (employee.payType === "fixed_salary") {
    return fixedSalary;
  }

  if (employee.payType === "fixed_salary_plus_project") {
    return fixedSalary + projectRate;
  }

  return projectRate;
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

export function generateEntityId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}