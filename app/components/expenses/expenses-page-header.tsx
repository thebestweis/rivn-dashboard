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
    <div className="rivn-card rivn-card-interactive p-4 sm:p-5">
      <div className="grid gap-3 xl:grid-cols-[minmax(220px,0.9fr)_minmax(260px,1.15fr)_220px_auto] xl:items-end">
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-[0.22em] text-[#43ffc2]">Финансы</div>
          <h1 className="mt-1 text-3xl font-medium tracking-[-0.05em] text-white sm:text-4xl">
            Расходы
          </h1>
        </div>

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск по расходам"
          className="rivn-field h-12"
        />

        <div className="relative" ref={categoryMenuRef}>
          <button
            type="button"
            onClick={() => setIsCategoryMenuOpen((prev) => !prev)}
            className="rivn-field flex h-12 w-full items-center justify-between"
          >
            <span className="truncate">{selectedCategoryLabel}</span>
            <span className="ml-3 text-white/45">
              {isCategoryMenuOpen ? "▴" : "▾"}
            </span>
          </button>

          {isCategoryMenuOpen ? (
            <div className="absolute right-0 top-[calc(100%+8px)] z-30 w-full overflow-hidden rounded-2xl border border-white/10 bg-[#0b1424] shadow-[0_20px_70px_rgba(0,0,0,0.55)]">
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
                          ? "bg-[#00f5a8] text-[#06101d]"
                          : "text-white/75 hover:bg-white/[0.06] hover:text-white"
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

        {canAddExpense ? (
          <button
            type="button"
            onClick={handleAddExpense}
            disabled={!canAddExpense}
            className="rivn-button rivn-button-primary w-full px-4 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            Добавить расход
          </button>
        ) : (
          <div className="rivn-pill px-4 py-3 text-sm text-white/55">
            Режим просмотра
          </div>
        )}
      </div>
    </div>
  );
}
