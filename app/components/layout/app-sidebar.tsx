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
import {
  getWorkspaceMemberPermissions,
  type WorkspaceMemberPermissionItem,
} from "../../lib/supabase/workspace-member-permissions";
import { canAccessSectionWithCustomPermissions } from "../../lib/custom-access";
import { useCrmInboxQuery } from "../../lib/queries/use-crm-query";
import { NotificationCenter } from "../notifications/notification-center";
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
      permissions: WorkspaceMemberPermissionItem[];
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

function writePermissionsCache(
  membershipId: string,
  permissions: WorkspaceMemberPermissionItem[]
) {
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
  const [memberPermissions, setMemberPermissions] = useState<
    WorkspaceMemberPermissionItem[]
  >([]);

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

    function closeMenuOnResize() {
      setIsWorkspaceMenuOpen(false);
    }

    window.addEventListener("resize", closeMenuOnResize);

    return () => {
      window.removeEventListener("resize", closeMenuOnResize);
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
  const workspaceDisplayName =
    typeof workspace?.name === "string" ? workspace.name.trim() : "";
  const sidebarBrandLabel =
    showResolvedContext && workspaceDisplayName ? "RIVN OS" : "Agency OS";
  const sidebarCompanyLabel = workspaceDisplayName || "RIVN";
  const visibleSidebarCompanyLabel = showResolvedContext
    ? sidebarCompanyLabel
    : "RIVN";

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
      <div className="rivn-themed-sidebar fixed inset-x-0 top-0 z-[240] border-b border-white/[0.08] bg-[#07111f]/88 px-4 py-3 shadow-[0_22px_70px_rgba(0,0,0,0.34)] backdrop-blur-2xl lg:hidden">
        <div className="flex items-center justify-between gap-3">
          <Link href="/dashboard" className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[#00f5a8]/25 bg-[radial-gradient(circle_at_30%_25%,#7dffd6,#00f5a8_48%,#047857)] text-[#06101d] shadow-[0_0_30px_rgba(0,245,168,0.22),inset_0_1px_0_rgba(255,255,255,0.45)]">
              <span className="text-base font-bold">R</span>
            </div>

            <div className="min-w-0">
              <div className="text-xs text-white/42" suppressHydrationWarning>
                {sidebarBrandLabel}
              </div>
              <div
                className="truncate text-sm font-semibold text-white"
                suppressHydrationWarning
              >
                {visibleSidebarCompanyLabel}
              </div>
            </div>
          </Link>

          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(true)}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/12 bg-white/[0.065] text-white/82 shadow-[inset_0_1px_0_rgba(255,255,255,0.10)] transition duration-300 ease-out hover:-translate-y-0.5 hover:border-[#00f5a8]/35 hover:bg-white/[0.11] hover:text-white active:translate-y-0 active:scale-[0.97]"
            aria-label="Открыть меню"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div
        aria-hidden="true"
        className={`hidden shrink-0 transition-[width] duration-300 ease-out lg:block ${
          isCollapsed ? "w-[88px]" : "w-72"
        }`}
      />

      <aside
        className={`rivn-themed-sidebar fixed inset-y-0 left-0 z-[220] hidden h-screen border-r border-white/[0.075] bg-[linear-gradient(180deg,#06101d_0%,#091423_46%,#0d1727_100%)] text-white shadow-[22px_0_80px_rgba(0,0,0,0.34)] transition-[width] duration-300 ease-out lg:flex lg:flex-col ${
          isCollapsed ? "w-[88px]" : "w-72"
        }`}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_32%_-4%,rgba(0,245,168,0.13),transparent_34%),radial-gradient(circle_at_92%_16%,rgba(124,92,255,0.14),transparent_33%),linear-gradient(90deg,rgba(255,255,255,0.035),transparent_24%,transparent_76%,rgba(255,255,255,0.025))]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.028)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.022)_1px,transparent_1px)] bg-[size:92px_92px] opacity-25"
        />
        <div
          className={`relative z-10 flex h-full min-h-0 flex-col py-5 ${
            isCollapsed ? "px-3" : "px-5"
          }`}
        >
          <div
            className={`mb-6 flex min-w-0 items-center ${
              isCollapsed ? "justify-center" : "gap-3"
            }`}
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#00f5a8]/25 bg-[radial-gradient(circle_at_30%_25%,#7dffd6,#00f5a8_48%,#047857)] text-[#06101d] shadow-[0_0_34px_rgba(0,245,168,0.24),inset_0_1px_0_rgba(255,255,255,0.45)] transition duration-500 ease-out hover:scale-[1.03]">
              <span className="text-lg font-bold">R</span>
            </div>

            <div className={`min-w-0 flex-1 ${isCollapsed ? "hidden" : ""}`}>
              <div
                className="truncate text-sm text-white/42"
                suppressHydrationWarning
              >
                {sidebarBrandLabel}
              </div>
              <div
                className="truncate text-lg font-semibold text-white"
                title={isMounted ? visibleSidebarCompanyLabel : undefined}
                suppressHydrationWarning
              >
                {visibleSidebarCompanyLabel}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsCollapsed(true)}
              title="Свернуть меню"
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.055] text-white/58 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition duration-300 ease-out hover:-translate-y-0.5 hover:border-[#00f5a8]/35 hover:bg-white/[0.10] hover:text-white active:translate-y-0 active:scale-[0.96] ${
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
            className={`mb-4 ${isCollapsed ? "flex" : "hidden"} h-9 w-full items-center justify-center rounded-xl border border-white/10 bg-white/[0.055] text-white/58 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition duration-300 ease-out hover:-translate-y-0.5 hover:border-[#00f5a8]/35 hover:bg-white/[0.10] hover:text-white active:translate-y-0 active:scale-[0.96]`}
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
              className={`text-xs uppercase tracking-[0.12em] text-white/35 ${
                isCollapsed ? "sr-only" : ""
              }`}
            >
              Текущая роль
            </div>
            <div
              className={`text-sm font-medium text-white ${
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

          <div className="min-h-0 flex-1 overflow-y-auto pr-1 [scrollbar-color:rgba(0,245,168,0.28)_transparent]">
            {!showResolvedMenu ? (
              <div className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm text-white/45">
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
                        className={`group relative flex w-full items-center overflow-hidden rounded-2xl py-3 text-left transition duration-300 ease-out active:scale-[0.985] ${
                          isCollapsed
                            ? "justify-center px-0"
                            : "justify-between px-4"
                        } ${
                          isActive
                            ? "border border-white/[0.12] bg-[linear-gradient(135deg,rgba(255,255,255,0.13),rgba(0,245,168,0.10)_46%,rgba(124,92,255,0.055))] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_18px_42px_rgba(0,245,168,0.105)]"
                            : "border border-transparent text-white/58 hover:-translate-y-0.5 hover:border-white/[0.085] hover:bg-white/[0.055] hover:text-white hover:shadow-[0_14px_34px_rgba(0,0,0,0.16)]"
                        }`}
                        title={isCollapsed ? item.label : undefined}
                        onMouseEnter={() => router.prefetch(item.href)}
                      >
                        <span className="pointer-events-none absolute inset-y-1 left-1 w-10 rounded-2xl bg-[#00f5a8]/0 blur-xl transition duration-500 group-hover:bg-[#00f5a8]/10" />
                        <span className="pointer-events-none absolute inset-x-3 top-0 h-px bg-gradient-to-r from-transparent via-white/0 to-transparent transition duration-500 group-hover:via-white/18" />
                        <span className="relative flex items-center gap-3">
                          <Icon
                            className={`h-4 w-4 shrink-0 transition duration-300 ease-out group-hover:scale-110 ${
                              isActive
                                ? "text-[#00f5a8]"
                                : "text-white/48 group-hover:text-[#43ffc2]"
                            }`}
                          />
                          <span className={isCollapsed ? "sr-only" : ""}>
                            {item.label}
                          </span>
                        </span>
                        {item.href === "/crm" && crmUnreadCount > 0 ? (
                          <span
                            className={`flex h-5 min-w-5 items-center justify-center rounded-full bg-[#00f5a8] px-1.5 text-[11px] font-bold text-[#06101d] shadow-[0_8px_20px_rgba(0,245,168,0.28)] ${
                              isCollapsed ? "absolute ml-7 -mt-6" : ""
                            }`}
                          >
                            {crmUnreadCount > 99 ? "99+" : crmUnreadCount}
                          </span>
                        ) : isActive && !isCollapsed ? (
                          <span className="h-2 w-2 rounded-full bg-[#00f5a8] shadow-[0_0_16px_rgba(0,245,168,0.55)]" />
                        ) : null}
                      </Link>
                    );
                  })}
                </nav>

                <div className="border-t border-white/10 pt-4">
                  <div
                    className={`mb-2 px-2 text-xs uppercase tracking-[0.14em] text-white/30 ${
                      isCollapsed ? "sr-only" : ""
                    }`}
                  >
                    Помощь
                  </div>

                  <Link
                    href="/guide"
                    className={`group flex w-full items-center rounded-2xl border border-transparent py-3 text-left text-white/58 transition duration-300 ease-out hover:-translate-y-0.5 hover:border-white/[0.085] hover:bg-white/[0.055] hover:text-white active:translate-y-0 active:scale-[0.985] ${
                      isCollapsed ? "justify-center px-0" : "justify-between px-4"
                    }`}
                    title={isCollapsed ? "Инструкция" : undefined}
                  >
                    <span className="flex items-center gap-3">
                      <BookOpen className="h-4 w-4 shrink-0 text-white/48 transition group-hover:text-[#43ffc2]" />
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
            <div className="mb-3">
              <NotificationCenter
                variant="sidebar"
                isSidebarCollapsed={isCollapsed}
              />
            </div>

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
              className={`group relative flex w-full items-center overflow-hidden rounded-[22px] border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.09),rgba(124,92,255,0.075)_48%,rgba(0,245,168,0.075))] px-3 py-3 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_18px_45px_rgba(0,0,0,0.18)] transition duration-300 ease-out hover:-translate-y-0.5 hover:border-[#00f5a8]/25 hover:bg-white/[0.08] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_20px_55px_rgba(0,245,168,0.08)] active:translate-y-0 active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-60 ${
                isCollapsed ? "justify-center" : "gap-3"
              }`}
            >
              <span className="pointer-events-none absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-white/18 to-transparent opacity-0 transition duration-500 group-hover:opacity-100" />
              <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#7c5cff]/18 text-sm font-semibold text-[#c4b5fd] shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] transition duration-300 group-hover:scale-[1.03]">
                {showResolvedContext && workspace
                  ? getWorkspaceInitial(workspace.name ?? "RIVN")
                  : "W"}
              </div>

              <div className={`relative min-w-0 flex-1 ${isCollapsed ? "hidden" : ""}`}>
                <div className="truncate text-sm font-medium text-white">
                  {showResolvedContext && workspace?.name
                    ? workspace.name
                    : "Выбери кабинет"}
                </div>
                <div className="mt-0.5 truncate text-xs text-white/42">
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
                className={`shrink-0 text-white/35 ${
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

      <nav className="rivn-themed-sidebar fixed inset-x-0 bottom-0 z-[240] border-t border-white/[0.08] bg-[#07111f]/90 px-2 pb-[max(10px,env(safe-area-inset-bottom))] pt-2 shadow-[0_-22px_70px_rgba(0,0,0,0.36)] backdrop-blur-2xl lg:hidden">
        <div className="grid grid-cols-5 gap-1">
          {mobilePrimaryItems.map((item) => {
            const isActive = isItemActive(pathname, item.href);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex min-h-[58px] flex-col items-center justify-center gap-1 rounded-2xl px-1 text-[11px] font-medium transition duration-300 ease-out active:scale-[0.96] ${
                  isActive
                    ? "bg-[#00f5a8]/14 text-[#43ffc2] shadow-[inset_0_1px_0_rgba(255,255,255,0.10),0_10px_26px_rgba(0,245,168,0.10)]"
                    : "text-white/50 hover:-translate-y-0.5 hover:bg-white/[0.06] hover:text-white"
                }`}
              >
                <span className="relative">
                  <Icon className="h-4 w-4" />
                  {item.href === "/crm" && crmUnreadCount > 0 ? (
                    <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#00f5a8] px-1 text-[9px] font-bold text-[#06101d]">
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
              className="flex min-h-[58px] flex-col items-center justify-center gap-1 rounded-2xl px-1 text-[11px] font-medium text-white/50 transition duration-300 ease-out hover:-translate-y-0.5 hover:bg-white/[0.06] hover:text-white active:translate-y-0 active:scale-[0.96]"
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
            className="absolute inset-0 bg-[#020817]/70 backdrop-blur-sm"
            onClick={() => setIsMobileMenuOpen(false)}
          />

          <div className="rivn-themed-surface absolute inset-x-3 bottom-3 max-h-[82vh] overflow-hidden rounded-[30px] border border-white/12 bg-[#08111f]/94 text-white shadow-[0_30px_100px_rgba(0,0,0,0.52)] backdrop-blur-2xl">
            <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
              <div className="min-w-0">
                <div className="text-xs uppercase tracking-[0.14em] text-white/35">
                  Навигация
                </div>
                <div className="mt-1 truncate text-base font-semibold text-white">
                  {showResolvedContext && workspace?.name
                    ? workspace.name
                    : "RIVN OS"}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.055] text-white/70 transition duration-300 ease-out hover:-translate-y-0.5 hover:bg-white/[0.10] hover:text-white active:translate-y-0 active:scale-[0.96]"
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
                      className={`flex items-center justify-between rounded-2xl px-4 py-3 transition duration-300 ease-out active:scale-[0.985] ${
                        isActive
                          ? "bg-[#00f5a8]/14 text-[#43ffc2] shadow-[inset_0_1px_0_rgba(255,255,255,0.10)]"
                          : "bg-white/[0.04] text-white/66 hover:-translate-y-0.5 hover:bg-white/[0.07] hover:text-white"
                      }`}
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        <Icon className="h-4 w-4 shrink-0" />
                        <span className="truncate text-sm font-medium">
                          {item.label}
                        </span>
                      </span>
                      {item.href === "/crm" && crmUnreadCount > 0 ? (
                        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#00f5a8] px-1.5 text-[11px] font-bold text-[#06101d]">
                          {crmUnreadCount > 99 ? "99+" : crmUnreadCount}
                        </span>
                      ) : null}
                    </Link>
                  );
                })}

                <Link
                  href="/guide"
                  className="flex items-center gap-3 rounded-2xl bg-white/[0.04] px-4 py-3 text-sm font-medium text-white/66 transition duration-300 ease-out hover:-translate-y-0.5 hover:bg-white/[0.07] hover:text-white active:translate-y-0 active:scale-[0.985]"
                >
                  <BookOpen className="h-4 w-4 shrink-0" />
                  <span>Инструкция по использованию</span>
                </Link>

                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
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
              className="rivn-themed-surface fixed z-[300] overflow-hidden rounded-[24px] border border-white/10 bg-[#08111f]/94 shadow-[0_26px_90px_rgba(0,0,0,0.58)] backdrop-blur-2xl"
              style={{
                left: menuPosition.left,
                top: menuPosition.top,
                width: menuPosition.width,
                maxHeight: menuPosition.maxHeight,
                transform: "translateY(-100%)",
              }}
              onWheel={(event) => event.stopPropagation()}
              onTouchMove={(event) => event.stopPropagation()}
            >
              <div className="border-b border-white/10 px-4 py-3 text-xs uppercase tracking-[0.12em] text-white/35">
                Кабинеты
              </div>

              <div
                className="overscroll-contain overflow-y-auto p-2 [scrollbar-color:rgba(0,245,168,0.28)_transparent]"
                style={{ maxHeight: menuPosition.maxHeight - 48 }}
                onWheel={(event) => event.stopPropagation()}
                onTouchMove={(event) => event.stopPropagation()}
              >
                {workspaces.length > 0 ? (
                  workspaces.map((item) => {
                    const isActive = item.id === activeWorkspaceId;

                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => void handleWorkspaceSelect(item.id)}
                        className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition duration-300 ease-out active:scale-[0.985] ${
                          isActive
                            ? "bg-[linear-gradient(135deg,rgba(255,255,255,0.11),rgba(0,245,168,0.10))] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.10)]"
                            : "text-white/66 hover:-translate-y-0.5 hover:bg-white/[0.055] hover:text-white"
                        }`}
                      >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#7c5cff]/18 text-sm font-semibold text-[#c4b5fd] shadow-[inset_0_1px_0_rgba(255,255,255,0.10)]">
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
                          <div className="h-2 w-2 rounded-full bg-[#00f5a8] shadow-[0_0_16px_rgba(0,245,168,0.55)]" />
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
