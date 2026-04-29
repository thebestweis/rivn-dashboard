import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  FileText,
  PlayCircle,
  Search,
} from "lucide-react";
import { guideArticles, quickStartSteps } from "./guide-content";

const categories = Array.from(
  new Set(guideArticles.map((article) => article.category))
);

export default function GuidePage() {
  return (
    <main className="min-h-screen bg-[#0B0F1A] px-5 py-6 text-white lg:px-8">
      <div className="mx-auto max-w-[1680px] space-y-6">
        <section className="overflow-hidden rounded-[34px] border border-white/10 bg-[linear-gradient(180deg,rgba(18,24,38,0.98),rgba(10,16,28,0.98))] p-6 shadow-[0_10px_40px_rgba(0,0,0,0.32)] lg:p-8">
          <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr] xl:items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-300">
                <BookOpen className="h-4 w-4" />
                Центр помощи RIVN OS
              </div>

              <h1 className="mt-5 max-w-4xl text-4xl font-semibold tracking-tight lg:text-6xl">
                Простые инструкции по работе в RIVN OS
              </h1>

              <p className="mt-5 max-w-3xl text-base leading-8 text-white/62 lg:text-lg">
                Здесь собраны быстрый старт, видеоинструкция и база знаний по
                основным разделам. Каждая статья объясняет не только куда
                нажимать, но и зачем это нужно бизнесу.
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <a
                  href="#quick-start"
                  className="inline-flex items-center gap-2 rounded-2xl bg-emerald-400 px-5 py-3 text-sm font-semibold text-[#07120F] transition hover:bg-emerald-300"
                >
                  Быстрый старт
                  <ArrowRight className="h-4 w-4" />
                </a>
                <a
                  href="#knowledge-base"
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-semibold text-white/75 transition hover:bg-white/[0.07] hover:text-white"
                >
                  База знаний
                  <Search className="h-4 w-4" />
                </a>
              </div>
            </div>

            <div className="rounded-[28px] border border-white/10 bg-[#0F1524] p-4">
              <div className="flex aspect-video items-center justify-center rounded-[22px] border border-dashed border-white/12 bg-black/25">
                <div className="px-6 text-center">
                  <PlayCircle className="mx-auto h-12 w-12 text-emerald-300" />
                  <div className="mt-4 text-lg font-semibold">
                    Видеоинструкция
                  </div>
                  <p className="mt-2 text-sm leading-6 text-white/48">
                    После записи сюда можно вставить видео быстрого старта:
                    обзор сервиса, первый запуск и ключевые сценарии.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section
          id="quick-start"
          className="scroll-mt-24 rounded-[34px] border border-white/10 bg-[#121826] p-6 shadow-[0_10px_40px_rgba(0,0,0,0.28)]"
        >
          <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-sm font-semibold uppercase tracking-[0.16em] text-violet-300">
                Быстрый старт
              </div>
              <h2 className="mt-2 text-3xl font-semibold">
                Что сделать в первый день
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-white/55">
                Этот сценарий помогает быстро собрать рабочую основу: команда,
                клиенты, проекты, задачи, деньги и автоматизация.
              </p>
            </div>
            <Link
              href="/guide/quick-start"
              className="w-fit rounded-2xl border border-violet-400/20 bg-violet-500/10 px-4 py-2 text-sm font-semibold text-violet-200 transition hover:bg-violet-500/15"
            >
              Открыть полный гайд
            </Link>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {quickStartSteps.map((step, index) => (
              <Link
                key={step.title}
                href={step.href}
                className="group rounded-[24px] border border-white/10 bg-white/[0.03] p-5 transition hover:border-emerald-400/20 hover:bg-emerald-400/[0.06]"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-400/12 text-sm font-semibold text-emerald-300">
                  {index + 1}
                </div>
                <h3 className="mt-4 text-lg font-semibold text-white">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-white/50">
                  {step.text}
                </p>
                <div className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-emerald-300">
                  Перейти
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section
          id="knowledge-base"
          className="scroll-mt-24 rounded-[34px] border border-white/10 bg-[#121826] p-6 shadow-[0_10px_40px_rgba(0,0,0,0.28)]"
        >
          <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-300">
                База знаний
              </div>
              <h2 className="mt-2 text-3xl font-semibold">
                Инструкции по разделам
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-white/55">
                Статьи сделаны как отдельные страницы. На них можно ссылаться
                из CRM, задач, Avito-отчётов, аналитики и других разделов.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white/55">
              {guideArticles.length} статей
            </div>
          </div>

          <div className="mt-5 space-y-6">
            {categories.map((category) => {
              const articles = guideArticles.filter(
                (article) => article.category === category
              );

              return (
                <div key={category}>
                  <div className="mb-3 text-sm font-semibold uppercase tracking-[0.14em] text-white/35">
                    {category}
                  </div>
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {articles.map((article) => (
                      <Link
                        key={article.slug}
                        href={`/guide/${article.slug}`}
                        className="group rounded-[24px] border border-white/10 bg-white/[0.03] p-5 transition hover:border-violet-400/25 hover:bg-violet-500/[0.06]"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-500/12 text-violet-200">
                            <FileText className="h-5 w-5" />
                          </div>
                          <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs text-white/40">
                            {article.readTime}
                          </span>
                        </div>
                        <h3 className="mt-4 text-lg font-semibold text-white">
                          {article.title}
                        </h3>
                        <p className="mt-2 min-h-[72px] text-sm leading-6 text-white/50">
                          {article.description}
                        </p>
                        <div className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-violet-200">
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

        <section className="rounded-[34px] border border-emerald-400/15 bg-emerald-400/[0.06] p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-300">
                <CheckCircle2 className="h-4 w-4" />
                Как использовать дальше
              </div>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-white/60">
                Когда появляется новая инструкция, добавляем её в базу знаний и
                ставим ссылку из нужного раздела сервиса. Пользователь нажимает
                «Помощь» и попадает сразу в правильную статью.
              </p>
            </div>
            <Link
              href="/dashboard"
              className="w-fit rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-semibold text-white/75 transition hover:bg-white/[0.07]"
            >
              Вернуться в сервис
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
