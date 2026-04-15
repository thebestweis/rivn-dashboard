"use client";

import Link from "next/link";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { setActiveWorkspace } from "../../lib/supabase/workspaces";
import {
  isAppRole,
  type AppRole,
  type AppSection,
} from "../../lib/permissions";
import { useAppContextState } from "../../providers/app-context-provider";
import { getWorkspaceMemberPermissions } from "../../lib/supabase/workspace-member-permissions";
import { canAccessSectionWithCustomPermissions } from "../../lib/custom-access";

const navItems: Array<{ label: string; href: string; section: AppSection }> = [
  { label: "Дашборд", href: "/dashboard", section: "dashboard" },
  { label: "Клиенты", href: "/clients", section: "clients" },
  { label: "Проекты", href: "/projects", section: "projects" },
  { label: "Все задачи", href: "/tasks", section: "tasks" },
  { label: "Платежи", href: "/payments", section: "payments" },
  { label: "Зарплаты", href: "/payroll", section: "payroll" },
  { label: "Расходы", href: "/expenses", section: "expenses" },
  { label: "Аналитика", href: "/analytics", section: "analytics" },
  { label: "Тарифы", href: "/billing", section: "billing" },
  { label: "Настройки", href: "/settings", section: "settings" },
];

const PERMISSIONS_CACHE_TTL_MS = 5 * 60 * 1000;

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

    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as {
      permissions: any[];
      timestamp: number;
    };

    if (
      !parsed ||
      typeof parsed !== "object" ||
      !Array.isArray(parsed.permissions) ||
      typeof parsed.timestamp !== "number"
    ) {
      return null;
    }

    const isFresh = Date.now() - parsed.timestamp < PERMISSIONS_CACHE_TTL_MS;

    if (!isFresh) {
      localStorage.removeItem(getPermissionsCacheKey(membershipId));
      return null;
    }

    return parsed.permissions;
  } catch (error) {
    console.error("Ошибка чтения кеша permissions:", error);
    return null;
  }
}

function writePermissionsCache(membershipId: string, permissions: any[]) {
  try {
    localStorage.setItem(
      getPermissionsCacheKey(membershipId),
      JSON.stringify({
        permissions,
        timestamp: Date.now(),
      })
    );
  } catch (error) {
    console.error("Ошибка сохранения кеша permissions:", error);
  }
}

type MenuPosition = {
  left: number;
  top: number;
  width: number;
  maxHeight: number;
};

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

  const [isSwitchingWorkspace, setIsSwitchingWorkspace] = useState(false);
  const [workspaceError, setWorkspaceError] = useState("");
  const [isWorkspaceMenuOpen, setIsWorkspaceMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  const [permissionsLoading, setPermissionsLoading] = useState(true);
  const [memberPermissions, setMemberPermissions] = useState<any[]>([]);

  const workspaceButtonRef = useRef<HTMLButtonElement | null>(null);
  const workspaceMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

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
      } catch (error) {
        console.error("Ошибка загрузки кастомных прав sidebar:", error);

        if (isCurrent) {
          if (!cachedPermissions) {
            setMemberPermissions([]);
          }
          setPermissionsLoading(false);
        }
      }
    }

    if (!isMounted) {
      return;
    }

    loadPermissions();

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
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
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

  const activeWorkspaceId = isMounted ? workspace?.id ?? "" : "";
  const activeRole: AppRole | null =
    isMounted && isAppRole(role) ? role : null;

  function prefetchRoute(href: string) {
    router.prefetch(href);
  }

  const filteredNavItems = useMemo(() => {
    if (!isMounted || !activeRole) return [];

    return navItems.filter((item) =>
      canAccessSectionWithCustomPermissions({
        role: activeRole,
        section: item.section,
        permissions: memberPermissions,
      })
    );
  }, [isMounted, activeRole, memberPermissions]);

  useEffect(() => {
    if (!isMounted) return;
    if (permissionsLoading) return;
    if (filteredNavItems.length === 0) return;

    const firstItems = filteredNavItems.slice(0, 4);

    for (const item of firstItems) {
      prefetchRoute(item.href);
    }
  }, [isMounted, permissionsLoading, filteredNavItems]);

  function openWorkspaceMenu() {
    if (!workspaceButtonRef.current) return;

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

  const showResolvedContext = isMounted && !isLoading;
  const showResolvedMenu = isMounted && !permissionsLoading;

  return (
    <>
      <aside className="sticky top-0 hidden h-screen w-72 border-r border-slate-200 bg-white lg:flex lg:flex-col dark:border-white/10 dark:bg-[#0F1524]">
        <div className="flex h-full min-h-0 flex-col px-5 py-5">
          <div className="mb-8 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-400/15 text-emerald-300 shadow-[0_0_30px_rgba(16,185,129,0.18)]">
              <span className="text-lg font-bold">R</span>
            </div>

            <div>
              <div className="text-sm text-slate-500 dark:text-white/50">
                Agency OS
              </div>
              <div className="text-lg font-semibold text-slate-900 dark:text-white">
                RIVN Control
              </div>
            </div>
          </div>

          <div className="mb-4 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-3">
            <div className="text-xs uppercase tracking-[0.12em] text-white/35">
              Текущая роль
            </div>
            <div className="mt-2 text-sm font-medium text-white">
              {showResolvedContext && activeRole
                ? getRoleLabel(activeRole)
                : "Загрузка..."}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            {!showResolvedMenu ? (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/45">
                Загружаем меню...
              </div>
            ) : (
              <nav className="space-y-2">
                {filteredNavItems.map((item) => {
                  const isActive = isItemActive(pathname, item.href);

                  const className = `flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left transition ${
                    isActive
                      ? "bg-slate-100 text-slate-900 shadow-sm dark:bg-white/8 dark:text-white dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_30px_rgba(123,97,255,0.18)]"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-white/65 dark:hover:bg-white/5 dark:hover:text-white"
                  }`;

                  return (
                    <Link
                      key={item.label}
                      href={item.href}
                      className={className}
                      onMouseEnter={() => prefetchRoute(item.href)}
                    >
                      <span>{item.label}</span>
                      {isActive ? (
                        <span className="h-2 w-2 rounded-full bg-emerald-400" />
                      ) : null}
                    </Link>
                  );
                })}
              </nav>
            )}
          </div>

          <div className="mt-4 shrink-0">
            <button
              ref={workspaceButtonRef}
              type="button"
              onClick={() => {
                if (!showResolvedContext) return;

                if (isWorkspaceMenuOpen) {
                  setIsWorkspaceMenuOpen(false);
                } else {
                  openWorkspaceMenu();
                }
              }}
              disabled={!showResolvedContext || isSwitchingWorkspace}
              className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-3 text-left transition hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-violet-500/15 text-sm font-semibold text-violet-300">
                {showResolvedContext && workspace
                  ? getWorkspaceInitial(workspace.name)
                  : "W"}
              </div>

              <div className="min-w-0 flex-1">
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

              <div className="shrink-0 text-slate-400 dark:text-white/35">
                {isWorkspaceMenuOpen ? "−" : "+"}
              </div>
            </button>

            {workspaceError ? (
              <div className="mt-3 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
                {workspaceError}
              </div>
            ) : null}
          </div>
        </div>
      </aside>

      {isMounted && isWorkspaceMenuOpen && menuPosition
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
                        onClick={() => handleWorkspaceSelect(item.id)}
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