"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { formatDisplayDate, parseDisplayDate } from "../../lib/storage";

interface RivnDatePickerProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

interface RivnDateRangePickerProps {
  from: string;
  to: string;
  onChange: (range: { from: string; to: string }) => void;
  placeholder?: string;
  className?: string;
  iconOnly?: boolean;
}

const weekdays = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const singleCalendarWidth = 320;
const singleCalendarHeight = 430;
const rangeCalendarWidth = 340;
const rangeCalendarHeight = 470;

type FloatingPosition = {
  top: number;
  left: number;
};

function formatInputDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
}

function getDateFromValue(value: string) {
  const date = parseDisplayDate(value);
  if (!date) return null;
  date.setHours(0, 0, 0, 0);
  return date;
}

function getMonthTitle(date: Date) {
  return date.toLocaleDateString("ru-RU", {
    month: "long",
    year: "numeric",
  });
}

function getDisplayValue(value: string, placeholder: string) {
  const date = getDateFromValue(value);
  if (!date) return placeholder;
  return formatDisplayDate(date);
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function getFloatingPosition(
  trigger: HTMLButtonElement | null,
  width: number,
  height: number
): FloatingPosition {
  if (!trigger || typeof window === "undefined") {
    return { top: 0, left: 0 };
  }

  const rect = trigger.getBoundingClientRect();
  const margin = 16;
  const safeWidth = Math.min(width, window.innerWidth - margin * 2);
  const left = Math.min(
    Math.max(margin, rect.right - safeWidth),
    window.innerWidth - safeWidth - margin
  );

  const bottomTop = rect.bottom + 10;
  const top =
    bottomTop + height > window.innerHeight - margin
      ? Math.max(margin, rect.top - height - 10)
      : bottomTop;

  return { top, left };
}

function buildCalendarDays(monthDate: Date) {
  const firstDay = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const start = new Date(firstDay);
  const mondayOffset = (firstDay.getDay() + 6) % 7;
  start.setDate(firstDay.getDate() - mondayOffset);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    date.setHours(0, 0, 0, 0);

    return {
      date,
      value: formatInputDate(date),
      day: date.getDate(),
      isCurrentMonth: date.getMonth() === monthDate.getMonth(),
      isToday: isSameDay(date, new Date()),
    };
  });
}

