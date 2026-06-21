import { NextResponse } from "next/server";
import { getErrorMessage, requireSuperAdminRoute } from "@/app/api/admin/_utils";

export async function GET() {
  try {
    if (
      process.env.NODE_ENV === "production" &&
      process.env.ENABLE_DEBUG_API !== "true"
    ) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    }

    await requireSuperAdminRoute();

    const res = await fetch("https://api.avito.ru/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: process.env.AVITO_CLIENT_ID!,
        client_secret: process.env.AVITO_CLIENT_SECRET!,
      }),
      cache: "no-store",
    });

    const data = await res.json();

    return NextResponse.json({
      ok: res.ok,
      tokenType: data?.token_type ?? null,
      expiresIn: data?.expires_in ?? null,
      hasAccessToken: Boolean(data?.access_token),
      error: res.ok ? "" : data?.error ?? "Avito token request failed",
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: getErrorMessage(error) },
      { status: 403 }
    );
  }
}
