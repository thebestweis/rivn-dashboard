interface PaymentsPageHeaderProps {
  activeTab: "planned" | "fact";
  setActiveTab: (value: "planned" | "fact") => void;
  onCreatePayment: () => void;
  canManage?: boolean;
}

export function PaymentsPageHeader({
  activeTab,
  setActiveTab,
  onCreatePayment,
  canManage = false,
}: PaymentsPageHeaderProps) {
  return (
    <div className="rivn-card rivn-card-interactive p-3.5 sm:p-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="h-9 w-1 rounded-full bg-[#00f5a8] shadow-[0_0_24px_rgba(0,245,168,0.4)]" />
          <h1 className="text-2xl font-medium tracking-[-0.05em] text-white sm:text-3xl">
            Платежи
          </h1>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="grid w-full grid-cols-2 gap-1 rounded-[22px] border border-white/10 bg-white/[0.04] p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] sm:w-fit">
            <button
              type="button"
              onClick={() => setActiveTab("planned")}
              className={`rounded-2xl px-3 py-2.5 text-sm font-medium transition duration-300 ease-out active:scale-[0.985] sm:px-4 ${
                activeTab === "planned"
                  ? "bg-[#00f5a8] text-[#06101d] shadow-[0_18px_42px_rgba(0,245,168,0.20),inset_0_1px_0_rgba(255,255,255,0.42)]"
                  : "text-white/58 hover:-translate-y-0.5 hover:bg-white/[0.07] hover:text-white"
              }`}
            >
              Плановые
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("fact")}
              className={`rounded-2xl px-3 py-2.5 text-sm font-medium transition duration-300 ease-out active:scale-[0.985] sm:px-4 ${
                activeTab === "fact"
                  ? "bg-[#00f5a8] text-[#06101d] shadow-[0_18px_42px_rgba(0,245,168,0.20),inset_0_1px_0_rgba(255,255,255,0.42)]"
                  : "text-white/58 hover:-translate-y-0.5 hover:bg-white/[0.07] hover:text-white"
              }`}
            >
              Оплаченные
            </button>
          </div>

          {canManage ? (
            <button
              type="button"
              onClick={onCreatePayment}
              className="rivn-button rivn-button-primary px-4 py-3 text-sm font-semibold"
            >
              Добавить оплату
            </button>
          ) : (
            <div className="rivn-pill px-4 py-3 text-sm text-white/45">
              Только просмотр
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
