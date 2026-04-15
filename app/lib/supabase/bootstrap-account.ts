import { createClient } from "./client";
import { getBillingPlanByCode } from "./billing";

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9а-яё]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function getWorkspaceNameFromEmail(email: string) {
  const localPart = email.split("@")[0]?.trim() || "workspace";
  return `${localPart} workspace`;
}

export async function bootstrapAccountForCurrentUser() {
  const supabase = createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("Пользователь не авторизован");
  }

  const nowIso = new Date().toISOString();

  // 1. PROFILE
  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (!existingProfile) {
    const { error: profileInsertError } = await supabase.from("profiles").insert({
      id: user.id,
      email: user.email ?? null,
      updated_at: nowIso,
    });

    if (profileInsertError) {
      throw new Error(`Не удалось создать profile: ${profileInsertError.message}`);
    }
  }

  // 2. ACTIVE MEMBERSHIP / WORKSPACE
  const { data: existingMembership } = await supabase
    .from("workspace_members")
    .select("*")
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  let workspaceId: string | null = existingMembership?.workspace_id ?? null;

  if (!workspaceId) {
    const workspaceName = getWorkspaceNameFromEmail(user.email ?? "workspace");
    const workspaceSlug = `${slugify(workspaceName)}-${Date.now().toString().slice(-6)}`;

    const { data: createdWorkspace, error: workspaceInsertError } = await supabase
      .from("workspaces")
      .insert({
        name: workspaceName,
        slug: workspaceSlug,
        owner_user_id: user.id,
      })
      .select("*")
      .single();

    if (workspaceInsertError || !createdWorkspace) {
      throw new Error(
        `Не удалось создать workspace: ${workspaceInsertError?.message ?? "unknown error"}`
      );
    }

    workspaceId = createdWorkspace.id;

    const { error: membershipInsertError } = await supabase
      .from("workspace_members")
      .insert({
        workspace_id: workspaceId,
        user_id: user.id,
        role: "owner",
        status: "active",
      });

    if (membershipInsertError) {
      throw new Error(
        `Не удалось создать membership: ${membershipInsertError.message}`
      );
    }
  }

  // 3. LAST ACTIVE WORKSPACE
  const { error: profileUpdateError } = await supabase
    .from("profiles")
    .update({
      last_active_workspace_id: workspaceId,
      updated_at: nowIso,
    })
    .eq("id", user.id);

  if (profileUpdateError) {
    throw new Error(
      `Не удалось обновить profile: ${profileUpdateError.message}`
    );
  }

  // 4. BILLING / TRIAL
  const { data: existingBilling } = await supabase
    .from("workspace_billing")
    .select("*")
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (!existingBilling) {
    const trialPlan = await getBillingPlanByCode("trial");
    const trialStart = new Date();
    const trialEnd = addDays(trialStart, 14);

    const { error: billingInsertError } = await supabase
      .from("workspace_billing")
      .insert({
        workspace_id: workspaceId,
        plan_code: "trial",
        billing_period: "monthly",
        subscription_status: "trial",
        subscription_started_at: null,
        subscription_ends_at: null,
        trial_started_at: trialStart.toISOString(),
        trial_ends_at: trialEnd.toISOString(),
        auto_renew: false,
        included_members: Number(trialPlan?.included_members ?? 1),
        extra_members: 0,
        max_members:
          trialPlan?.max_members === undefined ? null : trialPlan.max_members,
        team_enabled: Boolean(trialPlan?.team_enabled ?? true),
        ai_enabled: Boolean(trialPlan?.ai_enabled ?? false),
      });

    if (billingInsertError) {
      throw new Error(
        `Не удалось создать trial billing: ${billingInsertError.message}`
      );
    }
  }

  return { workspaceId };
}