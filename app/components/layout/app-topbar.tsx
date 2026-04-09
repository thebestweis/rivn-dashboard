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
  customActions?: ReactNode;
}

export function AppTopbar({
  eyebrow,
  title,
  description,
  breadcrumbs,
  customActions,
}: AppTopbarProps) {
  return (
    <header className="sticky top-0 z-20 border-b border-white/10 bg-[#0B0F1A]/85 backdrop-blur-xl">
  <div className="relative overflow-hidden border-b border-white/5 bg-[radial-gradient(circle_at_top,rgba(111,90,255,0.16),transparent_34%),radial-gradient(circle_at_82%_16%,rgba(16,185,129,0.12),transparent_18%),linear-gradient(180deg,rgba(11,15,26,0.98),rgba(9,13,24,0.96))] px-5 py-6 lg:px-8">
        <div className="pointer-events-none absolute inset-0 opacity-[0.04] [background-image:linear-gradient(rgba(255,255,255,0.8)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.8)_1px,transparent_1px)] [background-size:72px_72px]" />

        <div className="relative flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            {eyebrow ? (
              <div className="text-sm text-white/45">{eyebrow}</div>
            ) : null}

            <h1 className={`${eyebrow ? "mt-2" : ""} text-[30px] font-bold tracking-[-0.03em] text-white`}>
  {title}
</h1>

{description ? (
  <p className="mt-2 max-w-[720px] text-sm leading-6 text-white/50">{description}</p>
) : null}
          </div>

          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            {customActions ? (
              <div className="flex items-center gap-3">{customActions}</div>
            ) : (
              <div className="flex items-center gap-3">
                <a
                  href="https://t.me/weismakeleadgen"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/80 transition hover:bg-white/[0.06]"
                >
                  TG основателя
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