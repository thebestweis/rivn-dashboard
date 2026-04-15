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

export function useBillingPlansQuery(enabled = true) {
  return useQuery<BillingPlan[]>({
    queryKey: queryKeys.billingPlans,
    queryFn: getBillingPlans,
    enabled,
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
    placeholderData: (previousData) => previousData,
  });
}

export function useBillingTransactionsQuery(enabled = true, limit = 100) {
  return useQuery<BillingTransaction[]>({
    queryKey: [...queryKeys.billingTransactions, limit],
    queryFn: () => getBillingTransactions(limit),
    enabled,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
    placeholderData: (previousData) => previousData,
  });
}

export function useWorkspaceBalanceQuery(enabled = true) {
  return useQuery<number>({
    queryKey: queryKeys.workspaceBalance,
    queryFn: getWorkspaceBalance,
    enabled,
    staleTime: 1000 * 60 * 3,
    gcTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
    placeholderData: (previousData) => previousData,
  });
}