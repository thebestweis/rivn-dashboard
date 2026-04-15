"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../query-keys";
import { fetchMonthlyPlansFromSupabase } from "../supabase/clients";

export function useMonthlyPlansQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.monthlyPlans,
    queryFn: fetchMonthlyPlansFromSupabase,
    enabled,
  });
}