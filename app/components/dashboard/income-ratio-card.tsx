interface IncomeRatioCardProps {
  ratio: string;
}

export function IncomeRatioCard({ ratio }: IncomeRatioCardProps) {
  return (
    <div className="rounded-[28px] border border-white/10 bg-[#121826] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.32)]">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-white/50">Распределение</div>
          <h2 className="mt-1 text-xl font-semibold">Доходы / расходы</h2>
        </div>
        <div className="text-sm text-white/50">{ratio}</div>
      </div>

      <div className="mt-6 flex items-center justify-center">
        <div className="relative h-56 w-56 rounded-full bg-[conic-gradient(from_180deg,#7B61FF_0deg,#7B61FF_210deg,#FF4D4F_210deg,#FF4D4F_300deg,#FFD93D_300deg,#FFD93D_360deg)] p-4 shadow-[0_0_40px_rgba(123,97,255,0.12)]">
          <div className="flex h-full w-full items-center justify-center rounded-full bg-[#121826] text-center">
            <div>
              <div className="text-4xl font-semibold">{ratio}</div>
              <div className="mt-1 text-sm text-white/45">Income ratio</div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-3 text-sm">
        <div className="rounded-2xl bg-violet-500/10 p-3 text-violet-200">Выручка</div>
        <div className="rounded-2xl bg-rose-500/10 p-3 text-rose-200">Расходы</div>
        <div className="rounded-2xl bg-amber-500/10 p-3 text-amber-200">ФОТ</div>
      </div>
    </div>
  );
}