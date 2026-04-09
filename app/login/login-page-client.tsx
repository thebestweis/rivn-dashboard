"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { createClient } from "../lib/supabase/client";

export function LoginPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = useMemo(
    () => searchParams.get("next") || "/dashboard",
    [searchParams]
  );

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    setIsSubmitting(true);

    try {
      const supabase = createClient();

      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        throw error;
      }

      router.replace(nextPath);
      router.refresh();
    } catch {
      setErrorMessage("Неверный логин или пароль");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0B0F1A] px-4 py-8 text-white">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md items-center">
        <div className="w-full rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(18,24,38,0.96),rgba(10,14,26,0.96))] p-6 shadow-[0_20px_80px_rgba(0,0,0,0.45)] backdrop-blur-xl">
          <div className="text-sm text-white/45">RIVN Control</div>
          <h1 className="mt-2 text-3xl font-semibold">Вход в аккаунт</h1>
          <p className="mt-2 text-sm text-white/60">
            Войди, чтобы открыть свой личный кабинет и данные агентства.
          </p>

          <form onSubmit={handleLogin} className="mt-6 space-y-4">
            <label className="block">
              <div className="mb-2 text-sm text-white/65">Email</div>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                className="h-12 w-full rounded-2xl border border-white/10 bg-[#0F1724] px-4 text-sm text-white outline-none placeholder:text-white/30 transition focus:border-[#6F5AFF]/50 focus:bg-[#101A29] focus:ring-1 focus:ring-[#6F5AFF]/30"
                required
              />
            </label>

            <label className="block">
              <div className="mb-2 text-sm text-white/65">Пароль</div>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Введите пароль"
                className="h-12 w-full rounded-2xl border border-white/10 bg-[#0F1724] px-4 text-sm text-white outline-none placeholder:text-white/30 transition focus:border-[#6F5AFF]/50 focus:bg-[#101A29] focus:ring-1 focus:ring-[#6F5AFF]/30"
                required
              />
            </label>

            <div className="-mt-1 text-right">
              <a
                href="https://t.me/thebestweis"
                target="_blank"
                rel="noreferrer"
                className="text-sm text-white/45 transition hover:text-emerald-400"
              >
                Забыли пароль?
              </a>
            </div>

            {errorMessage ? (
              <div className="rounded-2xl border border-red-500/25 bg-red-500/10 p-4 text-sm text-red-200 shadow-[0_8px_24px_rgba(239,68,68,0.08)]">
                {errorMessage}
              </div>
            ) : null}

            <button
  type="submit"
  disabled={isSubmitting}
  style={{
    background: "linear-gradient(90deg, #6F5AFF 0%, #8B7BFF 100%)",
  }}
  className="mt-2 h-12 w-full rounded-full text-sm font-semibold text-white shadow-[0_10px_30px_rgba(111,90,255,0.35)] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_18px_44px_rgba(111,90,255,0.45)] active:translate-y-[1px] active:shadow-[0_8px_20px_rgba(111,90,255,0.28)] disabled:cursor-not-allowed disabled:opacity-60"
>
  {isSubmitting ? "Входим..." : "Войти"}
</button>
          </form>

          <div className="mt-5 text-sm text-white/55">
            Нет аккаунта?{" "}
            <Link
              href="/register"
              className="font-medium text-white underline underline-offset-4"
            >
              Зарегистрироваться
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}