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
  ReceiptText,
  Settings,
  UsersRound,
  WalletCards,
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

  useEffect(() => {
    if (!isMounted || permissionsLoading) return;

    for (const item of filteredNavItems.slice(0, 4)) {
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
                        className={`flex w-full items-center rounded-2xl py-3 text-left transition ${
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
                        {isActive && !isCollapsed ? (
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
