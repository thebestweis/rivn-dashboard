"use client";

import { Suspense, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SettingsPageHeader } from "../components/settings/settings-page-header";
import { UsersSettingsTab } from "../components/settings/users-settings-tab";
import { AccessSettingsTab } from "../components/settings/access-settings-tab";
import { TelegramSettingsTab } from "../components/settings/telegram-settings-tab";
import { SystemSettingsTab } from "../components/settings/system-settings-tab";
import { WorkspaceSettingsTab } from "../components/settings/workspace-settings-tab";
import { ReferralSettingsTab } from "../components/settings/referral-settings-tab";
import { ProfileSettingsTab } from "../components/settings/profile-settings-tab";
import { AccessDenied } from "../components/access/access-denied";
import { usePageAccess } from "../lib/use-page-access";

export type SettingsTab =
  | "profile"
  | "users"
  | "access"
  | "referrals"
  | "telegram"
  | "system"
  | "workspace";

const DEFAULT_TAB: SettingsTab = "profile";

function isSettingsTab(value: string | null): value is SettingsTab {
  return (
    value === "users" ||
    value === "profile" ||
    value === "access" ||
    value === "referrals" ||
    value === "telegram" ||
    value === "system" ||
    value === "workspace"
  );
}

function SettingsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const { isLoading, hasAccess } = usePageAccess("settings");

  const queryTab = searchParams.get("tab");
  const activeTab = isSettingsTab(queryTab) ? queryTab : DEFAULT_TAB;

  useEffect(() => {
    if (!isSettingsTab(queryTab)) {
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", DEFAULT_TAB);
      router.replace(`/settings?${params.toString()}`, { scroll: false });
    }
  }, [queryTab, router, searchParams]);

  function handleSetActiveTab(nextTab: SettingsTab) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", nextTab);

    router.replace(`/settings?${params.toString()}`, { scroll: false });
  }

  const tabContent = useMemo(() => {
    if (activeTab === "profile") return <ProfileSettingsTab />;
    if (activeTab === "users") return <UsersSettingsTab />;
    if (activeTab === "access") return <AccessSettingsTab />;
    if (activeTab === "referrals") return <ReferralSettingsTab />;
    if (activeTab === "telegram") return <TelegramSettingsTab />;
    if (activeTab === "system") return <SystemSettingsTab />;
    if (activeTab === "workspace") return <WorkspaceSettingsTab />;
    return null;
  }, [activeTab]);

  return (
    <main className="flex-1 px-3 py-3 sm:px-5 sm:py-5 lg:px-7">
      <div className="rivn-page-shell px-4 py-4 sm:px-5 sm:py-5 lg:px-7 lg:py-7">
        <div className="relative z-10 space-y-5 lg:space-y-6">
        {!hasAccess && activeTab !== "profile" && !isLoading ? (
          <AccessDenied
            title="Нет доступа к настройкам"
            description="Этот раздел доступен только владельцу кабинета и администраторам с соответствующими правами."
          />
        ) : (
          <>
            <SettingsPageHeader
              activeTab={activeTab}
              setActiveTab={handleSetActiveTab}
            />
            {tabContent}
          </>
        )}
        </div>
      </div>
    </main>
  );
}

function SettingsPageFallback() {
  return (
    <main className="flex-1 px-3 py-3 sm:px-5 sm:py-5 lg:px-7">
      <div className="rivn-page-shell px-4 py-4 sm:px-5 sm:py-5 lg:px-7 lg:py-7">
        <div className="rivn-card p-4 text-white/60 sm:p-8">
          Загружаем настройки...
        </div>
      </div>
    </main>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<SettingsPageFallback />}>
      <SettingsPageContent />
    </Suspense>
  );
}
