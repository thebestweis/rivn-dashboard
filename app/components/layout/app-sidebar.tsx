"use client";

import Link from "next/link";
import { createPortal } from "react-dom";
import type { ComponentType } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart3,
  BookOpen,
  BriefcaseBusiness,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Handshake,
  LayoutDashboard,
  LineChart,
  ListChecks,
  Menu,
  ReceiptText,
  Settings,
  UsersRound,
  WalletCards,
  X,
} from "lucide-react";
import { setActiveWorkspace } from "../../lib/supabase/workspaces";
import {
  isAppRole,
  type AppRole,
  type AppSection,
} from "../../lib/permissions";
import { useAppContextState } from "../../providers/app-context-provider";
import { getWorkspaceMemberPermissions } from "../../lib/supabase/workspace-member-permissions";
import { canAccessSectionWithCustomPermissions } from "../../lib/custom-access";
import { useCrmInboxQuery } from "../../lib/queries/use-crm-query";
import { ThemeToggle } from "../ui/theme-toggle";

const navItems: Array<{
  label: string;
  href: string;
  section: AppSection;
  icon: ComponentType<{ className?: string }>;
}> = [
  { label: "Дашборд", href: "/dashboard", section: "dashboard", icon: LayoutDashboard },
  { label: "Клиенты", href: "/clients", section: "clients", icon: UsersRound },
  { label: "CRM", href: "/crm", section: "crm", icon: Handshake },
  { label: "Проекты", href: "/projects", section: "projects", icon: BriefcaseBusiness },
  { label: "Все задачи", href: "/tasks", section: "tasks", icon: ListChecks },
  { label: "Платежи", href: "/payments", section: "payments", icon: CreditCard },
  { label: "Зарплаты", href: "/payroll", section: "payroll", icon: WalletCards },
  { label: "Расходы", href: "/expenses", section: "expenses", icon: ReceiptText },
  { label: "Аналитика", href: "/analytics", section: "analytics", icon: BarChart3 },
  { label: "Авито отчёты", href: "/avito-reports", section: "analytics", icon: LineChart },
  { label: "Тарифы", href: "/billing", section: "billing", icon: CreditCard },
  { label: "Настройки", href: "/settings", section: "settings", icon: Settings },
];

const PERMISSIONS_CACHE_TTL_MS = 5 * 60 * 1000;
const SIDEBAR_COLLAPSED_KEY = "rivn_sidebar_collapsed";
const mobilePrimaryHrefs = ["/dashboard", "/crm", "/projects", "/tasks", "/analytics"];

type MenuPosition = {
  left: number;
  top: number;
  width: number;
  maxHeight: number;
};

function isItemActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function getRoleLabel(role: string) {
  switch (role) {
    case "owner":
      return "Владелец";
    case "admin":
      return "Админ";
    case "manager":
      return "Менеджер";
    case "analyst":
      return "Аналитик";
    case "employee":
      return "Сотрудник";
    case "sales_head":
      return "РОП";
    case "sales_manager":
      return "Менеджер продаж";
    default:
      return role || "—";
  }
}

function getWorkspaceInitial(name: string) {
  return (name?.trim()?.charAt(0) || "W").toUpperCase();
}

function getPermissionsCacheKey(membershipId: string) {
  return `permissions_${membershipId}`;
}

function readPermissionsCache(membershipId: string) {
  try {
    const raw = localStorage.getItem(getPermissionsCacheKey(membershipId));
    if (!raw) return null;

    const parsed = JSON.parse(raw) as {
      permissions: any[];
      timestamp: number;
    };

    if (!parsed || !Array.isArray(parsed.permissions)) return null;

    if (Date.now() - parsed.timestamp > PERMISSIONS_CACHE_TTL_MS) {
      localStorage.removeItem(getPermissionsCacheKey(membershipId));
      return null;
    }

    return parsed.permissions;
  } catch {
    return null;
  }
}

