import { generateEntityId } from "./storage";
import { fetchEmployeesFromSupabase } from "./supabase/employees";
import {
  createPayrollAccrualInSupabase,
  findPayrollAccrualByPaymentId,
} from "./supabase/payroll";
import { fetchClientByIdFromSupabase } from "./supabase/clients";
import { getProjectById } from "./supabase/projects";

type AutoCreatePayrollAccrualParams = {
  paymentId: string;
  clientId: string | null;
  projectId?: string | null;
  periodLabel?: string | null;
  paidDate?: string | null;
};

function toDisplayDate(value: string | null | undefined) {
  if (!value) return "";

  if (value.includes(".")) return value;

  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;

  return `${day}.${month}.${year}`;
}

export async function autoCreatePayrollAccrualFromPayment(
  params: AutoCreatePayrollAccrualParams
): Promise<void> {
  if (!params.paymentId) return;
  if (!params.clientId) return;
  if (!params.projectId) return;

  const existing = await findPayrollAccrualByPaymentId(params.paymentId);
  if (existing) return;

  const [employees, client, project] = await Promise.all([
    fetchEmployeesFromSupabase(),
    fetchClientByIdFromSupabase(params.clientId),
    getProjectById(params.projectId),
  ]);

  if (!client || !project) return;
  if (!project.employee_id) return;

  const employee = employees.find(
    (item) => item.id === project.employee_id && item.isActive
  );

  if (!employee) return;

  const shouldCreateAccrual =
    employee.payType === "fixed_per_paid_project" ||
    employee.payType === "fixed_salary_plus_project";

  if (!shouldCreateAccrual) return;

  const paymentDate =
    toDisplayDate(params.paidDate) || toDisplayDate(new Date().toISOString());

  await createPayrollAccrualInSupabase({
    id: generateEntityId("payroll_accrual"),
    employee: employee.name,
    employeeId: employee.id,
    client: client.name,
    clientId: client.id,
    project: project.name ?? params.periodLabel ?? "Без проекта",
    projectId: project.id ?? params.projectId ?? null,
    paymentId: params.paymentId,
    amount: employee.payValue,
    date: paymentDate,
    status: "accrued",
  });
}