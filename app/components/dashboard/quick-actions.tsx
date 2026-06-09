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
      return "cursor-not-allowed border-[#2D342A] bg-[#0A0B09] text-[#AEAFB2]/35";
    }

    if (tone === "emerald") {
      return "border-[#99D32A]/25 bg-[#99D32A]/10 text-[#B7EA55] hover:bg-[#99D32A]/14";
    }

    if (tone === "violet") {
      return "border-[#70855C]/28 bg-[#70855C]/12 text-[#CECED0] hover:bg-[#70855C]/16";
    }

    if (tone === "rose") {
      return "border-[#E87979]/25 bg-[#E87979]/10 text-[#F39B9B] hover:bg-[#E87979]/14";
    }

    return "border-[#D8C45E]/25 bg-[#D8C45E]/10 text-[#E3D47C] hover:bg-[#D8C45E]/14";
  }

  return (
    <div className="relative overflow-hidden rounded-[22px] border border-[#2D342A] bg-[#11130F] p-4 shadow-[0_18px_45px_rgba(0,0,0,0.16)]">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-[#99D32A]/45 via-[#70855C]/20 to-transparent" />
      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#AEAFB2]/70">Быстрые действия</div>

      <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-1">
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
                className={`min-h-[46px] rounded-[14px] border px-3.5 py-2.5 text-left text-sm font-medium transition ${getToneClasses(
                  action.tone,
                  isDisabled
                )}`}
              >
                {action.label}
              </button>
            );
          })
        ) : (
          <div className="rounded-2xl border border-dashed border-[#2D342A] bg-[#0A0B09] px-4 py-6 text-sm text-[#AEAFB2]/45">
            Быстрые действия сейчас недоступны.
          </div>
        )}
      </div>
    </div>
  );
}
