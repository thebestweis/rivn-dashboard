import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/app/lib/supabase/server";
import { createServiceRoleClient } from "@/app/lib/supabase/service-role";
import { buildBillingAccessState } from "@/app/lib/billing-core";

export const INVITATION_SELECT =
  "id,workspace_id,email,role,status,invited_by,accepted_by,accepted_at,expires_at,created_at,updated_at";

export function invitationError(error: unknown, status = 500) {
  return NextResponse.json(
    {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Не удалось обработать приглашение.",
    },
    { status }
  );
}

export async function requireInvitationManager() {
  const authSupabase = await createServerClient();
  const {
    data: { user },
    error: userError,
  } = await authSupabase.auth.getUser();

  if (userError || !user) {
    throw new Error("Сессия закончилась. Войди заново.");
  }

  const serviceSupabase = createServiceRoleClient();

  const { data: profile, error: profileError } = await serviceSupabase
    .from("profiles")
    .select("id,last_active_workspace_id")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    throw new Error(profileError.message);
  }

  const workspaceId = profile?.last_active_workspace_id ?? null;

  if (!workspaceId) {
    throw new Error("Сначала выбери рабочий кабинет.");
  }

  const { data: membership, error: membershipError } = await serviceSupabase
    .from("workspace_members")
    .select("id,role,status")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (membershipError) {
    throw new Error(membershipError.message);
  }

  if (!membership || !["owner", "admin"].includes(String(membership.role))) {
    throw new Error("Приглашать сотрудников может только владелец или админ.");
  }

  return {
    user,
    serviceSupabase,
    workspaceId,
    membership,
  };
}

export async function assertInvitationSeatAvailable(params: {
  serviceSupabase: ReturnType<typeof createServiceRoleClient>;
  workspaceId: string;
}) {
  const { serviceSupabase, workspaceId } = params;

  const { data: billing, error: billingError } = await serviceSupabase
    .from("workspace_billing")
    .select("*")
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (billingError) {
    throw new Error(billingError.message);
  }

  const billingAccess = buildBillingAccessState(billing as any);

  if (billingAccess.isReadOnly) {
    throw new Error("Подписка неактивна. Сначала продли тариф.");
  }

  if (!billingAccess.teamEnabled) {
    throw new Error("Командная работа доступна только на тарифе Team и выше.");
  }

  const [
    { count: membersCount, error: membersError },
    { count: invitesCount, error: invitesError },
  ] = await Promise.all([
    serviceSupabase
      .from("workspace_members")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .in("status", ["active", "invited"]),
    serviceSupabase
      .from("workspace_invitations")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .eq("status", "pending")
      .gt("expires_at", new Date().toISOString()),
  ]);

  if (membersError) {
    throw new Error(membersError.message);
  }

  if (invitesError) {
    throw new Error(invitesError.message);
  }

  const seatsUsed = Number(membersCount ?? 0) + Number(invitesCount ?? 0);
  const seatsLimit = Number(billingAccess.totalAllowedMembers ?? 0);

  if (seatsUsed >= seatsLimit) {
    throw new Error(
      "Достигнут лимит участников по тарифу. Отмени лишнее приглашение, докупи место или перейди на тариф выше."
    );
  }
}
