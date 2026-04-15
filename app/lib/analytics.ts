import type {
  StoredExpense,
  StoredPayment,
  StoredPayrollPayout,
} from "./storage";
import { parseRubAmount } from "./storage";

interface MonthlyBucket {
  key: string;
  label: string;
  revenue: number;
  expenses: number;
  fot: number;
  tax: number;
  profit: number;
}

function parseStoredDate(value: string) {
  if (!value) return null;

  const normalizedValue = value.trim();
  if (!normalizedValue) return null;

  const isoDate = new Date(normalizedValue);
  if (!Number.isNaN(isoDate.getTime())) return isoDate;

  const fullRuMatch = normalizedValue.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (fullRuMatch) {
    const [, dayRaw, monthRaw, yearRaw] = fullRuMatch;

    const day = Number(dayRaw);
    const month = Number(monthRaw);
    const year = Number(yearRaw);

    if (!day || !month || !year || month < 1 || month > 12) {
      return null;
    }

    const parsed = new Date(year, month - 1, day);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const legacyMatch = normalizedValue.match(/^(\d{1,2})\.(\d{1,2})$/);
  if (legacyMatch) {
    const [, dayRaw, monthRaw] = legacyMatch;

    const day = Number(dayRaw);
    const month = Number(monthRaw);

    if (!day || !month || month < 1 || month > 12) {
      return null;
    }

    const year = new Date().getFullYear();
    const parsed = new Date(year, month - 1, day);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
}

function monthKey(date: Date) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  return `${year}-${String(month).padStart(2, "0")}`;
}

function monthLabel(date: Date) {
  return date.toLocaleString("ru-RU", { month: "short" });
}

function getMonthStartsFromDates(dates: Date[], count = 6) {
  const valid = dates
    .filter((date) => !Number.isNaN(date.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());

  const baseDate = valid.length > 0 ? valid[valid.length - 1] : new Date();

  const months: Date[] = [];

  for (let i = count - 1; i >= 0; i--) {
    months.push(new Date(baseDate.getFullYear(), baseDate.getMonth() - i, 1));
  }

  return months;
}

function normalizePayrollPayoutMonth(value: string) {
  if (!value) return "";

  if (value.includes("-")) {
    return value.slice(0, 7);
  }

  const match = value.match(/^(\d{2})\.(\d{2})$/);
  if (match) {
    const [, , month] = match;
    const currentYear = new Date().getFullYear();
    return `${currentYear}-${month}`;
  }

  const fullMatch = value.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (fullMatch) {
    const [, , month, year] = fullMatch;
    return `${year}-${month}`;
  }

  return "";
}

export function buildFinancialTimeSeries(params: {
  payments: StoredPayment[];
  expenses: StoredExpense[];
  payrollPayouts: StoredPayrollPayout[];
}) {
  const paymentDates = params.payments
    .map((item) => parseStoredDate(item.paidAt))
    .filter((date): date is Date => Boolean(date));

  const expenseDates = params.expenses
    .map((item) => parseStoredDate(item.date))
    .filter((date): date is Date => Boolean(date));

  const payrollDates = params.payrollPayouts
  .map((item) => {
    const monthKeyValue = normalizePayrollPayoutMonth(item.payoutDate);
    if (!monthKeyValue) return null;

    const [year, month] = monthKeyValue.split("-");
    if (!year || !month) return null;

    return new Date(Number(year), Number(month) - 1, 1);
  })
  .filter((date): date is Date => Boolean(date));

  const monthStarts = getMonthStartsFromDates(
    [...paymentDates, ...expenseDates, ...payrollDates],
    6
  );

  const buckets: MonthlyBucket[] = monthStarts.map((date) => ({
    key: monthKey(date),
    label: monthLabel(date),
    revenue: 0,
    expenses: 0,
    fot: 0,
    tax: 0,
    profit: 0,
  }));

  const bucketMap = new Map(buckets.map((bucket) => [bucket.key, bucket]));

  for (const payment of params.payments) {
    const date = parseStoredDate(payment.paidAt);
    if (!date) continue;

    const key = monthKey(date);
    const bucket = bucketMap.get(key);
    if (!bucket) continue;

    bucket.revenue += parseRubAmount(payment.amount);
  }

  for (const expense of params.expenses) {
    const date = parseStoredDate(expense.date);
    if (!date) continue;

    const key = monthKey(date);
    const bucket = bucketMap.get(key);
    if (!bucket) continue;

    bucket.expenses += parseRubAmount(expense.amount);
  }

  for (const payout of params.payrollPayouts) {
  if (!payout.payoutDate) continue;

  const key = normalizePayrollPayoutMonth(payout.payoutDate);
  if (!key) continue;

  const bucket = bucketMap.get(key);
  if (!bucket) continue;

  bucket.fot += parseRubAmount(String(payout.amount ?? ""));
}

  for (const bucket of buckets) {
    bucket.tax = Math.round(bucket.revenue * 0.07);
    bucket.profit = bucket.revenue - bucket.expenses - bucket.fot - bucket.tax;
  }

  return buckets.map((bucket) => ({
    period: bucket.key,
    periodLabel: bucket.label,
    revenue: bucket.revenue,
    expenses: bucket.expenses,
    fot: bucket.fot,
    profit: bucket.profit,
  }));
}