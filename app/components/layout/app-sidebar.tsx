"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { label: "Дашборд", href: "/" },
  { label: "Клиенты", href: "/clients" },
  { label: "Проекты", href: "/projects" },
  { label: "Платежи", href: "/payments" },
  { label: "Зарплаты", href: "/payroll" },
  { label: "Расходы", href: "/expenses" },
  { label: "Аналитика", href: "/analytics" },
  { label: "Настройки", href: "/settings" },
];

function isItemActive(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 hidden h-screen w-72 overflow-y-auto border-r border-slate-200 bg-white p-5 lg:flex lg:flex-col dark:border-white/10 dark:bg-[#0F1524]">
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-400/15 text-emerald-300 shadow-[0_0_30px_rgba(16,185,129,0.18)]">
          <span className="text-lg font-bold">R</span>
        </div>

        <div>
          <div className="text-sm text-slate-500 dark:text-white/50">Agency OS</div>
          <div className="text-lg font-semibold text-slate-900 dark:text-white">
            RIVN Control
          </div>
        </div>
      </div>

      <nav className="space-y-2">
        {navItems.map((item) => {
          const isActive = isItemActive(pathname, item.href);
          const isDisabled = item.href === "#";

          const className = `flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left transition ${
            isActive
              ? "bg-slate-100 text-slate-900 shadow-sm dark:bg-white/8 dark:text-white dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_30px_rgba(123,97,255,0.18)]"
              : isDisabled
                ? "cursor-not-allowed text-slate-300 dark:text-white/30"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-white/65 dark:hover:bg-white/5 dark:hover:text-white"
          }`;

          if (isDisabled) {
            return (
              <div key={item.label} className={className}>
                <span>{item.label}</span>
              </div>
            );
          }

          return (
            <Link key={item.label} href={item.href} className={className}>
              <span>{item.label}</span>
              {isActive ? (
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/[0.03]">
        <div className="text-sm text-slate-500 dark:text-white/60">
          Текущая неделя
        </div>
        <div className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">
          +12.4%
        </div>
        <div className="mt-1 text-sm text-emerald-600 dark:text-emerald-300">
          Рост выручки к прошлой
        </div>
      </div>
    </aside>
  );
}