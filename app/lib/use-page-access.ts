"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getSectionByPathname,
  isAppRole,
  type AppSection,
  type AppRole,
} from "./permissions";
import { useAppContextState } from "../providers/app-context-provider";
import { getWorkspaceMemberPermissions } from "./supabase/workspace-member-permissions";
import { canAccessSectionWithCustomPermissions } from "./custom-access";

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
    isLoading,
    role,
    errorMessage,
    membership,
    isBillingReadOnly,
  } = useAppContextState();

  const [permissionsLoading, setPermissionsLoading] = useState(true);
  const [permissionsError, setPermissionsError] = useState("");
  const [memberPermissions, setMemberPermissions] = useState<any[]>([]);

  useEffect(() => {
    let isMounted = true;

    async function loadPermissions() {
      if (!membership?.id) {
        if (isMounted) {
          setMemberPermissions([]);
          setPermissionsError("");
          setPermissionsLoading(false);
        }
        return;
      }

      try {
        setPermissionsLoading(true);
        setPermissionsError("");

        const data = await getWorkspaceMemberPermissions(membership.id);

        if (isMounted) {
          setMemberPermissions(data);
        }
      } catch (error) {
        if (isMounted) {
          setPermissionsError(
            error instanceof Error
              ? error.message
              : "Не удалось загрузить права доступа"
          );
          setMemberPermissions([]);
        }
      } finally {
        if (isMounted) {
          setPermissionsLoading(false);
        }
      }
    }

    loadPermissions();

    return () => {
      isMounted = false;
    };
  }, [membership?.id]);

  if (isLoading || permissionsLoading) {
    return {
      isLoading: true,
      hasAccess: false,
      errorMessage: "",
      resolvedSection: section,
      isBillingReadOnly,
      canInteract: false,
    };
  }

  const currentRole: AppRole | null = isAppRole(role) ? role : null;

  if (!section) {
    return {
      isLoading: false,
      hasAccess: true,
      errorMessage: errorMessage || permissionsError,
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
        errorMessage || permissionsError || "Роль пользователя не определена",
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

  return {
    isLoading: false,
    hasAccess,
    errorMessage: errorMessage || permissionsError,
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