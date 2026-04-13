"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getWorkspaceMembers,
  type WorkspaceMemberItem,
} from "../../lib/supabase/workspace-members";
import {
  getWorkspaceMemberPermissions,
  upsertWorkspaceMemberPermission,
  type WorkspacePermissionSection,
  type WorkspaceMemberPermissionItem,
} from "../../lib/supabase/workspace-member-permissions";
import { useAppContextState } from "../../providers/app-context-provider";
import { BillingAccessBanner } from "../ui/billing-access-banner";
import { AppToast } from "../ui/app-toast";
import { getBillingErrorMessage } from "../../lib/billing-errors";

const sectionPermissions: Array<{
  key: WorkspacePermissionSection;
  label: string;
}> = [
  { key: "dashboard", label: "Дашборд" },
  { key: "clients", label: "Клиенты" },
  { key: "projects", label: "Проекты" },
  { key: "tasks", label: "Задачи" },
  { key: "payments", label: "Платежи" },
  { key: "expenses", label: "Расходы" },
  { key: "payroll", label: "Зарплаты" },
  { key: "analytics", label: "Аналитика" },
  { key: "settings", label: "Настройки" },
];

function getRoleLabel(role: string) {
  if (role === "owner") return "Владелец";
  if (role === "admin") return "Админ";
  if (role === "manager") return "Менеджер";
  if (role === "analyst") return "Аналитик";
  if (role === "employee") return "Сотрудник";
  return role;
}

function getDefaultPermissionByRole(
  role: string,
  section: WorkspacePermissionSection
) {
  if (role === "owner") {
    return { view: true, manage: true };
  }

  if (role === "admin") {
    return {
      view: true,
      manage: section !== "settings",
    };
  }

  if (role === "manager") {
    return {
      view: [
        "dashboard",
        "clients",
        "projects",
        "tasks",
        "payments",
        "expenses",
      ].includes(section),
      manage: ["clients", "projects", "tasks"].includes(section),
    };
  }

  if (role === "analyst") {
    return {
      view: ["dashboard", "payments", "expenses", "payroll", "analytics"].includes(
        section
      ),
      manage: false,
    };
  }

  if (role === "employee") {
    return {
      view: ["projects", "tasks"].includes(section),
      manage: ["tasks"].includes(section),
    };
  }

  return { view: false, manage: false };
}

