type KpiTone = "success" | "warning" | "danger" | "neutral";

interface KpiCardProps {
  label: string;
  value: string;
  delta: string;
  tone: KpiTone;
}

export function KpiCard({ label, value, delta, tone }: KpiCardProps) {
  const toneMap = {
    success: "text-emerald-300",
    warning: "text-amber-300",
    danger: "text-rose-300",
    neutral: "text-white/50",
  };

  return (
  <div className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.28)]">
    <div className="text-sm text-white/55">{label}</div>
    <div
  suppressHydrationWarning
  className="mt-3 text-2xl font-semibold tracking-tight"
>
  {value}
</div>
    <div
  suppressHydrationWarning
  className={`mt-2 text-sm ${toneMap[tone]}`}
>
  {delta}
</div>
  </div>
);
}