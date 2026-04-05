export function SystemSettingsTab() {
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <div className="rounded-[28px] border border-white/10 bg-[#121826] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.32)]">
        <div className="text-sm text-white/50">System params</div>
        <h2 className="mt-1 text-xl font-semibold">Системные параметры</h2>

        <div className="mt-5 space-y-4">
          <div className="rounded-2xl bg-white/[0.04] p-4">
            <div className="text-sm text-white/50">Налог</div>
            <div className="mt-1 text-lg font-medium text-white">7%</div>
          </div>

          <div className="rounded-2xl bg-white/[0.04] p-4">
            <div className="text-sm text-white/50">Дата выплаты ЗП</div>
            <div className="mt-1 text-lg font-medium text-white">1 число месяца</div>
          </div>

          <div className="rounded-2xl bg-white/[0.04] p-4">
            <div className="text-sm text-white/50">Основной период аналитики</div>
            <div className="mt-1 text-lg font-medium text-white">Неделя</div>
          </div>
        </div>
      </div>

      <div className="rounded-[28px] border border-white/10 bg-[#121826] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.32)]">
        <div className="text-sm text-white/50">Health</div>
        <h2 className="mt-1 text-xl font-semibold">Статус системы</h2>

        <div className="mt-5 space-y-3">
          {[
            "UI shell — ok",
            "Clients module — ok",
            "Payments module — ok",
            "Expenses module — ok",
            "Payroll module — ok",
            "Analytics module — ok",
          ].map((item) => (
            <div
              key={item}
              className="rounded-2xl bg-white/[0.04] px-4 py-3 text-sm text-white/80"
            >
              {item}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}