"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Bell, CheckCheck, Megaphone, X } from "lucide-react";
import type { AppNotification } from "@/app/lib/notifications/center";

type NotificationCenterProps = {
  variant?: "floating" | "sidebar";
  isSidebarCollapsed?: boolean;
};

type NotificationResponse = {
  ok: boolean;
  notifications: AppNotification[];
  unreadCount: number;
  error: string;
};

function getKindClasses(kind: AppNotification["kind"]) {
  switch (kind) {
    case "success":
      return "border-[#00f5a8]/25 bg-[#00f5a8]/10 text-[#43ffc2]";
    case "warning":
      return "border-amber-400/25 bg-amber-400/10 text-amber-200";
    case "danger":
      return "border-rose-400/25 bg-rose-400/10 text-rose-200";
    case "marketing":
      return "border-violet-400/25 bg-violet-400/10 text-violet-200";
    default:
      return "border-sky-400/25 bg-sky-400/10 text-sky-200";
  }
}

function getKindLabel(kind: AppNotification["kind"]) {
  switch (kind) {
    case "success":
      return "Готово";
    case "warning":
      return "Важно";
    case "danger":
      return "Внимание";
    case "marketing":
      return "Новость";
    default:
      return "Инфо";
  }
}

function formatNotificationDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function renderNotificationBody(body: string) {
  const linkPattern = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
  const lines = body.split("\n");

  return lines.map((line, lineIndex) => {
    const parts: ReactNode[] = [];
    let lastIndex = 0;

    Array.from(line.matchAll(linkPattern)).forEach((match, matchIndex) => {
      const [fullMatch, label, href] = match;
      const matchStart = match.index ?? 0;

      if (matchStart > lastIndex) {
        parts.push(line.slice(lastIndex, matchStart));
      }

      parts.push(
        <a
          key={`${lineIndex}-${matchIndex}`}
          href={href}
          target="_blank"
          rel="noreferrer"
          className="font-semibold text-[#43ffc2] underline decoration-[#43ffc2]/35 underline-offset-4 transition hover:text-[#00f5a8]"
          onClick={(event) => event.stopPropagation()}
        >
          {label}
        </a>
      );

      lastIndex = matchStart + fullMatch.length;
    });

    if (lastIndex < line.length) {
      parts.push(line.slice(lastIndex));
    }

    return (
      <span key={`${lineIndex}-${line}`} className="block min-h-[0.75rem]">
        {parts.length > 0 ? parts : "\u00A0"}
      </span>
    );
  });
}

