interface PaymentsPageHeaderProps {
  activeTab: "planned" | "fact";
  setActiveTab: (value: "planned" | "fact") => void;
  onCreateInvoice: () => void;
  onCreatePayment: () => void;
}

export function PaymentsPageHeader({
  activeTab,
  setActiveTab,
  onCreateInvoice,
  onCreatePayment,
}: PaymentsPageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex gap-2 rounded-full bg-white/[0.04] p-1">
        <button
          onClick={() => setActiveTab("planned")}
          className={`rounded-full px-4 py-2 text-sm font-medium transition ${
            activeTab === "planned"
              ? "bg-white text-black"
              : "text-white/60 hover:text-white"
          }`}
        >
          План
        </button>

        <button
          onClick={() => setActiveTab("fact")}
          className={`rounded-full px-4 py-2 text-sm font-medium transition ${
            activeTab === "fact"
              ? "bg-white text-black"
              : "text-white/60 hover:text-white"
          }`}
        >
          Факт
        </button>
      </div>

      <div className="flex gap-2">
        <button
          onClick={onCreateInvoice}
          className="rounded-full border border-violet-400/30 bg-violet-500/10 px-4 py-2 text-sm font-medium text-violet-300 transition hover:bg-violet-500/20"
        >
          Выставить счёт
        </button>

        <button
          onClick={onCreatePayment}
          className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-300 transition hover:bg-emerald-500/20"
        >
          Добавить оплату
        </button>
      </div>
    </div>
  );
}