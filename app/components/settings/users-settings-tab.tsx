"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "../../lib/supabase/client";
import { useAppContextState } from "../../providers/app-context-provider";
import {
  addWorkspaceMemberByEmail,
  getWorkspaceMemberLimitState,
  getWorkspaceMembers,
  removeWorkspaceMember,
  updateWorkspaceMemberRole,
  type WorkspaceMemberItem,
  type WorkspaceMemberLimitState,
  type WorkspaceMemberRole,
} from "../../lib/supabase/workspace-members";
import { AppToast } from "../ui/app-toast";
import { BillingAccessBanner } from "../ui/billing-access-banner";
import { getBillingErrorMessage } from "../../lib/billing-errors";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../lib/query-keys";

const roleOptions: Array<{
  value: WorkspaceMemberRole;
  label: string;
}> = [
  { value: "owner", label: "Владелец" },
  { value: "admin", label: "Админ" },
  { value: "manager", label: "Менеджер" },
  { value: "analyst", label: "Аналитик" },
  { value: "employee", label: "Сотрудник" },
];

function getStatusLabel(status: WorkspaceMemberItem["status"]) {
  if (status === "active") return "Активен";
  if (status === "invited") return "Приглашён";
  if (status === "suspended") return "Заблокирован";
  if (status === "removed") return "Удалён";
  return status;
}

function getStatusClasses(status: WorkspaceMemberItem["status"]) {
  if (status === "active") {
    return "bg-emerald-500/15 text-emerald-300";
  }

  if (status === "invited") {
    return "bg-amber-500/15 text-amber-300";
  }

  if (status === "suspended") {
    return "bg-rose-500/15 text-rose-300";
  }

  return "bg-white/10 text-white/60";
}

function getPlanLabel(planCode: string | null | undefined) {
  if (!planCode) return "—";
  return planCode.toUpperCase();
}

