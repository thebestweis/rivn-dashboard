"use client";

import { useEffect, useState } from "react";

type HealthStatus = "ok" | "warning" | "error";

type HealthPayload = {
  ok: true;
  overallStatus: HealthStatus;
  checkedAt: string;
  checks: Array<{
    key: string;
    label: string;
    status: HealthStatus;
    message: string;
  }>;
};

function getStatusLabel(status: HealthStatus) {
  if (status === "ok") return "Работает";
  if (status === "warning") return "Проверить";
  return "Ошибка";
}

function getStatusClass(status: HealthStatus) {
  if (status === "ok") return "bg-emerald-400/15 text-emerald-200";
  if (status === "warning") return "bg-amber-400/15 text-amber-200";
  return "bg-rose-400/15 text-rose-200";
}

export function AdminHealthPanel() {
  const [data, setData] = useState<HealthPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadHealth() {
    try {
      setIsLoading(true);
      setError("");

      const response = await fetch("/api/admin/health", {
        cache: "no-store",
        credentials: "include",
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || "Не удалось проверить здоровье сервиса");
      }

      setData(payload as HealthPayload);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Не удалось проверить здоровье сервиса"
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadHealth();
  }, []);

  return (
    <section className="rounded-2xl border border-white/10 bg-[#121826] p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="text-lg font-semibold text-white">
            Health-check сервиса
          </div>
          <p className="mt-2 text-sm leading-6 text-white/55">
            Быстрая проверка: база, Telegram, Avito, env-переменные и логи
            отчётов.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadHealth()}
          disabled={isLoading}
          className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white/70 transition hover:bg-white/[0.08] disabled:opacity-50"
        >
          {isLoading ? "Проверяем..." : "Проверить"}
        </button>
      </div>

      {error ? (
        <div className="mt-4 rounded-xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {(data?.checks ?? []).map((check) => (
          <div
            key={check.key}
            className="rounded-2xl border border-white/10 bg-[#0F1524] px-4 py-4"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-medium text-white">{check.label}</div>
              <span
                className={`rounded-full px-2.5 py-1 text-xs ${getStatusClass(
                  check.status
                )}`}
              >
                {getStatusLabel(check.status)}
              </span>
            </div>
            <div className="mt-3 text-xs leading-5 text-white/50">
              {check.message}
            </div>
          </div>
        ))}
      </div>

      {data?.checkedAt ? (
        <div className="mt-4 text-xs text-white/40">
          Последняя проверка: {new Date(data.checkedAt).toLocaleString("ru-RU")}
        </div>
      ) : null}
    </section>
  );
}
