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
    <div className="rivn-panel p-4 sm:p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <div className="text-sm text-white/50">Раздел</div>
          <h1 className="text-2xl font-semibold sm:text-3xl">Аналитика</h1>
          <p className="mt-2 text-sm text-white/55">
            Финансовая аналитика, план / факт, клиенты, команда и управленческие сигналы.
          </p>
        </div>
        <div className="grid w-full grid-cols-3 gap-2 rounded-[20px] border border-white/10 bg-black/15 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] sm:flex sm:w-fit sm:flex-wrap sm:items-center">
        <button
          onClick={() => setActiveTab("financial")}
          className={`rounded-xl px-2 py-2 text-xs transition sm:px-4 sm:text-sm ${
            activeTab === "financial"
              ? "bg-[#00f5a8] text-[#06101d] shadow-[0_16px_36px_rgba(0,245,168,0.2)]"
              : "text-white/60 hover:bg-white/[0.06] hover:text-white"
          }`}
        >
          Финансы
        </button>

        <button
          onClick={() => setActiveTab("planfact")}
          className={`rounded-xl px-2 py-2 text-xs transition sm:px-4 sm:text-sm ${
            activeTab === "planfact"
              ? "bg-[#00f5a8] text-[#06101d] shadow-[0_16px_36px_rgba(0,245,168,0.2)]"
              : "text-white/60 hover:bg-white/[0.06] hover:text-white"
          }`}
        >
          План / Факт
        </button>

        <button
          onClick={() => setActiveTab("clients")}
          className={`rounded-xl px-2 py-2 text-xs transition sm:px-4 sm:text-sm ${
            activeTab === "clients"
              ? "bg-[#00f5a8] text-[#06101d] shadow-[0_16px_36px_rgba(0,245,168,0.2)]"
              : "text-white/60 hover:bg-white/[0.06] hover:text-white"
          }`}
        >
          Клиенты
        </button>
        </div>
      </div>
    </div>
  );
}
