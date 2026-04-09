"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[#0B0F1A] px-6 py-10 text-white">
      <div className="mx-auto flex min-h-[80vh] max-w-3xl items-center justify-center">
        <div className="w-full rounded-[32px] border border-white/10 bg-[#121826] p-8 shadow-[0_20px_80px_rgba(0,0,0,0.45)] md:p-12">
          <div className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/10 text-2xl text-rose-300">
            !
          </div>

          <div className="text-sm text-white/45">Ошибка системы</div>

          <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">
            Что-то пошло не так
          </h1>

          <p className="mt-4 max-w-2xl text-base leading-7 text-white/65">
            Попробуй обновить страницу. Если проблема не исчезает, напиши нам в
            Telegram — поможем разобраться и быстро решить вопрос.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => reset()}
              className="inline-flex items-center justify-center rounded-2xl bg-violet-500 px-5 py-3 text-sm font-medium text-white shadow-[0_0_24px_rgba(139,92,246,0.35)] transition hover:bg-violet-400 active:scale-[0.98]"
            >
              Обновить страницу
            </button>

            <a
              href="https://t.me/thebestweis"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-5 py-3 text-sm font-medium text-emerald-300 transition hover:bg-emerald-400/15 active:scale-[0.98]"
            >
              Написать в Telegram
            </a>

            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-medium text-white/80 transition hover:bg-white/[0.08] hover:text-white active:scale-[0.98]"
            >
              Вернуться на главную
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}