export function UsersSettingsTab() {
  const queryClient = useQueryClient();

  const {
    billingAccess,
    isLoading: isAppContextLoading,
  } = useAppContextState();

  const [currentUserId, setCurrentUserId] = useState<string>("");

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<WorkspaceMemberRole>("employee");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [updatingMemberId, setUpdatingMemberId] = useState<string | null>(null);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);

  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState<"success" | "error" | "info">(
    "success"
  );

  const isBillingReadOnly = billingAccess?.isReadOnly ?? false;
  const teamEnabled = billingAccess?.teamEnabled ?? false;
  const canManageMembers = !isBillingReadOnly && teamEnabled;

  const {
    data: users = [],
    isLoading: isUsersLoading,
    isFetching: isUsersFetching,
  } = useQuery({
    queryKey: queryKeys.workspaceMembers,
    queryFn: getWorkspaceMembers,
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });

  const {
    data: limitState = null,
    isLoading: isLimitLoading,
    isFetching: isLimitFetching,
  } = useQuery<WorkspaceMemberLimitState | null>({
    queryKey: queryKeys.workspaceMemberLimitState,
    queryFn: getWorkspaceMemberLimitState,
    staleTime: 1000 * 60 * 2,
    refetchOnWindowFocus: false,
  });

  async function refreshMembersData() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.workspaceMembers }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.workspaceMemberLimitState,
      }),
    ]);
  }

  useEffect(() => {
    async function bootstrapCurrentUser() {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        setCurrentUserId(user?.id ?? "");
      } catch (error) {
        console.error("Ошибка загрузки текущего пользователя:", error);
      }
    }

    bootstrapCurrentUser();
  }, []);

  useEffect(() => {
    if (!toastMessage) return;

    const timer = setTimeout(() => {
      setToastMessage("");
    }, 2200);

    return () => clearTimeout(timer);
  }, [toastMessage]);

  const sortedUsers = useMemo(() => {
    return [...users].sort((a, b) => {
      if (a.role === "owner" && b.role !== "owner") return -1;
      if (a.role !== "owner" && b.role === "owner") return 1;
      return a.email.localeCompare(b.email, "ru");
    });
  }, [users]);

  const addButtonDisabled =
    isSubmitting || !limitState?.canInviteMembers || !canManageMembers;

  async function handleAddUser() {
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      setToastType("error");
      setToastMessage("Укажи email пользователя");
      return;
    }

    if (isBillingReadOnly) {
      setToastType("error");
      setToastMessage("Подписка неактивна. Доступен только режим просмотра.");
      return;
    }

    if (!teamEnabled) {
      setToastType("error");
      setToastMessage("Функция команды доступна только на тарифе Team и выше.");
      return;
    }

    if (!limitState?.canInviteMembers) {
      setToastType("error");
      setToastMessage(
        limitState?.reason ||
          "Нельзя добавить участника из-за ограничения тарифа"
      );
      return;
    }

    try {
      setIsSubmitting(true);

      await addWorkspaceMemberByEmail({
        email: normalizedEmail,
        role,
      });

      setEmail("");
      setRole("employee");
      setToastType("success");
      setToastMessage("Пользователь успешно добавлен в кабинет");

      await refreshMembersData();
    } catch (error) {
      console.error(error);
      setToastType("error");
      setToastMessage(getBillingErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRoleChange(
    memberId: string,
    nextRole: WorkspaceMemberRole
  ) {
    if (isBillingReadOnly) {
      setToastType("error");
      setToastMessage("Подписка неактивна. Доступен только режим просмотра.");
      return;
    }

    if (!teamEnabled) {
      setToastType("error");
      setToastMessage("Функция команды доступна только на тарифе Team и выше.");
      return;
    }

    try {
      setUpdatingMemberId(memberId);

      await updateWorkspaceMemberRole({
        memberId,
        role: nextRole,
      });

      setToastType("success");
      setToastMessage("Роль пользователя обновлена");

      await refreshMembersData();
    } catch (error) {
      console.error(error);
      setToastType("error");
      setToastMessage(
        error instanceof Error ? error.message : "Не удалось обновить роль"
      );
    } finally {
      setUpdatingMemberId(null);
    }
  }

  async function handleRemove(memberId: string) {
    if (isBillingReadOnly) {
      setToastType("error");
      setToastMessage("Подписка неактивна. Доступен только режим просмотра.");
      return;
    }

    if (!teamEnabled) {
      setToastType("error");
      setToastMessage("Функция команды доступна только на тарифе Team и выше.");
      return;
    }

    const shouldDelete = window.confirm("Удалить пользователя из кабинета?");
    if (!shouldDelete) return;

    try {
      setRemovingMemberId(memberId);

      await removeWorkspaceMember(memberId);

      setToastType("success");
      setToastMessage("Пользователь удалён из кабинета");

      await refreshMembersData();
    } catch (error) {
      console.error(error);
      setToastType("error");
      setToastMessage(
        error instanceof Error ? error.message : "Не удалось удалить пользователя"
      );
    } finally {
      setRemovingMemberId(null);
    }
  }

  const isLoading = isUsersLoading || isLimitLoading;
  const isRefreshing = isUsersFetching || isLimitFetching;

  return (
    <>
      <div className="rounded-[28px] border border-white/10 bg-[#121826] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.32)]">
        <BillingAccessBanner
          isLoading={isAppContextLoading}
          isBillingReadOnly={isBillingReadOnly}
          canManage={teamEnabled}
          readOnlyMessage="Подписка неактивна. Раздел участников кабинета доступен только в режиме просмотра, пока тариф не будет активирован."
          roleRestrictedMessage="Функция команды доступна только на тарифе Team и выше."
          className="mb-5"
        />

        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-sm text-white/50">Users</div>
            <h2 className="mt-1 text-xl font-semibold">Участники кабинета</h2>
            <div className="mt-2 text-sm text-white/55">
              Добавляй пользователей в текущий кабинет, меняй им роли и управляй
              доступом.
            </div>
          </div>

          {isRefreshing && !isLoading ? (
            <div className="text-xs text-white/35">Обновляем данные...</div>
          ) : null}
        </div>

        <div className="mt-5 space-y-4">
          <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <div className="text-sm text-white/50">Лимит участников</div>
                <div className="mt-1 text-lg font-semibold text-white">
                  {limitState
                    ? `${limitState.seatsUsed} / ${limitState.seatsLimit}`
                    : "—"}
                </div>
                <div className="mt-2 text-sm text-white/55">
                  Текущий тариф:{" "}
                  <span className="text-white">
                    {getPlanLabel(limitState?.planCode)}
                  </span>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-[#0F1524] px-4 py-3 text-sm text-white/70">
                Свободно мест:{" "}
                <span className="font-medium text-white">
                  {limitState?.seatsAvailable ?? 0}
                </span>
              </div>
            </div>

            {!limitState?.teamEnabled ? (
              <div className="mt-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                Командная работа недоступна на текущем тарифе. Для добавления
                сотрудников перейди на TEAM или STRATEGY.
              </div>
            ) : null}

            {limitState && !limitState.canInviteMembers && limitState.teamEnabled ? (
              <div className="mt-4 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                {limitState.reason}
              </div>
            ) : null}
          </div>

          <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
            <div className="grid gap-3 md:grid-cols-[1fr_220px_180px]">
              <div>
                <label className="mb-2 block text-sm text-white/55">
                  Email пользователя
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Например: user@gmail.com"
                  disabled={!canManageMembers}
                  className="h-[48px] w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm text-white outline-none placeholder:text-white/30 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm text-white/55">Роль</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as WorkspaceMemberRole)}
                  disabled={!canManageMembers}
                  className="h-[48px] w-full rounded-2xl border border-white/10 bg-[#0F1524] px-4 text-sm text-white outline-none disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {roleOptions.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-end">
                <button
                  type="button"
                  onClick={handleAddUser}
                  disabled={addButtonDisabled}
                  className="h-[48px] w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm text-white/80 transition hover:bg-white/[0.06] hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting ? "Добавляем..." : "Добавить в кабинет"}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5 overflow-hidden rounded-[24px] border border-white/8">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/[0.04] text-white/45">
              <tr>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Роль</th>
                <th className="px-4 py-3 font-medium">Статус</th>
                <th className="px-4 py-3 font-medium">Действия</th>
              </tr>
            </thead>

            <tbody>
              {isLoading ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-10 text-center text-sm text-white/45"
                  >
                    Загрузка участников...
                  </td>
                </tr>
              ) : sortedUsers.length > 0 ? (
                sortedUsers.map((item) => {
                  const isCurrentUser = item.user_id === currentUserId;
                  const isUpdating = updatingMemberId === item.id;
                  const isRemoving = removingMemberId === item.id;

                  return (
                    <tr
                      key={item.id}
                      className="border-t border-white/6 bg-transparent transition hover:bg-white/[0.03]"
                    >
                      <td className="px-4 py-3 font-medium text-white/85">
                        {item.email}
                      </td>

                      <td className="px-4 py-3">
                        <select
                          value={item.role}
                          onChange={(e) =>
                            handleRoleChange(
                              item.id,
                              e.target.value as WorkspaceMemberRole
                            )
                          }
                          disabled={
                            isCurrentUser || isUpdating || !canManageMembers
                          }
                          className="h-[40px] rounded-xl border border-white/10 bg-[#0F1524] px-3 text-sm text-white outline-none disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {roleOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-3 py-1 text-xs ${getStatusClasses(
                            item.status
                          )}`}
                        >
                          {getStatusLabel(item.status)}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        {isCurrentUser ? (
                          <span className="text-xs text-white/30">Это ты</span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleRemove(item.id)}
                            disabled={isRemoving || !canManageMembers}
                            className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-300 transition hover:bg-rose-500/15 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {isRemoving ? "Удаляем..." : "Удалить"}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-10 text-center text-sm text-white/45"
                  >
                    В кабинете пока только один пользователь.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {toastMessage ? <AppToast message={toastMessage} type={toastType} /> : null}
    </>
  );
}