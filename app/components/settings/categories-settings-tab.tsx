const categories = [
  { id: "1", name: "marketing", type: "system" },
  { id: "2", name: "contractor", type: "system" },
  { id: "3", name: "service", type: "system" },
  { id: "4", name: "tax", type: "system" },
  { id: "5", name: "other", type: "custom" },
];

export function CategoriesSettingsTab() {
  return (
    <div className="rivn-card rivn-card-interactive p-5 sm:p-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-[#43ffc2]">Expense categories</div>
          <h2 className="mt-2 text-2xl font-medium tracking-[-0.04em]">Категории расходов</h2>
        </div>

        <button className="rivn-button px-4 py-2 text-sm">
          Добавить категорию
        </button>
      </div>

      <div className="rivn-table-wrap mt-5">
        <table className="w-full text-left text-sm">
          <thead className="rivn-table-head">
            <tr>
              <th className="px-4 py-3 font-medium">Категория</th>
              <th className="px-4 py-3 font-medium">Тип</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((item) => (
              <tr
                key={item.id}
                className="rivn-table-row bg-transparent"
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
