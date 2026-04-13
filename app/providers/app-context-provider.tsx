"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { getAppContext } from "../lib/supabase/app-context";
import {
  getAccessibleWorkspaces,
  type AccessibleWorkspace,
} from "../lib/supabase/workspaces";
import type { AppRole } from "../lib/permissions";
import {
  ensureBillingUpToDate,
  buildBillingAccessState,
  type BillingAccessState,
} from "../lib/billing-core";
import type { WorkspaceBilling } from "../lib/supabase/billing";

type AppContextState = {
  isLoading: boolean;
  isReady: boolean;
  errorMessage: string;

  user: any | null;
  profile: any | null;
  workspace: any | null;
  membership: any | null;
  role: AppRole | null;
  isSuperAdmin: boolean;

  workspaces: AccessibleWorkspace[];

  billing: WorkspaceBilling | null;
  billingAccess: BillingAccessState | null;
  isBillingReadOnly: boolean;

  refreshAppContext: () => Promise<void>;
};

const AppContextStateContext = createContext<AppContextState | null>(null);

export function AppContextProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isLoading, setIsLoading] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [workspace, setWorkspace] = useState<any | null>(null);
  const [membership, setMembership] = useState<any | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [workspaces, setWorkspaces] = useState<AccessibleWorkspace[]>([]);

  const [billing, setBilling] = useState<WorkspaceBilling | null>(null);
  const [billingAccess, setBillingAccess] = useState<BillingAccessState | null>(
    null
  );

  const refreshAppContext = useCallback(async () => {
    try {
      setIsLoading(true);
      setErrorMessage("");

      const [ctx, workspaceList] = await Promise.all([
        getAppContext(),
        getAccessibleWorkspaces(),
      ]);

      const nextWorkspace = ctx.workspace ?? null;
      const nextMembership = ctx.membership ?? null;
      const nextRole = (ctx.membership?.role ?? "employee") as AppRole;

      let nextBilling: WorkspaceBilling | null = null;
      let nextBillingAccess: BillingAccessState | null = null;

      if (nextWorkspace?.id) {
        nextBilling = await ensureBillingUpToDate(nextWorkspace.id);
        nextBillingAccess = buildBillingAccessState(nextBilling);
      }

      setUser(ctx.user ?? null);
      setProfile(ctx.profile ?? null);
      setWorkspace(nextWorkspace);
      setMembership(nextMembership);
      setRole(nextRole);
      setIsSuperAdmin(ctx.isSuperAdmin ?? false);
      setWorkspaces(workspaceList ?? []);
      setBilling(nextBilling);
      setBillingAccess(nextBillingAccess);
      setIsReady(true);
    } catch (error) {
      setUser(null);
      setProfile(null);
      setWorkspace(null);
      setMembership(null);
      setRole(null);
      setIsSuperAdmin(false);
      setWorkspaces([]);
      setBilling(null);
      setBillingAccess(null);
      setIsReady(false);
      setErrorMessage(
        error instanceof Error ? error.message : "Не удалось загрузить app context"
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshAppContext();
  }, [refreshAppContext]);

  const value = useMemo<AppContextState>(
    () => ({
      isLoading,
      isReady,
      errorMessage,
      user,
      profile,
      workspace,
      membership,
      role,
      isSuperAdmin,
      workspaces,
      billing,
      billingAccess,
      isBillingReadOnly: billingAccess?.isReadOnly ?? false,
      refreshAppContext,
    }),
    [
      isLoading,
      isReady,
      errorMessage,
      user,
      profile,
      workspace,
      membership,
      role,
      isSuperAdmin,
      workspaces,
      billing,
      billingAccess,
      refreshAppContext,
    ]
  );

  return (
    <AppContextStateContext.Provider value={value}>
      {children}
    </AppContextStateContext.Provider>
  );
}

export function useAppContextState() {
  const context = useContext(AppContextStateContext);

  if (!context) {
    throw new Error("useAppContextState must be used inside AppContextProvider");
  }

  return context;
}