import { createClient } from "@supabase/supabase-js";

function normalizeUrl(value: string) {
  return value.replace(/\/+$/, "");
}

function getHostedSupabaseUrl(serviceRoleKey: string) {
  try {
    const [, encodedPayload] = serviceRoleKey.split(".");
    if (!encodedPayload) return null;

    const payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8")
    ) as { ref?: unknown };
    const projectRef = typeof payload.ref === "string" ? payload.ref.trim() : "";

    if (!/^[a-z0-9]{15,40}$/.test(projectRef)) return null;
    return `https://${projectRef}.supabase.co`;
  } catch {
    return null;
  }
}

function getServerSupabaseUrl(publicUrl: string, serviceRoleKey: string) {
  const explicitServerUrl =
    process.env.SUPABASE_SERVER_URL || process.env.SUPABASE_URL;

  if (explicitServerUrl) {
    return normalizeUrl(explicitServerUrl);
  }

  try {
    const hostname = new URL(publicUrl).hostname.toLowerCase();
    if (hostname.endsWith(".supabase.co")) {
      return normalizeUrl(publicUrl);
    }
  } catch {
    // createClient reports the invalid public URL if no direct URL can be derived.
  }

  return getHostedSupabaseUrl(serviceRoleKey) || normalizeUrl(publicUrl);
}

export function createServiceRoleClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL не задан");
  }

  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY не задан");
  }

  return createClient(
    getServerSupabaseUrl(supabaseUrl, serviceRoleKey),
    serviceRoleKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
}
