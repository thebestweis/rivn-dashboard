import { buildBillingAccessState } from "./billing-core";
import { getWorkspaceBillingByWorkspaceId } from "./supabase/billing";
import { getAppContext } from "./supabase/app-context";

type BillingGuardOptions = {
  requireTeam?: boolean;
  requireAi?: boolean;
};

export async function requireBillingAccess(
  options: BillingGuardOptions = {}
) {
  const { workspace, membership } = await getAppContext();

  if (!workspace?.id) {
    throw new Error("WORKSPACE_NOT_FOUND");
  }

  if (!membership) {
    throw new Error("MEMBERSHIP_NOT_FOUND");
  }

  const billing = await getWorkspaceBillingByWorkspaceId(workspace.id);
  const billingAccess = buildBillingAccessState(billing);

  if (billingAccess.isReadOnly) {
    throw new Error("BILLING_READ_ONLY");
  }

  if (options.requireTeam && !billingAccess.teamEnabled) {
    throw new Error("BILLING_TEAM_REQUIRED");
  }

  if (options.requireAi && !billingAccess.aiEnabled) {
    throw new Error("BILLING_AI_REQUIRED");
  }

  return {
    workspace,
    membership,
    billing,
    billingAccess,
  };
}