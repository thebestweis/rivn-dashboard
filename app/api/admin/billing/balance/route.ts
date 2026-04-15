import { NextResponse } from "next/server";
import { requireSuperAdminRoute, getErrorMessage } from "../../_utils";

export async function POST(request: Request) {
  try {
    const { user, serviceSupabase } = await requireSuperAdminRoute();

    const body = await request.json();
    const workspaceId = String(body?.workspaceId ?? "").trim();
    const amount = Number(body?.amount ?? 0);
    const description = String(body?.description ?? "").trim();

    if (!workspaceId) {
      return NextResponse.json(
        { error: "workspaceId обязателен" },
        { status: 400 }
      );
    }

    if (!Number.isFinite(amount) || amount === 0) {
      return NextResponse.json(
        { error: "Сумма должна быть больше или меньше 0" },
        { status: 400 }
      );
    }

    const transactionType =
      amount > 0 ? "deposit" : "manual_adjustment";

    const { error: transactionError } = await serviceSupabase
      .from("billing_transactions")
      .insert({
        workspace_id: workspaceId,
        amount,
        currency: "RUB",
        transaction_type: transactionType,
        status: "completed",
        description:
          description ||
          (amount > 0
            ? "Ручное пополнение баланса"
            : "Ручное списание с баланса"),
        meta: {
          source: "admin_billing_action",
        },
        created_by_user_id: user.id,
      });

    if (transactionError) {
      throw new Error(
        `Не удалось создать billing транзакцию: ${transactionError.message}`
      );
    }

    const { error: logError } = await serviceSupabase
      .from("admin_action_logs")
      .insert({
        admin_user_id: user.id,
        workspace_id: workspaceId,
        action_type: "manual_balance_adjustment",
        action_payload: {
          amount,
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