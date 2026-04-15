

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

const defaultEmployees: StoredEmployee[] = [];
const defaultClients: StoredClient[] = [];
const defaultExpenses: StoredExpense[] = [];
const defaultPayments: StoredPayment[] = [];
const defaultPayrollAccruals: StoredPayrollAccrual[] = [];
const defaultPayrollPayouts: StoredPayrollPayout[] = [];
const defaultPayrollExtraPayments: StoredPayrollExtraPayment[] = [];

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