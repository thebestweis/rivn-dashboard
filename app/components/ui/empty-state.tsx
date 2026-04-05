interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <div className="rounded-[28px] border border-dashed border-white/10 bg-[#121826] p-10 text-center shadow-[0_10px_40px_rgba(0,0,0,0.22)]">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.04] text-xl text-white/50">
        ∅
      </div>

      <h3 className="mt-4 text-xl font-semibold tracking-tight">{title}</h3>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-white/50">
        {description}
      </p>

      {actionLabel && onAction ? (
        <button
          onClick={onAction}
          className="mt-6 rounded-2xl bg-emerald-400/15 px-4 py-3 text-sm font-medium text-emerald-300 shadow-[0_0_24px_rgba(16,185,129,0.18)]"
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}