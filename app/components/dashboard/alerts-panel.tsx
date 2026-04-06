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
      return "border-rose-500/20 bg-rose-500/10";
    }

    if (tone === "warning") {
      return "border-amber-500/20 bg-amber-500/10";
    }

    return "border-emerald-500/20 bg-emerald-500/10";
  }

  function getDotClasses(tone: AlertItem["tone"]) {
    if (tone === "danger") {
      return "bg-rose-400";
    }

    if (tone === "warning") {
      return "bg-amber-400";
    }

    return "bg-emerald-400";
  }

  return (
    <div className="rounded-[28px] border border-white/10 bg-[#121826] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.32)]">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-white/50">Сигналы внимания</div>
          <h2 className="mt-1 text-xl font-semibold">Что требует реакции</h2>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {alerts.map((alert) => {
          const content = (
            <div
              className={`rounded-[24px] border p-4 transition ${getToneClasses(
                alert.tone
              )} ${
                alert.href ? "hover:scale-[1.01] hover:border-white/20" : ""
              }`}
            >
              <div className="flex items-start gap-3">
                <span
                  className={`mt-1 h-2.5 w-2.5 rounded-full ${getDotClasses(
                    alert.tone
                  )}`}
                />
                <div>
                  <div className="font-medium text-white">{alert.title}</div>
                  <div className="mt-1 text-sm leading-6 text-white/65">
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