export function AccessSettingsTab() {
  const {
    billingAccess,
    isLoading: isAppContextLoading,
  } = useAppContextState();

  const [members, setMembers] = useState<WorkspaceMemberItem[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(true);

  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [memberPermissions, setMemberPermissions] = useState<
    WorkspaceMemberPermissionItem[]
  >([]);
  const [isLoadingPermissions, setIsLoadingPermissions] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState<"success" | "error" | "info">(
    "success"
  );

  const isBillingReadOnly = billingAccess?.isReadOnly ?? false;
  const teamEnabled = billingAccess?.teamEnabled ?? false;
  const canManageAccess = !isBillingReadOnly && teamEnabled;

  useEffect(() => {
    async function loadMembers() {
      try {
        setIsLoadingMembers(true);
        const data = await getWorkspaceMembers();
        const activeMembers = data.filter((item) => item.status === "active");
        setMembers(activeMembers);

        if (activeMembers.length > 0) {
          setSelectedMemberId((prev) => prev || activeMembers[0].id);
        }
      } catch (error) {
        console.error("Ошибка загрузки участников для доступов:", error);
        setMembers([]);
        setToastType("error");
        setToastMessage("Не удалось загрузить участников для настройки доступов");
      } finally {
        setIsLoadingMembers(false);
      }
    }

    loadMembers();
  }, []);

  useEffect(() => {
    async function loadPermissions() {
      if (!selectedMemberId) {
        setMemberPermissions([]);
        return;
      }

      try {
        setIsLoadingPermissions(true);
        const data = await getWorkspaceMemberPermissions(selectedMemberId);
        setMemberPermissions(data);
      } catch (error) {
        console.error("Ошибка загрузки прав:", error);
        setMemberPermissions([]);
        setToastType("error");
        setToastMessage("Не удалось загрузить права участника");
      } finally {
        setIsLoadingPermissions(false);
      }
    }

    loadPermissions();
  }, [selectedMemberId]);

  useEffect(() => {
    if (!toastMessage) return;

    const timer = setTimeout(() => {
      setToastMessage("");
    }, 2200);

    return () => clearTimeout(timer);
  }, [toastMessage]);

  const selectedMember = useMemo(() => {
    return members.find((item) => item.id === selectedMemberId) ?? null;
  }, [members, selectedMemberId]);

  function getPermissionState(section: WorkspacePermissionSection) {
    const saved = memberPermissions.find((item) => item.section === section);

    if (saved) {
      return {
        view: saved.can_view,
        manage: saved.can_manage,
      };
    }

    return getDefaultPermissionByRole(selectedMember?.role ?? "employee", section);
  }

  async function handleTogglePermission(params: {
    section: WorkspacePermissionSection;
    field: "view" | "manage";
    checked: boolean;
  }) {
    if (!selectedMember) return;

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

    const current = getPermissionState(params.section);

    let nextView = current.view;
    let nextManage = current.manage;

    if (params.field === "view") {
      nextView = params.checked;

      if (!params.checked) {
        nextManage = false;
      }
    }

    if (params.field === "manage") {
      nextManage = params.checked;

      if (params.checked) {
        nextView = true;
      }
    }

    const currentKey = `${params.section}_${params.field}`;

    try {
      setSavingKey(currentKey);

      const saved = await upsertWorkspaceMemberPermission({
        memberId: selectedMember.id,
        section: params.section,
        canView: nextView,
        canManage: nextManage,
      });

      setMemberPermissions((prev) => {
        const exists = prev.some((item) => item.section === saved.section);

        if (exists) {
          return prev.map((item) =>
            item.section === saved.section ? saved : item
          );
        }

        return [...prev, saved];
      });

      setToastType("success");
      setToastMessage("Права сохранены");
    } catch (error) {
      console.error("Ошибка сохранения прав:", error);
      setToastType("error");
      setToastMessage(getBillingErrorMessage(error));
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <>
      <div className="rounded-[28px] border border-white/10 bg-[#121826] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.32)]">
        <BillingAccessBanner
          isLoading={isAppContextLoading}
          isBillingReadOnly={isBillingReadOnly}
          canManage={teamEnabled}
          readOnlyMessage="Подписка неактивна. Настройка доступов доступна только в режиме просмотра, пока тариф не будет активирован."
          roleRestrictedMessage="Функция настройки доступов для команды доступна только на тарифе Team и выше."
          className="mb-5"
        />

        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-sm text-white/50">Доступы</div>
            <h2 className="mt-1 text-xl font-semibold">Права участников</h2>
            <div className="mt-2 text-sm text-white/55">
              Здесь можно вручную настраивать доступ к разделам и управлению для
              каждого участника кабинета.
            </div>
          </div>
        </div>

        {isLoadingMembers ? (
          <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-sm text-white/45">
            Загружаем участников...
          </div>
        ) : members.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-sm text-white/45">
            Нет участников кабинета для настройки доступов.
          </div>
        ) : (
          <>
            <div className="mt-6 grid gap-4 md:grid-cols-[1fr_220px]">
              <div>
                <label className="mb-2 block text-sm text-white/55">
                  Участник кабинета
                </label>
                <select
                  value={selectedMember?.id ?? ""}
                  onChange={(e) => setSelectedMemberId(e.target.value)}
                  className="h-[48px] w-full rounded-2xl border border-white/10 bg-[#0F1524] px-4 text-sm text-white outline-none"
                >
                  {members.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.email}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm text-white/55">Роль</label>
                <div className="flex h-[48px] items-center rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm text-white/85">
                  {selectedMember ? getRoleLabel(selectedMember.role) : "—"}
                </div>
              </div>
            </div>

            <div className="mt-6 overflow-hidden rounded-[24px] border border-white/8">
              <table className="w-full text-left text-sm">
                <thead className="bg-white/[0.04] text-white/45">
                  <tr>
                    <th className="px-4 py-3 font-medium">Раздел</th>
                    <th className="px-4 py-3 font-medium">Просмотр</th>
                    <th className="px-4 py-3 font-medium">Управление</th>
                  </tr>
                </thead>

                <tbody>
                  {sectionPermissions.map((section) => {
                    const permission = getPermissionState(section.key);

                    return (
                      <tr
                        key={section.key}
                        className="border-t border-white/6 bg-transparent transition hover:bg-white/[0.03]"
                      >
                        <td className="px-4 py-3 font-medium text-white">
                          {section.label}
                        </td>

                        <td className="px-4 py-3">
                          <label className="inline-flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={permission.view}
                              disabled={
                                isLoadingPermissions ||
                                savingKey === `${section.key}_view` ||
                                !canManageAccess
                              }
                              onChange={(e) =>
                                handleTogglePermission({
                                  section: section.key,
                                  field: "view",
                                  checked: e.target.checked,
                                })
                              }
                              className="h-4 w-4 rounded border-white/20 bg-transparent"
                            />
                            <span className="text-white/75">
                              {savingKey === `${section.key}_view`
                                ? "Сохраняем..."
                                : permission.view
                                  ? "Разрешено"
                                  : "Нет"}
                            </span>
                          </label>
                        </td>

                        <td className="px-4 py-3">
                          <label className="inline-flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={permission.manage}
                              disabled={
                                isLoadingPermissions ||
                                savingKey === `${section.key}_manage` ||
                                !canManageAccess
                              }
                              onChange={(e) =>
                                handleTogglePermission({
                                  section: section.key,
                                  field: "manage",
                                  checked: e.target.checked,
                                })
                              }
                              className="h-4 w-4 rounded border-white/20 bg-transparent"
                            />
                            <span className="text-white/75">
                              {savingKey === `${section.key}_manage`
                                ? "Сохраняем..."
                                : permission.manage
                                  ? "Разрешено"
                                  : "Нет"}
                            </span>
                          </label>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {toastMessage ? <AppToast message={toastMessage} type={toastType} /> : null}
    </>
  );
}