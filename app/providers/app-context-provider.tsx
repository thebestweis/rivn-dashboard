"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
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
import { createClient } from "../lib/supabase/client";

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

const APP_CONTEXT_CACHE_KEY = "app_context_cache";
const QUERY_CACHE_KEY = "RIVN_OS_QUERY_CACHE";
const APP_CONTEXT_CACHE_TTL_MS = 5 * 60 * 1000;

type AppContextCache = {
  user: any | null;
  profile: any | null;
  workspace: any | null;
  membership: any | null;
  role: AppRole | null;
  isSuperAdmin: boolean;
  workspaces: AccessibleWorkspace[];
  billing: WorkspaceBilling | null;
  billingAccess: BillingAccessState | null;
  timestamp: number;
};

const AppContextStateContext = createContext<AppContextState | null>(null);

function isBootstrapPendingErrorMessage(message: string) {
  return (
    message.includes("Profile not found") ||
    message.includes("Membership not found") ||
    message.includes("Workspace not found") ||
    message.includes("Auth session missing") ||
    message.includes("User not authenticated") ||
    message.includes("Пользователь не авторизован")
  );
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readCachedAppContext(): AppContextCache | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = localStorage.getItem(APP_CONTEXT_CACHE_KEY);

    if (!raw) return null;

    const parsed = JSON.parse(raw) as AppContextCache;

    if (
      !parsed ||
      typeof parsed !== "object" ||
      typeof parsed.timestamp !== "number"
    ) {
      return null;
    }

    const isFresh = Date.now() - parsed.timestamp < APP_CONTEXT_CACHE_TTL_MS;

    if (!isFresh) {
      localStorage.removeItem(APP_CONTEXT_CACHE_KEY);
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function writeCachedAppContext(cache: AppContextCache) {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(APP_CONTEXT_CACHE_KEY, JSON.stringify(cache));
  } catch {}
}

function clearCachedAppContext() {
  if (typeof window === "undefined") return;

  try {
    localStorage.removeItem(APP_CONTEXT_CACHE_KEY);
    localStorage.removeItem(QUERY_CACHE_KEY);
  } catch {}
}

export function AppContextProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const cachedRef = useRef<AppContextCache | null>(readCachedAppContext());

  const [isLoading, setIsLoading] = useState(() => !cachedRef.current);
  const [isReady, setIsReady] = useState(() => Boolean(cachedRef.current));
  const [errorMessage, setErrorMessage] = useState("");

  const [user, setUser] = useState<any | null>(cachedRef.current?.user ?? null);
  const [profile, setProfile] = useState<any | null>(
    cachedRef.current?.profile ?? null
  );
  const [workspace, setWorkspace] = useState<any | null>(
    cachedRef.current?.workspace ?? null
  );
  const [membership, setMembership] = useState<any | null>(
    cachedRef.current?.membership ?? null
  );
  const [role, setRole] = useState<AppRole | null>(
    cachedRef.current?.role ?? null
  );
  const [isSuperAdmin, setIsSuperAdmin] = useState(
    cachedRef.current?.isSuperAdmin ?? false
  );
  const [workspaces, setWorkspaces] = useState<AccessibleWorkspace[]>(
    cachedRef.current?.workspaces ?? []
  );

  const [billing, setBilling] = useState<WorkspaceBilling | null>(
    cachedRef.current?.billing ?? null
  );
  const [billingAccess, setBillingAccess] = useState<BillingAccessState | null>(
    cachedRef.current?.billingAccess ?? null
  );

  const resetStateToEmpty = useCallback(() => {
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
    setErrorMessage("");
    setIsLoading(false);
  }, []);

  const refreshAppContext = useCallback(async () => {
    try {
      setErrorMessage("");

      if (!cachedRef.current) {
        setIsLoading(true);
      }

      let ctx: Awaited<ReturnType<typeof getAppContext>> | null = null;
      let workspaceList: AccessibleWorkspace[] = [];
      let lastError: unknown = null;

      for (let attempt = 0; attempt < 6; attempt += 1) {
        try {
          const result = await Promise.all([
            getAppContext(),
            getAccessibleWorkspaces(),
          ]);

          ctx = result[0];
          workspaceList = result[1];
          lastError = null;
          break;
        } catch (error) {
          lastError = error;

          const message =
            error instanceof Error
              ? error.message
              : "Не удалось загрузить контекст";

          if (!isBootstrapPendingErrorMessage(message) || attempt === 5) {
            throw error;
          }

          await sleep(700);
        }
      }

      if (!ctx) {
        throw lastError instanceof Error
          ? lastError
          : new Error("Не удалось загрузить app context");
      }

      const nextWorkspace = ctx.workspace ?? null;
      const nextMembership = ctx.membership ?? null;
      const nextRole = (ctx.membership?.role ?? "employee") as AppRole;

      let nextBilling: WorkspaceBilling | null = null;
      let nextBillingAccess: BillingAccessState | null = null;

      if (nextWorkspace?.id) {
        nextBilling = await ensureBillingUpToDate(nextWorkspace.id);
        nextBillingAccess = buildBillingAccessState(nextBilling);
      }

      const nextCache: AppContextCache = {
        user: ctx.user ?? null,
        profile: ctx.profile ?? null,
        workspace: nextWorkspace,
        membership: nextMembership,
        role: nextRole,
        isSuperAdmin: ctx.isSuperAdmin ?? false,
        workspaces: workspaceList ?? [],
        billing: nextBilling,
        billingAccess: nextBillingAccess,
        timestamp: Date.now(),
      };

      cachedRef.current = nextCache;
      writeCachedAppContext(nextCache);

      setUser(nextCache.user);
      setProfile(nextCache.profile);
      setWorkspace(nextCache.workspace);
      setMembership(nextCache.membership);
      setRole(nextCache.role);
      setIsSuperAdmin(nextCache.isSuperAdmin);
      setWorkspaces(nextCache.workspaces);
      setBilling(nextCache.billing);
      setBillingAccess(nextCache.billingAccess);
      setIsReady(true);
    } catch (error) {
      if (!cachedRef.current) {
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
      }

      setErrorMessage(
        error instanceof Error ? error.message : "Не удалось загрузить app context"
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshAppContext();
  }, [refreshAppContext]);

  useEffect(() => {
    const supabase = createClient();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      const nextUserId = session?.user?.id ?? null;
      const currentCachedUserId = cachedRef.current?.user?.id ?? null;

      const didUserChange =
        Boolean(nextUserId) &&
        Boolean(currentCachedUserId) &&
        nextUserId !== currentCachedUserId;

      if (didUserChange) {
        cachedRef.current = null;
        clearCachedAppContext();

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
        setErrorMessage("");
      }

      if (
        event === "SIGNED_IN" ||
        event === "TOKEN_REFRESHED" ||
        event === "INITIAL_SESSION"
      ) {
        void refreshAppContext();
      }

      if (event === "SIGNED_OUT") {
        cachedRef.current = null;
        clearCachedAppContext();
        resetStateToEmpty();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [refreshAppContext, resetStateToEmpty]);

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