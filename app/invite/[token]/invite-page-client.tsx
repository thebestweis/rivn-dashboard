"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/app/lib/supabase/client";
import {
  bootstrapAccountForAuthFlow,
  isAlreadyRegisteredAuthError,
  withTimeout,
} from "@/app/lib/supabase/auth-flow";
import { reportAuthTelemetry } from "@/app/lib/auth-telemetry";
import { getWorkspaceInvitationRoleLabel } from "@/app/lib/workspace-invitations";

type InvitationInfo = {
  id: string;
  workspace_id: string;
  email: string;
  role: string;
  status: string;
  expires_at: string;
  workspaces?: { id: string; name: string | null } | null;
};

type Mode = "register" | "login";

async function readJsonResponse(response: Response) {
  const payload = await response.json().catch(() => null);

  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.error || "Не удалось обработать приглашение.");
  }

  return payload;
}

export function InvitePageClient({ token }: { token: string }) {
  const router = useRouter();
  const [invitation, setInvitation] = useState<InvitationInfo | null>(null);
  const [mode, setMode] = useState<Mode>("register");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [passwordRepeat, setPasswordRepeat] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const workspaceName =
    invitation?.workspaces?.name?.trim() || "кабинет RIVN OS";
  const inviteEmail = invitation?.email ?? "";
  const isInviteAvailable = invitation?.status === "pending";

  const subtitle = useMemo(() => {
    if (!invitation) return "Проверяем приглашение...";

    if (invitation.status === "accepted") {
      return "Это приглашение уже принято.";
    }

    if (invitation.status === "expired") {
      return "Срок действия приглашения истёк.";
    }

    if (invitation.status === "canceled") {
      return "Это приглашение отменено владельцем кабинета.";
    }

    return `Тебя пригласили в ${workspaceName} с ролью ${getWorkspaceInvitationRoleLabel(
      invitation.role
    )}.`;
  }, [invitation, workspaceName]);

  useEffect(() => {
    let isMounted = true;

    async function resolveInvitation() {
      try {
        setIsLoading(true);
        setErrorMessage("");

        const response = await fetch(
          `/api/workspace-invitations/resolve?token=${encodeURIComponent(
            token
          )}`,
          { credentials: "include" }
        );
        const payload = await readJsonResponse(response);

        if (!isMounted) return;

        setInvitation(payload.invitation);
      } catch (error) {
        if (!isMounted) return;
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Не удалось открыть приглашение."
        );
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    resolveInvitation();

    return () => {
      isMounted = false;
    };
  }, [token]);

  async function acceptInvitation(nextDisplayName = displayName) {
    const response = await fetch("/api/workspace-invitations/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        token,
        displayName: nextDisplayName.trim(),
      }),
    });

    await readJsonResponse(response);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!invitation) return;

    setErrorMessage("");
    setSuccessMessage("");

    if (mode === "register" && password !== passwordRepeat) {
      setErrorMessage("Пароли не совпадают.");
      return;
    }

    if (password.length < 6) {
      setErrorMessage("Пароль должен содержать минимум 6 символов.");
      return;
    }

    try {
      setIsSubmitting(true);

      const supabase = createClient();

      if (mode === "register") {
        const signUpResponse = await withTimeout<
          Awaited<ReturnType<typeof supabase.auth.signUp>>
        >(
          supabase.auth.signUp({
            email: inviteEmail,
            password,
          }),
          12_000,
          "Регистрация заняла слишком много времени. Попробуй ещё раз."
        );

        let data = signUpResponse.data;
        let error = signUpResponse.error;

        if (error && isAlreadyRegisteredAuthError(error)) {
          const signInResponse = await withTimeout<
            Awaited<ReturnType<typeof supabase.auth.signInWithPassword>>
          >(
            supabase.auth.signInWithPassword({
              email: inviteEmail,
              password,
            }),
            12_000,
            "Вход занял слишком много времени. Попробуй ещё раз."
          );

          data = signInResponse.data;
          error = signInResponse.error;
        }

        if (error) throw error;

        if (!data.session) {
          setSuccessMessage(
            "Аккаунт создан. Если Supabase попросит подтвердить email, открой письмо и потом вернись по ссылке приглашения."
          );
          return;
        }
      } else {
        const { error } = await withTimeout<
          Awaited<ReturnType<typeof supabase.auth.signInWithPassword>>
        >(
          supabase.auth.signInWithPassword({
            email: inviteEmail,
            password,
          }),
          12_000,
          "Вход занял слишком много времени. Попробуй ещё раз."
        );

        if (error) throw error;
      }

      await bootstrapAccountForAuthFlow();
      await withTimeout(
        acceptInvitation(displayName),
        12_000,
        "Принятие приглашения заняло слишком много времени. Попробуй ещё раз."
      );

      router.replace("/dashboard");
      router.refresh();
    } catch (error) {
      reportAuthTelemetry({
        event: "invite_failed",
        email: inviteEmail,
        message:
          error instanceof Error ? error.message : "Invitation accept failed",
        details: { token },
      });
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Не удалось принять приглашение."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#0B0F1A] px-4 py-8 text-white">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-xl items-center">
        <section className="w-full rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(18,24,38,0.96),rgba(10,14,26,0.96))] p-6 shadow-[0_20px_80px_rgba(0,0,0,0.45)] backdrop-blur-xl sm:p-8">
          <div className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-300">
            RIVN OS
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            Приглашение в команду
          </h1>
          <p className="mt-3 text-sm leading-6 text-white/60">{subtitle}</p>

          {isLoading ? (
            <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm text-white/60">
              Загружаем приглашение...
            </div>
          ) : null}

          {errorMessage ? (
            <div className="mt-6 rounded-2xl border border-rose-500/25 bg-rose-500/10 p-4 text-sm text-rose-200">
              {errorMessage}
            </div>
          ) : null}

          {successMessage ? (
            <div className="mt-6 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-4 text-sm text-emerald-200">
              {successMessage}
            </div>
          ) : null}

          {!isLoading && invitation && !isInviteAvailable ? (
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/login"
                className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white transition hover:bg-white/[0.08]"
              >
                Перейти ко входу
              </Link>
            </div>
          ) : null}

          {!isLoading && invitation && isInviteAvailable ? (
            <>
              <div className="mt-6 grid gap-3 rounded-3xl border border-white/10 bg-white/[0.035] p-4 text-sm text-white/70 sm:grid-cols-2">
                <div>
                  <div className="text-xs uppercase tracking-[0.16em] text-white/35">
                    Email
                  </div>
                  <div className="mt-1 font-medium text-white">
                    {inviteEmail}
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-[0.16em] text-white/35">
                    Роль
                  </div>
                  <div className="mt-1 font-medium text-white">
                    {getWorkspaceInvitationRoleLabel(invitation.role)}
                  </div>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-1">
                <button
                  type="button"
                  onClick={() => setMode("register")}
                  className={`rounded-xl px-4 py-2 text-sm transition ${
                    mode === "register"
                      ? "bg-[#7B61FF] text-white"
                      : "text-white/55 hover:text-white"
                  }`}
                >
                  Создать аккаунт
                </button>
                <button
                  type="button"
                  onClick={() => setMode("login")}
                  className={`rounded-xl px-4 py-2 text-sm transition ${
                    mode === "login"
                      ? "bg-[#7B61FF] text-white"
                      : "text-white/55 hover:text-white"
                  }`}
                >
                  Уже есть аккаунт
                </button>
              </div>

              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                {mode === "register" ? (
                  <label className="block">
                    <div className="mb-2 text-sm text-white/65">Имя</div>
                    <input
                      value={displayName}
                      onChange={(event) => setDisplayName(event.target.value)}
                      placeholder="Например: Дмитрий"
                      className="h-12 w-full rounded-2xl border border-white/10 bg-[#0F1724] px-4 text-sm text-white outline-none placeholder:text-white/30 transition focus:border-[#6F5AFF]/50 focus:bg-[#101A29] focus:ring-1 focus:ring-[#6F5AFF]/30"
                    />
                  </label>
                ) : null}

                <label className="block">
                  <div className="mb-2 text-sm text-white/65">Пароль</div>
                  <input
                    type="password"
                    autoComplete={
                      mode === "register" ? "new-password" : "current-password"
                    }
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder={
                      mode === "register"
                        ? "Придумай пароль"
                        : "Введи пароль от аккаунта"
                    }
                    className="h-12 w-full rounded-2xl border border-white/10 bg-[#0F1724] px-4 text-sm text-white outline-none placeholder:text-white/30 transition focus:border-[#6F5AFF]/50 focus:bg-[#101A29] focus:ring-1 focus:ring-[#6F5AFF]/30"
                    required
                  />
                </label>

                {mode === "register" ? (
                  <label className="block">
                    <div className="mb-2 text-sm text-white/65">
                      Повтори пароль
                    </div>
                    <input
                      type="password"
                      autoComplete="new-password"
                      value={passwordRepeat}
                      onChange={(event) =>
                        setPasswordRepeat(event.target.value)
                      }
                      placeholder="Повтори пароль"
                      className="h-12 w-full rounded-2xl border border-white/10 bg-[#0F1724] px-4 text-sm text-white outline-none placeholder:text-white/30 transition focus:border-[#6F5AFF]/50 focus:bg-[#101A29] focus:ring-1 focus:ring-[#6F5AFF]/30"
                      required
                    />
                  </label>
                ) : null}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="h-12 w-full rounded-2xl bg-emerald-400 px-5 text-sm font-semibold text-[#07110E] transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting
                    ? "Подключаем..."
                    : mode === "register"
                      ? "Создать аккаунт и войти"
                      : "Войти и принять приглашение"}
                </button>
              </form>
            </>
          ) : null}
        </section>
      </div>
    </main>
  );
}