export function RivnDatePicker({
  value,
  onChange,
  placeholder = "Выбери дату",
  disabled = false,
  className = "",
}: RivnDatePickerProps) {
  const selectedDate = getDateFromValue(value);
  const [isOpen, setIsOpen] = useState(false);
  const [monthDate, setMonthDate] = useState(() => selectedDate ?? new Date());
  const [floatingPosition, setFloatingPosition] = useState<FloatingPosition>({
    top: 0,
    left: 0,
  });
  const rootRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const calendarRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (
        !rootRef.current?.contains(target) &&
        !calendarRef.current?.contains(target)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    function updatePosition() {
      setFloatingPosition(
        getFloatingPosition(buttonRef.current, singleCalendarWidth, singleCalendarHeight)
      );
    }

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [isOpen]);

  const calendarDays = useMemo(() => buildCalendarDays(monthDate), [monthDate]);

  function moveMonth(direction: -1 | 1) {
    setMonthDate((current) => {
      const next = new Date(current);
      next.setMonth(current.getMonth() + direction);
      return next;
    });
  }

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((current) => !current)}
        className="rivn-field flex h-11 w-full items-center justify-between gap-3 text-left disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className={value ? "truncate text-white" : "truncate text-white/35"}>
          {getDisplayValue(value, placeholder)}
        </span>
        <CalendarDays className="h-4 w-4 shrink-0 text-[#43ffc2]" />
      </button>

      {isOpen && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={calendarRef}
              className="fixed z-[9999] w-[320px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-[28px] border border-white/12 bg-[#07111f]/95 p-4 text-white shadow-[0_28px_90px_rgba(0,0,0,0.62),inset_0_1px_0_rgba(255,255,255,0.09)] backdrop-blur-2xl"
              style={{ top: floatingPosition.top, left: floatingPosition.left }}
            >
              <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-[#00f5a8]/18 blur-3xl" />
              <div className="pointer-events-none absolute -left-20 bottom-8 h-44 w-44 rounded-full bg-[#7b61ff]/18 blur-3xl" />

              <div className="relative flex items-center justify-between">
                <button type="button" onClick={() => moveMonth(-1)} className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/[0.05] text-white/75 transition duration-300 hover:-translate-y-0.5 hover:bg-white/[0.09] hover:text-white">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <div className="text-sm font-semibold capitalize tracking-[-0.02em]">
                  {getMonthTitle(monthDate)}
                </div>
                <button type="button" onClick={() => moveMonth(1)} className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/[0.05] text-white/75 transition duration-300 hover:-translate-y-0.5 hover:bg-white/[0.09] hover:text-white">
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>

              <div className="relative mt-4 grid grid-cols-7 gap-1.5 text-center text-[11px] font-medium uppercase tracking-[0.12em] text-white/38">
                {weekdays.map((day) => (
                  <div key={day} className="py-1">
                    {day}
                  </div>
                ))}
              </div>

              <div className="relative mt-1 grid grid-cols-7 gap-1.5">
                {calendarDays.map((day) => {
                  const isSelected = selectedDate ? isSameDay(day.date, selectedDate) : false;

                  return (
                    <button
                      key={day.value}
                      type="button"
                      onClick={() => {
                        onChange(day.value);
                        setIsOpen(false);
                      }}
                      className={`grid h-9 place-items-center rounded-2xl text-sm font-medium transition duration-300 active:scale-95 ${
                        isSelected
                          ? "bg-[#00f5a8] text-[#06101d] shadow-[0_14px_34px_rgba(0,245,168,0.24)]"
                          : day.isToday
                            ? "border border-[#00f5a8]/30 bg-[#00f5a8]/10 text-[#43ffc2]"
                            : day.isCurrentMonth
                              ? "text-white/78 hover:-translate-y-0.5 hover:bg-white/[0.08] hover:text-white"
                              : "text-white/22 hover:bg-white/[0.05]"
                      }`}
                    >
                      {day.day}
                    </button>
                  );
                })}
              </div>

              <div className="relative mt-4 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => { onChange(""); setIsOpen(false); }} className="rivn-button px-4 py-2.5 text-sm text-white/70">
                  Очистить
                </button>
                <button type="button" onClick={() => { const today = new Date(); onChange(formatInputDate(today)); setMonthDate(today); setIsOpen(false); }} className="rivn-button rivn-button-primary px-4 py-2.5 text-sm font-semibold">
                  Сегодня
                </button>
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}

export function RivnDateRangePicker({
  from,
  to,
  onChange,
  placeholder = "Выбери период",
  className = "",
  iconOnly = false,
}: RivnDateRangePickerProps) {
  const fromDate = getDateFromValue(from);
  const toDate = getDateFromValue(to);
  const [isOpen, setIsOpen] = useState(false);
  const [anchor, setAnchor] = useState<string | null>(null);
  const [monthDate, setMonthDate] = useState(() => fromDate ?? toDate ?? new Date());
  const [floatingPosition, setFloatingPosition] = useState<FloatingPosition>({
    top: 0,
    left: 0,
  });
  const rootRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const calendarRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (
        !rootRef.current?.contains(target) &&
        !calendarRef.current?.contains(target)
      ) {
        setIsOpen(false);
        setAnchor(null);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    function updatePosition() {
      setFloatingPosition(
        getFloatingPosition(buttonRef.current, rangeCalendarWidth, rangeCalendarHeight)
      );
    }

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [isOpen]);

  const calendarDays = useMemo(() => {
    return buildCalendarDays(monthDate).map((day) => {
      const isStart = fromDate ? isSameDay(day.date, fromDate) : false;
      const isEnd = toDate ? isSameDay(day.date, toDate) : false;
      const isInRange = Boolean(fromDate && toDate && day.date >= fromDate && day.date <= toDate);

      return { ...day, isStart, isEnd, isInRange };
    });
  }, [monthDate, fromDate, toDate]);

  const label = useMemo(() => {
    if (!from && !to) return placeholder;
    if (from && to) {
      return `${getDisplayValue(from, "")} — ${getDisplayValue(to, "")}`;
    }
    return from ? `С ${getDisplayValue(from, "")}` : `По ${getDisplayValue(to, "")}`;
  }, [from, to, placeholder]);

  function moveMonth(direction: -1 | 1) {
    setMonthDate((current) => {
      const next = new Date(current);
      next.setMonth(current.getMonth() + direction);
      return next;
    });
  }

  function selectDay(value: string) {
    if (!anchor || (from && to)) {
      onChange({ from: value, to: "" });
      setAnchor(value);
      return;
    }

    if (value < anchor) {
      onChange({ from: value, to: anchor });
    } else {
      onChange({ from: anchor, to: value });
    }
    setAnchor(null);
  }

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className={`rivn-field flex h-11 items-center justify-between gap-3 text-left ${
          iconOnly ? "w-11 min-w-0 justify-center rounded-full px-0" : "w-full min-w-[250px]"
        }`}
        title={label}
      >
        {iconOnly ? null : (
          <span className={from || to ? "truncate text-white" : "truncate text-white/35"}>
            {label}
          </span>
        )}
        <CalendarDays className="h-4 w-4 shrink-0 text-[#43ffc2]" />
      </button>

      {isOpen && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={calendarRef}
              className="fixed z-[9999] w-[340px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-[28px] border border-white/12 bg-[#07111f]/95 p-4 text-white shadow-[0_28px_90px_rgba(0,0,0,0.62),inset_0_1px_0_rgba(255,255,255,0.09)] backdrop-blur-2xl"
              style={{ top: floatingPosition.top, left: floatingPosition.left }}
            >
              <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-[#00f5a8]/18 blur-3xl" />
              <div className="pointer-events-none absolute -left-20 bottom-8 h-44 w-44 rounded-full bg-[#7b61ff]/18 blur-3xl" />

              <div className="relative grid grid-cols-4 gap-2">
                {[
                  ["month", "Месяц"],
                  ["3m", "3 мес"],
                  ["6m", "6 мес"],
                  ["all", "Всё"],
                ].map(([key, title]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      const today = new Date();
                      if (key === "all") {
                        onChange({ from: "", to: "" });
                        setAnchor(null);
                        setIsOpen(false);
                        return;
                      }

                      const start = new Date(today);
                      if (key === "month") {
                        start.setDate(1);
                      } else if (key === "3m") {
                        start.setMonth(today.getMonth() - 2, 1);
                      } else if (key === "6m") {
                        start.setMonth(today.getMonth() - 5, 1);
                      }

                      onChange({ from: formatInputDate(start), to: formatInputDate(today) });
                      setMonthDate(start);
                      setAnchor(null);
                      setIsOpen(false);
                    }}
                    className="rounded-2xl border border-white/10 bg-white/[0.05] px-3 py-2 text-xs font-semibold text-white/68 transition duration-300 hover:-translate-y-0.5 hover:bg-white/[0.08] hover:text-white"
                  >
                    {title}
                  </button>
                ))}
              </div>

              <div className="relative mt-4 flex items-center justify-between">
                <button type="button" onClick={() => moveMonth(-1)} className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/[0.05] text-white/75 transition duration-300 hover:-translate-y-0.5 hover:bg-white/[0.09] hover:text-white">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <div className="text-sm font-semibold capitalize tracking-[-0.02em]">
                  {getMonthTitle(monthDate)}
                </div>
                <button type="button" onClick={() => moveMonth(1)} className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/[0.05] text-white/75 transition duration-300 hover:-translate-y-0.5 hover:bg-white/[0.09] hover:text-white">
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>

              <div className="relative mt-4 grid grid-cols-7 gap-1.5 text-center text-[11px] font-medium uppercase tracking-[0.12em] text-white/38">
                {weekdays.map((day) => (
                  <div key={day} className="py-1">
                    {day}
                  </div>
                ))}
              </div>

              <div className="relative mt-1 grid grid-cols-7 gap-1.5">
                {calendarDays.map((day) => (
                  <button
                    key={day.value}
                    type="button"
                    onClick={() => selectDay(day.value)}
                    className={`grid h-9 place-items-center rounded-2xl text-sm font-medium transition duration-300 active:scale-95 ${
                      day.isStart || day.isEnd
                        ? "bg-[#00f5a8] text-[#06101d] shadow-[0_14px_34px_rgba(0,245,168,0.24)]"
                        : day.isInRange
                          ? "bg-[#00f5a8]/18 text-[#b8ffe7]"
                          : day.isToday
                            ? "border border-[#00f5a8]/30 bg-[#00f5a8]/10 text-[#43ffc2]"
                            : day.isCurrentMonth
                              ? "text-white/78 hover:-translate-y-0.5 hover:bg-white/[0.08] hover:text-white"
                              : "text-white/22 hover:bg-white/[0.05]"
                    }`}
                  >
                    {day.day}
                  </button>
                ))}
              </div>

              <div className="relative mt-4 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => { onChange({ from: "", to: "" }); setAnchor(null); setIsOpen(false); }} className="rivn-button px-4 py-2.5 text-sm text-white/70">
                  Очистить
                </button>
                <button type="button" onClick={() => setIsOpen(false)} className="rivn-button rivn-button-primary px-4 py-2.5 text-sm font-semibold">
                  Готово
                </button>
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
