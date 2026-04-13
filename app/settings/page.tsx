"use client";

import { useState } from "react";
import { SettingsPageHeader } from "../components/settings/settings-page-header";
import { EmployeesSettingsTab } from "../components/settings/employees-settings-tab";
import { UsersSettingsTab } from "../components/settings/users-settings-tab";
import { AccessSettingsTab } from "../components/settings/access-settings-tab";
import { TelegramSettingsTab } from "../components/settings/telegram-settings-tab";
import { SystemSettingsTab } from "../components/settings/system-settings-tab";
import { WorkspaceSettingsTab } from "../components/settings/workspace-settings-tab";
import { ReferralSettingsTab } from "../components/settings/referral-settings-tab";
import { AccessDenied } from "../components/access/access-denied";
import { usePageAccess } from "../lib/use-page-access";

export type SettingsTab =
  | "employees"
  | "users"
  | "access"
  | "referrals"
  | "telegram"
  | "system"
  | "workspace";

export default function SettingsPage() {
  const { isLoading, hasAccess } = usePageAccess("settings");
  const [activeTab, setActiveTab] = useState<SettingsTab>("employees");

  return (
    <main className="flex-1">
      <div className="space-y-6 px-5 py-6 lg:px-8">
        {isLoading ? (
          <div className="rounded-[28px] border border-white/10 bg-[#121826] p-8 text-white/60 shadow-[0_10px_40px_rgba(0,0,0,0.32)]">
            Проверяем доступ...
          </div>
        ) : !hasAccess ? (
          <AccessDenied
            title="Нет доступа к настройкам"
            description="Этот раздел доступен только владельцу кабинета и администраторам с соответствующими правами."
          />
        ) : (
          <>
            <SettingsPageHeader
              activeTab={activeTab}
              setActiveTab={setActiveTab}
            />

                        {activeTab === "employees" ? (
              <EmployeesSettingsTab />
            ) : activeTab === "users" ? (
              <UsersSettingsTab />
            ) : activeTab === "access" ? (
              <AccessSettingsTab />
            ) : activeTab === "referrals" ? (
              <ReferralSettingsTab />
            ) : activeTab === "telegram" ? (
              <TelegramSettingsTab />
            ) : activeTab === "system" ? (
              <SystemSettingsTab />
            ) : activeTab === "workspace" ? (
              <WorkspaceSettingsTab />
            ) : null}
          </>
        )}
      </div>
    </main>
  );
}