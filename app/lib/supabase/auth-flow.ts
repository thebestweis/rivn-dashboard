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
        15_000,
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
