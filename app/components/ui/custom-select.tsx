"use client";

import { useEffect, useRef, useState } from "react";

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
};

export function CustomSelect({
  value,
  options,
  onChange,
  placeholder = "Выбрать",
  className = "",
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

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex h-11 min-w-[180px] items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 text-sm text-white transition hover:bg-white/[0.06]"
      >
        <span className={selectedOption ? "text-white" : "text-white/35"}>
          {selectedOption?.label ?? placeholder}
        </span>

        <span
          className={`text-xs text-white/40 transition ${
            isOpen ? "rotate-180" : ""
          }`}
        >
          ▼
        </span>
      </button>

      {isOpen ? (
        <div className="absolute left-0 top-[calc(100%+8px)] z-50 min-w-full overflow-hidden rounded-2xl border border-white/10 bg-[#121826] shadow-[0_16px_48px_rgba(0,0,0,0.45)]">
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
                  className={`flex w-full items-center rounded-xl px-3 py-2.5 text-left text-sm transition ${
                    isActive
                      ? "bg-white text-black"
                      : "text-white/80 hover:bg-white/[0.06] hover:text-white"
                  }`}
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