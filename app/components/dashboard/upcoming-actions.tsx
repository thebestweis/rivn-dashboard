interface UpcomingActionItem {
  date: string;
  title: string;
  value: string;
}

interface UpcomingActionsProps {
  items: UpcomingActionItem[];
}

export function UpcomingActions({ items }: UpcomingActionsProps) {
  return (
    <div className="rounded-[28px] border border-white/10 bg-[#121826] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.32)]">
      <div className="text-sm text-white/50">Ближайшие действия</div>

      <div className="mt-4 space-y-3">
        {items.map((item) => (
          <div
            key={`${item.date}-${item.title}`}
            className="flex items-center justify-between rounded-2xl bg-white/[0.04] px-4 py-3"
          >
            <div>
              <div className="text-sm text-white/45">{item.date}</div>
              <div className="mt-1 font-medium">{item.title}</div>
            </div>

            <div className="text-sm font-medium text-white/75">{item.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}