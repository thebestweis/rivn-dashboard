"use client";

import { useState } from "react";
import { AppSidebar } from "../components/layout/app-sidebar";
import { SettingsPageHeader } from "../components/settings/settings-page-header";
import { EmployeesSettingsTab } from "../components/settings/employees-settings-tab";
import { CategoriesSettingsTab } from "../components/settings/categories-settings-tab";
import { UsersSettingsTab } from "../components/settings/users-settings-tab";
import { TelegramSettingsTab } from "../components/settings/telegram-settings-tab";
import { SystemSettingsTab } from "../components/settings/system-settings-tab";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<
    "employees" | "categories" | "users" | "telegram" | "system"
  >("employees");

  return (
    <div className="min-h-screen bg-[#0B0F1A] text-white">
      <div className="flex min-h-screen">
        <AppSidebar />

        <main className="flex-1">
          <div className="space-y-6 px-5 py-6 lg:px-8">
            <SettingsPageHeader
              activeTab={activeTab}
              setActiveTab={setActiveTab}
            />

            {activeTab === "employees" ? (
              <EmployeesSettingsTab />
            ) : activeTab === "categories" ? (
              <CategoriesSettingsTab />
            ) : activeTab === "users" ? (
              <UsersSettingsTab />
            ) : activeTab === "telegram" ? (
              <TelegramSettingsTab />
            ) : activeTab === "system" ? (
              <SystemSettingsTab />
            ) : null}
          </div>
        </main>
      </div>
    </div>
  );
}