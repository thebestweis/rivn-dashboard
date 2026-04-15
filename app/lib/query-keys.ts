export const queryKeys = {
  projects: ["projects"] as const,
  project: (projectId: string) => ["projects", projectId] as const,
  projectsByWorkspace: (workspaceId: string) =>
    ["projects", "workspace", workspaceId] as const,
  projectTasks: (projectId: string) =>
    ["tasks", "project", projectId] as const,

  tasks: ["tasks"] as const,

  clients: ["clients"] as const,
  clientsByWorkspace: (workspaceId: string) =>
    ["clients", "workspace", workspaceId] as const,

  employees: ["employees"] as const,
  employeesByWorkspace: (workspaceId: string) =>
    ["employees", "workspace", workspaceId] as const,

  payments: ["payments"] as const,
  paymentsByWorkspace: (workspaceId: string) =>
    ["payments", "workspace", workspaceId] as const,

  expenses: ["expenses"] as const,
  expensesByWorkspace: (workspaceId: string) =>
    ["expenses", "workspace", workspaceId] as const,

  monthlyPlans: ["monthly-plans"] as const,
  monthlyPlansByWorkspace: (workspaceId: string) =>
    ["monthly-plans", "workspace", workspaceId] as const,

  payrollAccruals: ["payroll-accruals"] as const,
  payrollAccrualsByWorkspace: (workspaceId: string) =>
    ["payroll-accruals", "workspace", workspaceId] as const,

  payrollPayouts: ["payroll-payouts"] as const,
  payrollPayoutsByWorkspace: (workspaceId: string) =>
    ["payroll-payouts", "workspace", workspaceId] as const,

  payrollExtraPayments: ["payroll-extra-payments"] as const,
  payrollExtraPaymentsByWorkspace: (workspaceId: string) =>
    ["payroll-extra-payments", "workspace", workspaceId] as const,

  workspaceMembers: ["workspace-members"] as const,
  workspaceMemberLimitState: ["workspace-member-limit-state"] as const,
  workspaceMemberPermissions: (memberId: string) =>
    ["workspace-member-permissions", memberId] as const,

  accessibleWorkspaces: ["accessible-workspaces"] as const,
  systemSettings: ["system-settings"] as const,
  telegramSettings: ["telegram-settings"] as const,

  referralLinks: ["referral-links"] as const,
  referralRewards: ["referral-rewards"] as const,
  referralStats: ["referral-stats"] as const,

  billingPlans: ["billing-plans"] as const,
  billingTransactions: ["billing-transactions"] as const,
  billingTransactionsByWorkspace: (workspaceId: string, limit = 100) =>
    ["billing-transactions", "workspace", workspaceId, limit] as const,

  workspaceBalance: ["workspace-balance"] as const,
  workspaceBalanceByWorkspace: (workspaceId: string) =>
    ["workspace-balance", "workspace", workspaceId] as const,
};