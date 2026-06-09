"use client";

import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";

interface IncomeRatioDonutProps {
  ratio: number;
}

export function IncomeRatioDonut({ ratio }: IncomeRatioDonutProps) {
  const safeRatio = Math.max(0, Math.min(100, ratio));

  const data = [
    { name: "Маржа", value: safeRatio },
    { name: "Остальное", value: 100 - safeRatio },
  ];

  return (
    <div className="relative overflow-hidden rounded-[22px] border border-[#2D342A] bg-[#11130F] p-4 shadow-[0_18px_45px_rgba(0,0,0,0.16)]">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-[#99D32A]/45 via-[#70855C]/20 to-transparent" />
      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#AEAFB2]/70">Рентабельность</div>
      <h2 className="mt-1 text-lg font-semibold text-[#F4F5F1]">Доля прибыли</h2>

      <div className="mt-3 flex flex-col items-center gap-3 sm:flex-row sm:gap-4">
        <div className="relative h-[160px] min-w-[160px] w-[160px] sm:h-[172px] sm:min-w-[172px] sm:w-[172px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                innerRadius={56}
                outerRadius={78}
                startAngle={90}
                endAngle={-270}
                stroke="none"
                paddingAngle={2}
              >
                <Cell fill="#99D32A" />
                <Cell fill="#2D342A" />
              </Pie>
            </PieChart>
          </ResponsiveContainer>

          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-3xl font-semibold tracking-tight text-[#F4F5F1]">
              {safeRatio}%
            </div>
          </div>
        </div>

        <div className="w-full space-y-2.5 sm:w-auto">
          <div className="rounded-xl border border-[#2D342A] bg-[#070807] px-3.5 py-2.5">
            <div className="text-xs text-[#AEAFB2]/70">Текущий показатель</div>
            <div className="mt-1 text-lg font-medium text-[#99D32A]">
              {safeRatio}%
            </div>
          </div>

          <div className="rounded-xl border border-[#2D342A] bg-[#070807] px-3.5 py-2.5">
            <div className="text-xs text-[#AEAFB2]/70">Смысл</div>
            <div className="mt-1 text-sm leading-5 text-[#AEAFB2]">
              Чем выше процент, тем больше чистой прибыли остаётся после всех
              затрат.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
