import { NextResponse } from "next/server";
import { requireSuperAdminRoute, getErrorMessage } from "../_utils";

export async function GET() {
  try {
    const { serviceSupabase } = await requireSuperAdminRoute();

    const [
      { data: workspaces, error: workspacesError },
      { data: billingRows, error: billingError },
      { data: transactionRows, error: transactionsError },
      { data: logsRows, error: logsError },
    ] = await Promise.all([
      serviceSupabase
        .from("workspaces")
        .select("id,name,slug,created_at")
        .order("created_at", { ascending: false }),

      serviceSupabase
        .from("workspace_billing")
        .select("workspace_id,plan_code,subscription_status,billing_period"),

      serviceSupabase
        .from("billing_transactions")
        .select("workspace_id,amount,status"),

      serviceSupabase
        .from("admin_action_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(30),
    ]);

    if (workspacesError) {
      throw new Error(`Не удалось загрузить workspaces: ${workspacesError.message}`);
    }

    if (billingError) {
      throw new Error(`Не удалось загрузить billing: ${billingError.message}`);
    }

    if (transactionsError) {
      throw new Error(`Не удалось загрузить transactions: ${transactionsError.message}`);
    }

    if (logsError) {
      throw new Error(`Не удалось загрузить admin logs: ${logsError.message}`);
    }

    const billingMap = new Map<
      string,
      {
        workspace_id: string;
        plan_code: string | null;
        subscription_status: string | null;
        billing_period: "monthly" | "yearly" | null;
      }
    >();

    for (const row of billingRows ?? []) {
      billingMap.set(row.workspace_id, row);
    }

    const balanceMap = new Map<string, number>();

    for (const row of transactionRows ?? []) {
      if (row.status !== "completed") continue;

      const current = balanceMap.get(row.workspace_id) ?? 0;
      balanceMap.set(row.workspace_id, current + Number(row.amount ?? 0));
    }

    const normalizedWorkspaces = (workspaces ?? []).map((ws) => {
      const billing = billingMap.get(ws.id);

      return {
        id: ws.id,
        name: ws.name,
        slug: ws.slug,
        created_at: ws.created_at,
        billing: billing
          ? {
              plan_code: billing.plan_code,
              subscription_status: billing.subscription_status,
              billing_period: billing.billing_period,
            }
          : null,
        balance: {
          balance: balanceMap.get(ws.id) ?? 0,
        },
      };
    });

    return NextResponse.json({
      workspaces: normalizedWorkspaces,
      logs: logsRows ?? [],
    });
  } catch (error) {
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 }
    );
  }
}