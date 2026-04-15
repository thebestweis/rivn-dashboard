"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";
import { queryKeys } from "../query-keys";
import {
  createClientInSupabase,
  deleteClientInSupabase,
  fetchClientsFromSupabase,
  updateClientInSupabase,
} from "../supabase/clients";
import { fetchEmployeesFromSupabase } from "../supabase/employees";
import type { StoredClient, StoredEmployee } from "../storage";
import { useAppContextState } from "../../providers/app-context-provider";

const STALE_TIME = 1000 * 60 * 5;
const GC_TIME = 1000 * 60 * 30;

export function useClientsQuery(enabled = true) {
  const { workspace } = useAppContextState();
  const workspaceId = workspace?.id ?? "";

  return useQuery({
    queryKey: workspaceId
      ? queryKeys.clientsByWorkspace(workspaceId)
      : queryKeys.clients,
    queryFn: fetchClientsFromSupabase,
    enabled: enabled && Boolean(workspaceId),
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}

export function useClientEmployeesQuery(enabled = true) {
  const { workspace } = useAppContextState();
  const workspaceId = workspace?.id ?? "";

  return useQuery<StoredEmployee[]>({
    queryKey: workspaceId
      ? queryKeys.employeesByWorkspace(workspaceId)
      : queryKeys.employees,
    queryFn: fetchEmployeesFromSupabase,
    enabled: enabled && Boolean(workspaceId),
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}

export function useCreateClientMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createClientInSupabase,
    onSuccess: (createdClient) => {
      queryClient.setQueriesData<StoredClient[]>(
        { queryKey: ["clients"] },
        (prev = []) => [createdClient, ...prev]
      );
    },
  });
}

export function useUpdateClientMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      clientId,
      values,
    }: {
      clientId: string;
      values: Omit<StoredClient, "id">;
    }) => updateClientInSupabase(clientId, values),
    onSuccess: (updatedClient) => {
      queryClient.setQueriesData<StoredClient[]>(
        { queryKey: ["clients"] },
        (prev = []) =>
          prev.map((client) =>
            client.id === updatedClient.id ? updatedClient : client
          )
      );
    },
  });
}

export function useDeleteClientMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteClientInSupabase,
    onSuccess: (_, deletedClientId) => {
      queryClient.setQueriesData<StoredClient[]>(
        { queryKey: ["clients"] },
        (prev = []) => prev.filter((client) => client.id !== deletedClientId)
      );
    },
  });
}