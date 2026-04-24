import { NextResponse } from "next/server";

export async function GET() {
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
  });

  const data = await res.json();

  return NextResponse.json(data);
}