import { bootstrapAccountForCurrentUser } from "./bootstrap-account";
import { createClient } from "./client";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isAlreadyRegisteredAuthError(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : "";

  return (
    message.includes("already registered") ||
    message.includes("already exists") ||
    message.includes("user already")
  );
}

type AuthErrorDetails = {
  code?: unknown;
  message?: unknown;
  status?: unknown;
};

export function getLoginErrorMessage(error: unknown) {
  const details =
    error && typeof error === "object" ? (error as AuthErrorDetails) : null;
  const status =
    typeof details?.status === "number" ? details.status : undefined;
  const code = typeof details?.code === "string" ? details.code.toLowerCase() : "";
  const message =
    error instanceof Error
      ? error.message.toLowerCase()
      : typeof details?.message === "string"
        ? details.message.toLowerCase()
        : "";

  if (
    code === "invalid_credentials" ||
    message.includes("invalid login credentials") ||
    message.includes("invalid credentials")
  ) {
    return "Неверный логин или пароль";
  }

  if (
    code === "email_not_confirmed" ||
    message.includes("email not confirmed")
  ) {
    return "Email ещё не подтверждён. Проверь письмо от RIVN OS.";
  }

  if (status === 429 || code === "over_request_rate_limit") {
    return "Слишком много попыток входа. Подожди минуту и попробуй снова.";
  }

  const isServiceUnavailable =
    status === 0 ||
    status === 402 ||
    (typeof status === "number" && status >= 500) ||
    message.includes("exceed_egress_quota") ||
    message.includes("project is restricted") ||
    message.includes("service for this project is restricted") ||
    message.includes("failed to fetch") ||
    message.includes("fetch failed") ||
    message.includes("networkerror") ||
    message.includes("timeout") ||
    message.includes("bootstrap") ||
    message.includes("context");

  if (isServiceUnavailable) {
    return "Сервис авторизации временно недоступен. Пароль менять не нужно. Попробуй позже или обратись к администратору RIVN OS.";
  }

  return "Не удалось выполнить вход. Попробуй ещё раз или обратись к администратору RIVN OS.";
}

export async function withTimeout<T>(
  operation: PromiseLike<T>,
  timeoutMs: number,
  timeoutMessage: string
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;

  try {
    return await Promise.race([
      Promise.resolve(operation),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function waitForAuthSessionReady() {
  const supabase = createClient();

  for (let attempt = 0; attempt < 16; attempt += 1) {
    const {
      data: { session },
    } = await withTimeout<Awaited<ReturnType<typeof supabase.auth.getSession>>>(
      supabase.auth.getSession(),
      4_000,
      "Auth session timeout"
    );

    if (session) return session;

    await sleep(250);
  }

  throw new Error("Auth session was not created in time");
}

export async function bootstrapAccountForAuthFlow() {
  let lastError: unknown = null;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      await waitForAuthSessionReady();
      return await withTimeout(
        bootstrapAccountForCurrentUser(),
        30_000,
        "Account bootstrap timeout"
      );
    } catch (error) {
      lastError = error;
      await sleep(500 + attempt * 400);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Account bootstrap failed");
}
