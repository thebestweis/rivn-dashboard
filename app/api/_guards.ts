import "server-only";

import { createClient as createServerClient } from "@/app/lib/supabase/server";
import type { createServiceRoleClient } from "@/app/lib/supabase/service-role";

export class ApiAccessError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export function apiAccessErrorResponse(error: unknown) {
  if (error instanceof ApiAccessError) {
    return Response.json(
      { ok: false, error: error.message },
      { status: error.status }
    );
  }

  return Response.json(
    {
      ok: false,
      error: error instanceof Error ? error.message : "Internal server error",
    },
    { status: 500 }
  );
}

export async function requireAuthenticatedUser() {
  const authSupabase = await createServerClient();
  const {
    data: { user },
    error,
  } = await authSupabase.auth.getUser();

  if (error || !user) {
    throw new ApiAccessError("Unauthorized", 401);
  }

  return user;
}

export async function requireWorkspaceMember(params: {
  serviceSupabase: ReturnType<typeof createServiceRoleClient>;
  workspaceId: string;
  userId: string;
  roles?: string[];
}) {
  const { serviceSupabase, workspaceId, userId, roles } = params;

  const { data: membership, error } = await serviceSupabase
    .from("workspace_members")
    .select("id,role,status")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!membership) {
    throw new ApiAccessError("Forbidden", 403);
  }

  if (roles && !roles.includes(String(membership.role))) {
    throw new ApiAccessError("Forbidden", 403);
  }

  return membership;
}
