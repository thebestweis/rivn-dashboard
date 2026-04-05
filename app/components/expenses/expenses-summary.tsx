interface ExpensesSummaryProps {
  total: string;
  marketing: string;
  operations: string;
}

export function ExpensesSummary({
  total,
  marketing,
  operations,
}: ExpensesSummaryProps) {
  const cards = [
    { label: "Общие расходы", value: total, tone: "text-rose-300" },
    { label: "Маркетинг", value: marketing, tone: "text-violet-300" },
    { label: "Операционные", value: operations, tone: "text-amber-300" },
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