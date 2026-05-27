import { NextRequest, NextResponse } from "next/server";
import { hashInvitationToken } from "@/app/lib/workspace-invitations";
import { createClient as createServerClient } from "@/app/lib/supabase/server";
import { createServiceRoleClient } from "@/app/lib/supabase/service-role";
import { invitationError } from "../_helpers";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      token?: string;
      displayName?: string;
    };
    const token = body.token ?? "";

    if (!token) {
      return invitationError(
        new Error("Ссылка приглашения некорректна."),
        400
      );
    }

    const authSupabase = await createServerClient();
    const {
      data: { user },
      error: userError,
    } = await authSupabase.auth.getUser();

    if (userError || !user) {
      return invitationError(
        new Error("Сессия закончилась. Войди или зарегистрируйся заново."),
        401
      );
    }

    const userEmail = user.email?.trim().toLowerCase() ?? "";

    if (!userEmail) {
      return invitationError(
        new Error("У аккаунта не найден email. Напиши в поддержку RIVN OS."),
        400
      );
    }

    const serviceSupabase = createServiceRoleClient();
    const tokenHash = hashInvitationToken(token);

    const { data: invitation, error: invitationErrorResult } =
      await serviceSupabase
        .from("workspace_invitations")
        .select("id,workspace_id,email,role,status,expires_at")
        .eq("token_hash", tokenHash)
        .maybeSingle();

    if (invitationErrorResult) {
      throw new Error(invitationErrorResult.message);
    }

    if (!invitation) {
      return invitationError(new Error("Приглашение не найдено."), 404);
    }

    if (invitation.status !== "pending") {
      return invitationError(
        new Error("Это приглашение уже использовано, отменено или истекло."),
        409
      );
    }

    if (new Date(invitation.expires_at).getTime() < Date.now()) {
      await serviceSupabase
        .from("workspace_invitations")
        .update({
          status: "expired",
          updated_at: new Date().toISOString(),
        })
        .eq("id", invitation.id);

      return invitationError(
        new Error("Срок действия приглашения истёк. Попроси владельца отправить новое."),
        410
      );
    }

    if (String(invitation.email).trim().toLowerCase() !== userEmail) {
      return invitationError(
        new Error(
          `Приглашение создано для ${invitation.email}. Сейчас ты вошёл под ${userEmail}.`
        ),
        403
      );
    }

    const nowIso = new Date().toISOString();
    const displayName = body.displayName?.trim() || null;

    const { data: profile, error: profileError } = await serviceSupabase
      .from("profiles")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      throw new Error(profileError.message);
    }

    if (!profile) {
      const { error: profileInsertError } = await serviceSupabase
        .from("profiles")
        .insert({
          id: user.id,
          email: userEmail,
          updated_at: nowIso,
        });

      if (profileInsertError) {
        throw new Error(profileInsertError.message);
      }
    }

    const { data: existingMember, error: memberLookupError } =
      await serviceSupabase
        .from("workspace_members")
        .select("id,status")
        .eq("workspace_id", invitation.workspace_id)
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();

    if (memberLookupError) {
      throw new Error(memberLookupError.message);
    }

    if (existingMember) {
      const updatePayload: Record<string, unknown> = {
        role: invitation.role,
        status: "active",
        updated_at: nowIso,
      };

      if (displayName) {
        updatePayload.display_name = displayName;
      }

      const { error: memberUpdateError } = await serviceSupabase
        .from("workspace_members")
        .update(updatePayload)
        .eq("id", existingMember.id);

      if (memberUpdateError) {
        throw new Error(memberUpdateError.message);
      }
    } else {
      const { error: memberInsertError } = await serviceSupabase
        .from("workspace_members")
        .insert({
          workspace_id: invitation.workspace_id,
          user_id: user.id,
          role: invitation.role,
          status: "active",
          display_name: displayName,
        });

      if (memberInsertError) {
        throw new Error(memberInsertError.message);
      }
    }

    const { error: profileUpdateError } = await serviceSupabase
      .from("profiles")
      .update({
        last_active_workspace_id: invitation.workspace_id,
        updated_at: nowIso,
      })
      .eq("id", user.id);

    if (profileUpdateError) {
      throw new Error(profileUpdateError.message);
    }

    const { error: invitationUpdateError } = await serviceSupabase
      .from("workspace_invitations")
      .update({
        status: "accepted",
        accepted_by: user.id,
        accepted_at: nowIso,
        updated_at: nowIso,
      })
      .eq("id", invitation.id);

    if (invitationUpdateError) {
      throw new Error(invitationUpdateError.message);
    }

    return NextResponse.json({
      ok: true,
      workspaceId: invitation.workspace_id,
      error: "",
    });
  } catch (error) {
    return invitationError(error);
  }
}
