"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { getStoredTheme, toggleTheme, type AppTheme } from "../../lib/theme";

export function ThemeToggle() {
  const [theme, setTheme] = useState<AppTheme>("dark");

  useEffect(() => {
    setTheme(getStoredTheme());
  }, []);

  const isLight = theme === "light";

  return (
    <button
      type="button"
      onClick={() => setTheme((currentTheme) => toggleTheme(currentTheme))}
      className="flex h-11 w-full items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 dark:border-white/10 dark:bg-white/[0.04] dark:text-white/70 dark:hover:bg-white/[0.07] dark:hover:text-white"
      aria-label={isLight ? "Включить тёмную тему" : "Включить светлую тему"}
    >
      <span className="flex items-center gap-2">
        {isLight ? (
          <Sun className="h-4 w-4" aria-hidden="true" />
        ) : (
          <Moon className="h-4 w-4" aria-hidden="true" />
        )}
        <span>{isLight ? "Светлая тема" : "Тёмная тема"}</span>
      </span>

      <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-white/45">
        {isLight ? "Light" : "Dark"}
      </span>
    </button>
  );
}
