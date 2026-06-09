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
    <section className="grid grid-cols-2 gap-3 md:gap-4">
      <div className="rivn-card rivn-card-interactive p-4 sm:p-5">
        <div className="text-xs uppercase tracking-[0.2em] text-white/38">Всего проектов</div>
        <div className="mt-2 text-3xl font-medium tracking-[-0.05em] text-white sm:text-4xl">
          {isLoading ? "—" : totalProjects}
        </div>
      </div>

      <div className="rivn-card rivn-card-interactive p-4 sm:p-5">
        <div className="text-xs uppercase tracking-[0.2em] text-white/38">Активных проектов</div>
        <div className="mt-2 text-3xl font-medium tracking-[-0.05em] text-[#43ffc2] sm:text-4xl">
          {isLoading ? "—" : activeProjects}
        </div>
      </div>
    </section>
  );
}
