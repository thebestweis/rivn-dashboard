"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getSectionByPathname,
  isAppRole,
  type AppSection,
  type AppRole,
} from "./permissions";
import { useAppContextState } from "../providers/app-context-provider";
import {
  getWorkspaceMemberPermissions,
  type WorkspaceMemberPermissionItem,
} from "./supabase/workspace-member-permissions";
import { canAccessSectionWithCustomPermissions } from "./custom-access";
import { queryKeys } from "./query-keys";

type UsePageAccessResult = {
  isLoading: boolean;
  hasAccess: boolean;
  errorMessage: string;
  resolvedSection: AppSection | null;
  isBillingReadOnly: boolean;
  canInteract: boolean;
};

function useResolvedPageAccess(
  section: AppSection | null
): UsePageAccessResult {
  const {
    isLoading: isAppContextLoading,
    isReady,
    role,
    errorMessage,
    membership,
    isBillingReadOnly,
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
      hasAccess: false,
      errorMessage: "",
      resolvedSection: section,
      isBillingReadOnly,
      canInteract: false,
    };
  }

  if (!section) {
    return {
      isLoading: false,
      hasAccess: true,
      errorMessage:
        errorMessage ||
        (permissionsError instanceof Error ? permissionsError.message : ""),
      resolvedSection: null,
      isBillingReadOnly,
      canInteract: !isBillingReadOnly,
    };
  }

  if (!currentRole) {
    return {
      isLoading: false,
      hasAccess: false,
      errorMessage:
        errorMessage ||
        (permissionsError instanceof Error
          ? permissionsError.message
          : "Роль пользователя не определена"),
      resolvedSection: section,
      isBillingReadOnly,
      canInteract: false,
    };
  }

  const hasAccess = canAccessSectionWithCustomPermissions({
    role: currentRole,
    section,
    permissions: memberPermissions,
  });

  const canInteract = hasAccess && (!isBillingReadOnly || section === "billing");

  const shouldBlockOnPermissions =
    !isReady &&
    Boolean(memberId) &&
    isPermissionsLoading &&
    memberPermissions.length === 0;

  return {
    isLoading: shouldBlockOnPermissions,
    hasAccess,
    errorMessage:
      errorMessage ||
      (permissionsError instanceof Error ? permissionsError.message : ""),
    resolvedSection: section,
    isBillingReadOnly,
    canInteract,
  };
}

export function usePageAccess(section: AppSection): UsePageAccessResult {
  return useResolvedPageAccess(section);
}

export function usePathAccess(pathname: string): UsePageAccessResult {
  const resolvedSection = useMemo(
    () => getSectionByPathname(pathname),
    [pathname]
  );

  return useResolvedPageAccess(resolvedSection);
}