"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { createClient } from "../lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = useMemo(() => searchParams.get("next") || "/", [searchParams]);

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
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Не удалось выполнить вход"
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0B0F1A] px-4 py-8 text-white">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md items-center">
        <div className="w-full rounded-[28px] border border-white/10 bg-[#121826] p-6 shadow-[0_20px_80px_rgba(0,0,0,0.45)]">
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
                className="h-12 w-full rounded-2xl border border-white/10 bg-[#0F1724] px-4 text-sm text-white outline-none placeholder:text-white/30"
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
                className="h-12 w-full rounded-2xl border border-white/10 bg-[#0F1724] px-4 text-sm text-white outline-none placeholder:text-white/30"
                required
              />
            </label>

            {errorMessage ? (
              <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">
                {errorMessage}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={isSubmitting}
              className="h-12 w-full rounded-2xl bg-white text-sm font-semibold text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
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