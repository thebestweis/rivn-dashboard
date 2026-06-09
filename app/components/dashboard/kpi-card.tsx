type KpiTone = "success" | "warning" | "danger" | "neutral";

interface KpiCardProps {
  label: string;
  value: string;
  delta: string;
  tone: KpiTone;
  featured?: boolean;
}

export function KpiCard({ label, value, delta, tone, featured = false }: KpiCardProps) {
  const toneMap = {
    success: "text-[#99D32A]",
    warning: "text-[#D8C45E]",
    danger: "text-[#E87979]",
    neutral: "text-[#AEAFB2]",
  };

  const badgeMap = {
    success: "border-[#99D32A]/30 bg-[#99D32A]/10 text-[#B7EA55]",
    warning: "border-[#D8C45E]/30 bg-[#D8C45E]/10 text-[#E3D47C]",
    danger: "border-[#E87979]/30 bg-[#E87979]/10 text-[#F39B9B]",
    neutral: "border-[#70855C]/30 bg-[#70855C]/12 text-[#CECED0]",
  };

  return (
    <div
      className={`group relative min-w-0 overflow-hidden rounded-[18px] border p-4 transition duration-200 hover:border-[#99D32A]/35 ${
        featured
          ? "border-[#3B4636] bg-[linear-gradient(180deg,#1D2219_0%,#121510_100%)] shadow-[0_18px_45px_rgba(0,0,0,0.22)]"
          : "border-[#2D342A] bg-[#10130F]"
      }`}
    >
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-[#99D32A]/45 via-[#70855C]/20 to-transparent opacity-70"
      />
      {featured ? (
        <div
          aria-hidden="true"
          className="absolute right-3 top-3 h-16 w-16 rounded-full border border-[#99D32A]/10 bg-[#99D32A]/5"
        />
      ) : null}

      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#AEAFB2]/70">
          {label}
        </div>
        <div className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${badgeMap[tone]}`}>
          KPI
        </div>
      </div>
      <div
        suppressHydrationWarning
        className={`relative mt-3 min-w-0 font-semibold tracking-tight text-[#F4F5F1] ${
          featured ? "text-2xl sm:text-[28px]" : "text-xl"
        }`}
      >
        {value}
      </div>
      <div
        suppressHydrationWarning
        className={`relative mt-2 min-w-0 text-xs leading-5 ${toneMap[tone]}`}
      >
        {delta}
      </div>
    </div>
  );
}
