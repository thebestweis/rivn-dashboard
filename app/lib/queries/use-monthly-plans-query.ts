"use client";

import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { queryKeys } from "../query-keys";
import { fetchMonthlyPlansFromSupabase } from "../supabase/clients";
import { useAppContextState } from "../../providers/app-context-provider";

const STALE_TIME = 1000 * 60 * 10;
const GC_TIME = 1000 * 60 * 60;

export function useMonthlyPlansQuery(enabled = true) {
  const { workspace } = useAppContextState();
  const workspaceId = workspace?.id ?? "";

  return useQuery({
    queryKey: workspaceId
      ? queryKeys.monthlyPlansByWorkspace(workspaceId)
      : queryKeys.monthlyPlans,
    queryFn: fetchMonthlyPlansFromSupabase,
    enabled: enabled && Boolean(workspaceId),
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  });
}
