export const dynamic = "force-dynamic";

type TildaPayload = Record<string, unknown>;

function normalizeText(value: unknown) {
  if (typeof value === "number" || typeof value === "bigint") {
    return String(value).trim();
  }

  return typeof value === "string" ? value.trim() : "";
}

function pickFirst(payload: TildaPayload, keys: string[]) {
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

  const normalized = value.replace(/\s/g, "").replace(",", ".");
  const parsed = Number(normalized);

  return Number.isFinite(parsed) ? parsed : null;
}

async function readPayload(request: Request): Promise<TildaPayload> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return (await request.json()) as TildaPayload;
  }

  if (
    contentType.includes("application/x-www-form-urlencoded") ||
    contentType.includes("multipart/form-data")
  ) {
    const formData = await request.formData();
    return Object.fromEntries(
      Array.from(formData.entries()).map(([key, value]) => [
        key,
        typeof value === "string" ? value : value.name,
      ])
    );
  }

  const text = await request.text();
  const params = new URLSearchParams(text);

  return Object.fromEntries(params.entries());
}

function buildDescription(payload: TildaPayload) {
  const ignoredKeys = new Set([
    "name",
    "Name",
    "NAME",
    "phone",
    "Phone",
    "PHONE",
    "tel",
    "Телефон",
    "telegram",
    "Telegram",
    "serviceAmount",
    "budget",
  ]);

  const lines = Object.entries(payload)
    .filter(([key, value]) => !ignoredKeys.has(key) && normalizeText(value))
    .map(([key, value]) => `${key}: ${normalizeText(value)}`);

  return lines.length > 0
    ? `Заявка пришла с формы Tilda.\n\n${lines.join("\n")}`
    : "Заявка пришла с формы Tilda.";
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
      "Name",
      "NAME",
      "Имя",
      "Ваше имя",
      "clientName",
    ]);
    const phone = pickFirst(payload, [
      "phone",
      "Phone",
      "PHONE",
      "tel",
      "Телефон",
      "Ваш телефон",
    ]);
    const telegram = pickFirst(payload, [
      "telegram",
      "Telegram",
      "TELEGRAM",
      "tg",
      "username",
    ]);
    const serviceAmount = toNumberOrNull(
      pickFirst(payload, ["serviceAmount", "service_amount", "Стоимость услуги"])
    );
    const budget = toNumberOrNull(
      pickFirst(payload, ["budget", "Бюджет", "Рекламный бюджет"])
    );
    const formName = pickFirst(payload, [
      "formname",
      "form_name",
      "Форма",
      "formid",
    ]);

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
        sourceKind: "tilda",
        sourceName: "Tilda",
        title: formName
          ? `Заявка Tilda: ${formName}`
          : clientName
            ? `Заявка Tilda: ${clientName}`
            : "Заявка Tilda",
        clientName,
        phone,
        telegram,
        serviceAmount,
        budget,
        description: buildDescription(payload),
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
            : "Tilda CRM webhook failed",
      },
      { status: 500 }
    );
  }
}
