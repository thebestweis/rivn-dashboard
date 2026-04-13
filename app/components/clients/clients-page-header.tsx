interface ClientsPageHeaderProps {
  search: string;
  setSearch: (value: string) => void;
  status: string;
  setStatus: (value: string) => void;
  onAddClient: () => void;
  canAddClient?: boolean;
}

export function ClientsPageHeader({
  search,
  setSearch,
  status,
  setStatus,
  onAddClient,
  canAddClient = false,
}: ClientsPageHeaderProps) {
  return (
    <div className="rounded-[28px] border border-white/10 bg-[#121826] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.32)]">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="text-sm text-white/50">Раздел</div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Клиенты</h1>
          <p className="mt-2 text-sm text-white/55">
            Управление клиентами, статусами, следующими счетами и прибыльностью.
          </p>
        </div>

        {canAddClient ? (
          <button
            type="button"
            onClick={onAddClient}
            className="rounded-2xl bg-emerald-400/15 px-4 py-3 text-sm font-medium text-emerald-300 shadow-[0_0_24px_rgba(16,185,129,0.18)]"
          >
            Добавить клиента
          </button>
        ) : null}
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-[1.2fr_220px]">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск по клиентам"
          className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none placeholder:text-white/35"
        />

        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-2xl border border-white/10 bg-[#0F1524] px-4 py-3 text-sm text-white outline-none"
        >
          <option value="all">Все статусы</option>
          <option value="active">Активный</option>
          <option value="paused">На паузе</option>
          <option value="problem">Проблемный</option>
          <option value="completed">Завершён</option>
        </select>
      </div>
    </div>
  );
}