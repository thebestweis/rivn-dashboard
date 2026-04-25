import { getAppContext } from "./app-context";
import { getWorkspaceBillingByWorkspaceId } from "./billing";
import { buildBillingAccessState } from "../billing-core";

export type WorkspaceMemberRole =
  | "owner"
  | "admin"
  | "manager"
  | "analyst"
  | "employee"
  | "sales_head"
  | "sales_manager";

export type WorkspaceMemberStatus =
  | "active"
  | "invited"
  | "suspended"
  | "removed";

export type WorkspaceMemberPayType =
  | "fixed_per_paid_project"
  | "fixed_salary"
  | "fixed_salary_plus_project";

export type WorkspaceMemberItem = {
  id: string;
  workspace_id: string;
  user_id: string;
  email: string;
  display_name: string | null;
  role: WorkspaceMemberRole;
  status: WorkspaceMemberStatus;
  created_at: string;
  updated_at: string;

  pay_type: WorkspaceMemberPayType | null;
  pay_value: string | null;
  fixed_salary: string | null;
  payout_day: number | null;
  is_payroll_active: boolean;
};

export type WorkspaceMemberLimitState = {
  teamEnabled: boolean;
  seatsUsed: number;
  seatsLimit: number;
  seatsAvailable: number;
  canInviteMembers: boolean;
  reason: string;
  planCode: string | null;
};

type DbWorkspaceMemberRow = {
  id: string;
  workspace_id: string;
  user_id: string;
  role: WorkspaceMemberRole;
  status: WorkspaceMemberStatus;
  created_at: string;
  updated_at: string;

  display_name: string | null;
  pay_type: WorkspaceMemberPayType | null;
  pay_value: string | null;
  fixed_salary: string | null;
  payout_day: number | null;
  is_payroll_active: boolean | null;

  profiles:
    | {
        id: string;
        email: string | null;
      }
    | {
        id: string;
        email: string | null;
      }[]
    | null;
};

