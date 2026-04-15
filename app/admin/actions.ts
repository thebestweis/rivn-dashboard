"use server";

import { revalidatePath } from "next/cache";
import { getAdminOverview } from "../lib/supabase/admin";
import {
  addManualBalanceAdjustment,
  activatePlanFromBalance,
  forceSetWorkspaceBillingStatus,
} from "../lib/billing-admin";

export async function getAdminOverviewAction() {
  return getAdminOverview();
}

export async function addManualBalanceAdjustmentAction(params: {
  workspaceId: string;
  amount: number;
  description?: string;
}) {
  const result = await addManualBalanceAdjustment(params);
  revalidatePath("/admin");
  return result;
}

export async function activatePlanFromBalanceAction(params: {
  workspaceId: string;
  planCode: "base" | "team" | "strategy";
  billingPeriod: "monthly" | "yearly";
  extraMembers?: number;
  description?: string;
}) {
  const result = await activatePlanFromBalance(params);
  revalidatePath("/admin");
  return result;
}

export async function forceSetWorkspaceBillingStatusAction(params: {
  workspaceId: string;
  nextStatus: "active" | "past_due" | "expired";
  description?: string;
}) {
  const result = await forceSetWorkspaceBillingStatus(params);
  revalidatePath("/admin");
  return result;
}