"use client";

import { useEffect, useMemo, useRef, useState } from "react";

interface ExpensesPageHeaderProps {
  search: string;
  setSearch: (value: string) => void;
  category: string;
  setCategory: (value: string) => void;
  onAddExpense: () => void;
  canAddExpense?: boolean;
}

const expenseCategoryOptions = [
  { value: "", label: "Все категории" },
  { value: "marketing", label: "Маркетинг" },
  { value: "contractor", label: "Подрядчики" },
  { value: "service", label: "Сервисы" },
  { value: "tax", label: "Налоги" },
  { value: "other", label: "Прочее" },
];

export function ExpensesPageHeader({
  search,
  setSearch,
  category,
  setCategory,
  onAddExpense,
  canAddExpense = false,
}: ExpensesPageHeaderProps) {
  const [isCategoryMenuOpen, setIsCategoryMenuOpen] = useState(false);
  const categoryMenuRef = useRef<HTMLDivElement | null>(null);

  const selectedCategoryLabel = useMemo(() => {
    return (
      expenseCategoryOptions.find((option) => option.value === category)?.label ??
      "Все категории"
    );
  }, [category]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        categoryMenuRef.current &&
        !categoryMenuRef.current.contains(event.target as Node)
      ) {
        setIsCategoryMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  function handleAddExpense() {
    if (!canAddExpense) return;
    onAddExpense();
  }

  return (
    <div className="rounded-[28px] border border-white/10 bg-[#121826] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.32)]">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="text-sm text-white/50">Раздел</div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            Расходы
          </h1>
          <p className="mt-2 text-sm text-white/55">
            Учёт расходов, категорий затрат, маркетинга и влияния на прибыль.
          </p>
        </div>

        {canAddExpense ? (
          <button
            type="button"
            onClick={handleAddExpense}
            disabled={!canAddExpense}
            className="rounded-2xl bg-emerald-400/15 px-4 py-3 text-sm font-medium text-emerald-300 shadow-[0_0_24px_rgba(16,185,129,0.18)] transition hover:bg-emerald-400/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Добавить расход
          </button>
        ) : (
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/55">
            Режим просмотра
          </div>
        )}
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-[1.2fr_220px]">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск по расходам"
          className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none placeholder:text-white/35"
        />

        <div className="relative" ref={categoryMenuRef}>
          <button
            type="button"
            onClick={() => setIsCategoryMenuOpen((prev) => !prev)}
            className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white transition hover:border-white/20 hover:bg-white/[0.06]"
          >
            <span className="truncate">{selectedCategoryLabel}</span>
            <span className="ml-3 text-white/45">
              {isCategoryMenuOpen ? "▴" : "▾"}
            </span>
          </button>

          {isCategoryMenuOpen ? (
            <div className="absolute right-0 top-[calc(100%+8px)] z-30 w-full overflow-hidden rounded-2xl border border-white/10 bg-[#121826] shadow-[0_18px_60px_rgba(0,0,0,0.45)]">
              <div className="max-h-[260px] overflow-y-auto p-2">
                {expenseCategoryOptions.map((option) => {
                  const isActive = category === option.value;

                  return (
                    <button
                      key={option.value || "all"}
                      type="button"
                      onClick={() => {
                        setCategory(option.value);
                        setIsCategoryMenuOpen(false);
                      }}
                      className={`flex w-full items-center rounded-xl px-3 py-2 text-left text-sm transition ${
                        isActive
                          ? "bg-violet-500/20 text-violet-300"
                          : "text-white/75 hover:bg-white/[0.05] hover:text-white"
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}