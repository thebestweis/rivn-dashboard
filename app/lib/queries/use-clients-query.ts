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

  return useQuery<StoredClient[]>({
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
    refetchOnMount: false,
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
    refetchOnMount: false,
  });
}

export function useCreateClientMutation() {
  const queryClient = useQueryClient();
  const { workspace } = useAppContextState();
  const workspaceId = workspace?.id ?? "";

  return useMutation({
    mutationFn: createClientInSupabase,
    onSuccess: (createdClient) => {
      if (!workspaceId) return;

      queryClient.setQueryData<StoredClient[]>(
        queryKeys.clientsByWorkspace(workspaceId),
        (prev = []) => [createdClient, ...prev]
      );
    },
  });
}

export function useUpdateClientMutation() {
  const queryClient = useQueryClient();
  const { workspace } = useAppContextState();
  const workspaceId = workspace?.id ?? "";

  return useMutation({
    mutationFn: ({
      clientId,
      values,
    }: {
      clientId: string;
      values: Omit<StoredClient, "id">;
    }) => updateClientInSupabase(clientId, values),
    onSuccess: (updatedClient) => {
      if (!workspaceId) return;

      queryClient.setQueryData<StoredClient[]>(
        queryKeys.clientsByWorkspace(workspaceId),
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
  const { workspace } = useAppContextState();
  const workspaceId = workspace?.id ?? "";

  return useMutation({
    mutationFn: deleteClientInSupabase,
    onSuccess: (_, deletedClientId) => {
      if (!workspaceId) return;

      queryClient.setQueryData<StoredClient[]>(
        queryKeys.clientsByWorkspace(workspaceId),
        (prev = []) => prev.filter((client) => client.id !== deletedClientId)
      );
    },
  });
}