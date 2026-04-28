import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";
import { getGuideArticle, guideArticles } from "../guide-content";

export function generateStaticParams() {
  return guideArticles.map((article) => ({ slug: article.slug }));
}

export default async function GuideArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = getGuideArticle(slug);

  if (!article) {
    notFound();
  }

  const currentIndex = guideArticles.findIndex((item) => item.slug === slug);
  const previousArticle = guideArticles[currentIndex - 1] ?? null;
  const nextArticle = guideArticles[currentIndex + 1] ?? null;

  return (
    <main className="min-h-screen bg-[#0B0F1A] px-5 py-6 text-white lg:px-8">
      <div className="mx-auto grid max-w-[1680px] gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="xl:sticky xl:top-6 xl:self-start">
          <div className="rounded-[30px] border border-white/10 bg-[#121826] p-4 shadow-[0_10px_40px_rgba(0,0,0,0.28)]">
            <Link
              href="/guide"
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-white/70 transition hover:bg-white/[0.07] hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              Все инструкции
            </Link>

            <div className="mt-5 border-t border-white/10 pt-4">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-white/35">
                Разделы статьи
              </div>
              <nav className="mt-3 space-y-2">
                {article.sections.map((section) => (
                  <a
                    key={section.id}
                    href={`#${section.id}`}
                    className="block rounded-2xl border border-transparent bg-white/[0.03] px-4 py-3 text-sm text-white/68 transition hover:border-white/10 hover:bg-white/[0.05] hover:text-white"
                  >
                    {section.title}
                  </a>
                ))}
              </nav>
            </div>

            <div className="mt-5 border-t border-white/10 pt-4">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-white/35">
                База знаний
              </div>
              <nav className="mt-3 space-y-2">
                {guideArticles.map((item) => {
                  const isActive = item.slug === article.slug;

                  return (
                    <Link
                      key={item.slug}
                      href={`/guide/${item.slug}`}
                      className={`block rounded-2xl border px-4 py-3 text-sm transition ${
                        isActive
                          ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
                          : "border-transparent bg-white/[0.03] text-white/55 hover:border-white/10 hover:bg-white/[0.05] hover:text-white"
                      }`}
                    >
                      {item.title}
                    </Link>
                  );
                })}
              </nav>
            </div>
          </div>
        </aside>

        <article className="space-y-6">
          <header className="rounded-[34px] border border-white/10 bg-[linear-gradient(180deg,rgba(18,24,38,0.98),rgba(10,16,28,0.98))] p-6 shadow-[0_10px_40px_rgba(0,0,0,0.32)] lg:p-8">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 font-semibold text-emerald-300">
                {article.category}
              </span>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-white/45">
                {article.readTime}
              </span>
            </div>
            <h1 className="mt-5 max-w-4xl text-4xl font-semibold tracking-tight lg:text-6xl">
              {article.title}
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-8 text-white/62">
              {article.description}
            </p>
            {article.relatedHref ? (
              <Link
                href={article.relatedHref}
                className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-emerald-400 px-5 py-3 text-sm font-semibold text-[#07120F] transition hover:bg-emerald-300"
              >
                Открыть раздел в сервисе
                <ArrowRight className="h-4 w-4" />
              </Link>
            ) : null}
          </header>

          {article.sections.map((section) => (
            <section
              key={section.id}
              id={section.id}
              className="scroll-mt-24 rounded-[30px] border border-white/10 bg-[#121826] p-6 shadow-[0_10px_40px_rgba(0,0,0,0.24)]"
            >
              <h2 className="text-2xl font-semibold">{section.title}</h2>
              <div className="mt-4 space-y-4 text-[15px] leading-7 text-white/68">
                {section.body.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>

              {section.checklist ? (
                <div className="mt-5 rounded-[24px] border border-emerald-400/15 bg-emerald-400/[0.06] p-5">
                  <div className="text-sm font-semibold text-emerald-300">
                    Чеклист
                  </div>
                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    {section.checklist.map((item) => (
                      <div
                        key={item}
                        className="flex items-start gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/68"
                      >
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </section>
          ))}

          <footer className="grid gap-3 md:grid-cols-2">
            {previousArticle ? (
              <Link
                href={`/guide/${previousArticle.slug}`}
                className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5 transition hover:bg-white/[0.06]"
              >
                <div className="text-sm text-white/40">Предыдущая статья</div>
                <div className="mt-1 font-semibold">{previousArticle.title}</div>
              </Link>
            ) : (
              <div />
            )}

            {nextArticle ? (
              <Link
                href={`/guide/${nextArticle.slug}`}
                className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5 text-right transition hover:bg-white/[0.06]"
              >
                <div className="text-sm text-white/40">Следующая статья</div>
                <div className="mt-1 font-semibold">{nextArticle.title}</div>
              </Link>
            ) : null}
          </footer>
        </article>
      </div>
    </main>
  );
}
