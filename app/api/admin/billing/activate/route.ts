import { NextResponse } from "next/server";
import { requireSuperAdminRoute, getErrorMessage } from "../../_utils";

type BillingPeriod = "monthly" | "yearly";
type PlanCode = "base" | "team" | "strategy";

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
    const planCode = String(body?.planCode ?? "").trim() as PlanCode;
    const billingPeriod = String(body?.billingPeriod ?? "").trim() as BillingPeriod;
    const extraMembers = Math.max(0, Number(body?.extraMembers ?? 0));
    const description = String(body?.description ?? "").trim();

    if (!workspaceId) {
      return NextResponse.json({ error: "workspaceId обязателен" }, { status: 400 });
    }

    if (!["base", "team", "strategy"].includes(planCode)) {
      return NextResponse.json({ error: "Некорректный тариф" }, { status: 400 });
    }

    if (!["monthly", "yearly"].includes(billingPeriod)) {
      return NextResponse.json({ error: "Некорректный billing period" }, { status: 400 });
    }

    const { data: workspace, error: workspaceError } = await serviceSupabase
      .from("workspaces")
      .select("id")
      .eq("id", workspaceId)
      .single();

    if (workspaceError || !workspace) {
      throw new Error("Workspace не найден");
    }

    const { data: plan, error: planError } = await serviceSupabase
      .from("billing_plans")
      .select("*")
      .eq("code", planCode)
      .eq("is_active", true)
      .single();

    if (planError || !plan) {
      throw new Error("Тариф не найден");
    }

    const basePrice =
      billingPeriod === "yearly"
        ? Number(plan.yearly_price ?? 0)
        : Number(plan.monthly_price ?? 0);

    const extraMemberPrice =
      billingPeriod === "yearly"
        ? Number(plan.extra_member_price_yearly ?? 0)
        : Number(plan.extra_member_price_monthly ?? 0);

    const totalPrice = basePrice + extraMembers * extraMemberPrice;

    const { data: transactions, error: transactionsError } = await serviceSupabase
      .from("billing_transactions")
      .select("amount,status")
      .eq("workspace_id", workspaceId);

    if (transactionsError) {
      throw new Error(`Не удалось загрузить транзакции: ${transactionsError.message}`);
    }

    const balance = (transactions ?? [])
      .filter((item) => item.status === "completed")
      .reduce((sum, item) => sum + Number(item.amount ?? 0), 0);

    if (balance < totalPrice) {
      throw new Error(`Недостаточно средств на балансе. Нужно ${totalPrice} ₽`);
    }

    const { data: currentBilling, error: currentBillingError } = await serviceSupabase
      .from("workspace_billing")
      .select("*")
      .eq("workspace_id", workspaceId)
      .maybeSingle();

    if (currentBillingError) {
      throw new Error(`Не удалось загрузить billing: ${currentBillingError.message}`);
    }

    if (!currentBilling) {
      const { error: insertBillingError } = await serviceSupabase
        .from("workspace_billing")
        .insert({
          workspace_id: workspaceId,
          plan_code: "trial",
          billing_period: "monthly",
          subscription_status: "trial",
          trial_started_at: new Date().toISOString(),
          trial_ends_at: addMonths(new Date(), 1).toISOString(),
          subscription_started_at: null,
          subscription_ends_at: null,
          auto_renew: false,
          included_members: 1,
          extra_members: 0,
          max_members: 1,
          team_enabled: false,
          ai_enabled: false,
        });

      if (insertBillingError) {
        throw new Error(
          `Не удалось создать billing для workspace: ${insertBillingError.message}`
        );
      }
    }

    const { error: transactionError } = await serviceSupabase
      .from("billing_transactions")
      .insert({
        workspace_id: workspaceId,
        amount: -totalPrice,
        currency: "RUB",
        transaction_type: "subscription_charge",
        status: "completed",
        description:
          billingPeriod === "yearly"
            ? `Покупка тарифа ${plan.name} на 1 год`
            : `Покупка тарифа ${plan.name} на 1 месяц`,
        meta: {
          plan_code: planCode,
          billing_period: billingPeriod,
          extra_members: extraMembers,
          source: "manual_activation",
        },
        created_by_user_id: user.id,
      });

    if (transactionError) {
      throw new Error(
        `Не удалось создать billing транзакцию: ${transactionError.message}`
      );
    }

    const now = new Date();
    const endDate =
      billingPeriod === "yearly" ? addYears(now, 1) : addMonths(now, 1);

    const includedMembers = Number(plan.included_members ?? 0);
    const maxMembers =
      plan.max_members === null || plan.max_members === undefined
        ? null
        : Number(plan.max_members);

    const { error: updateError } = await serviceSupabase
      .from("workspace_billing")
      .update({
        plan_code: planCode,
        billing_period: billingPeriod,
        subscription_status: "active",
        subscription_started_at: now.toISOString(),
        subscription_ends_at: endDate.toISOString(),
        included_members: includedMembers,
        extra_members: extraMembers,
        max_members: maxMembers,
        team_enabled: Boolean(plan.team_enabled),
        ai_enabled: Boolean(plan.ai_enabled),
        updated_at: new Date().toISOString(),
      })
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
        action_type: "activate_plan_from_balance",
        action_payload: {
          planCode,
          billingPeriod,
          extraMembers,
          description,
          chargedAmount: totalPrice,
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