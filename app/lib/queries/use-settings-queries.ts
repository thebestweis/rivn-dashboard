"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../query-keys";
import { fetchEmployeesFromSupabase } from "../supabase/employees";
import { ensureSystemSettings } from "../supabase/system-settings";
import {
  getWorkspaceMembers,
  getWorkspaceMemberLimitState,
} from "../supabase/workspace-members";
import { getWorkspaceMemberPermissions } from "../supabase/workspace-member-permissions";
import {
  getAccessibleWorkspaces,
} from "../supabase/workspaces";
import {
  getMyReferralLinks,
  getMyReferralRewards,
  getMyReferralStats,
  ensureMyStandardReferralLink,
} from "../supabase/referrals";
import { getTelegramSettings } from "../telegram-settings";

export function useEmployeesQuery(enabled = true) {
  return useQuery({
    queryKey: ["settings", ...queryKeys.clients, "employees"],
    queryFn: fetchEmployeesFromSupabase,
    enabled,
    staleTime: 1000 * 60 * 5,
  });
}

export function useSystemSettingsQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.systemSettings,
    queryFn: ensureSystemSettings,
    enabled,
    staleTime: 1000 * 60 * 10,
  });
}

export function useWorkspaceMembersQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.workspaceMembers,
    queryFn: getWorkspaceMembers,
    enabled,
    staleTime: 1000 * 60 * 5,
  });
}

export function useWorkspaceMemberLimitStateQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.workspaceMemberLimitState,
    queryFn: getWorkspaceMemberLimitState,
    enabled,
    staleTime: 1000 * 60 * 2,
  });
}

export function useWorkspaceMemberPermissionsQuery(
  memberId: string,
  enabled = true
) {
  return useQuery({
    queryKey: queryKeys.workspaceMemberPermissions(memberId),
    queryFn: () => getWorkspaceMemberPermissions(memberId),
    enabled: enabled && Boolean(memberId),
    staleTime: 1000 * 60 * 5,
  });
}

export function useAccessibleWorkspacesQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.accessibleWorkspaces,
    queryFn: getAccessibleWorkspaces,
    enabled,
    staleTime: 1000 * 60 * 5,
  });
}

export function useReferralLinksQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.referralLinks,
    queryFn: async () => {
      await ensureMyStandardReferralLink();
      return getMyReferralLinks();
    },
    enabled,
    staleTime: 1000 * 60 * 5,
  });
}

export function useReferralRewardsQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.referralRewards,
    queryFn: getMyReferralRewards,
    enabled,
    staleTime: 1000 * 60 * 2,
  });
}

export function useReferralStatsQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.referralStats,
    queryFn: getMyReferralStats,
    enabled,
    staleTime: 1000 * 60 * 2,
  });
}

export function useTelegramSettingsQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.telegramSettings,
    queryFn: getTelegramSettings,
    enabled,
    staleTime: 1000 * 60 * 10,
  });
}