import { createHash, randomBytes } from "crypto";

export const INVITATION_TTL_DAYS = 7;

export type WorkspaceInvitationRole =
  | "owner"
  | "admin"
  | "manager"
  | "analyst"
  | "employee"
  | "sales_head"
  | "sales_manager";

export type WorkspaceInvitationStatus =
  | "pending"
  | "accepted"
  | "canceled"
  | "expired";

export function normalizeInviteEmail(email: string) {
  return email.trim().toLowerCase();
}

export function createInvitationToken() {
  return randomBytes(32).toString("base64url");
}

export function hashInvitationToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function getInvitationExpiresAt() {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + INVITATION_TTL_DAYS);
  return expiresAt.toISOString();
}

export function isWorkspaceInvitationRole(
  value: string
): value is WorkspaceInvitationRole {
  return (
    value === "owner" ||
    value === "admin" ||
    value === "manager" ||
    value === "analyst" ||
    value === "employee" ||
    value === "sales_head" ||
    value === "sales_manager"
  );
}

export function getWorkspaceInvitationRoleLabel(
  role: WorkspaceInvitationRole | string
) {
  if (role === "owner") return "Владелец";
  if (role === "admin") return "Админ";
  if (role === "manager") return "Менеджер";
  if (role === "analyst") return "Аналитик";
  if (role === "sales_head") return "Руководитель отдела продаж";
  if (role === "sales_manager") return "Менеджер по продажам";
  return "Сотрудник";
}

export function getWorkspaceInvitationStatusLabel(
  status: WorkspaceInvitationStatus | string
) {
  if (status === "pending") return "Ожидает";
  if (status === "accepted") return "Принято";
  if (status === "canceled") return "Отменено";
  if (status === "expired") return "Истекло";
  return status;
}
