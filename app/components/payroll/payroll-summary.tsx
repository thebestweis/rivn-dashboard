interface PayrollSummaryProps {
  totalAccrued: string;
  totalPaid: string;
  totalExtra: string;
}

export function PayrollSummary({
  totalAccrued,
  totalPaid,
  totalExtra,
}: PayrollSummaryProps) {
  const cards = [
    { label: "Начислено", value: totalAccrued, tone: "text-violet-300" },
    { label: "Выплачено", value: totalPaid, tone: "text-emerald-300" },
    { label: "Внеплановые", value: totalExtra, tone: "text-amber-300" },
  ];

  return (
    <section className="grid gap-4 md:grid-cols-3">
      {cards.map((item) => (
        <div
          key={item.label}
          className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.28)]"
        >
          <div className="text-sm text-white/55">{item.label}</div>
          <div className={`mt-3 text-2xl font-semibold tracking-tight ${item.tone}`}>
            {item.value}
          </div>
        </div>
      ))}
    </section>
  );
}