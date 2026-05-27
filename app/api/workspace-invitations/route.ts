import { NextRequest, NextResponse } from "next/server";
import {
  createInvitationToken,
  getInvitationExpiresAt,
  hashInvitationToken,
  isWorkspaceInvitationRole,
  normalizeInviteEmail,
} from "@/app/lib/workspace-invitations";
import {
  assertInvitationSeatAvailable,
  invitationError,
  INVITATION_SELECT,
  requireInvitationManager,
} from "./_helpers";

export const dynamic = "force-dynamic";

function getInviteBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_BASE_URL?.trim() ||
    "https://rivnos.ru"
  ).replace(/\/+$/, "");
}

export async function GET() {
  try {
    const { serviceSupabase, workspaceId } = await requireInvitationManager();

    const { data, error } = await serviceSupabase
      .from("workspace_invitations")
      .select(INVITATION_SELECT)
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({
      ok: true,
      invitations: data ?? [],
      error: "",
    });
  } catch (error) {
    return invitationError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, serviceSupabase, workspaceId } =
      await requireInvitationManager();
    const body = (await request.json().catch(() => ({}))) as {
      email?: string;
      role?: string;
    };

    const email = normalizeInviteEmail(body.email ?? "");

    if (!email || !email.includes("@")) {
      return invitationError(
        new Error("Укажи корректный email сотрудника."),
        400
      );
    }

    const role = body.role ?? "employee";

    if (!isWorkspaceInvitationRole(role)) {
      return invitationError(new Error("Выбрана неизвестная роль."), 400);
    }

    await assertInvitationSeatAvailable({ serviceSupabase, workspaceId });

    const { data: existingProfile, error: profileError } = await serviceSupabase
      .from("profiles")
      .select("id,email")
      .ilike("email", email)
      .limit(1)
      .maybeSingle();

    if (profileError) {
      throw new Error(profileError.message);
    }

    if (existingProfile?.id) {
      const { data: existingMember, error: memberError } =
        await serviceSupabase
          .from("workspace_members")
          .select("id,status")
          .eq("workspace_id", workspaceId)
          .eq("user_id", existingProfile.id)
          .neq("status", "removed")
          .limit(1)
          .maybeSingle();

      if (memberError) {
        throw new Error(memberError.message);
      }

      if (existingMember) {
        return invitationError(
          new Error("Этот пользователь уже добавлен в кабинет."),
          409
        );
      }
    }

    const { data: pendingInvite, error: pendingError } = await serviceSupabase
      .from("workspace_invitations")
      .select("id")
      .eq("workspace_id", workspaceId)
      .ilike("email", email)
      .eq("status", "pending")
      .gt("expires_at", new Date().toISOString())
      .limit(1)
      .maybeSingle();

    if (pendingError) {
      throw new Error(pendingError.message);
    }

    if (pendingInvite) {
      return invitationError(
        new Error("Для этого email уже есть активное приглашение."),
        409
      );
    }

    const token = createInvitationToken();
    const tokenHash = hashInvitationToken(token);

    const { data: invitation, error } = await serviceSupabase
      .from("workspace_invitations")
      .insert({
        workspace_id: workspaceId,
        email,
        role,
        token_hash: tokenHash,
        status: "pending",
        invited_by: user.id,
        expires_at: getInvitationExpiresAt(),
      })
      .select(INVITATION_SELECT)
      .single();

    if (error) {
      throw new Error(error.message);
    }

    const inviteUrl = new URL(`/invite/${token}`, getInviteBaseUrl());

    return NextResponse.json({
      ok: true,
      invitation,
      inviteUrl: inviteUrl.toString(),
      emailDelivery: "manual",
      error: "",
    });
  } catch (error) {
    return invitationError(error);
  }
}
