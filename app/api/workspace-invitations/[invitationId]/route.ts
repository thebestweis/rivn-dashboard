import { NextRequest, NextResponse } from "next/server";
import {
  createInvitationToken,
  getInvitationExpiresAt,
  hashInvitationToken,
} from "../../../lib/workspace-invitations";
import {
  invitationError,
  INVITATION_SELECT,
  requireInvitationManager,
} from "../_helpers";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ invitationId: string }> }
) {
  try {
    const { serviceSupabase, workspaceId } = await requireInvitationManager();
    const { invitationId } = await params;
    const body = (await request.json().catch(() => ({}))) as {
      action?: string;
    };

    if (body.action !== "cancel" && body.action !== "refresh") {
      return invitationError(new Error("Неизвестное действие."), 400);
    }

    if (body.action === "refresh") {
      const token = createInvitationToken();
      const tokenHash = hashInvitationToken(token);
      const expiresAt = getInvitationExpiresAt();

      const { data, error } = await serviceSupabase
        .from("workspace_invitations")
        .update({
          token_hash: tokenHash,
          expires_at: expiresAt,
          status: "pending",
          updated_at: new Date().toISOString(),
        })
        .eq("id", invitationId)
        .eq("workspace_id", workspaceId)
        .eq("status", "pending")
        .select(INVITATION_SELECT)
        .maybeSingle();

      if (error) {
        throw new Error(error.message);
      }

      if (!data) {
        return invitationError(
          new Error("Активное приглашение не найдено или уже обработано."),
          404
        );
      }

      return NextResponse.json({
        ok: true,
        invitation: data,
        inviteUrl: `${request.nextUrl.origin}/invite/${token}`,
        error: "",
      });
    }

    const { data, error } = await serviceSupabase
      .from("workspace_invitations")
      .update({
        status: "canceled",
        updated_at: new Date().toISOString(),
      })
      .eq("id", invitationId)
      .eq("workspace_id", workspaceId)
      .eq("status", "pending")
      .select(INVITATION_SELECT)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    if (!data) {
      return invitationError(
        new Error("Активное приглашение не найдено или уже обработано."),
        404
      );
    }

    return NextResponse.json({
      ok: true,
      invitation: data,
      error: "",
    });
  } catch (error) {
    return invitationError(error);
  }
}
