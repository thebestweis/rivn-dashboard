"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ensureSystemSettings,
  type SystemSettings,
} from "../../lib/supabase/system-settings";
import {
  getWorkspaceMembers,
  getWorkspaceMemberDisplayName,
  updateWorkspaceMemberPayrollSettings,
  type WorkspaceMemberItem,
  type WorkspaceMemberPayType,
} from "../../lib/supabase/workspace-members";
import { useAppContextState } from "../../providers/app-context-provider";
import { AppToast } from "../ui/app-toast";
import { BillingAccessBanner } from "../ui/billing-access-banner";
import { getBillingErrorMessage } from "../../lib/billing-errors";
import { queryKeys } from "../../lib/query-keys";

type MemberPayrollFormState = {
  id: string | null;
  name: string;
  role: string;
  payType: WorkspaceMemberPayType;
  payValue: string;
  fixedSalary: string;
  payoutDay: string;
  isPayrollActive: boolean;
};

const initialFormState: MemberPayrollFormState = {
  id: null,
  name: "",
  role: "",
  payType: "fixed_per_paid_project",
  payValue: "₽5,000",
  fixedSalary: "",
  payoutDay: "1",
  isPayrollActive: true,
};

export function EmployeesSettingsTab() {
  const queryClient = useQueryClient();

  const {
    billingAccess,
    isLoading: isAppContextLoading,
  } = useAppContextState();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState<MemberPayrollFormState>(initialFormState);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState<"success" | "error" | "info">(
    "success"
  );

  const isBillingReadOnly = billingAccess?.isReadOnly ?? false;
  const teamEnabled = billingAccess?.teamEnabled ?? false;
  const canManageMembersPayroll = !isBillingReadOnly && teamEnabled;

  const {
    data: members = [],
    isLoading: isMembersLoading,
  } = useQuery<WorkspaceMemberItem[]>({
    queryKey: queryKeys.workspaceMembers,
    queryFn: getWorkspaceMembers,
    staleTime: 1000 * 60 * 5,
  });

  const {
    data: systemSettings,
    isLoading: isSystemSettingsLoading,
  } = useQuery<SystemSettings>({
    queryKey: queryKeys.systemSettings,
    queryFn: ensureSystemSettings,
    staleTime: 1000 * 60 * 5,
  });

  const defaultEmployeePay =
    systemSettings?.default_employee_pay?.trim() || "₽5,000";

  async function refreshMembersData() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.workspaceMembers }),
      queryClient.invalidateQueries({ queryKey: queryKeys.systemSettings }),
    ]);
  }

  useEffect(() => {
    if (canManageMembersPayroll) return;
    setIsModalOpen(false);
  }, [canManageMembersPayroll]);

  useEffect(() => {
    if (!toastMessage) return;

    const timer = setTimeout(() => {
      setToastMessage("");
    }, 2200);

    return () => clearTimeout(timer);
  }, [toastMessage]);

  const activeAndInvitedMembers = useMemo(() => {
    return members.filter(
      (member) => member.status === "active" || member.status === "invited"
    );
  }, [members]);

  const sortedMembers = useMemo(() => {
    return [...activeAndInvitedMembers].sort((a, b) => {
      const aActive = a.status === "active" ? 1 : 0;
      const bActive = b.status === "active" ? 1 : 0;

      if (bActive !== aActive) {
        return bActive - aActive;
      }

      return getWorkspaceMemberDisplayName(a).localeCompare(
        getWorkspaceMemberDisplayName(b),
        "ru"
      );
    });
  }, [activeAndInvitedMembers]);

  const isLoading = isMembersLoading || isSystemSettingsLoading;

  function openEditModal(member: WorkspaceMemberItem) {
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

    setErrors({});
    setForm({
      id: member.id,
      name: getWorkspaceMemberDisplayName(member),
      role: member.role,
      payType: member.pay_type ?? "fixed_per_paid_project",
      payValue: member.pay_value?.trim() || defaultEmployeePay,
      fixedSalary: member.fixed_salary?.trim() || "",
      payoutDay: member.payout_day ? String(member.payout_day) : "1",
      isPayrollActive: member.is_payroll_active ?? true,
    });
    setIsModalOpen(true);
  }

  function closeModal() {
    if (isSaving) return;

    setErrors({});
    setForm(initialFormState);
    setIsModalOpen(false);
  }

  async function handleSaveMemberPayroll() {
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

    if (!form.id) {
      setToastType("error");
      setToastMessage("Пользователь не найден");
      return;
    }

    const newErrors: Record<string, string> = {};

    if (!form.payValue.trim()) {
      newErrors.payValue = "Укажи ставку";
    }

    if (
      (form.payType === "fixed_salary" ||
        form.payType === "fixed_salary_plus_project") &&
      !form.fixedSalary.trim()
    ) {
      newErrors.fixedSalary = "Укажи оклад";
    }

    if (!form.payoutDay.trim()) {
      newErrors.payoutDay = "Укажи день выплаты";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});

    try {
      setIsSaving(true);

            await updateWorkspaceMemberPayrollSettings({
        memberId: form.id,
        displayName: form.name.trim(),
        payType: form.payType,
        payValue: form.payValue.trim() || defaultEmployeePay,
        fixedSalary: form.fixedSalary.trim(),
        payoutDay: Number(form.payoutDay || 1),
        isPayrollActive: form.isPayrollActive,
      });

      await refreshMembersData();
      closeModal();

      setToastType("success");
      setToastMessage(`Параметры пользователя "${form.name}" сохранены`);
    } catch (error) {
      console.error("Ошибка сохранения payroll-настроек пользователя:", error);
      setToastType("error");
      setToastMessage(getBillingErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <div className="rounded-[28px] border border-white/10 bg-[#121826] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.32)]">
        <BillingAccessBanner
          isLoading={isAppContextLoading}
          isBillingReadOnly={isBillingReadOnly}
          canManage={teamEnabled}
          readOnlyMessage="Подписка неактивна. Раздел payroll-настроек пользователей доступен только в режиме просмотра, пока тариф не будет активирован."
          roleRestrictedMessage="Функция команды доступна только на тарифе Team и выше."
          className="mb-5"
        />

        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-sm text-white/50">Пользователи</div>
            <h2 className="mt-1 text-xl font-semibold">
              Payroll-настройки пользователей
            </h2>
            <div className="mt-2 text-sm text-white/55">
              Здесь настраивается логика начисления зарплаты для участников
              кабинета: ставка за проект, оклад, день выплаты и участие в payroll.
            </div>
            <div className="mt-2 text-xs text-white/35">
              Ставка по умолчанию из системных настроек: {defaultEmployeePay}
            </div>
          </div>
        </div>

        <div className="mt-5 overflow-hidden rounded-[24px] border border-white/8">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/[0.04] text-white/45">
              <tr>
                <th className="px-4 py-3 font-medium">Пользователь</th>
                <th className="px-4 py-3 font-medium">Роль</th>
                <th className="px-4 py-3 font-medium">Механизм</th>
                <th className="px-4 py-3 font-medium">Ставка</th>
                <th className="px-4 py-3 font-medium">Оклад</th>
                <th className="px-4 py-3 font-medium">День выплаты</th>
                <th className="px-4 py-3 font-medium">Payroll</th>
                <th className="px-4 py-3 font-medium">Действия</th>
              </tr>
            </thead>

            <tbody>
              {isLoading ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-10 text-center text-sm text-white/45"
                  >
                    Загрузка пользователей...
                  </td>
                </tr>
              ) : sortedMembers.length > 0 ? (
                sortedMembers.map((item) => (
                  <tr
                    key={item.id}
                    className="border-t border-white/6 bg-transparent transition hover:bg-white/[0.03]"
                  >
                    <td className="px-4 py-3 font-medium">
                      {getWorkspaceMemberDisplayName(item)}
                    </td>
                    <td className="px-4 py-3 text-white/75">{item.role}</td>
                    <td className="px-4 py-3 text-white/75">
                      {item.pay_type === "fixed_per_paid_project"
                        ? "За оплаченный проект"
                        : item.pay_type === "fixed_salary"
                        ? "Оклад"
                        : item.pay_type === "fixed_salary_plus_project"
                        ? "Оклад + проект"
                        : "За оплаченный проект"}
                    </td>
                    <td className="px-4 py-3 text-white/75">
                      {item.pay_value?.trim() || defaultEmployeePay}
                    </td>
                    <td className="px-4 py-3 text-white/75">
                      {item.fixed_salary?.trim() || "—"}
                    </td>
                    <td className="px-4 py-3 text-white/75">
                      {item.payout_day ? item.payout_day : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-3 py-1 text-xs ${
                          item.is_payroll_active
                            ? "bg-emerald-500/15 text-emerald-300"
                            : "bg-amber-500/15 text-amber-300"
                        }`}
                      >
                        {item.is_payroll_active ? "Включён" : "Выключен"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => openEditModal(item)}
                          disabled={!canManageMembersPayroll}
                          className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white/80 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Редактировать
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-10 text-center text-sm text-white/45"
                  >
                    Пока нет пользователей в кабинете.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-[560px] rounded-[28px] border border-white/10 bg-[#121826] p-6 shadow-[0_20px_80px_rgba(0,0,0,0.45)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm text-white/50">Пользователь</div>
                <h3 className="mt-1 text-xl font-semibold text-white">
                  Payroll-настройки пользователя
                </h3>
              </div>

              <button
                type="button"
                onClick={closeModal}
                className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white/70 transition hover:text-white"
                disabled={isSaving}
              >
                Закрыть
              </button>
            </div>

            <div className="mt-6 grid gap-4">
              {Object.keys(errors).length > 0 ? (
                <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
                  Заполни все обязательные поля
                </div>
              ) : null}

              <div>
                <label className="mb-2 block text-sm text-white/55">
                  Пользователь
                </label>
                <div className="h-[48px] w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm leading-[48px] text-white/85">
                  {form.name}
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm text-white/55">Роль</label>
                <div className="h-[48px] w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm leading-[48px] text-white/65">
                  {form.role}
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm text-white/55">
                  Механизм начисления
                </label>
                <select
                  value={form.payType}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      payType: e.target.value as WorkspaceMemberPayType,
                    }))
                  }
                  className="h-[48px] w-full rounded-2xl border border-white/10 bg-[#0F1524] px-4 text-sm text-white outline-none"
                >
                  <option value="fixed_per_paid_project">
                    За оплаченный проект
                  </option>
                  <option value="fixed_salary">Оклад</option>
                  <option value="fixed_salary_plus_project">
                    Оклад + проектная часть
                  </option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm text-white/55">
                  Ставка за оплаченный проект
                </label>
                <input
                  value={form.payValue}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      payValue: e.target.value,
                    }))
                  }
                  placeholder={defaultEmployeePay}
                  className={`h-[48px] w-full rounded-2xl border bg-white/[0.04] px-4 text-sm text-white outline-none placeholder:text-white/30 ${
                    errors.payValue
                      ? "border-rose-500/50"
                      : "border-white/10"
                  }`}
                />
                {errors.payValue ? (
                  <div className="mt-2 text-xs text-rose-400">
                    {errors.payValue}
                  </div>
                ) : null}
              </div>

              <div>
                <label className="mb-2 block text-sm text-white/55">
                  Фиксированный оклад
                </label>
                <input
                  value={form.fixedSalary}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      fixedSalary: e.target.value,
                    }))
                  }
                  placeholder="Например: ₽40,000"
                  className={`h-[48px] w-full rounded-2xl border bg-white/[0.04] px-4 text-sm text-white outline-none placeholder:text-white/30 ${
                    errors.fixedSalary
                      ? "border-rose-500/50"
                      : "border-white/10"
                  }`}
                />
                {errors.fixedSalary ? (
                  <div className="mt-2 text-xs text-rose-400">
                    {errors.fixedSalary}
                  </div>
                ) : null}
              </div>

              <div>
                <label className="mb-2 block text-sm text-white/55">
                  Зарплата выплачивается (число месяца)
                </label>
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={form.payoutDay}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      payoutDay: e.target.value,
                    }))
                  }
                  className={`h-[48px] w-full rounded-2xl border bg-white/[0.04] px-4 text-sm text-white outline-none ${
                    errors.payoutDay
                      ? "border-rose-500/50"
                      : "border-white/10"
                  }`}
                />
                {errors.payoutDay ? (
                  <div className="mt-2 text-xs text-rose-400">
                    {errors.payoutDay}
                  </div>
                ) : null}
              </div>

              <div>
                <label className="mb-2 block text-sm text-white/55">
                  Участвует в payroll
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setForm((prev) => ({
                        ...prev,
                        isPayrollActive: true,
                      }))
                    }
                    className={`rounded-xl px-4 py-2 text-sm transition ${
                      form.isPayrollActive
                        ? "bg-emerald-500/20 text-emerald-300"
                        : "bg-white/[0.04] text-white/60 hover:text-white"
                    }`}
                  >
                    Включён
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setForm((prev) => ({
                        ...prev,
                        isPayrollActive: false,
                      }))
                    }
                    className={`rounded-xl px-4 py-2 text-sm transition ${
                      !form.isPayrollActive
                        ? "bg-amber-500/20 text-amber-300"
                        : "bg-white/[0.04] text-white/60 hover:text-white"
                    }`}
                  >
                    Выключен
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeModal}
                className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/80 transition hover:bg-white/[0.06] hover:text-white"
                disabled={isSaving}
              >
                Отмена
              </button>

              <button
                type="button"
                onClick={handleSaveMemberPayroll}
                disabled={isSaving}
                className="rounded-2xl bg-emerald-400/15 px-4 py-3 text-sm font-medium text-emerald-300 shadow-[0_0_24px_rgba(16,185,129,0.18)] transition hover:bg-emerald-400/20 disabled:opacity-60"
              >
                {isSaving ? "Сохраняем..." : "Сохранить"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {toastMessage ? <AppToast message={toastMessage} type={toastType} /> : null}
    </>
  );
}