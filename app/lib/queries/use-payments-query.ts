"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../query-keys";
import { fetchClientsFromSupabase } from "../supabase/clients";
import { fetchEmployeesFromSupabase } from "../supabase/employees";
import { getPaymentsFromSupabase } from "../supabase/payments";
import { getProjects } from "../supabase/projects";
import { useAppContextState } from "../../providers/app-context-provider";

export function usePaymentsQuery(enabled = true) {
  const { workspace } = useAppContextState();
  const workspaceId = workspace?.id ?? "";

  return useQuery({
    queryKey: queryKeys.paymentsByWorkspace(workspaceId),
    queryFn: getPaymentsFromSupabase,
    enabled: enabled && Boolean(workspaceId),
  });
}

export function usePaymentClientsQuery(enabled = true) {
  const { workspace } = useAppContextState();
  const workspaceId = workspace?.id ?? "";

  return useQuery({
    queryKey: queryKeys.clientsByWorkspace(workspaceId),
    queryFn: fetchClientsFromSupabase,
    enabled: enabled && Boolean(workspaceId),
  });
}

export function usePaymentProjectsQuery(enabled = true) {
  const { workspace } = useAppContextState();
  const workspaceId = workspace?.id ?? "";

  return useQuery({
    queryKey: queryKeys.projectsByWorkspace(workspaceId),
    queryFn: getProjects,
    enabled: enabled && Boolean(workspaceId),
  });
}

export function usePaymentEmployeesQuery(enabled = true) {
  const { workspace } = useAppContextState();
  const workspaceId = workspace?.id ?? "";

  return useQuery({
    queryKey: queryKeys.employeesByWorkspace(workspaceId),
    queryFn: fetchEmployeesFromSupabase,
    enabled: enabled && Boolean(workspaceId),
  });
}