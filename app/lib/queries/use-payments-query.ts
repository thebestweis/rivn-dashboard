"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../query-keys";
import { fetchClientsFromSupabase } from "../supabase/clients";
import { fetchEmployeesFromSupabase } from "../supabase/employees";
import { getPaymentsFromSupabase } from "../supabase/payments";
import { getProjects } from "../supabase/projects";

export function usePaymentsQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.payments,
    queryFn: getPaymentsFromSupabase,
    enabled,
  });
}

export function usePaymentClientsQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.clients,
    queryFn: fetchClientsFromSupabase,
    enabled,
  });
}

export function usePaymentProjectsQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.projects,
    queryFn: getProjects,
    enabled,
  });
}

export function usePaymentEmployeesQuery(enabled = true) {
  return useQuery({
    queryKey: ["employees"],
    queryFn: fetchEmployeesFromSupabase,
    enabled,
  });
}