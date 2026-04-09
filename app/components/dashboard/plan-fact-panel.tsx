import Link from "next/link";

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
        <div className="mt-5 overflow-hidden rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-5">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-violet-400/20 bg-violet-400/10 text-violet-300 shadow-[0_0_24px_rgba(139,92,246,0.14)]">
              <span className="text-lg font-semibold">+</span>
            </div>

            <div className="flex-1">
              <div className="text-base font-medium text-white">
                Пока нет плана на выбранный период
              </div>

              <div className="mt-2 max-w-[520px] text-sm leading-6 text-white/55">
                Когда ты добавишь плановые значения по выручке, прибыли, расходам и ФОТ,
                здесь появится наглядное сравнение плана и факта по месяцу или диапазону месяцев.
              </div>

              <div className="mt-4">
  <Link
    href="/analytics?tab=planfact"
    style={{
      background: "linear-gradient(90deg, #6F5AFF 0%, #8B7BFF 100%)",
    }}
    className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium text-white shadow-[0_10px_30px_rgba(111,90,255,0.35)] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_16px_40px_rgba(111,90,255,0.42)] active:translate-y-[1px] active:shadow-[0_8px_20px_rgba(111,90,255,0.26)]"
  >
    Добавить план
  </Link>
</div>

              <div className="mt-4 flex flex-wrap gap-2">
                <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-white/60">
                  Выручка
                </div>
                <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-white/60">
                  Прибыль
                </div>
                <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-white/60">
                  Расходы
                </div>
                <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-white/60">
                  ФОТ
                </div>
              </div>
            </div>
          </div>
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