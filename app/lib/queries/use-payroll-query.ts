"use client";

import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { queryKeys } from "../query-keys";
import {
  fetchPayrollAccrualsFromSupabase,
  fetchPayrollExtraPaymentsFromSupabase,
  fetchPayrollPayoutsFromSupabase,
} from "../supabase/payroll";
import { useAppContextState } from "../../providers/app-context-provider";

const STALE_TIME = 1000 * 60 * 10;
const GC_TIME = 1000 * 60 * 60;

export function usePayrollAccrualsQuery(enabled = true) {
  const { workspace } = useAppContextState();
  const workspaceId = workspace?.id ?? "";

  return useQuery({
    queryKey: workspaceId
      ? queryKeys.payrollAccrualsByWorkspace(workspaceId)
      : queryKeys.payrollAccruals,
    queryFn: fetchPayrollAccrualsFromSupabase,
    enabled: enabled && Boolean(workspaceId),
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  });
}

export function usePayrollPayoutsQuery(enabled = true) {
  const { workspace } = useAppContextState();
  const workspaceId = workspace?.id ?? "";

  return useQuery({
    queryKey: workspaceId
      ? queryKeys.payrollPayoutsByWorkspace(workspaceId)
      : queryKeys.payrollPayouts,
    queryFn: fetchPayrollPayoutsFromSupabase,
    enabled: enabled && Boolean(workspaceId),
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  });
}

export function usePayrollExtraPaymentsQuery(enabled = true) {
  const { workspace } = useAppContextState();
  const workspaceId = workspace?.id ?? "";

  return useQuery({
    queryKey: workspaceId
      ? queryKeys.payrollExtraPaymentsByWorkspace(workspaceId)
      : queryKeys.payrollExtraPayments,
    queryFn: fetchPayrollExtraPaymentsFromSupabase,
    enabled: enabled && Boolean(workspaceId),
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  });
}
