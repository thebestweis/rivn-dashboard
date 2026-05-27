import type {
  WorkspaceInvitationRole,
  WorkspaceInvitationStatus,
} from "./workspace-invitations";

export type WorkspaceInvitationItem = {
  id: string;
  workspace_id: string;
  email: string;
  role: WorkspaceInvitationRole;
  status: WorkspaceInvitationStatus;
  invited_by: string | null;
  accepted_by: string | null;
  accepted_at: string | null;
  expires_at: string;
  created_at: string;
  updated_at: string;
};

async function readInvitationResponse(response: Response) {
  const payload = await response.json().catch(() => null);

  if (!response.ok || !payload?.ok) {
    throw new Error(
      payload?.error || "Не удалось обработать приглашение."
    );
  }

  return payload;
}

export async function getWorkspaceInvitations(): Promise<
  WorkspaceInvitationItem[]
> {
  const response = await fetch("/api/workspace-invitations", {
    credentials: "include",
  });
  const payload = await readInvitationResponse(response);
  return payload.invitations ?? [];
}

export async function createWorkspaceInvitation(params: {
  email: string;
  role: WorkspaceInvitationRole;
}): Promise<{
  invitation: WorkspaceInvitationItem;
  inviteUrl: string;
}> {
  const response = await fetch("/api/workspace-invitations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(params),
  });
  const payload = await readInvitationResponse(response);

  return {
    invitation: payload.invitation,
    inviteUrl: payload.inviteUrl,
  };
}

export async function cancelWorkspaceInvitation(invitationId: string) {
  const response = await fetch(`/api/workspace-invitations/${invitationId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ action: "cancel" }),
  });

  await readInvitationResponse(response);
}

export async function refreshWorkspaceInvitationLink(
  invitationId: string
): Promise<{
  invitation: WorkspaceInvitationItem;
  inviteUrl: string;
}> {
  const response = await fetch(`/api/workspace-invitations/${invitationId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ action: "refresh" }),
  });
  const payload = await readInvitationResponse(response);

  return {
    invitation: payload.invitation,
    inviteUrl: payload.inviteUrl,
  };
}
