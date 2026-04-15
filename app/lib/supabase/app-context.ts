import { createClient } from "./client";

export type AppContext = {
  supabase: ReturnType<typeof createClient>;
  user: any;
  profile: any;
  workspace: any;
  membership: any;
  isSuperAdmin: boolean;
};

export async function getAppContext(): Promise<AppContext> {
  const supabase = createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    throw new Error(`Auth error: ${userError.message}`);
  }

  if (!user) {
  throw new Error("Пользователь не авторизован");
}

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    throw new Error("Profile not found");
  }

  async function loadWorkspaceById(workspaceId: string) {
    const { data: workspace, error: workspaceError } = await supabase
      .from("workspaces")
      .select("*")
      .eq("id", workspaceId)
      .single();

    if (workspaceError || !workspace) {
      return null;
    }

    if (!user) {
  throw new Error("Пользователь не авторизован");
}

    const { data: membership, error: membershipError } = await supabase
      .from("workspace_members")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle();

    if (membershipError || !membership) {
      return null;
    }

    return {
      workspace,
      membership,
    };
  }

  if (profile.last_active_workspace_id) {
    const activeWorkspaceContext = await loadWorkspaceById(
      profile.last_active_workspace_id
    );

    if (activeWorkspaceContext) {
      return {
        supabase,
        user,
        profile,
        workspace: activeWorkspaceContext.workspace,
        membership: activeWorkspaceContext.membership,
        isSuperAdmin: profile.platform_role === "super_admin",
      };
    }
  }

  const { data: fallbackMembership, error: fallbackMembershipError } =
    await supabase
      .from("workspace_members")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

  if (fallbackMembershipError) {
    throw new Error(
      `Membership fallback error: ${fallbackMembershipError.message}`
    );
  }

  if (!fallbackMembership) {
    throw new Error("Membership not found");
  }

  const { data: fallbackWorkspace, error: fallbackWorkspaceError } =
    await supabase
      .from("workspaces")
      .select("*")
      .eq("id", fallbackMembership.workspace_id)
      .single();

  if (fallbackWorkspaceError || !fallbackWorkspace) {
    throw new Error("Workspace not found");
  }

  await supabase
    .from("profiles")
    .update({
      last_active_workspace_id: fallbackWorkspace.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", profile.id);

  return {
    supabase,
    user,
    profile: {
      ...profile,
      last_active_workspace_id: fallbackWorkspace.id,
    },
    workspace: fallbackWorkspace,
    membership: fallbackMembership,
    isSuperAdmin: profile.platform_role === "super_admin",
  };
}