interface ExpensesPageHeaderProps {
  search: string;
  setSearch: (value: string) => void;
  category: string;
  setCategory: (value: string) => void;
  onAddExpense: () => void;
}

export function ExpensesPageHeader({
  search,
  setSearch,
  category,
  setCategory,
  onAddExpense,
}: ExpensesPageHeaderProps) {
  return (
    <div className="rounded-[28px] border border-white/10 bg-[#121826] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.32)]">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="text-sm text-white/50">Раздел</div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Expenses</h1>
          <p className="mt-2 text-sm text-white/55">
            Учёт расходов, категорий затрат, маркетинга и влияния на прибыль.
          </p>
        </div>

        <button
  onClick={onAddExpense}
  className="rounded-2xl bg-emerald-400/15 px-4 py-3 text-sm font-medium text-emerald-300 shadow-[0_0_24px_rgba(16,185,129,0.18)]"
>
  Добавить расход
</button>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-[1.2fr_220px]">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск по расходам"
          className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none placeholder:text-white/35"
        />

        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded-2xl border border-white/10 bg-[#0F1524] px-4 py-3 text-sm text-white outline-none"
        >
          <option value="all">Все категории</option>
          <option value="marketing">marketing</option>
          <option value="contractor">contractor</option>
          <option value="service">service</option>
          <option value="tax">tax</option>
          <option value="other">other</option>
        </select>
      </div>
    </div>
  );
}