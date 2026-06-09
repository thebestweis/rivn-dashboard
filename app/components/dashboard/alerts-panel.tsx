"use client";

import Link from "next/link";

type AlertItem = {
  title: string;
  desc: string;
  tone: "warning" | "danger" | "success";
  href?: string;
};

interface AlertsPanelProps {
  alerts: AlertItem[];
}

export function AlertsPanel({ alerts }: AlertsPanelProps) {
  function getToneClasses(tone: AlertItem["tone"]) {
    if (tone === "danger") {
      return "border-[#E87979]/20 bg-[#E87979]/8";
    }

    if (tone === "warning") {
      return "border-[#D8C45E]/20 bg-[#D8C45E]/8";
    }

    return "border-[#99D32A]/22 bg-[#99D32A]/9";
  }

  function getDotClasses(tone: AlertItem["tone"]) {
    if (tone === "danger") {
      return "bg-[#E87979]";
    }

    if (tone === "warning") {
      return "bg-[#D8C45E]";
    }

    return "bg-[#99D32A]";
  }

  return (
    <div className="relative overflow-hidden rounded-[22px] border border-[#2D342A] bg-[#11130F] p-4 shadow-[0_18px_45px_rgba(0,0,0,0.16)]">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-[#99D32A]/45 via-[#70855C]/20 to-transparent" />
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#AEAFB2]/70">Сигналы</div>
          <h2 className="mt-1 text-lg font-semibold text-[#F4F5F1]">Что требует реакции</h2>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {alerts.map((alert) => {
          const content = (
            <div
              className={`rounded-[16px] border px-3 py-2.5 transition ${getToneClasses(
                alert.tone
              )} ${
                alert.href ? "hover:border-[#99D32A]/28 hover:bg-[#99D32A]/6" : ""
              }`}
            >
              <div className="flex items-start gap-3">
                <span
                  className={`mt-1 h-2.5 w-2.5 rounded-full ${getDotClasses(
                    alert.tone
                  )}`}
                />
                <div>
                  <div className="font-medium text-[#F4F5F1]">{alert.title}</div>
                  <div className="mt-1 text-sm leading-5 text-[#AEAFB2]">
                    {alert.desc}
                  </div>
                </div>
              </div>
            </div>
          );

          if (alert.href) {
            return (
              <Link key={`${alert.title}_${alert.desc}`} href={alert.href}>
                {content}
              </Link>
            );
          }

          return (
            <div key={`${alert.title}_${alert.desc}`}>
              {content}
            </div>
          );
        })}
      </div>
    </div>
  );
}
