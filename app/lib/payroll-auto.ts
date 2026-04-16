import { generateEntityId, parseRubAmount } from "./storage";
import {
  createPayrollAccrualInSupabase,
  deletePayrollAccrualFromSupabase,
  findPayrollAccrualByPaymentId,
  updatePayrollAccrualInSupabase,
} from "./supabase/payroll";
import { fetchClientByIdFromSupabase } from "./supabase/clients";
import { getProjectById } from "./supabase/projects";
import { ensureSystemSettings } from "./supabase/system-settings";
import {
  getWorkspaceMembers,
  getWorkspaceMemberDisplayName,
} from "./supabase/workspace-members";

type SyncPayrollAccrualParams = {
  paymentId: string;
  clientId: string | null;
  projectId?: string | null;
  periodLabel?: string | null;
  paidDate?: string | null;
  shouldExist: boolean;
};

function toDisplayDate(value: string | null | undefined) {
  if (!value) return "";

  if (value.includes(".")) return value;

  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;

  return `${day}.${month}.${year}`;
}

function resolveAccrualAmount(params: {
  memberPayValue: string | null | undefined;
  defaultEmployeePay: string | null | undefined;
}) {
  const memberAmount = parseRubAmount(params.memberPayValue);
  if (memberAmount > 0) {
    return params.memberPayValue?.trim() || "₽5,000";
  }

  const defaultAmount = parseRubAmount(params.defaultEmployeePay);
  if (defaultAmount > 0) {
    return params.defaultEmployeePay?.trim() || "₽5,000";
  }

  return "₽5,000";
}

export async function syncPayrollAccrualFromPayment(
  params: SyncPayrollAccrualParams
): Promise<void> {
  if (!params.paymentId) return;

  const existing = await findPayrollAccrualByPaymentId(params.paymentId);

  if (!params.shouldExist) {
    if (existing) {
      await deletePayrollAccrualFromSupabase(existing.id);
    }
    return;
  }

  if (!params.clientId || !params.projectId) {
    if (existing) {
      await deletePayrollAccrualFromSupabase(existing.id);
    }
    return;
  }

  const [members, client, project, systemSettings] = await Promise.all([
    getWorkspaceMembers(),
    fetchClientByIdFromSupabase(params.clientId),
    getProjectById(params.projectId),
    ensureSystemSettings(),
  ]);

  if (!client || !project || !project.employee_id) {
    if (existing) {
      await deletePayrollAccrualFromSupabase(existing.id);
    }
    return;
  }

  const member = members.find(
    (item) =>
      item.id === project.employee_id &&
      item.status === "active" &&
      (item.is_payroll_active ?? true)
  );

  if (!member) {
    if (existing) {
      await deletePayrollAccrualFromSupabase(existing.id);
    }
    return;
  }

  const shouldCreateAccrual =
    member.pay_type === "fixed_per_paid_project" ||
    member.pay_type === "fixed_salary_plus_project";

  if (!shouldCreateAccrual) {
    if (existing) {
      await deletePayrollAccrualFromSupabase(existing.id);
    }
    return;
  }

  const paymentDate =
    toDisplayDate(params.paidDate) || toDisplayDate(new Date().toISOString());

  const accrualAmount = resolveAccrualAmount({
    memberPayValue: member.pay_value,
    defaultEmployeePay: systemSettings.default_employee_pay,
  });

  const nextAccrual = {
    employee: getWorkspaceMemberDisplayName(member),
    employeeId: member.id,
    client: client.name,
    clientId: client.id,
    project: project.name ?? params.periodLabel ?? "Без проекта",
    projectId: project.id ?? params.projectId ?? null,
    paymentId: params.paymentId,
    amount: accrualAmount,
    date: paymentDate,
    status: "accrued" as const,
  };

  if (existing) {
    await updatePayrollAccrualInSupabase(existing.id, nextAccrual);
    return;
  }

  await createPayrollAccrualInSupabase({
    id: generateEntityId("payroll_accrual"),
    ...nextAccrual,
  });
}