"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../query-keys";
import {
  getBillingPlans,
  getBillingTransactions,
  getWorkspaceBalance,
  type BillingPlan,
  type BillingTransaction,
} from "../supabase/billing";
import { useAppContextState } from "../../providers/app-context-provider";

const STALE_TIME = 1000 * 60 * 5;
const GC_TIME = 1000 * 60 * 30;

export function useBillingPlansQuery(enabled = true) {
  return useQuery<BillingPlan[]>({
    queryKey: queryKeys.billingPlans,
    queryFn: getBillingPlans,
    enabled,
    staleTime: 1000 * 60 * 10,
    gcTime: GC_TIME,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
    placeholderData: (previousData) => previousData,
  });
}

export function useBillingTransactionsQuery(enabled = true, limit = 100) {
  const { workspace } = useAppContextState();
  const workspaceId = workspace?.id ?? "";

  return useQuery<BillingTransaction[]>({
    queryKey: workspaceId
      ? queryKeys.billingTransactionsByWorkspace(workspaceId, limit)
      : [...queryKeys.billingTransactions, limit],
    queryFn: () => getBillingTransactions(limit),
    enabled: enabled && Boolean(workspaceId),
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
    placeholderData: (previousData) => previousData,
  });
}

export function useWorkspaceBalanceQuery(enabled = true) {
  const { workspace } = useAppContextState();
  const workspaceId = workspace?.id ?? "";

  return useQuery<number>({
    queryKey: workspaceId
      ? queryKeys.workspaceBalanceByWorkspace(workspaceId)
      : queryKeys.workspaceBalance,
    queryFn: getWorkspaceBalance,
    enabled: enabled && Boolean(workspaceId),
    staleTime: 1000 * 60 * 3,
    gcTime: GC_TIME,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
    placeholderData: (previousData) => previousData,
  });
}