interface AnalyticsPageHeaderProps {
  activeTab: "financial" | "planfact" | "clients" | "team";
  setActiveTab: (
    value: "financial" | "planfact" | "clients" | "team"
  ) => void;
}

export function AnalyticsPageHeader({
  activeTab,
  setActiveTab,
}: AnalyticsPageHeaderProps) {
  return (
    <div className="rounded-[28px] border border-white/10 bg-[#121826] p-4 shadow-[0_10px_40px_rgba(0,0,0,0.32)] sm:p-5">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="text-sm text-white/50">Раздел</div>
          <h1 className="text-2xl font-semibold sm:text-3xl">Аналитика</h1>
          <p className="mt-2 text-sm text-white/55">
            Финансовая аналитика, план / факт, клиенты, команда и управленческие сигналы.
          </p>
        </div>
      </div>

      <div className="mt-5 grid w-full grid-cols-3 gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-1 sm:flex sm:w-fit sm:flex-wrap sm:items-center">
        <button
          onClick={() => setActiveTab("financial")}
          className={`rounded-xl px-2 py-2 text-xs transition sm:px-4 sm:text-sm ${
            activeTab === "financial"
              ? "bg-[#7B61FF] text-white shadow-[0_0_24px_rgba(123,97,255,0.35)]"
              : "text-white/60 hover:text-white"
          }`}
        >
          Финансы
        </button>

        <button
          onClick={() => setActiveTab("planfact")}
          className={`rounded-xl px-2 py-2 text-xs transition sm:px-4 sm:text-sm ${
            activeTab === "planfact"
              ? "bg-[#7B61FF] text-white shadow-[0_0_24px_rgba(123,97,255,0.35)]"
              : "text-white/60 hover:text-white"
          }`}
        >
          План / Факт
        </button>

        <button
          onClick={() => setActiveTab("clients")}
          className={`rounded-xl px-2 py-2 text-xs transition sm:px-4 sm:text-sm ${
            activeTab === "clients"
              ? "bg-[#7B61FF] text-white shadow-[0_0_24px_rgba(123,97,255,0.35)]"
              : "text-white/60 hover:text-white"
          }`}
        >
          Клиенты
        </button>
      </div>
    </div>
  );
}
