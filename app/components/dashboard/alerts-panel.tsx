type AlertTone = "warning" | "danger";

interface AlertItem {
  title: string;
  desc: string;
  tone: AlertTone;
}

interface AlertsPanelProps {
  alerts: AlertItem[];
}

export function AlertsPanel({ alerts }: AlertsPanelProps) {
  const toneMap = {
    warning: "border-amber-400/20 bg-amber-400/8 text-amber-200",
    danger: "border-rose-400/20 bg-rose-400/8 text-rose-200",
  };

  return (
    <div className="rounded-[28px] border border-white/10 bg-[#121826] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.32)]">
      <div className="text-sm text-white/50">Требует внимания</div>

      <div className="mt-4 space-y-3">
        {alerts.map((alert) => (
          <div
            key={alert.title}
            className={`rounded-2xl border p-4 ${toneMap[alert.tone]}`}
          >
            <div className="font-medium">{alert.title}</div>
            <div className="mt-1 text-sm opacity-80">{alert.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}