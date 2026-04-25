"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../query-keys";
import { fetchClientsFromSupabase } from "../supabase/clients";
import { getPaymentsFromSupabase } from "../supabase/payments";
import { getProjects } from "../supabase/projects";
import { useAppContextState } from "../../providers/app-context-provider";

const STALE_TIME = 1000 * 60 * 5;
const GC_TIME = 1000 * 60 * 30;

export function usePaymentsQuery(enabled = true) {
  const { workspace } = useAppContextState();
  const workspaceId = workspace?.id ?? "";

  return useQuery({
    queryKey: queryKeys.paymentsByWorkspace(workspaceId),
    queryFn: getPaymentsFromSupabase,
    enabled: enabled && Boolean(workspaceId),
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
    placeholderData: (previousData) => previousData,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  });
}

export function usePaymentClientsQuery(enabled = true) {
  const { workspace } = useAppContextState();
  const workspaceId = workspace?.id ?? "";

  return useQuery({
    queryKey: queryKeys.clientsByWorkspace(workspaceId),
    queryFn: fetchClientsFromSupabase,
    enabled: enabled && Boolean(workspaceId),
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
    placeholderData: (previousData) => previousData,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  });
}

export function usePaymentProjectsQuery(enabled = true) {
  const { workspace } = useAppContextState();
  const workspaceId = workspace?.id ?? "";

  return useQuery({
    queryKey: queryKeys.projectsByWorkspace(workspaceId),
    queryFn: getProjects,
    enabled: enabled && Boolean(workspaceId),
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
    placeholderData: (previousData) => previousData,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  });
}
