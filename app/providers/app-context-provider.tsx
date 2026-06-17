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
import { usePathname, useRouter } from "next/navigation";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import {
  clearAppContextMemoryCache,
  getAppContext,
} from "../lib/supabase/app-context";
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
import { createReferralAttributionForUser } from "../lib/supabase/referrals";
import { withTimeout } from "../lib/supabase/auth-flow";

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
const APP_CONTEXT_FAILURE_COUNT_KEY = "app_context_failure_count";
const APP_CONTEXT_CACHE_TTL_MS = 5 * 60 * 1000;
const AUTH_EXPIRED_PATHS = [
  "/dashboard",
  "/clients",
  "/projects",
  "/tasks",
  "/payments",
  "/payroll",
  "/expenses",
  "/analytics",
  "/avito-reports",
  "/crm",
  "/billing",
  "/settings",
  "/admin",
  "/admin-leads",
];

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
  const normalizedMessage = message.toLowerCase();

  return (
    message.includes("Profile not found") ||
    message.includes("Membership not found") ||
    message.includes("Workspace not found") ||
    message.includes("Auth session missing") ||
    message.includes("User not authenticated") ||
    normalizedMessage.includes("lock broken") ||
    normalizedMessage.includes("navigatorlockacquiretimeouterror") ||
    normalizedMessage.includes("failed to acquire lock") ||
    normalizedMessage.includes("timeout") ||
    message.includes("Пользователь не авторизован")
  );
}

function isAuthExpiredErrorMessage(message: string) {
  const normalizedMessage = message.toLowerCase();

  if (normalizedMessage.includes("timeout")) {
    return false;
  }

  return (
    message.includes("Auth session missing") ||
    message.includes("User not authenticated") ||
    normalizedMessage.includes("jwt") ||
    normalizedMessage.includes("session") ||
    normalizedMessage.includes("refresh token") ||
    message.includes("Пользователь не авторизован")
  );
}

function isProtectedAppPath(pathname: string) {
  return AUTH_EXPIRED_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readCachedAppContext(): AppContextCache | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = sessionStorage.getItem(APP_CONTEXT_CACHE_KEY);

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
      sessionStorage.removeItem(APP_CONTEXT_CACHE_KEY);
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
    localStorage.removeItem(APP_CONTEXT_CACHE_KEY);
    localStorage.removeItem("RIVN_OS_QUERY_CACHE");
    sessionStorage.setItem(APP_CONTEXT_CACHE_KEY, JSON.stringify(cache));
  } catch {}
}

function clearCachedAppContext() {
  if (typeof window === "undefined") return;

  try {
    clearAppContextMemoryCache();
    sessionStorage.removeItem(APP_CONTEXT_CACHE_KEY);
    localStorage.removeItem(APP_CONTEXT_CACHE_KEY);
    localStorage.removeItem("RIVN_OS_QUERY_CACHE");
  } catch {}
}

function resetAppContextFailureCount() {
  if (typeof window === "undefined") return;

  try {
    sessionStorage.removeItem(APP_CONTEXT_FAILURE_COUNT_KEY);
  } catch {}
}

function incrementAppContextFailureCount() {
  if (typeof window === "undefined") return 1;

  try {
    const current = Number(
      sessionStorage.getItem(APP_CONTEXT_FAILURE_COUNT_KEY) ?? "0"
    );
    const next = Number.isFinite(current) ? current + 1 : 1;
    sessionStorage.setItem(APP_CONTEXT_FAILURE_COUNT_KEY, String(next));
    return next;
  } catch {
    return 1;
  }
}

export function AppContextProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const cachedRef = useRef<AppContextCache | null>(readCachedAppContext());
  const refreshPromiseRef = useRef<Promise<void> | null>(null);

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

  const redirectToSessionExpired = useCallback(() => {
    if (typeof window === "undefined") return;
    if (!isProtectedAppPath(pathname)) return;

    const params = new URLSearchParams();
    params.set("next", pathname);
    router.replace(`/session-expired?${params.toString()}`);
  }, [pathname, router]);

  const refreshAppContext = useCallback(async () => {
    if (refreshPromiseRef.current) {
      return refreshPromiseRef.current;
    }

    const refreshPromise = (async () => {
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
          const result = await withTimeout(
            Promise.all([getAppContext(), getAccessibleWorkspaces()]),
            10_000,
            "App context timeout"
          );

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

          await sleep(600 + attempt * 250);
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
        try {
          nextBilling = await withTimeout(
            ensureBillingUpToDate(nextWorkspace.id),
            10_000,
            "Billing context timeout"
          );
          nextBillingAccess = buildBillingAccessState(nextBilling);
        } catch (billingError) {
          console.error("Billing context load failed:", billingError);
          nextBilling = null;
          nextBillingAccess = buildBillingAccessState(null);
        }
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
      resetAppContextFailureCount();

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

      if (nextCache.user?.id) {
        createReferralAttributionForUser(nextCache.user.id).catch((error) => {
          console.error("Ошибка финализации реферальной привязки:", error);
        });
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Не удалось загрузить app context";

      if (isAuthExpiredErrorMessage(message)) {
        resetStateToEmpty();
        redirectToSessionExpired();
        return;
      }

      const failedAttempts = incrementAppContextFailureCount();

      if (failedAttempts >= 3 && isProtectedAppPath(pathname)) {
        cachedRef.current = null;
        clearCachedAppContext();
        resetStateToEmpty();

        try {
          await createClient().auth.signOut();
        } catch {}

        const params = new URLSearchParams();
        params.set("next", pathname);
        router.replace(`/login?${params.toString()}`);
        return;
      }

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
    })();

    refreshPromiseRef.current = refreshPromise.finally(() => {
      refreshPromiseRef.current = null;
    });

    return refreshPromiseRef.current;
  }, [pathname, redirectToSessionExpired, resetStateToEmpty, router]);

  useEffect(() => {
    void refreshAppContext();
  }, [refreshAppContext]);

  useEffect(() => {
    const supabase = createClient();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (event: AuthChangeEvent, session: Session | null) => {
        const nextUserId = session?.user?.id ?? null;
        const currentCachedUserId = cachedRef.current?.user?.id ?? null;

        const didUserChange =
          Boolean(nextUserId) &&
          Boolean(currentCachedUserId) &&
          nextUserId !== currentCachedUserId;

        if (didUserChange) {
          clearAppContextMemoryCache();
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
          if (event === "SIGNED_IN") {
            clearAppContextMemoryCache();
          }

          void refreshAppContext();
        }

        if (event === "SIGNED_OUT") {
          clearAppContextMemoryCache();
          resetStateToEmpty();
          redirectToSessionExpired();
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [refreshAppContext, redirectToSessionExpired, resetStateToEmpty]);

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
