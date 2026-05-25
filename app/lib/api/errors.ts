import { NextResponse } from "next/server";

export type ApiErrorCode =
  | "AUTH_REQUIRED"
  | "FORBIDDEN"
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "EXTERNAL_SERVICE_ERROR"
  | "DATABASE_ERROR"
  | "INTERNAL_ERROR";

const friendlyMessages: Record<ApiErrorCode, string> = {
  AUTH_REQUIRED: "Сессия закончилась. Войди заново.",
  FORBIDDEN: "Нет доступа к этому действию.",
  VALIDATION_ERROR: "Проверь данные и попробуй ещё раз.",
  NOT_FOUND: "Нужные данные не найдены.",
  RATE_LIMITED: "Сервис временно ограничил запросы. Попробуй чуть позже.",
  EXTERNAL_SERVICE_ERROR:
    "Внешний сервис временно не ответил. Мы сохранили ошибку и можно повторить позже.",
  DATABASE_ERROR: "Не удалось получить данные. Попробуй обновить страницу.",
  INTERNAL_ERROR: "Что-то пошло не так. Попробуй ещё раз или напиши в поддержку.",
};

export function getHumanApiError(error: unknown, fallbackCode: ApiErrorCode = "INTERNAL_ERROR") {
  const rawMessage = error instanceof Error ? error.message : String(error ?? "");
  const normalized = rawMessage.toLowerCase();

  if (
    normalized.includes("not authenticated") ||
    normalized.includes("jwt") ||
    normalized.includes("auth") ||
    normalized.includes("не авториз")
  ) {
    return friendlyMessages.AUTH_REQUIRED;
  }

  if (
    normalized.includes("permission") ||
    normalized.includes("forbidden") ||
    normalized.includes("нет доступа")
  ) {
    return friendlyMessages.FORBIDDEN;
  }

  if (
    normalized.includes("rate") ||
    normalized.includes("429") ||
    normalized.includes("temporarily restricted")
  ) {
    return friendlyMessages.RATE_LIMITED;
  }

  if (
    normalized.includes("supabase") ||
    normalized.includes("relation") ||
    normalized.includes("column") ||
    normalized.includes("database")
  ) {
    return friendlyMessages.DATABASE_ERROR;
  }

  if (
    normalized.includes("fetch failed") ||
    normalized.includes("unexpected token") ||
    normalized.includes("avito") ||
    normalized.includes("telegram")
  ) {
    return friendlyMessages.EXTERNAL_SERVICE_ERROR;
  }

  return friendlyMessages[fallbackCode] || friendlyMessages.INTERNAL_ERROR;
}

export function apiSuccess<T extends Record<string, unknown>>(data: T, init?: ResponseInit) {
  return NextResponse.json({ ok: true, error: "", ...data }, init);
}

export function apiFailure(params: {
  error: unknown;
  status?: number;
  code?: ApiErrorCode;
  details?: Record<string, unknown>;
}) {
  return NextResponse.json(
    {
      ok: false,
      error: getHumanApiError(params.error, params.code),
      code: params.code ?? "INTERNAL_ERROR",
      details: params.details ?? {},
    },
    { status: params.status ?? 500 }
  );
}
