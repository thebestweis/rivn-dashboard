"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
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
import {
  getBillingPlans,
  getBillingTransactions,
  getWorkspaceBalance,
} from "../lib/supabase/billing";
import { getCrmBootstrap, getCrmInbox } from "../lib/supabase/crm";

const STALE_TIME = 1000 * 60 * 10;
const BILLING_STALE_TIME = 1000 * 60 * 5;

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
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const { isReady, workspace } = useAppContextState();
  const workspaceId = workspace?.id ?? "";

  useEffect(() => {
    if (!isReady || !workspaceId) return;

    let cancelled = false;

    const cancelIdleWork = scheduleIdleWork(() => {
      if (cancelled) return;

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

      void Promise.allSettled([
        prefetch(queryKeys.clientsByWorkspace(workspaceId), fetchClientsFromSupabase),
        prefetch(queryKeys.projectsByWorkspace(workspaceId), getProjects),
        prefetch(queryKeys.paymentsByWorkspace(workspaceId), getPaymentsFromSupabase),
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
      ]).then(() => {
        if (cancelled) return;

        void Promise.allSettled([
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
          prefetch(queryKeys.crmBootstrap(workspaceId), () => getCrmBootstrap({})),
          prefetch(queryKeys.crmInbox(workspaceId), getCrmInbox, 1000 * 30),
        ]);
      });

      if (pathname.startsWith("/tasks")) {
        void prefetch(queryKeys.tasksByWorkspace(workspaceId), getAllTasks);
      }
    });

    return () => {
      cancelled = true;
      cancelIdleWork();
    };
  }, [isReady, pathname, queryClient, workspaceId]);

  return null;
}
