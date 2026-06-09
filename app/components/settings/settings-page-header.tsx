"use client";

import {
  canManageUsers,
  canManageWorkspace,
  canManageSystem,
} from "../../lib/permissions";
import { useAppContextState } from "../../providers/app-context-provider";
import type { SettingsTab } from "../../settings/page";

interface SettingsPageHeaderProps {
  activeTab: SettingsTab;
  setActiveTab: (value: SettingsTab) => void;
}

export function SettingsPageHeader({
  activeTab,
  setActiveTab,
}: SettingsPageHeaderProps) {
  const { role, isLoading } = useAppContextState();

  function getTabClass(tab: SettingsTab) {
    return `relative overflow-hidden rounded-2xl px-4 py-2.5 text-sm font-medium transition duration-300 ease-out active:scale-[0.985] ${
      activeTab === tab
        ? "bg-[#00f5a8] text-[#06101d] shadow-[0_18px_42px_rgba(0,245,168,0.20),inset_0_1px_0_rgba(255,255,255,0.42)]"
        : "text-white/58 hover:-translate-y-0.5 hover:bg-white/[0.07] hover:text-white"
    }`;
  }

  return (
    <div className="rivn-card rivn-card-interactive p-4 sm:p-6">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.22em] text-[#43ffc2]">
            RIVN OS Control
          </div>
          <h1 className="mt-2 text-3xl font-medium tracking-[-0.05em] text-white sm:text-4xl">
            Настройки
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/52">
            Настрой кабинет, команду, доступы, уведомления и системные правила в одном спокойном пространстве.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="mt-6 h-[50px] animate-pulse rounded-2xl border border-white/10 bg-white/[0.04]" />
      ) : (
        <div className="mt-6 grid w-full grid-cols-2 gap-2 rounded-[24px] border border-white/10 bg-white/[0.04] p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] sm:flex sm:w-fit sm:flex-wrap sm:items-center">
          <button
            type="button"
            onClick={() => setActiveTab("profile")}
            className={getTabClass("profile")}
          >
            Профиль
          </button>

          {role && canManageUsers(role) ? (
            <>
              <button
                type="button"
                onClick={() => setActiveTab("users")}
                className={getTabClass("users")}
              >
                Пользователи
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("access")}
                className={getTabClass("access")}
              >
                Доступы
              </button>
            </>
          ) : null}

          <button
            type="button"
            onClick={() => setActiveTab("referrals")}
            className={getTabClass("referrals")}
          >
            Рефералка
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("telegram")}
            className={getTabClass("telegram")}
          >
            Telegram
          </button>

          {role && canManageSystem(role) ? (
            <button
              type="button"
              onClick={() => setActiveTab("system")}
              className={getTabClass("system")}
            >
              Система
            </button>
          ) : null}

          {role && canManageWorkspace(role) ? (
            <button
              type="button"
              onClick={() => setActiveTab("workspace")}
              className={getTabClass("workspace")}
            >
              Кабинеты
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}
