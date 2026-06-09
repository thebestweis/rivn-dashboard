import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Clock3,
  FileText,
  PlayCircle,
  Sparkles,
} from "lucide-react";
import { guideArticles, quickStartSteps } from "./guide-content";

const QUICK_START_VIDEO_EMBED_URL =
  "https://kinescope.io/embed/8pL4G9D1LadTbgSt3srW7A";

const categories = Array.from(
  new Set(guideArticles.map((article) => article.category))
);

const accentClasses = {
  mint: "border-[#00f5a8]/24 bg-[#00f5a8]/10 text-[#43ffc2]",
  violet: "border-[#7c5cff]/26 bg-[#7c5cff]/12 text-[#b8a7ff]",
  blue: "border-sky-400/24 bg-sky-400/10 text-sky-200",
  amber: "border-amber-300/24 bg-amber-300/10 text-amber-200",
} as const;

export default function GuidePage() {
  return (
    <main className="rivn-scope min-h-screen bg-[var(--rivn-app-bg)] px-4 py-5 text-[var(--rivn-text)] sm:px-5 lg:px-8">
      <div className="mx-auto max-w-[1680px] space-y-5">
        <section className="relative overflow-hidden rounded-[34px] border border-[var(--rivn-card-border)] bg-[var(--rivn-card-bg)] p-5 shadow-[var(--rivn-card-shadow)] sm:p-7 lg:p-8">
          <div className="pointer-events-none absolute -left-24 top-0 h-72 w-72 rounded-full bg-[#00f5a8]/12 blur-3xl" />
          <div className="pointer-events-none absolute right-0 top-0 h-80 w-80 rounded-full bg-[#7c5cff]/14 blur-3xl" />

          <div className="relative grid gap-6 xl:grid-cols-[1.05fr_0.95fr] xl:items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#00f5a8]/20 bg-[#00f5a8]/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-[#43ffc2]">
                <BookOpen className="h-4 w-4" />
                База знаний RIVN OS
              </div>

              <h1 className="mt-5 max-w-4xl text-4xl font-semibold tracking-[-0.06em] sm:text-5xl lg:text-6xl">
                Простые инструкции, чтобы быстро освоиться в системе
              </h1>

              <p className="mt-5 max-w-3xl text-base leading-8 text-[var(--rivn-muted)]">
                Здесь собран быстрый старт и короткие инструкции по ключевым
                разделам: клиенты, проекты, задачи, финансы, CRM, аналитика и
                тарифы. Без перегруза, но с понятной логикой работы.
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <a
                  href="#quick-start"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--rivn-primary-bg)] px-5 py-3 text-sm font-semibold text-[var(--rivn-primary-text)] shadow-[0_18px_40px_rgba(0,245,168,0.20)] transition hover:-translate-y-0.5"
                >
                  Начать за 20 минут
                  <ArrowRight className="h-4 w-4" />
                </a>
                <a
                  href="#knowledge-base"
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-[var(--rivn-card-border)] bg-[var(--rivn-inner-bg)] px-5 py-3 text-sm font-semibold text-[var(--rivn-text)] transition hover:-translate-y-0.5"
                >
                  Открыть базу знаний
                  <Sparkles className="h-4 w-4" />
                </a>
              </div>
            </div>

            <div className="rounded-[30px] border border-[var(--rivn-card-border)] bg-[var(--rivn-inner-bg)] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.10)] sm:p-4">
              <div className="overflow-hidden rounded-[24px] border border-[var(--rivn-card-border)] bg-black shadow-[0_24px_90px_rgba(0,0,0,0.24)]">
                <div className="relative aspect-video w-full">
                  <iframe
                    src={QUICK_START_VIDEO_EMBED_URL}
                    title="Видеоинструкция: быстрый старт в RIVN OS"
                    allow="autoplay; fullscreen; picture-in-picture; encrypted-media; gyroscope; accelerometer; clipboard-write; screen-wake-lock;"
                    allowFullScreen
                    className="absolute inset-0 h-full w-full border-0"
                  />
                </div>
              </div>

              <div className="mt-4 flex items-start gap-3 rounded-[24px] border border-[#00f5a8]/16 bg-[#00f5a8]/8 p-4">
                <PlayCircle className="mt-0.5 h-5 w-5 shrink-0 text-[#43ffc2]" />
                <div>
                  <div className="text-sm font-semibold text-[var(--rivn-text)]">
                    Видео быстрого старта
                  </div>
                  <p className="mt-1 text-sm leading-6 text-[var(--rivn-muted)]">
                    Посмотри короткий обзор, если хочешь понять общую логику
                    платформы перед настройкой кабинета.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section
          id="quick-start"
          className="scroll-mt-24 rounded-[34px] border border-[var(--rivn-card-border)] bg-[var(--rivn-card-bg)] p-5 shadow-[var(--rivn-card-shadow)] sm:p-6"
        >
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#43ffc2]">
                Быстрый старт
              </div>
              <h2 className="mt-2 text-3xl font-semibold tracking-[-0.04em]">
                Что сделать в первый день
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--rivn-muted)]">
                Эти шаги превращают пустой кабинет в рабочую систему: сначала
                основа, потом данные, потом ежедневная работа.
              </p>
            </div>
            <Link
              href="/guide/quick-start"
              className="w-fit rounded-full border border-[#7c5cff]/24 bg-[#7c5cff]/12 px-4 py-2 text-sm font-semibold text-[#b8a7ff] transition hover:-translate-y-0.5"
            >
              Полный быстрый старт
            </Link>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {quickStartSteps.map((step, index) => (
              <Link
                key={step.title}
                href={step.href}
                className="group rounded-[26px] border border-[var(--rivn-card-border)] bg-[var(--rivn-inner-bg)] p-4 transition hover:-translate-y-1 hover:border-[#00f5a8]/24 hover:shadow-[0_24px_70px_rgba(0,245,168,0.10)] sm:p-5"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--rivn-primary-bg)] text-sm font-semibold text-[var(--rivn-primary-text)]">
                  {index + 1}
                </div>
                <h3 className="mt-4 text-lg font-semibold text-[var(--rivn-text)]">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-[var(--rivn-muted)]">
                  {step.text}
                </p>
                <div className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[#43ffc2]">
                  Перейти
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section
          id="knowledge-base"
          className="scroll-mt-24 rounded-[34px] border border-[var(--rivn-card-border)] bg-[var(--rivn-card-bg)] p-5 shadow-[var(--rivn-card-shadow)] sm:p-6"
        >
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#43ffc2]">
                База знаний
              </div>
              <h2 className="mt-2 text-3xl font-semibold tracking-[-0.04em]">
                Инструкции по разделам
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--rivn-muted)]">
                Каждая статья объясняет назначение раздела, базовый сценарий и
                несколько действий, которые важно сделать правильно.
              </p>
            </div>
            <div className="rounded-full border border-[var(--rivn-card-border)] bg-[var(--rivn-inner-bg)] px-4 py-2 text-sm text-[var(--rivn-muted)]">
              {guideArticles.length} коротких статей
            </div>
          </div>

          <div className="mt-5 space-y-6">
            {categories.map((category) => {
              const articles = guideArticles.filter(
                (article) => article.category === category
              );

              return (
                <div key={category}>
                  <div className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--rivn-muted)]">
                    {category}
                  </div>
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {articles.map((article) => (
                      <Link
                        key={article.slug}
                        href={`/guide/${article.slug}`}
                        className="group rounded-[26px] border border-[var(--rivn-card-border)] bg-[var(--rivn-inner-bg)] p-4 transition hover:-translate-y-1 hover:shadow-[0_24px_70px_rgba(0,0,0,0.16)] sm:p-5"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div
                            className={`flex h-11 w-11 items-center justify-center rounded-2xl border ${accentClasses[article.accent]}`}
                          >
                            <FileText className="h-5 w-5" />
                          </div>
                          <span className="inline-flex items-center gap-1 rounded-full border border-[var(--rivn-card-border)] bg-[var(--rivn-panel-bg)] px-2.5 py-1 text-xs text-[var(--rivn-muted)]">
                            <Clock3 className="h-3.5 w-3.5" />
                            {article.readTime}
                          </span>
                        </div>
                        <h3 className="mt-4 text-lg font-semibold text-[var(--rivn-text)]">
                          {article.title}
                        </h3>
                        <p className="mt-2 min-h-[72px] text-sm leading-6 text-[var(--rivn-muted)]">
                          {article.description}
                        </p>
                        <div className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[#43ffc2]">
                          Читать
                          <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-[34px] border border-[#00f5a8]/16 bg-[#00f5a8]/8 p-5 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 text-sm font-semibold text-[#43ffc2]">
                <CheckCircle2 className="h-4 w-4" />
                Лучший способ освоиться
              </div>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--rivn-muted)]">
                Открой быстрый старт, сделай первые шаги в своём кабинете и
                возвращайся к отдельным статьям, когда понадобится конкретный
                раздел.
              </p>
            </div>
            <Link
              href="/dashboard"
              className="w-fit rounded-full border border-[var(--rivn-card-border)] bg-[var(--rivn-inner-bg)] px-5 py-3 text-sm font-semibold text-[var(--rivn-text)] transition hover:-translate-y-0.5"
            >
              Вернуться в сервис
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
