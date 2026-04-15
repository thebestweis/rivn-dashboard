"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../query-keys";
import {
  fetchPayrollAccrualsFromSupabase,
  fetchPayrollExtraPaymentsFromSupabase,
  fetchPayrollPayoutsFromSupabase,
} from "../supabase/payroll";

export function usePayrollAccrualsQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.payrollAccruals,
    queryFn: fetchPayrollAccrualsFromSupabase,
    enabled,
  });
}

export function usePayrollPayoutsQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.payrollPayouts,
    queryFn: fetchPayrollPayoutsFromSupabase,
    enabled,
  });
}

export function usePayrollExtraPaymentsQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.payrollExtraPayments,
    queryFn: fetchPayrollExtraPaymentsFromSupabase,
    enabled,
  });
}