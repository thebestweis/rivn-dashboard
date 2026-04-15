"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../query-keys";
import {
  getWorkspaceMembers,
  type WorkspaceMemberItem,
} from "../supabase/workspace-members";

export function useWorkspaceMembersQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.workspaceMembers,
    queryFn: getWorkspaceMembers,
    enabled,
  });
}

export function useActiveWorkspaceMembers(enabled = true) {
  const query = useWorkspaceMembersQuery(enabled);

  const activeMembers = useMemo<WorkspaceMemberItem[]>(
    () => (query.data ?? []).filter((member) => member.status === "active"),
    [query.data]
  );

  return {
    ...query,
    activeMembers,
  };
}