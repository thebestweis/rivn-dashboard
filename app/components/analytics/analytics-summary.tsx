interface AnalyticsSummaryProps {
  revenue: string;
  profit: string;
  expenses: string;
  fot: string;
}

export function AnalyticsSummary({
  revenue,
  profit,
  expenses,
  fot,
}: AnalyticsSummaryProps) {
  const cards = [
    { label: "Выручка", value: revenue, tone: "text-violet-300" },
    { label: "Прибыль", value: profit, tone: "text-emerald-300" },
    { label: "Расходы", value: expenses, tone: "text-rose-300" },
    { label: "ФОТ", value: fot, tone: "text-amber-300" },
  ];

  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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
