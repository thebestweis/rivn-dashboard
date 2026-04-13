"use client";

import {
  canManageUsers,
  canManageWorkspace,
  canManageSystem,
} from "../../lib/permissions";
import { useAppContextState } from "../../providers/app-context-provider";

interface SettingsPageHeaderProps {
  activeTab:
    | "workspace"
    | "employees"
    | "users"
    | "access"
    | "referrals"
    | "telegram"
    | "system";
  setActiveTab: (
    value:
      | "workspace"
      | "employees"
      | "users"
      | "access"
      | "referrals"
      | "telegram"
      | "system"
  ) => void;
}

export function SettingsPageHeader({
  activeTab,
  setActiveTab,
}: SettingsPageHeaderProps) {
  const { role, isLoading } = useAppContextState();

  return (
    <div className="rounded-[28px] border border-white/10 bg-[#121826] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.32)]">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="text-sm text-white/50">Раздел</div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            Настройки
          </h1>
          <p className="mt-2 text-sm text-white/55">
  Сотрудники, пользователи, доступы, реферальная система, Telegram, системные параметры и кабинеты.
</p>
        </div>

        <div className="rounded-2xl bg-emerald-400/15 px-4 py-3 text-sm font-medium text-emerald-300 shadow-[0_0_24px_rgba(16,185,129,0.18)]">
          Конфигурация системы
        </div>
      </div>

      {isLoading ? (
        <div className="mt-5 h-[46px] rounded-2xl border border-white/10 bg-white/[0.04]" />
      ) : (
        <div className="mt-5 flex w-fit flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-1">
          <button
            onClick={() => setActiveTab("employees")}
            className={`rounded-xl px-4 py-2 text-sm transition ${
              activeTab === "employees"
                ? "bg-[#7B61FF] text-white shadow-[0_0_24px_rgba(123,97,255,0.35)]"
                : "text-white/60 hover:text-white"
            }`}
          >
            Сотрудники
          </button>

          <button
            onClick={() => setActiveTab("referrals")}
            className={`rounded-xl px-4 py-2 text-sm transition ${
              activeTab === "referrals"
                ? "bg-[#7B61FF] text-white shadow-[0_0_24px_rgba(123,97,255,0.35)]"
                : "text-white/60 hover:text-white"
            }`}
          >
            Рефералка
          </button>

          {role && canManageUsers(role) ? (
            <>
              <button
                onClick={() => setActiveTab("users")}
                className={`rounded-xl px-4 py-2 text-sm transition ${
                  activeTab === "users"
                    ? "bg-[#7B61FF] text-white shadow-[0_0_24px_rgba(123,97,255,0.35)]"
                    : "text-white/60 hover:text-white"
                }`}
              >
                Пользователи
              </button>

              <button
                onClick={() => setActiveTab("access")}
                className={`rounded-xl px-4 py-2 text-sm transition ${
                  activeTab === "access"
                    ? "bg-[#7B61FF] text-white shadow-[0_0_24px_rgba(123,97,255,0.35)]"
                    : "text-white/60 hover:text-white"
                }`}
              >
                Доступы
              </button>
            </>
          ) : null}

          <button
            onClick={() => setActiveTab("telegram")}
            className={`rounded-xl px-4 py-2 text-sm transition ${
              activeTab === "telegram"
                ? "bg-[#7B61FF] text-white shadow-[0_0_24px_rgba(123,97,255,0.35)]"
                : "text-white/60 hover:text-white"
            }`}
          >
            Telegram
          </button>

          {role && canManageSystem(role) ? (
            <button
              onClick={() => setActiveTab("system")}
              className={`rounded-xl px-4 py-2 text-sm transition ${
                activeTab === "system"
                  ? "bg-[#7B61FF] text-white shadow-[0_0_24px_rgba(123,97,255,0.35)]"
                  : "text-white/60 hover:text-white"
              }`}
            >
              Система
            </button>
          ) : null}

          {role && canManageWorkspace(role) ? (
            <button
              onClick={() => setActiveTab("workspace")}
              className={`rounded-xl px-4 py-2 text-sm transition ${
                activeTab === "workspace"
                  ? "bg-[#7B61FF] text-white shadow-[0_0_24px_rgba(123,97,255,0.35)]"
                  : "text-white/60 hover:text-white"
              }`}
            >
              Кабинеты
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}