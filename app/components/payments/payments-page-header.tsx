interface PaymentsPageHeaderProps {
  setActiveTab: (value: "planned" | "fact") => void;
  onCreateInvoice: () => void;
  onCreatePayment: () => void;
  onOpenNotifications?: () => void;
}

export function PaymentsPageHeader({
  activeTab,
  setActiveTab,
  onCreateInvoice,
  onCreatePayment,
  onOpenNotifications,
}: PaymentsPageHeaderProps) {
  return (
    <div className="rounded-[28px] border border-white/10 bg-[#121826] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.32)]">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="text-sm text-white/50">Раздел</div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            Платежи
          </h1>
          <p className="mt-2 text-sm text-white/55">
            Контроль счетов, ожидаемых поступлений, фактических оплат и просрочек.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onOpenNotifications}
            className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/80 transition hover:bg-white/[0.06] hover:text-white"
          >
            Уведомления
          </button>

          <button
            type="button"
            onClick={onCreateInvoice}
            className="rounded-2xl border border-violet-500/20 bg-violet-500/10 px-4 py-3 text-sm font-medium text-violet-300 transition hover:bg-violet-500/15"
          >
            Выставить счёт
          </button>

          <button
            type="button"
            onClick={onCreatePayment}
            className="rounded-2xl bg-emerald-400/15 px-4 py-3 text-sm font-medium text-emerald-300 shadow-[0_0_24px_rgba(16,185,129,0.18)] transition hover:bg-emerald-400/20"
          >
            Добавить оплату
          </button>
        </div>
      </div>

      <div className="mt-5">
        <input
          placeholder="Поиск по клиентам, оплатам, счетам"
          className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none placeholder:text-white/35"
        />
      </div>

    </div>
  );
}