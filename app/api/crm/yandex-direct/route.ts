import { ApiAccessError } from "@/app/api/_guards";
import {
  assertContentLengthLimit,
  readJsonWithLimit,
  readTextWithLimit,
} from "@/app/api/_request";

export const dynamic = "force-dynamic";

type YandexDirectPayload = Record<string, unknown>;

function normalizeText(value: unknown) {
  if (typeof value === "number" || typeof value === "bigint") {
    return String(value).trim();
  }

  return typeof value === "string" ? value.trim() : "";
}

function pickFirst(payload: YandexDirectPayload, keys: string[]) {
  for (const key of keys) {
    const value = normalizeText(payload[key]);

    if (value) {
      return value;
    }
  }

  const lowerPayload = new Map(
    Object.entries(payload).map(([key, value]) => [key.toLowerCase(), value])
  );

  for (const key of keys) {
    const value = normalizeText(lowerPayload.get(key.toLowerCase()));

    if (value) {
      return value;
    }
  }

  return "";
}

function toNumberOrNull(value: string) {
  if (!value) return null;

  const parsed = Number(value.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

async function readPayload(request: Request): Promise<YandexDirectPayload> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return await readJsonWithLimit<YandexDirectPayload>(request, 256 * 1024);
  }

  if (
    contentType.includes("application/x-www-form-urlencoded") ||
    contentType.includes("multipart/form-data")
  ) {
    assertContentLengthLimit(request, 512 * 1024);
    const formData = await request.formData();
    return Object.fromEntries(
      Array.from(formData.entries()).map(([key, value]) => [
        key,
        typeof value === "string" ? value : value.name,
      ])
    );
  }

  return Object.fromEntries(
    new URLSearchParams(await readTextWithLimit(request, 256 * 1024)).entries()
  );
}

function buildDescription(payload: YandexDirectPayload) {
  const lines = Object.entries(payload)
    .filter(([, value]) => normalizeText(value))
    .map(([key, value]) => `${key}: ${normalizeText(value)}`);

  return lines.length > 0
    ? `Заявка пришла из рекламного канала Яндекс Директ.\n\n${lines.join("\n")}`
    : "Заявка пришла из рекламного канала Яндекс Директ.";
}

export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    const workspaceId = normalizeText(url.searchParams.get("workspaceId"));
    const secret = normalizeText(url.searchParams.get("secret"));
    const payload = await readPayload(request);

    if (!workspaceId) {
      return Response.json(
        { ok: false, error: "workspaceId is required" },
        { status: 400 }
      );
    }

    const clientName = pickFirst(payload, [
      "name",
      "clientName",
      "client_name",
      "Имя",
      "ФИО",
    ]);
    const phone = pickFirst(payload, [
      "phone",
      "tel",
      "clientPhone",
      "Телефон",
    ]);
    const telegram = pickFirst(payload, ["telegram", "tg", "username"]);
    const campaign = pickFirst(payload, [
      "utm_campaign",
      "campaign",
      "campaign_name",
      "Кампания",
    ]);
    const keyword = pickFirst(payload, [
      "utm_term",
      "keyword",
      "phrase",
      "Ключевая фраза",
    ]);
    const budget = toNumberOrNull(
      pickFirst(payload, ["budget", "ad_budget", "Бюджет"])
    );
    const serviceAmount = toNumberOrNull(
      pickFirst(payload, ["serviceAmount", "service_amount", "Стоимость услуги"])
    );

    const leadResponse = await fetch(new URL("/api/crm/leads", request.url), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(secret ? { Authorization: `Bearer ${secret}` } : {}),
        ...(request.headers.get("authorization")
          ? { Authorization: request.headers.get("authorization") as string }
          : {}),
        ...(request.headers.get("x-rivn-secret")
          ? { "x-rivn-secret": request.headers.get("x-rivn-secret") as string }
          : {}),
      },
      body: JSON.stringify({
        workspaceId,
        sourceKind: "yandex_direct",
        sourceName: "Яндекс Директ",
        title: campaign
          ? `Заявка Яндекс Директ: ${campaign}`
          : clientName
            ? `Заявка Яндекс Директ: ${clientName}`
            : "Заявка Яндекс Директ",
        clientName,
        phone,
        telegram,
        serviceAmount,
        budget,
        description: [
          buildDescription(payload),
          keyword ? `\nКлючевая фраза: ${keyword}` : "",
        ].join(""),
      }),
      cache: "no-store",
    });

    const result = await leadResponse.json().catch(() => null);

    return Response.json(result ?? { ok: leadResponse.ok }, {
      status: leadResponse.status,
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Yandex Direct CRM webhook failed",
      },
      { status: error instanceof ApiAccessError ? error.status : 500 }
    );
  }
}
