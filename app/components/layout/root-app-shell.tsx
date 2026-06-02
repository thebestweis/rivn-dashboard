"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { AppSidebar } from "./app-sidebar";
import { AccessDenied } from "../access/access-denied";
import { usePathAccess } from "../../lib/use-page-access";
import { useAppContextState } from "../../providers/app-context-provider";
import { AppDataPreloader } from "../../providers/app-data-preloader";

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
  "/crm",
  "/billing",
  "/settings",
  "/admin",
  "/admin-leads",
];

function isInternalAppRoute(pathname: string) {
  return appRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );
}

function getDaysLeft(date: string | null | undefined) {
  if (!date) return null;

  const end = new Date(date);
  if (Number.isNaN(end.getTime())) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  return Math.max(0, Math.ceil((end.getTime() - today.getTime()) / 86400000));
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
  } = usePathAccess(pathname);
  const {
    isReady: isAppContextReady,
    errorMessage: appContextErrorMessage,
    refreshAppContext,
    billingAccess,
    workspace,
  } = useAppContextState();
  const [isTrialWelcomeOpen, setIsTrialWelcomeOpen] = useState(false);

  const isInternalRoute = isInternalAppRoute(pathname);
  const isBillingRoute =
    pathname === "/billing" || pathname.startsWith("/billing/");
  const trialDaysLeft = useMemo(
    () => getDaysLeft(billingAccess?.endDate),
    [billingAccess?.endDate]
  );
  const isTrialActive =
    Boolean(billingAccess?.isTrial) &&
    !billingAccess?.isExpired &&
    trialDaysLeft !== null &&
    trialDaysLeft > 0;
  const shouldShowTrialEndingBanner =
    isTrialActive && trialDaysLeft !== null && trialDaysLeft <= 4;

  useEffect(() => {
    if (!isInternalRoute || !isTrialActive || !workspace?.id) return;

    const storageKey = `rivn_trial_welcome_seen_${workspace.id}_${billingAccess?.endDate ?? "trial"}`;

    try {
      if (localStorage.getItem(storageKey) !== "1") {
        setIsTrialWelcomeOpen(true);
      }
    } catch {
      setIsTrialWelcomeOpen(true);
    }
  }, [billingAccess?.endDate, isInternalRoute, isTrialActive, workspace?.id]);

  function closeTrialWelcome() {
    setIsTrialWelcomeOpen(false);

    if (!workspace?.id) return;

    const storageKey = `rivn_trial_welcome_seen_${workspace.id}_${billingAccess?.endDate ?? "trial"}`;

    try {
      localStorage.setItem(storageKey, "1");
    } catch {}
  }

  if (!isInternalRoute) {
    return <>{children}</>;
  }

  if (!isAppContextReady && appContextErrorMessage) {
    return (
      <div className="min-h-screen overflow-x-hidden bg-slate-50 text-slate-950 dark:bg-[#0B0F1A] dark:text-white">
        <div className="flex min-h-screen min-w-0 overflow-x-hidden">
          <AppSidebar />

          <div className="min-w-0 flex-1 overflow-x-hidden pb-24 pt-20 lg:pb-0 lg:pt-0">
            <main className="flex-1 px-5 py-6 lg:px-8">
              <div className="rounded-[24px] border border-white/10 bg-[#121827] p-8 shadow-[0_24px_70px_rgba(0,0,0,0.35)]">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-200/80">
                  Кабинет загружается
                </p>
                <h1 className="mt-3 text-2xl font-semibold text-white">
                  Не удалось сразу загрузить роль и кабинет
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
                  Обычно это временный сбой авторизации в браузере. Нажми
                  кнопку ниже, и RIVN OS повторно подтянет кабинет, роль и
                  доступы.
                </p>
                <button
                  type="button"
                  onClick={() => void refreshAppContext()}
                  className="mt-6 rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-[#06120f] transition hover:bg-emerald-400"
                >
                  Повторить загрузку
                </button>
              </div>
            </main>
          </div>
        </div>
      </div>
    );
  }

  if (!isLoading && !hasAccess) {
    return (
      <div className="min-h-screen overflow-x-hidden bg-slate-50 text-slate-950 dark:bg-[#0B0F1A] dark:text-white">
        <div className="flex min-h-screen min-w-0 overflow-x-hidden">
          <AppSidebar />

          <div className="min-w-0 flex-1 overflow-x-hidden pb-24 pt-20 lg:pb-0 lg:pt-0">
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
    <div className="min-h-screen overflow-x-hidden bg-slate-50 text-slate-950 dark:bg-[#0B0F1A] dark:text-white">
      <AppDataPreloader />
      <div className="flex min-h-screen min-w-0 overflow-x-hidden">
        <AppSidebar />

        <div className="min-w-0 flex-1 overflow-x-hidden pb-24 pt-20 lg:pb-0 lg:pt-0">
          <div className="relative min-h-screen overflow-x-hidden">
            {shouldShowTrialEndingBanner && !isBillingRoute ? (
              <div className="sticky top-0 z-20 border-b border-amber-500/25 bg-amber-500/10 px-5 py-3 text-sm text-amber-100 backdrop-blur-sm lg:px-8">
                Пробная подписка заканчивается через {trialDaysLeft}{" "}
                {trialDaysLeft === 1 ? "день" : "дня"}. Пополни баланс и
                оформи подписку, чтобы продолжить работу без паузы.
              </div>
            ) : null}

            <div className="relative">
              {children}

            </div>
          </div>
        </div>
      </div>

      {isTrialWelcomeOpen ? (
        <button
          type="button"
          onClick={closeTrialWelcome}
          className="fixed inset-0 z-50 flex cursor-default items-center justify-center bg-[#020617]/55 px-4 text-left backdrop-blur-sm"
        >
          <span className="block w-full max-w-xl cursor-default rounded-[28px] border border-emerald-400/20 bg-[#121826] p-6 text-white shadow-[0_30px_90px_rgba(0,0,0,0.45)] sm:p-7">
            <span className="inline-flex rounded-full border border-emerald-400/25 bg-emerald-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200">
              Пробный период активирован
            </span>
            <span className="mt-5 block text-2xl font-semibold tracking-tight sm:text-3xl">
              Добро пожаловать в RIVN OS
            </span>
            <span className="mt-4 block text-sm leading-6 text-white/65">
              Тебе доступен пробный период на {trialDaysLeft ?? "несколько"}{" "}
              {trialDaysLeft === 1 ? "день" : "дня"}. Все основные функции
              работают как на полноценном тарифе: можно создавать клиентов,
              проекты, задачи, платежи и подключать отчёты.
            </span>
            <span className="mt-6 inline-flex rounded-2xl bg-emerald-400 px-5 py-3 text-sm font-semibold text-[#06120f] shadow-[0_18px_45px_rgba(16,185,129,0.28)]">
              Понятно, начать работу
            </span>
          </span>
        </button>
      ) : null}
    </div>
  );
}