export function NotificationCenter({
  variant = "floating",
  isSidebarCollapsed = false,
}: NotificationCenterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const hasUnread = unreadCount > 0;

  const unreadLabel = useMemo(() => {
    if (unreadCount > 99) return "99+";
    return String(unreadCount);
  }, [unreadCount]);
  const isSidebarVariant = variant === "sidebar";

  const loadNotifications = useCallback(async () => {
    try {
      setIsLoading(true);
      setErrorMessage("");

      const response = await fetch("/api/notifications/center", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });
      const data = (await response.json().catch(() => null)) as
        | NotificationResponse
        | null;

      if (!response.ok || !data?.ok) {
        throw new Error(
          data?.error || "Не удалось загрузить уведомления"
        );
      }

      setNotifications(data.notifications ?? []);
      setUnreadCount(data.unreadCount ?? 0);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Не удалось загрузить уведомления"
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadNotifications();

    const intervalId = window.setInterval(() => {
      void loadNotifications();
    }, 60000);

    return () => window.clearInterval(intervalId);
  }, [loadNotifications]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!isOpen) return;
      const target = event.target as Node;

      if (panelRef.current?.contains(target)) return;

      setIsOpen(false);
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  async function markAsRead(notificationId: string) {
    const previousNotifications = notifications;
    const previousUnreadCount = unreadCount;

    setNotifications((items) =>
      items.map((item) =>
        item.id === notificationId && !item.read_at
          ? { ...item, read_at: new Date().toISOString() }
          : item
      )
    );
    setUnreadCount((count) => Math.max(0, count - 1));

    try {
      const response = await fetch("/api/notifications/center", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ notificationId }),
      });
      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || "Не удалось отметить уведомление");
      }
    } catch {
      setNotifications(previousNotifications);
      setUnreadCount(previousUnreadCount);
    }
  }

  async function markAllAsRead() {
    const previousNotifications = notifications;
    const previousUnreadCount = unreadCount;

    setNotifications((items) =>
      items.map((item) =>
        item.read_at ? item : { ...item, read_at: new Date().toISOString() }
      )
    );
    setUnreadCount(0);

    try {
      const response = await fetch("/api/notifications/center", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ markAll: true }),
      });
      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || "Не удалось отметить уведомления");
      }
    } catch {
      setNotifications(previousNotifications);
      setUnreadCount(previousUnreadCount);
    }
  }

  return (
    <div
      ref={panelRef}
      className={
        isSidebarVariant
          ? "relative"
          : "fixed right-4 top-20 z-[260] lg:right-6 lg:top-5"
      }
    >
      <button
        type="button"
        onClick={() => {
          setIsOpen((value) => !value);
          if (!isOpen) void loadNotifications();
        }}
        className={
          isSidebarVariant
            ? `group relative flex h-11 w-full items-center overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] text-white/66 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition duration-300 ease-out hover:-translate-y-0.5 hover:border-[#00f5a8]/25 hover:bg-white/[0.07] hover:text-white active:translate-y-0 active:scale-[0.985] ${
                isSidebarCollapsed ? "justify-center px-0" : "justify-between px-3"
              }`
            : "group relative flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-[#08111f]/90 text-white shadow-[0_12px_34px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-xl transition duration-300 ease-out hover:-translate-y-0.5 hover:bg-white/[0.08] active:translate-y-0 active:scale-[0.96]"
        }
        aria-label="Открыть уведомления"
      >
        <span className="pointer-events-none absolute inset-x-3 top-0 h-px bg-gradient-to-r from-transparent via-white/0 to-transparent transition duration-500 group-hover:via-white/18" />
        <span className="relative flex min-w-0 items-center gap-3">
          <Bell className="h-5 w-5 shrink-0 transition duration-300 group-hover:scale-110" />
          {isSidebarVariant && !isSidebarCollapsed ? (
            <span className="truncate text-sm font-medium">Уведомления</span>
          ) : null}
        </span>
        {hasUnread ? (
          <span
            className={`flex h-5 min-w-5 items-center justify-center rounded-full bg-[#00f5a8] px-1.5 text-[10px] font-bold text-[#06101d] shadow-[0_8px_20px_rgba(0,245,168,0.35)] ${
              isSidebarVariant && !isSidebarCollapsed
                ? "relative"
                : "absolute -right-1 -top-1"
            }`}
          >
            {unreadLabel}
          </span>
        ) : null}
      </button>

      {isOpen ? (
        <div
          className={
            isSidebarVariant
              ? "absolute bottom-[calc(100%+12px)] left-0 z-[260] w-[min(88vw,420px)] overflow-hidden rounded-[26px] border border-white/10 bg-[#08111f]/94 text-white shadow-[0_30px_100px_rgba(0,0,0,0.52)] backdrop-blur-2xl"
              : "absolute right-0 mt-3 w-[min(92vw,420px)] overflow-hidden rounded-[26px] border border-white/10 bg-[#08111f]/94 text-white shadow-[0_30px_100px_rgba(0,0,0,0.52)] backdrop-blur-2xl"
          }
        >
          <div className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4">
            <div>
              <div className="text-base font-semibold text-white">
                Уведомления
              </div>
              <div className="mt-1 text-xs text-white/45">
                Важные события по кабинету и новости RIVN OS
              </div>
            </div>

            <div className="flex items-center gap-2">
              {hasUnread ? (
                <button
                  type="button"
                  onClick={() => void markAllAsRead()}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/55 transition duration-300 ease-out hover:-translate-y-0.5 hover:bg-white/[0.08] hover:text-[#43ffc2] active:translate-y-0 active:scale-[0.96]"
                  title="Отметить всё прочитанным"
                >
                  <CheckCheck className="h-4 w-4" />
                </button>
              ) : null}

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/55 transition duration-300 ease-out hover:-translate-y-0.5 hover:bg-white/[0.08] hover:text-white active:translate-y-0 active:scale-[0.96]"
                aria-label="Закрыть уведомления"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="max-h-[70vh] overflow-y-auto p-3">
            {errorMessage ? (
              <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm leading-6 text-amber-200">
                {errorMessage}
              </div>
            ) : null}

            {!errorMessage && isLoading && notifications.length === 0 ? (
              <div className="rounded-2xl bg-white/[0.045] px-4 py-5 text-sm text-white/45">
                Загружаем уведомления...
              </div>
            ) : null}

            {!errorMessage && !isLoading && notifications.length === 0 ? (
              <div className="rounded-2xl bg-white/[0.045] px-4 py-8 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#00f5a8]/12 text-[#43ffc2]">
                  <Megaphone className="h-5 w-5" />
                </div>
                <div className="mt-3 text-sm font-semibold text-white">
                  Пока нет уведомлений
                </div>
                <div className="mt-1 text-xs leading-5 text-white/45">
                  Когда появятся важные события или новости, они будут здесь.
                </div>
              </div>
            ) : null}

            <div className="space-y-2">
              {notifications.map((item) => {
                const content = (
                  <div
                    className={`rounded-2xl border p-4 transition duration-300 ease-out hover:-translate-y-0.5 ${
                      item.read_at
                        ? "border-white/10 bg-white/[0.035]"
                        : "border-[#00f5a8]/30 bg-[#00f5a8]/10"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getKindClasses(
                            item.kind
                          )}`}
                        >
                          {getKindLabel(item.kind)}
                        </span>
                        <div className="mt-3 text-sm font-semibold text-white">
                          {item.title}
                        </div>
                      </div>
                      <div className="shrink-0 text-[11px] text-white/35">
                        {formatNotificationDate(item.created_at)}
                      </div>
                    </div>

                    <div className="mt-3 space-y-1 text-sm leading-6 text-white/62">
                      {renderNotificationBody(item.body)}
                    </div>

                    {!item.read_at ? (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          void markAsRead(item.id);
                        }}
                        className="mt-3 text-xs font-semibold text-[#43ffc2] transition hover:text-[#00f5a8]"
                      >
                        Отметить прочитанным
                      </button>
                    ) : null}

                    {item.link_url ? (
                      <Link
                        href={item.link_url}
                        onClick={() => {
                          if (!item.read_at) void markAsRead(item.id);
                          setIsOpen(false);
                        }}
                        className="mt-3 inline-flex rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs font-semibold text-white/70 transition hover:bg-white/[0.08] hover:text-white"
                      >
                        Открыть
                      </Link>
                    ) : null}
                  </div>
                );

                return <div key={item.id}>{content}</div>;
              })}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
