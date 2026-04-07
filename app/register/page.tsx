"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "../lib/supabase/client";

export default function RegisterPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordRepeat, setPasswordRepeat] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  async function handleRegister(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    if (password !== passwordRepeat) {
      setErrorMessage("Пароли не совпадают");
      return;
    }

    if (password.length < 6) {
      setErrorMessage("Пароль должен содержать минимум 6 символов");
      return;
    }

    setIsSubmitting(true);

    try {
      const supabase = createClient();

      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });

      if (error) {
        throw error;
      }

      if (data.session) {
        router.replace("/");
        router.refresh();
        return;
      }

      setSuccessMessage(
        "Аккаунт создан. Проверь почту и подтверди email, если подтверждение включено в Supabase."
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Не удалось зарегистрироваться"
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
          <h1 className="mt-2 text-3xl font-semibold">Регистрация</h1>
          <p className="mt-2 text-sm text-white/60">
            Создай аккаунт, чтобы получить свой личный кабинет в системе.
          </p>

          <form onSubmit={handleRegister} className="mt-6 space-y-4">
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
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Минимум 6 символов"
                className="h-12 w-full rounded-2xl border border-white/10 bg-[#0F1724] px-4 text-sm text-white outline-none placeholder:text-white/30"
                required
              />
            </label>

            <label className="block">
              <div className="mb-2 text-sm text-white/65">Повтори пароль</div>
              <input
                type="password"
                autoComplete="new-password"
                value={passwordRepeat}
                onChange={(event) => setPasswordRepeat(event.target.value)}
                placeholder="Повтори пароль"
                className="h-12 w-full rounded-2xl border border-white/10 bg-[#0F1724] px-4 text-sm text-white outline-none placeholder:text-white/30"
                required
              />
            </label>

            {errorMessage ? (
              <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">
                {errorMessage}
              </div>
            ) : null}

            {successMessage ? (
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-200">
                {successMessage}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={isSubmitting}
              className="h-12 w-full rounded-2xl bg-white text-sm font-semibold text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "Создаём аккаунт..." : "Создать аккаунт"}
            </button>
          </form>

          <div className="mt-5 text-sm text-white/55">
            Уже есть аккаунт?{" "}
            <Link
              href="/login"
              className="font-medium text-white underline underline-offset-4"
            >
              Войти
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}