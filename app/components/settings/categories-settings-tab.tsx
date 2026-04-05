const categories = [
  { id: "1", name: "marketing", type: "system" },
  { id: "2", name: "contractor", type: "system" },
  { id: "3", name: "service", type: "system" },
  { id: "4", name: "tax", type: "system" },
  { id: "5", name: "other", type: "custom" },
];

export function CategoriesSettingsTab() {
  return (
    <div className="rounded-[28px] border border-white/10 bg-[#121826] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.32)]">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-white/50">Expense categories</div>
          <h2 className="mt-1 text-xl font-semibold">Категории расходов</h2>
        </div>

        <button className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white/80">
          Добавить категорию
        </button>
      </div>

      <div className="mt-5 overflow-hidden rounded-[24px] border border-white/8">
        <table className="w-full text-left text-sm">
          <thead className="bg-white/[0.04] text-white/45">
            <tr>
              <th className="px-4 py-3 font-medium">Категория</th>
              <th className="px-4 py-3 font-medium">Тип</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((item) => (
              <tr
                key={item.id}
                className="border-t border-white/6 bg-transparent transition hover:bg-white/[0.03]"
              >
                <td className="px-4 py-3 font-medium">{item.name}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-3 py-1 text-xs ${
                      item.type === "system"
                        ? "bg-violet-500/15 text-violet-300"
                        : "bg-white/10 text-white/70"
                    }`}
                  >
                    {item.type}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}