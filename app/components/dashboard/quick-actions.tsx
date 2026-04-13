"use client";

import { useRouter } from "next/navigation";

type QuickActionItem = {
  label: string;
  tone: "emerald" | "violet" | "rose" | "amber";
  href?: string;
};

interface QuickActionsProps {
  actions: QuickActionItem[];
}

export function QuickActions({ actions }: QuickActionsProps) {
  const router = useRouter();

  function getToneClasses(tone: QuickActionItem["tone"], isDisabled: boolean) {
    if (isDisabled) {
      return "cursor-not-allowed bg-white/[0.04] text-white/35";
    }

    if (tone === "emerald") {
      return "bg-emerald-400/15 text-emerald-300 hover:bg-emerald-400/20";
    }

    if (tone === "violet") {
      return "bg-violet-400/15 text-violet-300 hover:bg-violet-400/20";
    }

    if (tone === "rose") {
      return "bg-rose-400/15 text-rose-300 hover:bg-rose-400/20";
    }

    return "bg-amber-400/15 text-amber-300 hover:bg-amber-400/20";
  }

  return (
    <div className="rounded-[28px] border border-white/10 bg-[#121826] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.32)]">
      <div className="text-sm text-white/50">Быстрые действия</div>

      <div className="mt-4 grid gap-3">
        {actions.length > 0 ? (
          actions.map((action) => {
            const isDisabled = !action.href;

            return (
              <button
                key={action.label}
                type="button"
                disabled={isDisabled}
                onClick={() => {
                  if (action.href) {
                    router.push(action.href);
                  }
                }}
                className={`rounded-2xl px-4 py-3 text-left text-sm font-medium transition ${getToneClasses(
                  action.tone,
                  isDisabled
                )}`}
              >
                {action.label}
              </button>
            );
          })
        ) : (
          <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-6 text-sm text-white/35">
            Быстрые действия сейчас недоступны.
          </div>
        )}
      </div>
    </div>
  );
}