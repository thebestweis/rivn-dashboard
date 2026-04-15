"use server";

import { revalidatePath } from "next/cache";
import { getAdminOverview } from "../lib/supabase/admin";
import {
  addManualBalanceAdjustment,
  activatePlanFromBalance,
  forceSetWorkspaceBillingStatus,
} from "../lib/billing-admin";

export async function getAdminOverviewAction() {
  try {
    const result = await getAdminOverview();

    return {
      ok: true as const,
      workspaces: result.workspaces,
      logs: result.logs,
      error: "",
    };
  } catch (error) {
    console.error("getAdminOverviewAction error:", error);

    return {
      ok: false as const,
      workspaces: [],
      logs: [],
      error:
        error instanceof Error
          ? error.message
          : "Неизвестная ошибка getAdminOverviewAction",
    };
  }
}

export async function addManualBalanceAdjustmentAction(params: {
  workspaceId: string;
  amount: number;
  description?: string;
}) {
  try {
    const result = await addManualBalanceAdjustment(params);
    revalidatePath("/admin");

    return {
      ok: true as const,
      data: result,
      error: "",
    };
  } catch (error) {
    console.error("addManualBalanceAdjustmentAction error:", error);

    return {
      ok: false as const,
      data: null,
      error:
        error instanceof Error
          ? error.message
          : "Ошибка при изменении баланса",
    };
  }
}

export async function activatePlanFromBalanceAction(params: {
  workspaceId: string;
  planCode: "base" | "team" | "strategy";
  billingPeriod: "monthly" | "yearly";
  extraMembers?: number;
  description?: string;
}) {
  try {
    const result = await activatePlanFromBalance(params);
    revalidatePath("/admin");

    return {
      ok: true as const,
      data: result,
      error: "",
    };
  } catch (error) {
    console.error("activatePlanFromBalanceAction error:", error);

    return {
      ok: false as const,
      data: null,
      error:
        error instanceof Error
          ? error.message
          : "Ошибка при активации / продлении тарифа",
    };
  }
}

export async function forceSetWorkspaceBillingStatusAction(params: {
  workspaceId: string;
  nextStatus: "active" | "past_due" | "expired";
  description?: string;
}) {
  try {
    const result = await forceSetWorkspaceBillingStatus(params);
    revalidatePath("/admin");

    return {
      ok: true as const,
      data: result,
      error: "",
    };
  } catch (error) {
    console.error("forceSetWorkspaceBillingStatusAction error:", error);

    return {
      ok: false as const,
      data: null,
      error:
        error instanceof Error
          ? error.message
          : "Ошибка при изменении статуса подписки",
    };
  }
}