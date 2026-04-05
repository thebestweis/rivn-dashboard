import { AppBreadcrumbs, type BreadcrumbItem } from "./app-breadcrumbs";
interface AppTopbarProps {
  eyebrow?: string;
  title: string;
  description?: string;
  breadcrumbs?: BreadcrumbItem[];
}

export function AppTopbar({
  eyebrow = "Панель управления агентством",
  title,
  description,
  breadcrumbs,
}: AppTopbarProps) {
  return (
    <header className="sticky top-0 z-20 border-b border-white/10 bg-[#0B0F1A]/85 backdrop-blur-xl">
      <div className="flex flex-col gap-4 px-5 py-4 lg:px-8 xl:flex-row xl:items-center xl:justify-between">
        <div>
  <AppBreadcrumbs items={breadcrumbs} />
  <div className="mt-2 text-sm text-white/45">{eyebrow}</div>
  <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
  {description ? (
    <p className="mt-1 text-sm text-white/45">{description}</p>
  ) : null}
</div>

        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/60">
            Поиск по клиентам, оплатам, расходам
          </div>

          <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-1">
            {["Неделя", "Месяц", "Квартал"].map((item, idx) => (
              <button
                key={item}
                className={`rounded-xl px-4 py-2 text-sm transition ${
                  idx === 0
                    ? "bg-[#7B61FF] text-white shadow-[0_0_24px_rgba(123,97,255,0.35)]"
                    : "text-white/60 hover:text-white"
                }`}
              >
                {item}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <button className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/80">
              Уведомления
            </button>
            <button className="rounded-2xl bg-emerald-400/15 px-4 py-3 text-sm font-medium text-emerald-300 shadow-[0_0_24px_rgba(16,185,129,0.18)]">
              Быстрое действие
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}