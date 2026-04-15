"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "../lib/supabase/client";
import {
  createReferralAttributionForUser,
  storeReferralCodeInBrowser,
} from "../lib/supabase/referrals";

import { bootstrapAccountForCurrentUser } from "../lib/supabase/bootstrap-account";

async function waitForSessionReady() {
  const supabase = createClient();

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session) {
      return session;
    }

    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  throw new Error("Не удалось дождаться auth session после регистрации");
}

export function RegisterPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordRepeat, setPasswordRepeat] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    const refCode = searchParams.get("ref");

    if (!refCode) return;

    storeReferralCodeInBrowser(refCode).catch((error) => {
      console.error("Не удалось сохранить referral code:", error);
    });
  }, [searchParams]);

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

      if (data.user) {
        try {
          await createReferralAttributionForUser(data.user.id);
        } catch (referralError) {
          console.error("Ошибка создания реферальной привязки:", referralError);
        }
      }

      if (data.session) {
  await waitForSessionReady();
  await bootstrapAccountForCurrentUser();

  router.replace("/dashboard");
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
        <div className="w-full rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(18,24,38,0.96),rgba(10,14,26,0.96))] p-6 shadow-[0_20px_80px_rgba(0,0,0,0.45)] backdrop-blur-xl">
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
                className="h-12 w-full rounded-2xl border border-white/10 bg-[#0F1724] px-4 text-sm text-white outline-none placeholder:text-white/30 transition focus:border-[#6F5AFF]/50 focus:bg-[#101A29] focus:ring-1 focus:ring-[#6F5AFF]/30"
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
                className="h-12 w-full rounded-2xl border border-white/10 bg-[#0F1724] px-4 text-sm text-white outline-none placeholder:text-white/30 transition focus:border-[#6F5AFF]/50 focus:bg-[#101A29] focus:ring-1 focus:ring-[#6F5AFF]/30"
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
                className="h-12 w-full rounded-2xl border border-white/10 bg-[#0F1724] px-4 text-sm text-white outline-none placeholder:text-white/30 transition focus:border-[#6F5AFF]/50 focus:bg-[#101A29] focus:ring-1 focus:ring-[#6F5AFF]/30"
                required
              />
            </label>

            {errorMessage ? (
              <div className="rounded-2xl border border-red-500/25 bg-red-500/10 p-4 text-sm text-red-200 shadow-[0_8px_24px_rgba(239,68,68,0.08)]">
                {errorMessage}
              </div>
            ) : null}

            {successMessage ? (
              <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-4 text-sm text-emerald-200 shadow-[0_8px_24px_rgba(16,185,129,0.08)]">
                {successMessage}
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