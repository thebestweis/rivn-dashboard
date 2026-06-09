"use client";

import {
  Check,
  ChevronDown,
  Gem,
  Monitor,
  Moon,
  Palette,
  Sparkles,
  Sun,
} from "lucide-react";
import { useState } from "react";
import { getStoredTheme, setTheme, type AppTheme } from "../../lib/theme";

const themeOptions: Array<{
  value: AppTheme;
  label: string;
  shortLabel: string;
  description: string;
  icon: typeof Sparkles;
}> = [
  {
    value: "classic",
    label: "Классика",
    shortLabel: "C",
    description: "Текущий RIVN Style: неон, стекло и живой контраст.",
    icon: Sparkles,
  },
  {
    value: "black",
    label: "Black",
    shortLabel: "B",
    description: "Глубокий премиум в черных и золотистых оттенках.",
    icon: Gem,
  },
  {
    value: "white",
    label: "White",
    shortLabel: "W",
    description: "Светлый футуристичный минимализм.",
    icon: Sun,
  },
  {
    value: "legacy-dark",
    label: "Prod Dark",
    shortLabel: "PD",
    description: "Темный интерфейс как в текущем продакшне.",
    icon: Moon,
  },
  {
    value: "legacy-light",
    label: "Prod Light",
    shortLabel: "PL",
    description: "Светлый интерфейс как в текущем продакшне.",
    icon: Monitor,
  },
];

export function ThemeToggle() {
  const [currentTheme, setCurrentTheme] = useState<AppTheme>(getStoredTheme);
  const [isOpen, setIsOpen] = useState(false);

  function handleSelect(theme: AppTheme) {
    setCurrentTheme(setTheme(theme));
    setIsOpen(false);
  }

  const activeOption =
    themeOptions.find((option) => option.value === currentTheme) ?? themeOptions[0];
  const ActiveIcon = activeOption.icon;

  return (
    <div className="rivn-themed-surface relative overflow-hidden rounded-[22px] border border-white/10 bg-white/[0.045] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition duration-300">
      <button
        type="button"
        onClick={() => setIsOpen((value) => !value)}
        className="group flex w-full items-center justify-between gap-3 rounded-[18px] border border-white/8 bg-white/[0.035] px-3 py-2.5 text-left transition duration-300 hover:-translate-y-0.5 hover:border-[#00f5a8]/24 hover:bg-white/[0.07] active:translate-y-0 active:scale-[0.985]"
        aria-expanded={isOpen}
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-[#00f5a8]/14 text-[#43ffc2]">
            <Palette className="h-4 w-4" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-white">
              Тема и стиль
            </span>
            <span className="mt-0.5 flex items-center gap-1.5 text-xs text-white/45">
              <ActiveIcon className="h-3.5 w-3.5 shrink-0 text-[#43ffc2]" />
              <span className="truncate">{activeOption.label}</span>
            </span>
          </span>
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-white/38 transition duration-300 ${
            isOpen ? "rotate-180 text-[#43ffc2]" : "group-hover:text-white/70"
          }`}
          aria-hidden="true"
        />
      </button>

      {isOpen ? (
        <div className="mt-2 grid gap-1.5">
          {themeOptions.map((option) => {
            const isActive = option.value === currentTheme;
            const Icon = option.icon;

            return (
              <button
                key={option.value}
                type="button"
                onClick={() => handleSelect(option.value)}
                className={`group relative flex min-h-12 items-center justify-between gap-3 rounded-[18px] border px-3 py-2.5 text-left transition duration-300 active:scale-[0.985] ${
                  isActive
                    ? "border-[#00f5a8]/42 bg-[#00f5a8] text-[#06101d] shadow-[0_14px_34px_rgba(0,245,168,0.18)]"
                    : "border-white/8 bg-white/[0.03] text-white/68 hover:-translate-y-0.5 hover:border-white/14 hover:bg-white/[0.07] hover:text-white"
                }`}
                title={option.description}
                aria-pressed={isActive}
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl ${
                      isActive
                        ? "bg-[#06101d]/10 text-[#06101d]"
                        : "bg-white/[0.05] text-[#43ffc2]"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">
                      {option.label}
                    </span>
                    <span
                      className={`mt-0.5 block truncate text-[11px] ${
                        isActive ? "text-[#06101d]/62" : "text-white/38"
                      }`}
                    >
                      {option.description}
                    </span>
                  </span>
                </span>
                <span
                  className={`flex h-6 min-w-8 shrink-0 items-center justify-center rounded-full px-2 text-[10px] font-bold ${
                    isActive
                      ? "bg-[#06101d] text-[#00f5a8]"
                      : "bg-white/[0.05] text-white/42"
                  }`}
                >
                  {isActive ? <Check className="h-3.5 w-3.5" /> : option.shortLabel}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
