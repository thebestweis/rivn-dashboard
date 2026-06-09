"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { CSSProperties } from "react";
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
  const [dropdownStyle, setDropdownStyle] = useState<CSSProperties>({});
  const rootRef = useRef<HTMLDivElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  const selectedOption = options.find((option) => option.value === value);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!rootRef.current) return;

      const target = event.target as Node;

      if (
        !rootRef.current.contains(target) &&
        !dropdownRef.current?.contains(target)
      ) {
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
    if (!isOpen || typeof window === "undefined") return;

    function updatePosition() {
      const rect = rootRef.current?.getBoundingClientRect();
      if (!rect) return;

      const dropdownWidth = Math.max(rect.width, 220);
      const estimatedHeight = Math.min(288, Math.max(64, options.length * 44 + 16));
      const spaceBelow = window.innerHeight - rect.bottom;
      const top =
        spaceBelow >= estimatedHeight + 12
          ? rect.bottom + 8
          : Math.max(12, rect.top - estimatedHeight - 8);

      setDropdownStyle({
        position: "fixed",
        left: Math.min(rect.left, window.innerWidth - dropdownWidth - 12),
        top,
        width: dropdownWidth,
        zIndex: 10000,
      });
    }

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [isOpen, options.length]);

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
              ? "truncate text-slate-900 dark:text-white"
              : "truncate text-slate-400 dark:text-white/35"
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
          ▾
        </span>
      </button>

      {isOpen && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={dropdownRef}
              style={dropdownStyle}
              className={cn(
                "overflow-hidden rounded-[22px] border border-white/10 bg-[#101a28]/95 shadow-[0_24px_80px_rgba(0,0,0,0.55),0_0_0_1px_rgba(0,245,168,0.08)] backdrop-blur-2xl",
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
                        "flex w-full items-center rounded-2xl px-3 py-2.5 text-left text-sm transition",
                        isActive
                          ? "bg-[#00f5a8] text-[#06101d] shadow-[0_14px_34px_rgba(0,245,168,0.22)]"
                          : "text-white/72 hover:bg-white/[0.07] hover:text-white"
                      )}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
