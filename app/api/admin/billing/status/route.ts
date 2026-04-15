import { NextResponse } from "next/server";
import { requireSuperAdminRoute, getErrorMessage } from "../../_utils";

type BillingStatus = "trial" | "active" | "past_due" | "expired" | "canceled";

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function addYears(date: Date, years: number) {
  const next = new Date(date);
  next.setFullYear(next.getFullYear() + years);
  return next;
}

export async function POST(request: Request) {
  try {
    const { user, serviceSupabase } = await requireSuperAdminRoute();

    const body = await request.json();

    const workspaceId = String(body?.workspaceId ?? "").trim();
    const nextStatus = String(body?.nextStatus ?? "").trim() as BillingStatus;
    const description = String(body?.description ?? "").trim();

    if (!workspaceId) {
      return NextResponse.json(
        { error: "workspaceId обязателен" },
        { status: 400 }
      );
    }

    if (
      !["trial", "active", "past_due", "expired", "canceled"].includes(
        nextStatus
      )
    ) {
      return NextResponse.json(
        { error: "Некорректный статус" },
        { status: 400 }
      );
    }

    const { data: currentBilling, error: currentBillingError } = await serviceSupabase
      .from("workspace_billing")
      .select("*")
      .eq("workspace_id", workspaceId)
      .single();

    if (currentBillingError || !currentBilling) {
      throw new Error("Billing для workspace не найден");
    }

    const nowIso = new Date().toISOString();

    const patch: Record<string, unknown> = {
      subscription_status: nextStatus,
      updated_at: nowIso,
    };

    if (nextStatus === "active") {
      if (!currentBilling.subscription_started_at) {
        patch.subscription_started_at = nowIso;
      }

      if (!currentBilling.subscription_ends_at) {
        const endDate =
          currentBilling.billing_period === "yearly"
            ? addYears(new Date(), 1)
            : addMonths(new Date(), 1);

        patch.subscription_ends_at = endDate.toISOString();
      }
    }

    if (nextStatus === "expired") {
      patch.subscription_ends_at =
        currentBilling.subscription_ends_at ?? nowIso;
    }

    const { error: updateError } = await serviceSupabase
      .from("workspace_billing")
      .update(patch)
      .eq("workspace_id", workspaceId);

    if (updateError) {
      throw new Error(
        `Не удалось обновить billing workspace: ${updateError.message}`
      );
    }

    const { error: logError } = await serviceSupabase
      .from("admin_action_logs")
      .insert({
        admin_user_id: user.id,
        workspace_id: workspaceId,
        action_type: "force_billing_status",
        action_payload: {
          previousStatus: currentBilling.subscription_status,
          nextStatus,
          description,
        },
      });

    if (logError) {
      throw new Error(`Не удалось записать admin log: ${logError.message}`);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 }
    );
  }
}