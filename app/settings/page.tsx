"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SettingsPageHeader } from "../components/settings/settings-page-header";
import { UsersSettingsTab } from "../components/settings/users-settings-tab";
import { AccessSettingsTab } from "../components/settings/access-settings-tab";
import { TelegramSettingsTab } from "../components/settings/telegram-settings-tab";
import { SystemSettingsTab } from "../components/settings/system-settings-tab";
import { WorkspaceSettingsTab } from "../components/settings/workspace-settings-tab";
import { ReferralSettingsTab } from "../components/settings/referral-settings-tab";
import { AccessDenied } from "../components/access/access-denied";
import { usePageAccess } from "../lib/use-page-access";

export type SettingsTab =
  | "users"
  | "access"
  | "referrals"
  | "telegram"
  | "system"
  | "workspace";

const DEFAULT_TAB: SettingsTab = "users";

function isSettingsTab(value: string | null): value is SettingsTab {
  return (
    value === "users" ||
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
  const resolvedInitialTab = isSettingsTab(queryTab) ? queryTab : DEFAULT_TAB;

  const [activeTab, setActiveTab] = useState<SettingsTab>(resolvedInitialTab);

  useEffect(() => {
    const nextTab = isSettingsTab(queryTab) ? queryTab : DEFAULT_TAB;

    setActiveTab((prev) => (prev === nextTab ? prev : nextTab));

    if (!isSettingsTab(queryTab)) {
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", DEFAULT_TAB);
      router.replace(`/settings?${params.toString()}`, { scroll: false });
    }
  }, [queryTab, router, searchParams]);

  function handleSetActiveTab(nextTab: SettingsTab) {
    setActiveTab(nextTab);

    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", nextTab);

    router.replace(`/settings?${params.toString()}`, { scroll: false });
  }

  const tabContent = useMemo(() => {
    if (activeTab === "users") return <UsersSettingsTab />;
    if (activeTab === "access") return <AccessSettingsTab />;
    if (activeTab === "referrals") return <ReferralSettingsTab />;
    if (activeTab === "telegram") return <TelegramSettingsTab />;
    if (activeTab === "system") return <SystemSettingsTab />;
    if (activeTab === "workspace") return <WorkspaceSettingsTab />;
    return null;
  }, [activeTab]);

  return (
    <main className="flex-1">
      <div className="space-y-6 px-5 py-6 lg:px-8">
        {!hasAccess && !isLoading ? (
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
    </main>
  );
}

function SettingsPageFallback() {
  return (
    <main className="flex-1">
      <div className="space-y-6 px-5 py-6 lg:px-8">
        <div className="rounded-[28px] border border-white/10 bg-[#121826] p-8 text-white/60 shadow-[0_10px_40px_rgba(0,0,0,0.32)]">
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