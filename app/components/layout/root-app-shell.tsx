"use client";

import { usePathname } from "next/navigation";
import { AppSidebar } from "./app-sidebar";
import { AccessDenied } from "../access/access-denied";
import { usePathAccess } from "../../lib/use-page-access";

const appRoutes = [
  "/dashboard",
  "/clients",
  "/projects",
  "/tasks",
  "/payments",
  "/payroll",
  "/expenses",
  "/analytics",
  "/avito-reports",
  "/billing",
  "/settings",
  "/admin",
];

function isInternalAppRoute(pathname: string) {
  return appRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );
}

export function RootAppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const {
    isLoading,
    hasAccess,
    isBillingReadOnly,
    canInteract,
  } = usePathAccess(pathname);

  const isInternalRoute = isInternalAppRoute(pathname);
  const isBillingRoute =
    pathname === "/billing" || pathname.startsWith("/billing/");

  if (!isInternalRoute) {
    return <>{children}</>;
  }

  if (!isLoading && !hasAccess) {
    return (
      <div className="min-h-screen bg-[#0B0F1A] text-white">
        <div className="flex min-h-screen">
          <AppSidebar />

          <div className="min-w-0 flex-1">
            <main className="flex-1 px-5 py-6 lg:px-8">
              <AccessDenied
                title="Нет доступа к разделу"
                description="У тебя нет прав для просмотра этой страницы в текущем кабинете."
              />
            </main>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B0F1A] text-white">
      <div className="flex min-h-screen">
        <AppSidebar />

        <div className="min-w-0 flex-1">
          <div className="relative min-h-screen">
            {isBillingReadOnly && !isBillingRoute ? (
              <div className="sticky top-0 z-20 border-b border-amber-500/20 bg-amber-500/10 px-5 py-3 text-sm text-amber-200 backdrop-blur-sm lg:px-8">
                Активирована пробная подписка в режиме TEAM. Приятного использования!
              </div>
            ) : null}

            <div className="relative">
              {children}

              {!isLoading && !canInteract && !isBillingRoute ? (
                <div className="absolute inset-0 z-10 bg-[#0B0F1A]/35 backdrop-blur-[1px]" />
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
