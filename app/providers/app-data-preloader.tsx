"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useAppContextState } from "./app-context-provider";
import { queryKeys } from "../lib/query-keys";
import {
  fetchClientsFromSupabase,
  fetchMonthlyPlansFromSupabase,
} from "../lib/supabase/clients";
import { getProjects } from "../lib/supabase/projects";
import {
  getActiveRootTaskCountsByProject,
  getAllTasks,
} from "../lib/supabase/tasks";
import { getPaymentsFromSupabase } from "../lib/supabase/payments";
import { getExpensesFromSupabase } from "../lib/supabase/expenses";
import {
  fetchPayrollAccrualsFromSupabase,
  fetchPayrollExtraPaymentsFromSupabase,
  fetchPayrollPayoutsFromSupabase,
} from "../lib/supabase/payroll";
import { getWorkspaceMembers } from "../lib/supabase/workspace-members";
import { getWorkspaceMemberPermissions } from "../lib/supabase/workspace-member-permissions";
import {
  getBillingPlans,
  getBillingTransactions,
  getWorkspaceBalance,
} from "../lib/supabase/billing";
import { getCrmBootstrap, getCrmInbox } from "../lib/supabase/crm";

const STALE_TIME = 1000 * 60 * 10;
const BILLING_STALE_TIME = 1000 * 60 * 5;
const ROUTES_TO_PREFETCH = [
  "/dashboard",
  "/clients",
  "/crm",
  "/crm/settings",
  "/crm/integrations",
  "/crm/analytics",
  "/crm/team",
  "/projects",
  "/tasks",
  "/payments",
  "/payroll",
  "/expenses",
  "/analytics",
  "/billing",
  "/settings",
  "/guide",
];

const DEFAULT_PAYMENT_FILTERS_KEY = JSON.stringify({});
const PLANNED_PAYMENT_FILTERS_KEY = JSON.stringify({
  status: "planned",
  sortBy: "due_date",
  sortDirection: "asc",
});
const PAID_PAYMENT_FILTERS_KEY = JSON.stringify({
  status: "paid",
  sortBy: "paid_date",
  sortDirection: "desc",
});
const CRM_DEFAULT_FILTERS = {
  search: "",
  sourceId: "",
  assigneeId: "",
  status: "all" as const,
  pipelineId: "",
};
const CRM_DEFAULT_FILTERS_KEY = JSON.stringify(CRM_DEFAULT_FILTERS);

function scheduleIdleWork(callback: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  const requestIdleCallback = (
    window as Window & {
      requestIdleCallback?: (
        callback: () => void,
        options?: { timeout?: number }
      ) => number;
      cancelIdleCallback?: (handle: number) => void;
    }
  ).requestIdleCallback;

  if (requestIdleCallback) {
    const handle = requestIdleCallback(callback, { timeout: 1500 });
    return () =>
      (
        window as Window & {
          cancelIdleCallback?: (handle: number) => void;
        }
      ).cancelIdleCallback?.(handle);
  }

  const handle = window.setTimeout(callback, 700);
  return () => window.clearTimeout(handle);
}

export function AppDataPreloader() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isReady, membership, workspace } = useAppContextState();
  const workspaceId = workspace?.id ?? "";
  const memberId = membership?.id ?? "";

  useEffect(() => {
    if (!isReady || !workspaceId) return;

    let cancelled = false;

    for (const route of ROUTES_TO_PREFETCH) {
      router.prefetch(route);
    }

    const prefetch = (
      queryKey: readonly unknown[],
      queryFn: () => Promise<unknown>,
      staleTime = STALE_TIME
    ) =>
      queryClient.prefetchQuery({
        queryKey,
        queryFn,
        staleTime,
      });

    const prefetchPrimaryData = () =>
      Promise.allSettled([
        memberId
          ? prefetch(
              queryKeys.workspaceMemberPermissions(memberId),
              () => getWorkspaceMemberPermissions(memberId)
            )
          : Promise.resolve(),
        prefetch(
          queryKeys.crmBootstrap(workspaceId, CRM_DEFAULT_FILTERS_KEY),
          () => getCrmBootstrap(CRM_DEFAULT_FILTERS)
        ),
        prefetch(queryKeys.crmInbox(workspaceId), getCrmInbox, 1000 * 30),
        prefetch(queryKeys.clientsByWorkspace(workspaceId), fetchClientsFromSupabase),
        prefetch(queryKeys.projectsByWorkspace(workspaceId), getProjects),
        prefetch(queryKeys.tasksByWorkspace(workspaceId), getAllTasks),
        prefetch(
          queryKeys.paymentsByWorkspaceFilters(
            workspaceId,
            DEFAULT_PAYMENT_FILTERS_KEY
          ),
          () => getPaymentsFromSupabase({})
        ),
        prefetch(queryKeys.expensesByWorkspace(workspaceId), getExpensesFromSupabase),
        prefetch(
          queryKeys.monthlyPlansByWorkspace(workspaceId),
          fetchMonthlyPlansFromSupabase
        ),
        prefetch(queryKeys.workspaceMembersByWorkspace(workspaceId), getWorkspaceMembers),
        prefetch(
          queryKeys.activeTaskCountsByProject(workspaceId),
          getActiveRootTaskCountsByProject
        ),
      ]);

    const prefetchSecondaryData = () =>
      Promise.allSettled([
        prefetch(
          queryKeys.paymentsByWorkspaceFilters(
            workspaceId,
            PLANNED_PAYMENT_FILTERS_KEY
          ),
          () =>
            getPaymentsFromSupabase({
              status: "planned",
              sortBy: "due_date",
              sortDirection: "asc",
            })
        ),
        prefetch(
          queryKeys.paymentsByWorkspaceFilters(
            workspaceId,
            PAID_PAYMENT_FILTERS_KEY
          ),
          () =>
            getPaymentsFromSupabase({
              status: "paid",
              sortBy: "paid_date",
              sortDirection: "desc",
            })
        ),
        prefetch(
          queryKeys.payrollAccrualsByWorkspace(workspaceId),
          fetchPayrollAccrualsFromSupabase
        ),
        prefetch(
          queryKeys.payrollPayoutsByWorkspace(workspaceId),
          fetchPayrollPayoutsFromSupabase
        ),
        prefetch(
          queryKeys.payrollExtraPaymentsByWorkspace(workspaceId),
          fetchPayrollExtraPaymentsFromSupabase
        ),
        prefetch(queryKeys.billingPlans, getBillingPlans, BILLING_STALE_TIME),
        prefetch(
          queryKeys.billingTransactionsByWorkspace(workspaceId, 100),
          () => getBillingTransactions(100),
          BILLING_STALE_TIME
        ),
        prefetch(
          queryKeys.workspaceBalanceByWorkspace(workspaceId),
          getWorkspaceBalance,
          BILLING_STALE_TIME
        ),
      ]);

    void prefetchPrimaryData().then(() => {
      if (cancelled) return;
      void prefetchSecondaryData();
    });

    const cancelIdleWork = scheduleIdleWork(() => {
      if (cancelled) return;
      void prefetchSecondaryData();
    });

    return () => {
      cancelled = true;
      cancelIdleWork();
    };
  }, [isReady, memberId, queryClient, router, workspaceId]);

  return null;
}
