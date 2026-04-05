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
    <div className="rounded-[28px] border border-white/10 bg-[#121826] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.32)]">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="text-sm text-white/50">Раздел</div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Analytics</h1>
          <p className="mt-2 text-sm text-white/55">
            Финансовая аналитика, план / факт, клиенты, команда и управленческие сигналы.
          </p>
        </div>
      </div>

      <div className="mt-5 flex w-fit flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-1">
        <button
          onClick={() => setActiveTab("financial")}
          className={`rounded-xl px-4 py-2 text-sm transition ${
            activeTab === "financial"
              ? "bg-[#7B61FF] text-white shadow-[0_0_24px_rgba(123,97,255,0.35)]"
              : "text-white/60 hover:text-white"
          }`}
        >
          Финансы
        </button>

        <button
          onClick={() => setActiveTab("planfact")}
          className={`rounded-xl px-4 py-2 text-sm transition ${
            activeTab === "planfact"
              ? "bg-[#7B61FF] text-white shadow-[0_0_24px_rgba(123,97,255,0.35)]"
              : "text-white/60 hover:text-white"
          }`}
        >
          Plan / Fact
        </button>

        <button
          onClick={() => setActiveTab("clients")}
          className={`rounded-xl px-4 py-2 text-sm transition ${
            activeTab === "clients"
              ? "bg-[#7B61FF] text-white shadow-[0_0_24px_rgba(123,97,255,0.35)]"
              : "text-white/60 hover:text-white"
          }`}
        >
          Clients
        </button>

        <button
          onClick={() => setActiveTab("team")}
          className={`rounded-xl px-4 py-2 text-sm transition ${
            activeTab === "team"
              ? "bg-[#7B61FF] text-white shadow-[0_0_24px_rgba(123,97,255,0.35)]"
              : "text-white/60 hover:text-white"
          }`}
        >
          Team
        </button>
      </div>
    </div>
  );
}