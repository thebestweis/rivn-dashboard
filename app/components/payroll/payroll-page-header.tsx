interface PayrollPageHeaderProps {
  activeTab: "accruals" | "payouts" | "extra";
  setActiveTab: (value: "accruals" | "payouts" | "extra") => void;
  onAddPayout: () => void;
  onAccrueSalaries: () => void;
  canManagePayroll: boolean;
}

export function PayrollPageHeader({
  activeTab,
  setActiveTab,
  onAddPayout,
  onAccrueSalaries,
  canManagePayroll,
}: PayrollPageHeaderProps) {
  return (
    <div className="rounded-[28px] border border-white/10 bg-[#121826] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.32)]">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="text-sm text-white/50">Раздел</div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            Зарплаты
          </h1>
          <p className="mt-2 text-sm text-white/55">
            Начисления ФОТ, выплаты сотрудникам и контроль внеплановых выплат.
          </p>

          <div className="mt-5 flex w-fit items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-1">
            <button
              type="button"
              onClick={() => setActiveTab("accruals")}
              className={`rounded-xl px-4 py-2 text-sm transition ${
                activeTab === "accruals"
                  ? "bg-[#7B61FF] text-white shadow-[0_0_24px_rgba(123,97,255,0.35)]"
                  : "text-white/60 hover:text-white"
              }`}
            >
              Начисления
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("payouts")}
              className={`rounded-xl px-4 py-2 text-sm transition ${
                activeTab === "payouts"
                  ? "bg-[#7B61FF] text-white shadow-[0_0_24px_rgba(123,97,255,0.35)]"
                  : "text-white/60 hover:text-white"
              }`}
            >
              Выплаты
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("extra")}
              className={`rounded-xl px-4 py-2 text-sm transition ${
                activeTab === "extra"
                  ? "bg-[#7B61FF] text-white shadow-[0_0_24px_rgba(123,97,255,0.35)]"
                  : "text-white/60 hover:text-white"
              }`}
            >
              Внеплановые
            </button>
          </div>
        </div>

        {canManagePayroll ? (
          <div className="flex flex-col items-stretch gap-3 xl:min-w-[220px]">
            <button
              type="button"
              onClick={onAccrueSalaries}
              className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-medium text-white/80 transition hover:bg-white/[0.06] hover:text-white"
            >
              Начислить оклады
            </button>

            <button
              type="button"
              onClick={onAddPayout}
              className="rounded-2xl bg-emerald-400/15 px-4 py-3 text-sm font-medium text-emerald-300 shadow-[0_0_24px_rgba(16,185,129,0.18)] transition hover:bg-emerald-400/20"
            >
              Добавить выплату
            </button>
          </div>
        ) : (
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/55">
            Режим просмотра
          </div>
        )}
      </div>
    </div>
  );
}