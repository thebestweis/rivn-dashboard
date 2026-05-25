import Link from "next/link";

export default function SessionExpiredPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-5 py-8 text-slate-950 dark:bg-[#0B0F1A] dark:text-white">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-3xl items-center justify-center">
        <section className="w-full rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_24px_80px_rgba(15,23,42,0.12)] dark:border-white/10 dark:bg-[#121826] dark:shadow-[0_24px_80px_rgba(0,0,0,0.35)] sm:p-8">
          <div className="inline-flex rounded-full border border-amber-400/25 bg-amber-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-amber-600 dark:text-amber-200">
            Сессия закончилась
          </div>

          <h1 className="mt-5 text-3xl font-semibold tracking-tight sm:text-4xl">
            Войди заново, чтобы продолжить работу
          </h1>

          <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-600 dark:text-white/60">
            Такое бывает, когда браузер долго был открыт, токен авторизации
            устарел или вход был сброшен. Данные кабинета не потерялись, нужно
            просто снова авторизоваться.
          </p>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/login"
              className="rounded-2xl bg-emerald-400 px-5 py-3 text-center text-sm font-semibold text-[#06120f] shadow-[0_18px_45px_rgba(16,185,129,0.24)] transition hover:bg-emerald-300"
            >
              Войти заново
            </Link>

            <Link
              href="/"
              className="rounded-2xl border border-slate-200 bg-slate-100 px-5 py-3 text-center text-sm font-semibold text-slate-700 transition hover:bg-slate-200 dark:border-white/10 dark:bg-white/[0.04] dark:text-white/70 dark:hover:bg-white/[0.08]"
            >
              На главную
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
