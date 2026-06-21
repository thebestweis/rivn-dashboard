"use client";

import { ReactNode } from "react";
import { type BreadcrumbItem } from "./app-breadcrumbs";

interface AppTopbarProps {
  eyebrow?: string;
  title: string;
  description?: string;
  breadcrumbs?: BreadcrumbItem[];
  showSearch?: boolean;
  showPeriodTabs?: boolean;
  showThemeToggle?: boolean;
  compactMobile?: boolean;
  customActions?: ReactNode;
}

export function AppTopbar({
  eyebrow,
  title,
  description,
  compactMobile = false,
  customActions,
}: AppTopbarProps) {
  return (
    <header className="sticky top-[65px] z-20 max-w-full overflow-x-hidden border-b border-slate-200 bg-white/85 backdrop-blur-xl lg:top-0 dark:border-white/10 dark:bg-[#0B0F1A]/85">
  <div className={`relative overflow-hidden border-b border-slate-200 bg-white px-4 dark:border-white/5 dark:bg-[radial-gradient(circle_at_top,rgba(111,90,255,0.16),transparent_34%),radial-gradient(circle_at_82%_16%,rgba(16,185,129,0.12),transparent_18%),linear-gradient(180deg,rgba(11,15,26,0.98),rgba(9,13,24,0.96))] sm:px-5 lg:px-8 lg:py-6 ${compactMobile ? "py-3" : "py-4"}`}>
        <div className="pointer-events-none absolute inset-0 opacity-[0.04] [background-image:linear-gradient(rgba(255,255,255,0.8)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.8)_1px,transparent_1px)] [background-size:72px_72px]" />

        <div className={`relative flex min-w-0 flex-col xl:flex-row xl:items-start xl:justify-between ${compactMobile ? "gap-3 lg:gap-4" : "gap-4"}`}>
          <div className="min-w-0">
            {eyebrow ? (
              <div className="text-sm text-slate-500 dark:text-white/45">{eyebrow}</div>
            ) : null}

            <h1 className={`${eyebrow ? "mt-2" : ""} ${compactMobile ? "text-[28px] leading-tight sm:text-[30px]" : "text-2xl sm:text-[30px]"} font-bold tracking-[-0.03em] text-slate-950 dark:text-white`}>
  {title}
</h1>

{description ? (
  <p className={`${compactMobile ? "hidden sm:block" : ""} mt-2 max-w-[720px] text-sm leading-6 text-slate-500 dark:text-white/50`}>{description}</p>
) : null}
          </div>

          <div className="min-w-0 max-w-full shrink-0">
            {customActions ? (
              <div className={compactMobile ? "grid max-w-full grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center sm:gap-3" : "flex max-w-full flex-wrap items-center gap-2 sm:gap-3"}>
                {customActions}
              </div>
            ) : (
              <div className="flex max-w-full flex-wrap items-center gap-3">
                <a
  href="https://t.me/weismakeleadgen"
  target="_blank"
  rel="noopener noreferrer"
  className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/80 transition hover:bg-white/[0.06]"
>
  Telegram основателя
</a>

                <a
                  href="https://t.me/thebestweis"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-2xl bg-emerald-400/15 px-4 py-3 text-sm font-medium text-emerald-300 shadow-[0_0_24px_rgba(16,185,129,0.18)] transition hover:bg-emerald-400/20"
                >
                  Техническая поддержка
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
