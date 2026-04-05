interface QuickActionItem {
  label: string;
  tone: "violet" | "emerald" | "rose" | "amber";
}

interface QuickActionsProps {
  actions: QuickActionItem[];
}

export function QuickActions({ actions }: QuickActionsProps) {
  const toneMap = {
    violet:
      "bg-[#7B61FF]/15 text-violet-200 shadow-[0_0_24px_rgba(123,97,255,0.16)] hover:bg-[#7B61FF]/20",
    emerald: "bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/15",
    rose: "bg-rose-500/10 text-rose-200 hover:bg-rose-500/15",
    amber: "bg-amber-500/10 text-amber-200 hover:bg-amber-500/15",
  };

  return (
    <div className="rounded-[28px] border border-white/10 bg-[#121826] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.32)]">
      <div className="text-sm text-white/50">Быстрые действия</div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        {actions.map((action) => (
          <button
            key={action.label}
            className={`rounded-2xl px-4 py-4 text-left text-sm font-medium transition ${toneMap[action.tone]}`}
          >
            {action.label}
          </button>
        ))}
      </div>
    </div>
  );
}