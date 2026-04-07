type ProjectsStatsProps = {
  totalProjects: number;
  activeProjects: number;
  isLoading: boolean;
};

export function ProjectsStats({
  totalProjects,
  activeProjects,
  isLoading,
}: ProjectsStatsProps) {
  return (
    <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <div className="rounded-[28px] border border-white/10 bg-[#121826] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.32)]">
        <div className="text-sm text-white/50">Всего проектов</div>
        <div className="mt-3 text-3xl font-semibold text-white">
          {isLoading ? "—" : totalProjects}
        </div>
      </div>

      <div className="rounded-[28px] border border-white/10 bg-[#121826] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.32)]">
        <div className="text-sm text-white/50">Активных проектов</div>
        <div className="mt-3 text-3xl font-semibold text-white">
          {isLoading ? "—" : activeProjects}
        </div>
      </div>
    </section>
  );
}