function buildDisplayNameFromEmail(email: string) {
  const localPart = email.split("@")[0]?.trim();

  if (!localPart) {
    return "Без имени";
  }

  return localPart
    .replace(/[._-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function getWorkspaceMemberDisplayName(member: {
  display_name?: string | null;
  email?: string | null;
}) {
  const displayName = member.display_name?.trim();

  if (displayName) {
    return displayName;
  }

  const email = member.email?.trim();

  if (email) {
    return buildDisplayNameFromEmail(email);
  }

  return "Без имени";
}

function mapWorkspaceMember(row: DbWorkspaceMemberRow): WorkspaceMemberItem {
  const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
  const email = profile?.email ?? "";

  return {
    id: row.id,
    workspace_id: row.workspace_id,
    user_id: row.user_id,
    email,
    display_name: row.display_name ?? null,
    role: row.role,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,

    pay_type: row.pay_type ?? null,
    pay_value: row.pay_value ?? null,
    fixed_salary: row.fixed_salary ?? null,
    payout_day: row.payout_day ?? null,
    is_payroll_active: row.is_payroll_active ?? true,
  };
}

export async function getWorkspaceMembers(): Promise<WorkspaceMemberItem[]> {
  const { supabase, workspace } = await getAppContext();

  const { data, error } = await supabase
    .from("workspace_members")
    .select(
      `
      id,
      workspace_id,
      user_id,
      role,
      status,
      created_at,
      updated_at,
      display_name,
      pay_type,
      pay_value,
      fixed_salary,
      payout_day,
      is_payroll_active,
      profiles!workspace_members_user_id_fkey (
        id,
        email
      )
    `
    )
    .eq("workspace_id", workspace.id)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Не удалось загрузить участников кабинета: ${error.message}`);
  }

  return ((data ?? []) as DbWorkspaceMemberRow[]).map(mapWorkspaceMember);
}

export async function getWorkspaceMemberLimitState(): Promise<WorkspaceMemberLimitState> {
  const { workspace } = await getAppContext();

  const [members, billing] = await Promise.all([
    getWorkspaceMembers(),
    getWorkspaceBillingByWorkspaceId(workspace.id),
  ]);

  const billingAccess = buildBillingAccessState(billing);

  const seatsUsed = members.filter(
    (member) => member.status === "active" || member.status === "invited"
  ).length;

  const seatsLimit = billingAccess.totalAllowedMembers ?? 0;
  const seatsAvailable = Math.max(seatsLimit - seatsUsed, 0);

  if (!billingAccess.teamEnabled) {
    return {
      teamEnabled: false,
      seatsUsed,
      seatsLimit,
      seatsAvailable: 0,
      canInviteMembers: false,
      reason:
        "Текущий тариф не включает командную работу. Перейди на TEAM или STRATEGY.",
      planCode: billingAccess.currentPlanCode,
    };
  }

  if (seatsAvailable <= 0) {
    return {
      teamEnabled: true,
      seatsUsed,
      seatsLimit,
      seatsAvailable: 0,
      canInviteMembers: false,
      reason:
        "Достигнут лимит участников по текущему тарифу. Докупи места или перейди на более высокий тариф.",
      planCode: billingAccess.currentPlanCode,
    };
  }

  return {
    teamEnabled: true,
    seatsUsed,
    seatsLimit,
    seatsAvailable,
    canInviteMembers: true,
    reason: "",
    planCode: billingAccess.currentPlanCode,
  };
}

export async function addWorkspaceMemberByEmail(params: {
  email: string;
  role: WorkspaceMemberRole;
}): Promise<void> {
  const { supabase, workspace } = await getAppContext();

  const normalizedEmail = params.email.trim().toLowerCase();

  if (!normalizedEmail) {
    throw new Error("Укажи email пользователя");
  }

  const billing = await getWorkspaceBillingByWorkspaceId(workspace.id);
  const billingAccess = buildBillingAccessState(billing);

  if (billingAccess.isReadOnly) {
    throw new Error(
      "Кабинет находится в режиме только просмотра. Сначала продли подписку."
    );
  }

  const limitState = await getWorkspaceMemberLimitState();

  if (!limitState.canInviteMembers) {
    throw new Error(limitState.reason);
  }

  const { error } = await supabase.rpc("add_workspace_member_by_email", {
    p_workspace_id: workspace.id,
    p_email: normalizedEmail,
    p_role: params.role,
  });

  if (error) {
    throw new Error(error.message || "Не удалось добавить пользователя в кабинет");
  }
}

export async function updateWorkspaceMemberRole(params: {
  memberId: string;
  role: WorkspaceMemberRole;
}): Promise<void> {
  const { supabase, workspace, user } = await getAppContext();

  const billing = await getWorkspaceBillingByWorkspaceId(workspace.id);
  const billingAccess = buildBillingAccessState(billing);

  if (billingAccess.isReadOnly) {
    throw new Error(
      "Кабинет находится в режиме только просмотра. Сначала продли подписку."
    );
  }

  const { data: members } = await supabase
    .from("workspace_members")
    .select("*")
    .eq("workspace_id", workspace.id)
    .eq("status", "active");

  const owners = members?.filter((m) => m.role === "owner") ?? [];

  const { data: targetMember } = await supabase
    .from("workspace_members")
    .select("*")
    .eq("id", params.memberId)
    .single();

  if (!targetMember) {
    throw new Error("Участник не найден");
  }

  if (
    targetMember.user_id === user.id &&
    targetMember.role === "owner" &&
    params.role !== "owner"
  ) {
    throw new Error("Нельзя понизить собственную роль владельца");
  }

  if (
    targetMember.role === "owner" &&
    params.role !== "owner" &&
    owners.length <= 1
  ) {
    throw new Error("Нельзя понизить последнего владельца");
  }

  const { error } = await supabase
    .from("workspace_members")
    .update({
      role: params.role,
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.memberId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function updateWorkspaceMemberPayrollSettings(params: {
  memberId: string;
  displayName: string;
  payType: WorkspaceMemberPayType;
  payValue: string;
  fixedSalary: string;
  payoutDay: number;
  isPayrollActive: boolean;
}): Promise<void> {
  const { supabase, workspace } = await getAppContext();

  const billing = await getWorkspaceBillingByWorkspaceId(workspace.id);
  const billingAccess = buildBillingAccessState(billing);

  if (billingAccess.isReadOnly) {
    throw new Error(
      "Кабинет находится в режиме только просмотра. Сначала продли подписку."
    );
  }

  const { error } = await supabase
    .from("workspace_members")
    .update({
      display_name: params.displayName.trim() || null,
      pay_type: params.payType,
      pay_value: params.payValue.trim() || "₽0",
      fixed_salary: params.fixedSalary.trim() || null,
      payout_day: params.payoutDay,
      is_payroll_active: params.isPayrollActive,
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.memberId)
    .eq("workspace_id", workspace.id);

  if (error) {
    throw new Error(
      `Не удалось обновить payroll-настройки пользователя: ${error.message}`
    );
  }
}

export async function removeWorkspaceMember(memberId: string): Promise<void> {
  const { supabase, workspace, user } = await getAppContext();

  const billing = await getWorkspaceBillingByWorkspaceId(workspace.id);
  const billingAccess = buildBillingAccessState(billing);

  if (billingAccess.isReadOnly) {
    throw new Error(
      "Кабинет находится в режиме только просмотра. Сначала продли подписку."
    );
  }

  const { data: members } = await supabase
    .from("workspace_members")
    .select("*")
    .eq("workspace_id", workspace.id)
    .eq("status", "active");

  const owners = members?.filter((m) => m.role === "owner") ?? [];

  const { data: targetMember } = await supabase
    .from("workspace_members")
    .select("*")
    .eq("id", memberId)
    .single();

  if (!targetMember) {
    throw new Error("Участник не найден");
  }

  if (targetMember.role === "owner" && owners.length <= 1) {
    throw new Error("Нельзя удалить последнего владельца кабинета");
  }

  if (targetMember.user_id === user.id && targetMember.role === "owner") {
    throw new Error("Нельзя удалить самого себя как владельца");
  }

  const { error } = await supabase
    .from("workspace_members")
    .delete()
    .eq("id", memberId);

  if (error) {
    throw new Error(error.message);
  }
}
