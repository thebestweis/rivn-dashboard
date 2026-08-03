import type { NextConfig } from "next";

const productionAssetHost = process.env.NEXT_PUBLIC_ASSET_HOST?.replace(
  /\/$/,
  ""
);

const isDev = process.env.NODE_ENV === "development";

function getSupabaseConnectSources() {
  const sources = new Set([
    "https://*.supabase.co",
    "wss://*.supabase.co",
    "https://supabase.rivnos.ru",
    "wss://supabase.rivnos.ru",
  ]);

  const configuredUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();

  if (configuredUrl) {
    try {
      const origin = new URL(configuredUrl).origin;
      sources.add(origin);
      sources.add(origin.replace(/^http/, "ws"));
    } catch {
      // Supabase client initialization will report an invalid URL at runtime.
    }
  }

  return [...sources].join(" ");
}

const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data: https:",
  "font-src 'self' data:",
  `connect-src 'self' ${getSupabaseConnectSources()}`,
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR?.trim() || ".next",
  assetPrefix: productionAssetHost,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: contentSecurityPolicy,
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "Permissions-Policy",
            value:
              "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