function writePermissionsCache(membershipId: string, permissions: any[]) {
  try {
    localStorage.setItem(
      getPermissionsCacheKey(membershipId),
      JSON.stringify({ permissions, timestamp: Date.now() })
    );
  } catch {
    // localStorage can be unavailable in restricted browser modes.
  }
}

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const {
    workspace,
    role,
    workspaces,
    isLoading,
    refreshAppContext,
    errorMessage,
    membership,
  } = useAppContextState();

  const [isMounted, setIsMounted] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isSwitchingWorkspace, setIsSwitchingWorkspace] = useState(false);
  const [workspaceError, setWorkspaceError] = useState("");
  const [isWorkspaceMenuOpen, setIsWorkspaceMenuOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);
  const [permissionsLoading, setPermissionsLoading] = useState(true);
  const [memberPermissions, setMemberPermissions] = useState<any[]>([]);

  const workspaceButtonRef = useRef<HTMLButtonElement | null>(null);
  const workspaceMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setIsMounted(true);

    try {
      setIsCollapsed(localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true");
    } catch {
      setIsCollapsed(false);
    }
  }, []);

  useEffect(() => {
    if (!isMounted) return;

    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(isCollapsed));
    } catch {
      // localStorage can be unavailable in restricted browser modes.
    }
  }, [isCollapsed, isMounted]);

  useEffect(() => {
    if (errorMessage) {
      setWorkspaceError(errorMessage);
    }
  }, [errorMessage]);

  useEffect(() => {
    let isCurrent = true;

    async function loadPermissions() {
      const membershipId = membership?.id ?? null;

      if (!membershipId) {
        if (isCurrent) {
          setMemberPermissions([]);
          setPermissionsLoading(false);
        }
        return;
      }

      const cachedPermissions = readPermissionsCache(membershipId);

      if (cachedPermissions && isCurrent) {
        setMemberPermissions(cachedPermissions);
        setPermissionsLoading(false);
      } else if (isCurrent) {
        setPermissionsLoading(true);
      }

      try {
        const data = await getWorkspaceMemberPermissions(membershipId);

        if (isCurrent) {
          setMemberPermissions(data);
          setPermissionsLoading(false);
          writePermissionsCache(membershipId, data);
        }
      } catch {
        if (isCurrent) {
          if (!cachedPermissions) setMemberPermissions([]);
          setPermissionsLoading(false);
        }
      }
    }

    if (isMounted) {
      void loadPermissions();
    }

    return () => {
      isCurrent = false;
    };
  }, [membership?.id, isMounted]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!isWorkspaceMenuOpen) return;

      const target = event.target as Node;

      if (
        workspaceMenuRef.current?.contains(target) ||
        workspaceButtonRef.current?.contains(target)
      ) {
        return;
      }

      setIsWorkspaceMenuOpen(false);
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isWorkspaceMenuOpen]);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!isWorkspaceMenuOpen) return;

    function closeMenu() {
      setIsWorkspaceMenuOpen(false);
    }

    window.addEventListener("resize", closeMenu);
    window.addEventListener("scroll", closeMenu, true);

    return () => {
      window.removeEventListener("resize", closeMenu);
      window.removeEventListener("scroll", closeMenu, true);
    };
  }, [isWorkspaceMenuOpen]);

  const activeWorkspaceId = workspace?.id ?? "";
  const resolvedRole: AppRole | null = isAppRole(role) ? role : null;
  const activeRole: AppRole | null = isMounted ? resolvedRole : null;
  const showResolvedContext =
    isMounted && Boolean(activeRole || workspace) && !isLoading;
  const showResolvedMenu = Boolean(activeRole);

  const filteredNavItems = useMemo(() => {
    if (!activeRole) return [];

    return navItems.filter((item) =>
      canAccessSectionWithCustomPermissions({
        role: activeRole,
        section: item.section,
        permissions: memberPermissions,
      })
    );
  }, [activeRole, memberPermissions]);

  const mobilePrimaryItems = useMemo(() => {
    const primaryItems = mobilePrimaryHrefs
      .map((href) => filteredNavItems.find((item) => item.href === href))
      .filter(Boolean) as typeof filteredNavItems;

    return primaryItems.slice(0, 5);
  }, [filteredNavItems]);
  const canLoadCrmInbox = filteredNavItems.some((item) => item.href === "/crm");
  const { data: sidebarInboxItems = [] } = useCrmInboxQuery(
    showResolvedMenu && canLoadCrmInbox
  );
  const crmUnreadCount = sidebarInboxItems.filter((item) => item.isUnread).length;

  useEffect(() => {
    if (!isMounted || permissionsLoading) return;

    for (const item of filteredNavItems) {
      router.prefetch(item.href);
    }
  }, [filteredNavItems, isMounted, permissionsLoading, router]);

  function openWorkspaceMenu() {
    if (isCollapsed || !workspaceButtonRef.current) return;

    const rect = workspaceButtonRef.current.getBoundingClientRect();
    const gap = 12;
    const viewportPadding = 12;
    const maxHeight = Math.max(
      160,
      Math.min(320, rect.top - gap - viewportPadding)
    );

    setMenuPosition({
      left: rect.left,
      top: rect.top - gap,
      width: rect.width,
      maxHeight,
    });
    setIsWorkspaceMenuOpen(true);
  }

  async function handleWorkspaceSelect(workspaceId: string) {
    if (!workspaceId || workspaceId === activeWorkspaceId) {
      setIsWorkspaceMenuOpen(false);
      return;
    }

    try {
      setIsSwitchingWorkspace(true);
      setWorkspaceError("");

      await setActiveWorkspace(workspaceId);
      await refreshAppContext();

      setIsWorkspaceMenuOpen(false);
      router.refresh();
    } catch (error) {
      setWorkspaceError(
        error instanceof Error
          ? error.message
          : "Не удалось переключить кабинет"
      );
    } finally {
      setIsSwitchingWorkspace(false);
    }
  }

  return (
    <>
      <div className="fixed inset-x-0 top-0 z-[240] border-b border-slate-200 bg-white/92 px-4 py-3 shadow-[0_10px_30px_rgba(15,23,42,0.08)] backdrop-blur-xl lg:hidden dark:border-white/10 dark:bg-[#0B0F1A]/92">
        <div className="flex items-center justify-between gap-3">
          <Link href="/dashboard" className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-400/15 text-emerald-500 shadow-[0_0_24px_rgba(16,185,129,0.18)] dark:text-emerald-300">
              <span className="text-base font-bold">R</span>
            </div>

            <div className="min-w-0">
              <div className="text-xs text-slate-500 dark:text-white/45">
                RIVN OS
              </div>
              <div className="truncate text-sm font-semibold text-slate-950 dark:text-white">
                {showResolvedContext && workspace?.name
                  ? workspace.name
                  : "Кабинет"}
              </div>
            </div>
          </Link>

          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(true)}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-700 transition hover:bg-white dark:border-white/10 dark:bg-white/[0.05] dark:text-white"
            aria-label="Открыть меню"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </div>

      <aside
        className={`sticky top-0 hidden h-screen border-r border-slate-200 bg-white transition-[width] duration-300 ease-out lg:flex lg:flex-col dark:border-white/10 dark:bg-[#0F1524] ${
          isCollapsed ? "w-[88px]" : "w-72"
        }`}
      >
        <div
          className={`flex h-full min-h-0 flex-col py-5 ${
            isCollapsed ? "px-3" : "px-5"
          }`}
        >
          <div
            className={`mb-6 flex items-center ${
              isCollapsed ? "justify-center" : "gap-3"
            }`}
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-400/15 text-emerald-500 shadow-[0_0_30px_rgba(16,185,129,0.18)] dark:text-emerald-300">
              <span className="text-lg font-bold">R</span>
            </div>

            <div className={`min-w-0 flex-1 ${isCollapsed ? "hidden" : ""}`}>
              <div className="text-sm text-slate-500 dark:text-white/50">
                Agency OS
              </div>
              <div className="text-lg font-semibold text-slate-900 dark:text-white">
                RIVN Control
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsCollapsed(true)}
              title="Свернуть меню"
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-500 transition hover:border-violet-200 hover:bg-white hover:text-violet-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-white/60 dark:hover:bg-white/[0.08] dark:hover:text-white ${
                isCollapsed ? "hidden" : ""
              }`}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsCollapsed((value) => !value)}
            title={isCollapsed ? "Развернуть меню" : "Свернуть меню"}
            className={`mb-4 ${isCollapsed ? "flex" : "hidden"} h-9 w-full items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-500 transition hover:border-violet-200 hover:bg-white hover:text-violet-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-white/60 dark:hover:bg-white/[0.08] dark:hover:text-white`}
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <>
                <ChevronLeft className="h-4 w-4" />
                <span>Свернуть</span>
              </>
            )}
          </button>

          <div className="hidden">
            <div
              className={`text-xs uppercase tracking-[0.12em] text-slate-400 dark:text-white/35 ${
                isCollapsed ? "sr-only" : ""
              }`}
            >
              Текущая роль
            </div>
            <div
              className={`text-sm font-medium text-slate-950 dark:text-white ${
                isCollapsed ? "mt-0 text-center" : "mt-2"
              }`}
              title={
                showResolvedContext && activeRole
                  ? getRoleLabel(activeRole)
                  : "Загрузка..."
              }
            >
              {showResolvedContext && activeRole
                ? isCollapsed
                  ? getRoleLabel(activeRole).slice(0, 1)
                  : getRoleLabel(activeRole)
                : isCollapsed
                  ? "…"
                  : "Загрузка..."}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            {!showResolvedMenu ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/45">
                Загрузка меню...
              </div>
            ) : (
              <div className="space-y-5">
                <nav className="space-y-2">
                  {filteredNavItems.map((item) => {
                    const isActive = isItemActive(pathname, item.href);
                    const Icon = item.icon;

                    return (
                      <Link
                        key={item.label}
                        href={item.href}
                        className={`relative flex w-full items-center rounded-2xl py-3 text-left transition ${
                          isCollapsed
                            ? "justify-center px-0"
                            : "justify-between px-4"
                        } ${
                          isActive
                            ? "bg-slate-100 text-slate-900 shadow-sm dark:bg-white/8 dark:text-white dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_30px_rgba(123,97,255,0.18)]"
                            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-white/65 dark:hover:bg-white/5 dark:hover:text-white"
                        }`}
                        title={isCollapsed ? item.label : undefined}
                        onMouseEnter={() => router.prefetch(item.href)}
                      >
                        <span className="flex items-center gap-3">
                          <Icon className="h-4 w-4 shrink-0" />
                          <span className={isCollapsed ? "sr-only" : ""}>
                            {item.label}
                          </span>
                        </span>
                        {item.href === "/crm" && crmUnreadCount > 0 ? (
                          <span
                            className={`flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-500 px-1.5 text-[11px] font-bold text-white ${
                              isCollapsed ? "absolute ml-7 -mt-6" : ""
                            }`}
                          >
                            {crmUnreadCount > 99 ? "99+" : crmUnreadCount}
                          </span>
                        ) : isActive && !isCollapsed ? (
                          <span className="h-2 w-2 rounded-full bg-emerald-400" />
                        ) : null}
                      </Link>
                    );
                  })}
                </nav>

                <div className="border-t border-slate-200 pt-4 dark:border-white/10">
                  <div
                    className={`mb-2 px-2 text-xs uppercase tracking-[0.12em] text-slate-400 dark:text-white/30 ${
                      isCollapsed ? "sr-only" : ""
                    }`}
                  >
                    Помощь
                  </div>

                  <Link
                    href="/guide"
                    className={`flex w-full items-center rounded-2xl py-3 text-left text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-white/65 dark:hover:bg-white/5 dark:hover:text-white ${
                      isCollapsed ? "justify-center px-0" : "justify-between px-4"
                    }`}
                    title={isCollapsed ? "Инструкция" : undefined}
                  >
                    <span className="flex items-center gap-3">
                      <BookOpen className="h-4 w-4 shrink-0" />
                      <span className={isCollapsed ? "sr-only" : ""}>
                        Инструкция по использованию
                      </span>
                    </span>
                  </Link>
                </div>
              </div>
            )}
          </div>

          <div className="mt-4 shrink-0">
            <div className={`mb-3 ${isCollapsed ? "hidden" : ""}`}>
              <ThemeToggle />
            </div>

            <button
              ref={workspaceButtonRef}
              type="button"
              onClick={() => {
                if (!showResolvedContext || isCollapsed) return;
                setIsWorkspaceMenuOpen((value) => !value);
                if (!isWorkspaceMenuOpen) openWorkspaceMenu();
              }}
              disabled={!showResolvedContext || isSwitchingWorkspace}
              title={isCollapsed ? workspace?.name ?? "Кабинет" : undefined}
              className={`flex w-full items-center rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-left transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-white/[0.04] dark:hover:bg-white/[0.06] ${
                isCollapsed ? "justify-center" : "gap-3"
              }`}
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-violet-500/15 text-sm font-semibold text-violet-500 dark:text-violet-300">
                {showResolvedContext && workspace
                  ? getWorkspaceInitial(workspace.name)
                  : "W"}
              </div>

              <div className={`min-w-0 flex-1 ${isCollapsed ? "hidden" : ""}`}>
                <div className="truncate text-sm font-medium text-slate-900 dark:text-white">
                  {showResolvedContext && workspace?.name
                    ? workspace.name
                    : "Выбери кабинет"}
                </div>
                <div className="mt-0.5 truncate text-xs text-slate-500 dark:text-white/45">
                  {!showResolvedContext
                    ? "Загрузка..."
                    : isSwitchingWorkspace
                      ? "Переключаем кабинет..."
                      : workspace && activeRole
                        ? `${getRoleLabel(activeRole)} • ${workspace.slug}`
                        : "Нет данных"}
                </div>
              </div>

              <div
                className={`shrink-0 text-slate-400 dark:text-white/35 ${
                  isCollapsed ? "hidden" : ""
                }`}
              >
                {isWorkspaceMenuOpen ? "−" : "+"}
              </div>
            </button>

            {workspaceError && !isCollapsed ? (
              <div className="mt-3 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
                {workspaceError}
              </div>
            ) : null}
          </div>
        </div>
      </aside>

      <nav className="fixed inset-x-0 bottom-0 z-[240] border-t border-slate-200 bg-white/94 px-2 pb-[max(10px,env(safe-area-inset-bottom))] pt-2 shadow-[0_-12px_34px_rgba(15,23,42,0.1)] backdrop-blur-xl lg:hidden dark:border-white/10 dark:bg-[#0B0F1A]/94">
        <div className="grid grid-cols-5 gap-1">
          {mobilePrimaryItems.map((item) => {
            const isActive = isItemActive(pathname, item.href);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex min-h-[58px] flex-col items-center justify-center gap-1 rounded-2xl px-1 text-[11px] font-medium transition ${
                  isActive
                    ? "bg-emerald-500/12 text-emerald-600 dark:bg-emerald-400/14 dark:text-emerald-300"
                    : "text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-white/55 dark:hover:bg-white/[0.06] dark:hover:text-white"
                }`}
              >
                <span className="relative">
                  <Icon className="h-4 w-4" />
                  {item.href === "/crm" && crmUnreadCount > 0 ? (
                    <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-500 px-1 text-[9px] font-bold text-white">
                      {crmUnreadCount > 9 ? "9+" : crmUnreadCount}
                    </span>
                  ) : null}
                </span>
                <span className="max-w-full truncate">{item.label}</span>
              </Link>
            );
          })}

          {mobilePrimaryItems.length < 5 ? (
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(true)}
              className="flex min-h-[58px] flex-col items-center justify-center gap-1 rounded-2xl px-1 text-[11px] font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-white/55 dark:hover:bg-white/[0.06] dark:hover:text-white"
            >
              <Menu className="h-4 w-4" />
              <span>Меню</span>
            </button>
          ) : null}
        </div>
      </nav>

      {isMobileMenuOpen ? (
        <div className="fixed inset-0 z-[280] lg:hidden">
          <button
            type="button"
            aria-label="Закрыть меню"
            className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm"
            onClick={() => setIsMobileMenuOpen(false)}
          />

          <div className="absolute inset-x-3 bottom-3 max-h-[82vh] overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.24)] dark:border-white/10 dark:bg-[#121826]">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-white/10">
              <div className="min-w-0">
                <div className="text-xs uppercase tracking-[0.14em] text-slate-400 dark:text-white/35">
                  Навигация
                </div>
                <div className="mt-1 truncate text-base font-semibold text-slate-950 dark:text-white">
                  {showResolvedContext && workspace?.name
                    ? workspace.name
                    : "RIVN OS"}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-600 transition hover:bg-white dark:border-white/10 dark:bg-white/[0.05] dark:text-white/70"
                aria-label="Закрыть меню"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-[calc(82vh-76px)] overflow-y-auto p-3">
              <div className="grid gap-2">
                {filteredNavItems.map((item) => {
                  const isActive = isItemActive(pathname, item.href);
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center justify-between rounded-2xl px-4 py-3 transition ${
                        isActive
                          ? "bg-emerald-500/12 text-emerald-700 dark:bg-emerald-400/14 dark:text-emerald-300"
                          : "bg-slate-50 text-slate-700 hover:bg-slate-100 dark:bg-white/[0.04] dark:text-white/70 dark:hover:bg-white/[0.07] dark:hover:text-white"
                      }`}
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        <Icon className="h-4 w-4 shrink-0" />
                        <span className="truncate text-sm font-medium">
                          {item.label}
                        </span>
                      </span>
                      {item.href === "/crm" && crmUnreadCount > 0 ? (
                        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-500 px-1.5 text-[11px] font-bold text-white">
                          {crmUnreadCount > 99 ? "99+" : crmUnreadCount}
                        </span>
                      ) : null}
                    </Link>
                  );
                })}

                <Link
                  href="/guide"
                  className="flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:bg-white/[0.04] dark:text-white/70 dark:hover:bg-white/[0.07] dark:hover:text-white"
                >
                  <BookOpen className="h-4 w-4 shrink-0" />
                  <span>Инструкция по использованию</span>
                </Link>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/[0.04]">
                  <ThemeToggle />
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {isMounted && isWorkspaceMenuOpen && menuPosition && !isCollapsed
        ? createPortal(
            <div
              ref={workspaceMenuRef}
              className="fixed z-[300] overflow-hidden rounded-[24px] border border-white/10 bg-[#121826] shadow-[0_18px_60px_rgba(0,0,0,0.6)]"
              style={{
                left: menuPosition.left,
                top: menuPosition.top,
                width: menuPosition.width,
                maxHeight: menuPosition.maxHeight,
                transform: "translateY(-100%)",
              }}
            >
              <div className="border-b border-white/10 px-4 py-3 text-xs uppercase tracking-[0.12em] text-white/35">
                Кабинеты
              </div>

              <div
                className="overflow-y-auto p-2"
                style={{ maxHeight: menuPosition.maxHeight - 48 }}
              >
                {workspaces.length > 0 ? (
                  workspaces.map((item) => {
                    const isActive = item.id === activeWorkspaceId;

                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => void handleWorkspaceSelect(item.id)}
                        className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition ${
                          isActive
                            ? "bg-white/[0.08] text-white"
                            : "text-white/70 hover:bg-white/[0.05] hover:text-white"
                        }`}
                      >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-violet-500/15 text-sm font-semibold text-violet-300">
                          {getWorkspaceInitial(item.name)}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">
                            {item.name}
                          </div>
                          <div className="mt-0.5 truncate text-xs text-white/45">
                            {getRoleLabel(item.membership_role)} • {item.slug}
                          </div>
                        </div>

                        {isActive ? (
                          <div className="h-2 w-2 rounded-full bg-emerald-400" />
                        ) : null}
                      </button>
                    );
                  })
                ) : (
                  <div className="px-3 py-4 text-sm text-white/45">
                    Нет доступных кабинетов
                  </div>
                )}
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
