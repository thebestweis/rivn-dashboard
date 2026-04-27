"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type Option = {
  value: string;
  label: string;
};

type CustomSelectProps = {
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  buttonClassName?: string;
  dropdownClassName?: string;
  disabled?: boolean;
};

export function CustomSelect({
  value,
  options,
  onChange,
  placeholder = "Выбрать",
  className = "",
  buttonClassName = "",
  dropdownClassName = "",
  disabled = false,
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const selectedOption = options.find((option) => option.value === value);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!rootRef.current) return;

      if (!rootRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  useEffect(() => {
    if (disabled && isOpen) {
      setIsOpen(false);
    }
  }, [disabled, isOpen]);

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => {
          if (disabled) return;
          setIsOpen((prev) => !prev);
        }}
        disabled={disabled}
        className={cn(
          "flex h-11 w-full items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 shadow-sm transition dark:border-white/10 dark:bg-white/[0.03] dark:text-white dark:shadow-none",
          disabled
            ? "cursor-not-allowed opacity-60"
            : "hover:border-violet-200 hover:bg-slate-50 dark:hover:bg-white/[0.06]",
          buttonClassName
        )}
      >
        <span
          className={
            selectedOption
              ? "text-slate-900 dark:text-white"
              : "text-slate-400 dark:text-white/35"
          }
        >
          {selectedOption?.label ?? placeholder}
        </span>

        <span
          className={cn(
            "text-xs text-slate-400 transition dark:text-white/40",
            isOpen ? "rotate-180" : ""
          )}
        >
          ▼
        </span>
      </button>

      {isOpen ? (
        <div
          className={cn(
            "absolute left-0 top-[calc(100%+8px)] z-50 min-w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_16px_48px_rgba(15,23,42,0.14)] dark:border-white/10 dark:bg-[#121826] dark:shadow-[0_16px_48px_rgba(0,0,0,0.45)]",
            dropdownClassName
          )}
        >
          <div className="max-h-72 overflow-y-auto p-2">
            {options.map((option) => {
              const isActive = option.value === value;

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center rounded-xl px-3 py-2.5 text-left text-sm transition",
                    isActive
                      ? "bg-violet-600 text-white dark:bg-white dark:text-black"
                      : "text-slate-600 hover:bg-violet-50 hover:text-violet-700 dark:text-white/80 dark:hover:bg-white/[0.06] dark:hover:text-white"
                  )}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
