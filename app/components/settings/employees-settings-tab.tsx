const employees = [
  { id: "1", name: "Дмитрий", payout: "₽5,000", status: "active" },
  { id: "2", name: "Антон", payout: "₽5,000", status: "active" },
  { id: "3", name: "Иван", payout: "₽5,000", status: "paused" },
];

export function EmployeesSettingsTab() {
  return (
    <div className="rounded-[28px] border border-white/10 bg-[#121826] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.32)]">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-white/50">Employees</div>
          <h2 className="mt-1 text-xl font-semibold">Сотрудники</h2>
        </div>

        <button className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white/80">
          Добавить сотрудника
        </button>
      </div>

      <div className="mt-5 overflow-hidden rounded-[24px] border border-white/8">
        <table className="w-full text-left text-sm">
          <thead className="bg-white/[0.04] text-white/45">
            <tr>
              <th className="px-4 py-3 font-medium">Имя</th>
              <th className="px-4 py-3 font-medium">Ставка</th>
              <th className="px-4 py-3 font-medium">Статус</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((item) => (
              <tr
                key={item.id}
                className="border-t border-white/6 bg-transparent transition hover:bg-white/[0.03]"
              >
                <td className="px-4 py-3 font-medium">{item.name}</td>
                <td className="px-4 py-3 text-white/75">{item.payout}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-3 py-1 text-xs ${
                      item.status === "active"
                        ? "bg-emerald-500/15 text-emerald-300"
                        : "bg-amber-500/15 text-amber-300"
                    }`}
                  >
                    {item.status}
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