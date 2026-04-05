interface SettingsPageHeaderProps {
  activeTab: "employees" | "categories" | "users" | "telegram" | "system";
  setActiveTab: (
    value: "employees" | "categories" | "users" | "telegram" | "system"
  ) => void;
}

export function SettingsPageHeader({
  activeTab,
  setActiveTab,
}: SettingsPageHeaderProps) {
  return (
    <div className="rounded-[28px] border border-white/10 bg-[#121826] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.32)]">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="text-sm text-white/50">Раздел</div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Settings</h1>
          <p className="mt-2 text-sm text-white/55">
            Сотрудники, категории расходов, пользователи, Telegram и системные параметры.
          </p>
        </div>

        <div className="rounded-2xl bg-emerald-400/15 px-4 py-3 text-sm font-medium text-emerald-300 shadow-[0_0_24px_rgba(16,185,129,0.18)]">
          Конфигурация системы
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-1 w-fit">
        <button
          onClick={() => setActiveTab("employees")}
          className={`rounded-xl px-4 py-2 text-sm transition ${
            activeTab === "employees"
              ? "bg-[#7B61FF] text-white shadow-[0_0_24px_rgba(123,97,255,0.35)]"
              : "text-white/60 hover:text-white"
          }`}
        >
          Employees
        </button>

        <button
          onClick={() => setActiveTab("categories")}
          className={`rounded-xl px-4 py-2 text-sm transition ${
            activeTab === "categories"
              ? "bg-[#7B61FF] text-white shadow-[0_0_24px_rgba(123,97,255,0.35)]"
              : "text-white/60 hover:text-white"
          }`}
        >
          Expense Categories
        </button>

        <button
          onClick={() => setActiveTab("users")}
          className={`rounded-xl px-4 py-2 text-sm transition ${
            activeTab === "users"
              ? "bg-[#7B61FF] text-white shadow-[0_0_24px_rgba(123,97,255,0.35)]"
              : "text-white/60 hover:text-white"
          }`}
        >
          Users
        </button>

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

        <button
          onClick={() => setActiveTab("system")}
          className={`rounded-xl px-4 py-2 text-sm transition ${
            activeTab === "system"
              ? "bg-[#7B61FF] text-white shadow-[0_0_24px_rgba(123,97,255,0.35)]"
              : "text-white/60 hover:text-white"
          }`}
        >
          System
        </button>
      </div>
    </div>
  );
}