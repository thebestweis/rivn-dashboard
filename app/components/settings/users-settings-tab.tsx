const users = [
  { id: "1", name: "WEIS", email: "weis@rivn.local", status: "active" },
  { id: "2", name: "Manager", email: "manager@rivn.local", status: "active" },
];

export function UsersSettingsTab() {
  return (
    <div className="rounded-[28px] border border-white/10 bg-[#121826] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.32)]">
      <div className="text-sm text-white/50">Users</div>
      <h2 className="mt-1 text-xl font-semibold">Пользователи</h2>

      <div className="mt-5 overflow-hidden rounded-[24px] border border-white/8">
        <table className="w-full text-left text-sm">
          <thead className="bg-white/[0.04] text-white/45">
            <tr>
              <th className="px-4 py-3 font-medium">Имя</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Статус</th>
            </tr>
          </thead>
          <tbody>
            {users.map((item) => (
              <tr
                key={item.id}
                className="border-t border-white/6 bg-transparent transition hover:bg-white/[0.03]"
              >
                <td className="px-4 py-3 font-medium">{item.name}</td>
                <td className="px-4 py-3 text-white/75">{item.email}</td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs text-emerald-300">
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