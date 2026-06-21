import { NextResponse } from "next/server";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

export const leadProjectStatuses = ["draft", "active", "paused", "archived"] as const;
export const readerStatuses = ["active", "paused", "auth_required", "banned", "error"] as const;
export const sourceChatTypes = ["group", "supergroup", "channel_discussion"] as const;
export const sourceChatAccessLevels = ["public", "private", "special"] as const;
export const sourceChatStatuses = ["active", "paused", "pending_access", "access_lost", "error"] as const;
export const keywordMatchTypes = ["contains", "exact", "fuzzy"] as const;

export type AdminLeadsClient = SupabaseClient;

export function normalizeText(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function requiredString(value: unknown, label: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} обязательно для заполнения`);
  }

  return value.trim();
}

export function optionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function optionalNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);

  if (!Number.isFinite(number)) {
    throw new Error("Числовое поле заполнено некорректно");
  }

  return number;
}

export function requireEnum<T extends readonly string[]>(
  value: unknown,
  allowed: T,
  fallback: T[number]
): T[number] {
  if (typeof value !== "string") return fallback;
  return allowed.includes(value) ? (value as T[number]) : fallback;
}

export async function writeAdminLeadsAudit(
  serviceSupabase: AdminLeadsClient,
  params: {
    userId: string;
    workspaceId?: string | null;
    action: string;
    entityType: string;
    entityId?: string | null;
    metadata?: Record<string, unknown>;
  }
) {
  await serviceSupabase.from("rivn_leads_audit_logs").insert({
    workspace_id: params.workspaceId ?? null,
    user_id: params.userId,
    action: params.action,
    entity_type: params.entityType,
    entity_id: params.entityId ?? null,
    metadata: params.metadata ?? {},
  });
}

export function adminLeadsFailure(error: unknown) {
  console.error("RIVN Leads admin API error:", error);

  const message =
    error instanceof Error
      ? error.message
      : "Не удалось получить данные RIVN Leads. Обнови страницу или проверь настройки сервера.";

  return NextResponse.json(
    {
      ok: false,
      error: message,
      code: "RIVN_LEADS_ADMIN_ERROR",
    },
    { status: 500 }
  );
}

function getEncryptionKey() {
  const key = process.env.RIVN_LEADS_ENCRYPTION_KEY || process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error("Ключ шифрования RIVN Leads не заполнен на сервере");
  }

  const maybeBase64 = Buffer.from(key, "base64");
  if (maybeBase64.length === 32) return maybeBase64;

  const utf8 = Buffer.from(key, "utf8");
  if (utf8.length === 32) return utf8;

  throw new Error("Ключ шифрования RIVN Leads должен быть ровно 32 байта");
}

export function encryptRivnLeadsSessionString(sessionString: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(sessionString, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return ["v1", iv.toString("base64"), tag.toString("base64"), encrypted.toString("base64")].join(":");
}

export function decryptRivnLeadsSessionString(encryptedSessionString: string) {
  const [version, ivBase64, tagBase64, encryptedBase64] = encryptedSessionString.split(":");

  if (version !== "v1" || !ivBase64 || !tagBase64 || !encryptedBase64) {
    throw new Error("Telegram session string сохранён в неподдерживаемом формате");
  }

  const decipher = createDecipheriv("aes-256-gcm", getEncryptionKey(), Buffer.from(ivBase64, "base64"));
  decipher.setAuthTag(Buffer.from(tagBase64, "base64"));

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedBase64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}
