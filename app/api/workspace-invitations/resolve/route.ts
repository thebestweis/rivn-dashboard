import { NextRequest, NextResponse } from "next/server";
import { hashInvitationToken } from "@/app/lib/workspace-invitations";
import { createServiceRoleClient } from "@/app/lib/supabase/service-role";
import { invitationError } from "../_helpers";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get("token") ?? "";

    if (!token) {
      return invitationError(
        new Error("Ссылка приглашения некорректна."),
        400
      );
    }

    const serviceSupabase = createServiceRoleClient();
    const tokenHash = hashInvitationToken(token);

    const { data: invitation, error } = await serviceSupabase
      .from("workspace_invitations")
      .select(
        `
        id,
        workspace_id,
        email,
        role,
        status,
        expires_at,
        created_at,
        workspaces (
          id,
          name
        )
      `
      )
      .eq("token_hash", tokenHash)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    if (!invitation) {
      return invitationError(new Error("Приглашение не найдено."), 404);
    }

    const isExpired = new Date(invitation.expires_at).getTime() < Date.now();

    if (invitation.status === "pending" && isExpired) {
      await serviceSupabase
        .from("workspace_invitations")
        .update({
          status: "expired",
          updated_at: new Date().toISOString(),
        })
        .eq("id", invitation.id);
    }

    return NextResponse.json({
      ok: true,
      invitation: {
        ...invitation,
        status:
          invitation.status === "pending" && isExpired
            ? "expired"
            : invitation.status,
      },
      error: "",
    });
  } catch (error) {
    return invitationError(error);
  }
}
