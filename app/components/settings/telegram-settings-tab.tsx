export function TelegramSettingsTab() {
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <div className="rounded-[28px] border border-white/10 bg-[#121826] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.32)]">
        <div className="text-sm text-white/50">Telegram bot</div>
        <h2 className="mt-1 text-xl font-semibold">Интеграция Telegram</h2>

        <div className="mt-5 space-y-4">
          <div className="rounded-2xl bg-white/[0.04] p-4">
            <div className="text-sm text-white/50">Bot token</div>
            <div className="mt-1 text-sm text-white/75">••••••••••••••••••••••</div>
          </div>

          <div className="rounded-2xl bg-white/[0.04] p-4">
            <div className="text-sm text-white/50">Chat ID</div>
            <div className="mt-1 text-sm text-white/75">Не подключен</div>
          </div>
        </div>
      </div>

      <div className="rounded-[28px] border border-white/10 bg-[#121826] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.32)]">
        <div className="text-sm text-white/50">Notifications</div>
        <h2 className="mt-1 text-xl font-semibold">Типы уведомлений</h2>

        <div className="mt-5 space-y-3">
          {[
            "Сегодня выставить счёт",
            "Оплата просрочена",
            "День выплаты ЗП",
            "Рост расходов",
            "Падение прибыли",
          ].map((item) => (
            <div
              key={item}
              className="flex items-center justify-between rounded-2xl bg-white/[0.04] px-4 py-3"
            >
              <span className="text-sm text-white/80">{item}</span>
              <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs text-emerald-300">
                on
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}