import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, CheckCircle2, Clock3 } from "lucide-react";
import { getGuideArticle, guideArticles } from "../guide-content";

const accentClasses = {
  mint: "border-[#00f5a8]/24 bg-[#00f5a8]/10 text-[#43ffc2]",
  violet: "border-[#7c5cff]/26 bg-[#7c5cff]/12 text-[#b8a7ff]",
  blue: "border-sky-400/24 bg-sky-400/10 text-sky-200",
  amber: "border-amber-300/24 bg-amber-300/10 text-amber-200",
} as const;

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
    <main className="rivn-scope min-h-screen bg-[var(--rivn-app-bg)] px-4 py-5 text-[var(--rivn-text)] sm:px-5 lg:px-8">
      <div className="mx-auto grid max-w-[1680px] gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="xl:sticky xl:top-5 xl:self-start">
          <div className="rounded-[30px] border border-[var(--rivn-card-border)] bg-[var(--rivn-card-bg)] p-4 shadow-[var(--rivn-card-shadow)]">
            <Link
              href="/guide"
              className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-[var(--rivn-card-border)] bg-[var(--rivn-inner-bg)] px-4 py-2.5 text-sm font-semibold text-[var(--rivn-text)] transition hover:-translate-y-0.5"
            >
              <ArrowLeft className="h-4 w-4" />
              Все инструкции
            </Link>

            <div className="mt-5 border-t border-[var(--rivn-card-border)] pt-4">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--rivn-muted)]">
                В этой статье
              </div>
              <nav className="mt-3 space-y-2">
                {article.sections.map((section) => (
                  <a
                    key={section.id}
                    href={`#${section.id}`}
                    className="block rounded-2xl border border-transparent bg-[var(--rivn-inner-bg)] px-4 py-3 text-sm text-[var(--rivn-muted-strong)] transition hover:border-[var(--rivn-card-border)] hover:text-[var(--rivn-text)]"
                  >
                    {section.title}
                  </a>
                ))}
              </nav>
            </div>

            <div className="mt-5 border-t border-[var(--rivn-card-border)] pt-4">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--rivn-muted)]">
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
                          ? "border-[#00f5a8]/24 bg-[#00f5a8]/10 text-[#43ffc2]"
                          : "border-transparent bg-[var(--rivn-inner-bg)] text-[var(--rivn-muted-strong)] hover:border-[var(--rivn-card-border)] hover:text-[var(--rivn-text)]"
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

        <article className="space-y-5">
          <header className="relative overflow-hidden rounded-[34px] border border-[var(--rivn-card-border)] bg-[var(--rivn-card-bg)] p-6 shadow-[var(--rivn-card-shadow)] lg:p-8">
            <div className="pointer-events-none absolute -left-28 top-0 h-72 w-72 rounded-full bg-[#00f5a8]/12 blur-3xl" />
            <div className="pointer-events-none absolute right-0 top-0 h-72 w-72 rounded-full bg-[#7c5cff]/14 blur-3xl" />

            <div className="relative">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span
                  className={`rounded-full border px-3 py-1.5 font-semibold ${accentClasses[article.accent]}`}
                >
                  {article.category}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-[var(--rivn-card-border)] bg-[var(--rivn-inner-bg)] px-3 py-1.5 text-[var(--rivn-muted)]">
                  <Clock3 className="h-3.5 w-3.5" />
                  {article.readTime}
                </span>
              </div>

              <h1 className="mt-5 max-w-4xl text-4xl font-semibold tracking-[-0.06em] lg:text-6xl">
                {article.title}
              </h1>
              <p className="mt-4 max-w-3xl text-base leading-8 text-[var(--rivn-muted)]">
                {article.description}
              </p>

              {article.relatedHref ? (
                <Link
                  href={article.relatedHref}
                  className="mt-6 inline-flex items-center gap-2 rounded-full bg-[var(--rivn-primary-bg)] px-5 py-3 text-sm font-semibold text-[var(--rivn-primary-text)] shadow-[0_18px_40px_rgba(0,245,168,0.20)] transition hover:-translate-y-0.5"
                >
                  Открыть раздел в сервисе
                  <ArrowRight className="h-4 w-4" />
                </Link>
              ) : null}
            </div>
          </header>

          {article.sections.map((section, index) => (
            <section
              key={section.id}
              id={section.id}
              className="scroll-mt-24 rounded-[30px] border border-[var(--rivn-card-border)] bg-[var(--rivn-card-bg)] p-5 shadow-[var(--rivn-card-shadow)] sm:p-6"
            >
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#43ffc2]">
                  Шаг {index + 1}
                </div>
                <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em]">
                  {section.title}
                </h2>
              </div>

              <div className="mt-4 space-y-4 text-[15px] leading-7 text-[var(--rivn-muted-strong)]">
                {section.body.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>

              {section.image ? (
                <figure className="mt-5 overflow-hidden rounded-[26px] border border-[var(--rivn-card-border)] bg-[var(--rivn-inner-bg)]">
                  <Image
                    src={section.image.src}
                    alt={section.image.alt}
                    width={1600}
                    height={900}
                    className="h-auto w-full"
                  />
                  <figcaption className="border-t border-[var(--rivn-card-border)] px-5 py-3 text-sm text-[var(--rivn-muted)]">
                    {section.image.caption}
                  </figcaption>
                </figure>
              ) : null}

              {section.checklist ? (
                <div className="mt-5 rounded-[24px] border border-[#00f5a8]/16 bg-[#00f5a8]/8 p-5">
                  <div className="text-sm font-semibold text-[#43ffc2]">
                    Мини-чеклист
                  </div>
                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    {section.checklist.map((item) => (
                      <div
                        key={item}
                        className="flex items-start gap-2 rounded-2xl border border-[var(--rivn-card-border)] bg-[var(--rivn-inner-bg)] px-3 py-2 text-sm text-[var(--rivn-muted-strong)]"
                      >
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#43ffc2]" />
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
                className="rounded-[24px] border border-[var(--rivn-card-border)] bg-[var(--rivn-card-bg)] p-5 transition hover:-translate-y-0.5"
              >
                <div className="text-sm text-[var(--rivn-muted)]">
                  Предыдущая статья
                </div>
                <div className="mt-1 font-semibold text-[var(--rivn-text)]">
                  {previousArticle.title}
                </div>
              </Link>
            ) : (
              <div />
            )}

            {nextArticle ? (
              <Link
                href={`/guide/${nextArticle.slug}`}
                className="rounded-[24px] border border-[var(--rivn-card-border)] bg-[var(--rivn-card-bg)] p-5 text-right transition hover:-translate-y-0.5"
              >
                <div className="text-sm text-[var(--rivn-muted)]">
                  Следующая статья
                </div>
                <div className="mt-1 font-semibold text-[var(--rivn-text)]">
                  {nextArticle.title}
                </div>
              </Link>
            ) : null}
          </footer>
        </article>
      </div>
    </main>
  );
}
