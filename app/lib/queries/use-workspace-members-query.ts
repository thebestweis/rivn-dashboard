"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../query-keys";
import {
  getWorkspaceMembers,
  type WorkspaceMemberItem,
} from "../supabase/workspace-members";

const STALE_TIME = 1000 * 60 * 10;
const GC_TIME = 1000 * 60 * 30;

export function useWorkspaceMembersQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.workspaceMembers,
    queryFn: getWorkspaceMembers,
    enabled,
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
    placeholderData: (previousData) => previousData,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  });
}

export function useActiveWorkspaceMembers(enabled = true) {
  const query = useWorkspaceMembersQuery(enabled);

  const activeMembers = useMemo<WorkspaceMemberItem[]>(
    () => (query.data ?? []).filter((member) => member.status === "active"),
    [query.data]
  );

  const activePayrollMembers = useMemo<WorkspaceMemberItem[]>(
    () =>
      activeMembers.filter(
        (member) => member.is_payroll_active && member.status === "active"
      ),
    [activeMembers]
  );

  return {
    ...query,
    activeMembers,
    activePayrollMembers,
  };
}
