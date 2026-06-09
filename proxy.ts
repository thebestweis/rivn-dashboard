import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { updateSession } from "./app/lib/supabase/proxy";

const DEBUG_API_PATH_PATTERNS = [
  /^\/api\/avito\/test(?:-|\/|$)/,
  /^\/api\/avito\/get-token$/,
  /^\/api\/avito\/get-all-items$/,
  /^\/api\/telegram\/test(?:\/|$)/,
];

const API_RATE_LIMITS = [
  { pattern: /^\/api\/cron(?:\/|$)/, limit: 30, windowMs: 60_000 },
  { pattern: /^\/api\/telegram\/webhook$/, limit: 120, windowMs: 60_000 },
  { pattern: /^\/api\/crm(?:\/|$)/, limit: 90, windowMs: 60_000 },
  { pattern: /^\/api\/avito\/messenger\/webhook$/, limit: 120, windowMs: 60_000 },
  { pattern: /^\/api\/rivn-leads\/ingest$/, limit: 120, windowMs: 60_000 },
  { pattern: /^\/api\/avito\/(?:test|get-token|get-all-items)/, limit: 10, windowMs: 60_000 },
] as const;

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

const rateLimitBuckets = new Map<string, RateLimitBucket>();

function isDebugApiPath(pathname: string) {
  return DEBUG_API_PATH_PATTERNS.some((pattern) => pattern.test(pathname));
}

function getRateLimitRule(pathname: string) {
  return API_RATE_LIMITS.find((rule) => rule.pattern.test(pathname));
}

function getClientIp(request: NextRequest) {
  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-real-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

function checkRateLimit(request: NextRequest) {
  const rule = getRateLimitRule(request.nextUrl.pathname);

  if (!rule) return null;

  const now = Date.now();
  const clientIp = getClientIp(request);
  const key = `${request.nextUrl.pathname}:${clientIp}`;
  const bucket = rateLimitBuckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    rateLimitBuckets.set(key, {
      count: 1,
      resetAt: now + rule.windowMs,
    });
    return null;
  }

  bucket.count += 1;

  if (bucket.count <= rule.limit) {
    return null;
  }

  const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));

  return withApiPrivacyHeaders(
    NextResponse.json(
      { ok: false, error: "Too many requests" },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfterSeconds),
        },
      }
    )
  );
}

function withApiPrivacyHeaders(response: NextResponse) {
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api/")) {
    if (
      process.env.NODE_ENV === "production" &&
      isDebugApiPath(pathname) &&
      process.env.ENABLE_DEBUG_API !== "true"
    ) {
      return withApiPrivacyHeaders(
        NextResponse.json(
          { ok: false, error: "Debug API is disabled in production" },
          { status: 404 }
        )
      );
    }

    const rateLimitResponse = checkRateLimit(request);

    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    return withApiPrivacyHeaders(NextResponse.next());
  }

  return await updateSession(request);
}

export const config = {
  matcher: [
    "/api/:path*",
    "/dashboard/:path*",
    "/clients/:path*",
    "/projects/:path*",
    "/tasks/:path*",
    "/payments/:path*",
    "/expenses/:path*",
    "/payroll/:path*",
    "/analytics/:path*",
    "/avito-reports/:path*",
    "/crm/:path*",
    "/billing/:path*",
    "/settings/:path*",
    "/admin/:path*",
    "/login",
    "/register",
    "/session-expired",
  ],
};
