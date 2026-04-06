interface PlanFactPanelProps {
  title?: string;
  subtitle?: string;
  periodLabel: string;
  revenuePlan: number;
  revenueFact: number;
  profitPlan: number;
  profitFact: number;
  expensesPlan: number;
  expensesFact: number;
  fotPlan: number;
  fotFact: number;
}

function formatRubValue(value: number) {
  return new Intl.NumberFormat("ru-RU").format(Math.round(value)) + " ₽";
}

function getCompletionPercent(plan: number, fact: number) {
  if (plan <= 0) return 0;
  return Math.max(0, Math.min(999, Math.round((fact / plan) * 100)));
}

export function PlanFactPanel({
  title = "Выполнение целей",
  subtitle = "План / факт",
  periodLabel,
  revenuePlan,
  revenueFact,
  profitPlan,
  profitFact,
  expensesPlan,
  expensesFact,
  fotPlan,
  fotFact,
}: PlanFactPanelProps) {
  const rows = [
    {
      label: "Выручка",
      plan: revenuePlan,
      fact: revenueFact,
      tone: "bg-violet-400",
    },
    {
      label: "Прибыль",
      plan: profitPlan,
      fact: profitFact,
      tone: "bg-emerald-400",
    },
    {
      label: "Расходы",
      plan: expensesPlan,
      fact: expensesFact,
      tone: "bg-rose-400",
    },
    {
      label: "ФОТ",
      plan: fotPlan,
      fact: fotFact,
      tone: "bg-amber-400",
    },
  ];

  const hasPlan =
    revenuePlan > 0 || profitPlan > 0 || expensesPlan > 0 || fotPlan > 0;

  return (
    <div className="rounded-[28px] border border-white/10 bg-[#121826] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.32)]">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-sm text-white/50">{subtitle}</div>
          <h2 className="mt-1 text-xl font-semibold">{title}</h2>
        </div>

        <div className="rounded-full bg-white/[0.04] px-3 py-1 text-xs text-white/60">
          {periodLabel}
        </div>
      </div>

      {!hasPlan ? (
        <div className="mt-5 rounded-[24px] border border-white/10 bg-white/[0.03] p-5 text-sm text-white/55">
          Для выбранного периода пока нет плановых значений.
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          {rows.map((row) => {
            const percent = getCompletionPercent(row.plan, row.fact);

            return (
              <div
                key={row.label}
                className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4"
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm text-white/50">{row.label}</div>
                    <div className="mt-1 text-sm text-white/75">
                      План: {formatRubValue(row.plan)}
                    </div>
                    <div className="mt-1 text-sm font-medium text-white">
                      Факт: {formatRubValue(row.fact)}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-sm text-white/50">Выполнение</div>
                    <div className="mt-1 text-lg font-semibold text-white">
                      {percent}%
                    </div>
                  </div>
                </div>

                <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
                  <div
                    className={`h-full rounded-full ${row.tone}`}
                    style={{ width: `${Math.min(percent, 100)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}