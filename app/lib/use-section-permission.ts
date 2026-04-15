"use client";

import { useQuery } from "@tanstack/react-query";
import { isAppRole, type AppRole, type AppSection } from "./permissions";
import { useAppContextState } from "../providers/app-context-provider";
import {
  getWorkspaceMemberPermissions,
  type WorkspaceMemberPermissionItem,
} from "./supabase/workspace-member-permissions";
import {
  canAccessSectionWithCustomPermissions,
  canManageSectionWithCustomPermissions,
} from "./custom-access";
import { queryKeys } from "./query-keys";

type UseSectionPermissionResult = {
  isLoading: boolean;
  canView: boolean;
  canManage: boolean;
  errorMessage: string;
};

export function useSectionPermission(
  section: AppSection
): UseSectionPermissionResult {
  const {
    isLoading: isAppContextLoading,
    isReady,
    role,
    errorMessage,
    membership,
  } = useAppContextState();

  const memberId = membership?.id ?? "";
  const currentRole: AppRole | null = isAppRole(role) ? role : null;

  const {
    data: memberPermissions = [],
    isLoading: isPermissionsLoading,
    error: permissionsError,
  } = useQuery<WorkspaceMemberPermissionItem[]>({
    queryKey: queryKeys.workspaceMemberPermissions(memberId || "me"),
    queryFn: () => getWorkspaceMemberPermissions(memberId),
    enabled: Boolean(memberId),
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
    placeholderData: (previousData) => previousData,
  });

  if (!isReady && isAppContextLoading) {
    return {
      isLoading: true,
      canView: false,
      canManage: false,
      errorMessage: "",
    };
  }

  if (!currentRole) {
    return {
      isLoading: false,
      canView: false,
      canManage: false,
      errorMessage:
        errorMessage ||
        (permissionsError instanceof Error
          ? permissionsError.message
          : "Роль пользователя не определена"),
    };
  }

  const canView = canAccessSectionWithCustomPermissions({
    role: currentRole,
    section,
    permissions: memberPermissions,
  });

  const canManage = canManageSectionWithCustomPermissions({
    role: currentRole,
    section,
    permissions: memberPermissions,
  });

  const shouldBlockOnPermissions =
    !isReady &&
    Boolean(memberId) &&
    isPermissionsLoading &&
    memberPermissions.length === 0;

  return {
    isLoading: shouldBlockOnPermissions,
    canView,
    canManage,
    errorMessage:
      errorMessage ||
      (permissionsError instanceof Error ? permissionsError.message : ""),
  };
}