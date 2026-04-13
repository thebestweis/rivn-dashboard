"use client";

import { useEffect, useState } from "react";
import { isAppRole, type AppRole, type AppSection } from "./permissions";
import { useAppContextState } from "../providers/app-context-provider";
import { getWorkspaceMemberPermissions } from "./supabase/workspace-member-permissions";
import {
  canAccessSectionWithCustomPermissions,
  canManageSectionWithCustomPermissions,
} from "./custom-access";

type UseSectionPermissionResult = {
  isLoading: boolean;
  canView: boolean;
  canManage: boolean;
  errorMessage: string;
};

export function useSectionPermission(
  section: AppSection
): UseSectionPermissionResult {
  const { isLoading, role, errorMessage, membership } = useAppContextState();

  const [permissionsLoading, setPermissionsLoading] = useState(true);
  const [permissionsError, setPermissionsError] = useState("");
  const [memberPermissions, setMemberPermissions] = useState<any[]>([]);

  useEffect(() => {
    let isMounted = true;

    async function loadPermissions() {
      if (!membership?.id) {
        if (isMounted) {
          setMemberPermissions([]);
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
      canView: false,
      canManage: false,
      errorMessage: "",
    };
  }

  const currentRole: AppRole | null = isAppRole(role) ? role : null;

  if (!currentRole) {
    return {
      isLoading: false,
      canView: false,
      canManage: false,
      errorMessage:
        errorMessage || permissionsError || "Роль пользователя не определена",
    };
  }

  return {
    isLoading: false,
    canView: canAccessSectionWithCustomPermissions({
      role: currentRole,
      section,
      permissions: memberPermissions,
    }),
    canManage: canManageSectionWithCustomPermissions({
      role: currentRole,
      section,
      permissions: memberPermissions,
    }),
    errorMessage: errorMessage || permissionsError,
  };
}