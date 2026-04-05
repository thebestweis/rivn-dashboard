"use client";

import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";

interface IncomeRatioDonutProps {
  ratio: number;
}

export function IncomeRatioDonut({ ratio }: IncomeRatioDonutProps) {
  const safeRatio = Math.max(0, Math.min(100, ratio));

  const data = [
    { name: "Доходность", value: safeRatio },
    { name: "Остальное", value: 100 - safeRatio },
  ];

  return (
    <div className="rounded-[28px] border border-white/10 bg-[#121826] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.32)]">
      <div className="text-sm text-white/50">Income Ratio</div>
      <h2 className="mt-1 text-xl font-semibold">Доля прибыльности</h2>

      <div className="mt-6 flex items-center gap-6">
        <div className="relative h-[220px] w-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                innerRadius={68}
                outerRadius={96}
                startAngle={90}
                endAngle={-270}
                stroke="none"
                paddingAngle={2}
              >
                <Cell fill="#10B981" />
                <Cell fill="rgba(255,255,255,0.08)" />
              </Pie>
            </PieChart>
          </ResponsiveContainer>

          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-4xl font-semibold tracking-tight">{safeRatio}%</div>
            <div className="mt-1 text-sm text-white/45">profit share</div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl bg-white/[0.04] px-4 py-3">
            <div className="text-sm text-white/45">Текущий показатель</div>
            <div className="mt-1 text-lg font-medium text-emerald-300">
              {safeRatio}%
            </div>
          </div>

          <div className="rounded-2xl bg-white/[0.04] px-4 py-3">
            <div className="text-sm text-white/45">Комментарий</div>
            <div className="mt-1 text-sm text-white/75">
              Чем выше доля, тем больше чистой прибыли остаётся после затрат.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}