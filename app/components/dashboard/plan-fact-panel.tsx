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
      tone: "bg-[#99D32A]",
    },
    {
      label: "Прибыль",
      plan: profitPlan,
      fact: profitFact,
      tone: "bg-[#70855C]",
    },
    {
      label: "Расходы",
      plan: expensesPlan,
      fact: expensesFact,
      tone: "bg-[#E87979]",
    },
    {
      label: "ФОТ",
      plan: fotPlan,
      fact: fotFact,
      tone: "bg-[#D8C45E]",
    },
  ];

  const hasPlan =
    revenuePlan > 0 || profitPlan > 0 || expensesPlan > 0 || fotPlan > 0;

  return (
    <div className="relative overflow-hidden rounded-[22px] border border-[#2D342A] bg-[#11130F] p-4 shadow-[0_18px_45px_rgba(0,0,0,0.16)]">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-[#99D32A]/45 via-[#70855C]/20 to-transparent" />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#AEAFB2]/70">{subtitle}</div>
          <h2 className="mt-1 text-lg font-semibold text-[#F4F5F1]">{title}</h2>
        </div>

        <div className="w-fit rounded-full border border-[#2D342A] bg-[#070807] px-3 py-1 text-xs text-[#AEAFB2]">
          {periodLabel}
        </div>
      </div>

            {!hasPlan ? (
        <div className="mt-4 overflow-hidden rounded-2xl border border-[#2D342A] bg-[#070807] p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#99D32A]/25 bg-[#99D32A]/10 text-[#B7EA55]">
              <span className="text-lg font-semibold">+</span>
            </div>

            <div className="flex-1">
              <div className="text-base font-medium text-[#F4F5F1]">
                Пока нет плана на выбранный период
              </div>

              <div className="mt-1 max-w-[520px] text-sm leading-5 text-[#AEAFB2]">
                Когда ты добавишь плановые значения по выручке, прибыли, расходам и ФОТ,
                здесь появится наглядное сравнение плана и факта по месяцу или диапазону месяцев.
              </div>

              <div className="mt-3">
  <Link
    href="/analytics?tab=planfact"
    style={{
      background: "linear-gradient(90deg, #99D32A 0%, #B7EA55 100%)",
    }}
    className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold text-[#070807] transition-all duration-200 ease-out hover:-translate-y-0.5 active:translate-y-[1px]"
  >
    Добавить план
  </Link>
</div>

              <div className="mt-3 flex flex-wrap gap-2">
                <div className="rounded-full border border-[#2D342A] bg-[#11130F] px-3 py-1 text-xs text-[#AEAFB2]">
                  Выручка
                </div>
                <div className="rounded-full border border-[#2D342A] bg-[#11130F] px-3 py-1 text-xs text-[#AEAFB2]">
                  Прибыль
                </div>
                <div className="rounded-full border border-[#2D342A] bg-[#11130F] px-3 py-1 text-xs text-[#AEAFB2]">
                  Расходы
                </div>
                <div className="rounded-full border border-[#2D342A] bg-[#11130F] px-3 py-1 text-xs text-[#AEAFB2]">
                  ФОТ
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-4 grid gap-2.5 md:grid-cols-2">
          {rows.map((row) => {
            const percent = getCompletionPercent(row.plan, row.fact);

            return (
              <div
                key={row.label}
                className="rounded-2xl border border-[#2D342A] bg-[#070807] px-3.5 py-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-[#F4F5F1]">{row.label}</div>
                    <div className="mt-1 text-xs text-[#AEAFB2]/70">
                      План: {formatRubValue(row.plan)}
                    </div>
                    <div className="mt-0.5 text-sm font-medium text-[#CECED0]">
                      Факт: {formatRubValue(row.fact)}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-xs text-[#AEAFB2]/65">Выполнено</div>
                    <div className="mt-0.5 text-lg font-semibold text-[#F4F5F1]">
                      {percent}%
                    </div>
                  </div>
                </div>

                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#2D342A]">
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
