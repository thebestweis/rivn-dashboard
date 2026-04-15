"use client";

import { useEffect, useMemo, useState } from "react";
import type { StoredEmployee } from "../../lib/storage";
import {
  fetchEmployeesFromSupabase,
  createEmployeeInSupabase,
  updateEmployeeInSupabase,
  deleteEmployeeFromSupabase,
} from "../../lib/supabase/employees";
import { ensureSystemSettings } from "../../lib/supabase/system-settings";
import { useAppContextState } from "../../providers/app-context-provider";
import { AppToast } from "../ui/app-toast";
import { BillingAccessBanner } from "../ui/billing-access-banner";
import { getBillingErrorMessage } from "../../lib/billing-errors";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../lib/query-keys";

type EmployeeFormState = {
  id: string | null;
  name: string;
  role: string;
  payType:
    | "fixed_per_paid_project"
    | "fixed_salary"
    | "fixed_salary_plus_project";
  payValue: string;
  fixedSalary: string;
  payoutDay: string;
  isActive: boolean;
};

const initialFormState: EmployeeFormState = {
  id: null,
  name: "",
  role: "",
  payType: "fixed_per_paid_project",
  payValue: "₽5,000",
  fixedSalary: "",
  payoutDay: "1",
  isActive: true,
};

export function EmployeesSettingsTab() {
  const queryClient = useQueryClient();

  const {
    billingAccess,
    isLoading: isAppContextLoading,
  } = useAppContextState();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState<EmployeeFormState>(initialFormState);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState<"success" | "error" | "info">(
    "success"
  );

  const isBillingReadOnly = billingAccess?.isReadOnly ?? false;
  const teamEnabled = billingAccess?.teamEnabled ?? false;
  const canManageEmployees = !isBillingReadOnly && teamEnabled;

  const {
    data: employees = [],
    isLoading: isEmployeesLoading,
  } = useQuery<StoredEmployee[]>({
    queryKey: queryKeys.employees,
    queryFn: fetchEmployeesFromSupabase,
    staleTime: 1000 * 60 * 5,
  });

  const {
    data: systemSettings,
    isLoading: isSystemSettingsLoading,
  } = useQuery({
    queryKey: queryKeys.systemSettings,
    queryFn: ensureSystemSettings,
    staleTime: 1000 * 60 * 10,
  });

  const defaultEmployeePay =
    systemSettings?.default_employee_pay?.trim() || "₽5,000";

  useEffect(() => {
    if (canManageEmployees) return;
    setIsModalOpen(false);
  }, [canManageEmployees]);

  useEffect(() => {
    if (!toastMessage) return;

    const timer = setTimeout(() => {
      setToastMessage("");
    }, 2200);

    return () => clearTimeout(timer);
  }, [toastMessage]);

  const sortedEmployees = useMemo(() => {
    return [...employees].sort(
      (a, b) => Number(b.isActive) - Number(a.isActive)
    );
  }, [employees]);

  function resetForm() {
    setErrors({});
    setForm({
      id: null,
      name: "",
      role: "",
      payType: "fixed_per_paid_project",
      payValue: defaultEmployeePay,
      fixedSalary: "",
      payoutDay: "1",
      isActive: true,
    });
  }

  function openCreateModal() {
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

    resetForm();
    setIsModalOpen(true);
  }

  function openEditModal(employee: StoredEmployee) {
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
      id: employee.id,
      name: employee.name,
      role: employee.role,
      payType: employee.payType,
      payValue: employee.payValue,
      fixedSalary: employee.fixedSalary ?? "",
      payoutDay: employee.payoutDay ? String(employee.payoutDay) : "1",
      isActive: employee.isActive,
    });
    setIsModalOpen(true);
  }

  function closeModal() {
    if (isSaving) return;
    resetForm();
    setIsModalOpen(false);
  }

  async function refreshEmployees() {
    await queryClient.invalidateQueries({ queryKey: queryKeys.employees });
  }

  async function handleSaveEmployee() {
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

    const newErrors: Record<string, string> = {};

    if (!form.name.trim()) {
      newErrors.name = "Укажи имя сотрудника";
    }

    if (!form.role.trim()) {
      newErrors.role = "Укажи роль";
    }

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

      if (form.id) {
        const updated = await updateEmployeeInSupabase(form.id, {
          name: form.name.trim(),
          role: form.role.trim(),
          payType: form.payType,
          payValue: form.payValue.trim(),
          fixedSalary: form.fixedSalary.trim(),
          payoutDay: Number(form.payoutDay || 1),
          isActive: form.isActive,
        });

        queryClient.setQueryData<StoredEmployee[]>(
          queryKeys.employees,
          (prev = []) =>
            prev.map((employee) =>
              employee.id === updated.id ? updated : employee
            )
        );

        setToastType("success");
        setToastMessage(`Сотрудник "${updated.name}" сохранён`);
      } else {
        const created = await createEmployeeInSupabase({
          name: form.name.trim(),
          role: form.role.trim(),
          payType: form.payType,
          payValue: form.payValue.trim(),
          fixedSalary: form.fixedSalary.trim(),
          payoutDay: Number(form.payoutDay || 1),
          isActive: form.isActive,
        });

        queryClient.setQueryData<StoredEmployee[]>(
          queryKeys.employees,
          (prev = []) => [created, ...prev]
        );

        setToastType("success");
        setToastMessage(`Сотрудник "${created.name}" создан`);
      }

      closeModal();
    } catch (error) {
      console.error("Ошибка сохранения сотрудника:", error);
      setToastType("error");
      setToastMessage(getBillingErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteEmployee(employeeId: string) {
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

    const target = employees.find((employee) => employee.id === employeeId);

    if (!target) {
      setToastType("error");
      setToastMessage("Сотрудник не найден");
      return;
    }

    const shouldDelete = window.confirm(
      "Удалить сотрудника? Это действие нельзя отменить."
    );

    if (!shouldDelete) return;

    try {
      await deleteEmployeeFromSupabase(employeeId);

      queryClient.setQueryData<StoredEmployee[]>(
        queryKeys.employees,
        (prev = []) => prev.filter((employee) => employee.id !== employeeId)
      );

      setToastType("success");
      setToastMessage(`Сотрудник "${target.name}" удалён`);
    } catch (error) {
      console.error("Ошибка удаления сотрудника:", error);
      setToastType("error");
      setToastMessage(getBillingErrorMessage(error));
    }
  }

  const isLoading = isEmployeesLoading || isSystemSettingsLoading;

  return (
    <>
      <div className="rounded-[28px] border border-white/10 bg-[#121826] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.32)]">
        <BillingAccessBanner
          isLoading={isAppContextLoading}
          isBillingReadOnly={isBillingReadOnly}
          canManage={teamEnabled}
          readOnlyMessage="Подписка неактивна. Раздел сотрудников доступен только в режиме просмотра, пока тариф не будет активирован."
          roleRestrictedMessage="Функция команды доступна только на тарифе Team и выше."
          className="mb-5"
        />

        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-sm text-white/50">Сотрудники</div>
            <h2 className="mt-1 text-xl font-semibold">
              Управление сотрудниками
            </h2>
            <div className="mt-2 text-sm text-white/55">
              Добавляй сотрудников, меняй их статус и ставку для дальнейшей
              привязки к клиентам, проектам и зарплатам.
            </div>
            <div className="mt-2 text-xs text-white/35">
              Ставка по умолчанию из системных настроек: {defaultEmployeePay}
            </div>
          </div>

          <button
            type="button"
            onClick={openCreateModal}
            disabled={!canManageEmployees}
            className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white/80 transition hover:bg-white/[0.06] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            Добавить сотрудника
          </button>
        </div>

        <div className="mt-5 overflow-hidden rounded-[24px] border border-white/8">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/[0.04] text-white/45">
              <tr>
                <th className="px-4 py-3 font-medium">Имя</th>
                <th className="px-4 py-3 font-medium">Роль</th>
                <th className="px-4 py-3 font-medium">Механизм</th>
                <th className="px-4 py-3 font-medium">Ставка</th>
                <th className="px-4 py-3 font-medium">Оклад</th>
                <th className="px-4 py-3 font-medium">День выплаты</th>
                <th className="px-4 py-3 font-medium">Статус</th>
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
                    Загрузка сотрудников...
                  </td>
                </tr>
              ) : sortedEmployees.length > 0 ? (
                sortedEmployees.map((item) => (
                  <tr
                    key={item.id}
                    className="border-t border-white/6 bg-transparent transition hover:bg-white/[0.03]"
                  >
                    <td className="px-4 py-3 font-medium">{item.name}</td>
                    <td className="px-4 py-3 text-white/75">{item.role}</td>
                    <td className="px-4 py-3 text-white/75">
                      {item.payType === "fixed_per_paid_project"
                        ? "За проект"
                        : item.payType === "fixed_salary"
                          ? "Оклад"
                          : "Оклад + проект"}
                    </td>
                    <td className="px-4 py-3 text-white/75">{item.payValue}</td>
                    <td className="px-4 py-3 text-white/75">
                      {item.fixedSalary || "—"}
                    </td>
                    <td className="px-4 py-3 text-white/75">
                      {item.payoutDay ? item.payoutDay : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-3 py-1 text-xs ${
                          item.isActive
                            ? "bg-emerald-500/15 text-emerald-300"
                            : "bg-amber-500/15 text-amber-300"
                        }`}
                      >
                        {item.isActive ? "Активен" : "Приостановлен"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => openEditModal(item)}
                          disabled={!canManageEmployees}
                          className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white/80 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Редактировать
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteEmployee(item.id)}
                          disabled={!canManageEmployees}
                          className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-300 transition hover:bg-rose-500/15 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Удалить
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
                    Пока нет сотрудников. Добавь первого сотрудника.
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
                <div className="text-sm text-white/50">Сотрудник</div>
                <h3 className="mt-1 text-xl font-semibold text-white">
                  {form.id ? "Редактирование сотрудника" : "Новый сотрудник"}
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
                <label className="mb-2 block text-sm text-white/55">Имя</label>
                <input
                  value={form.name}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      name: e.target.value,
                    }))
                  }
                  placeholder="Например: Дмитрий"
                  className={`h-[48px] w-full rounded-2xl border bg-white/[0.04] px-4 text-sm text-white outline-none placeholder:text-white/30 ${
                    errors.name ? "border-rose-500/50" : "border-white/10"
                  }`}
                />
                {errors.name ? (
                  <div className="mt-2 text-xs text-rose-400">
                    {errors.name}
                  </div>
                ) : null}
              </div>

              <div>
                <label className="mb-2 block text-sm text-white/55">Роль</label>
                <input
                  value={form.role}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      role: e.target.value,
                    }))
                  }
                  placeholder="Например: Аккаунт-менеджер"
                  className={`h-[48px] w-full rounded-2xl border bg-white/[0.04] px-4 text-sm text-white outline-none placeholder:text-white/30 ${
                    errors.role ? "border-rose-500/50" : "border-white/10"
                  }`}
                />
                {errors.role ? (
                  <div className="mt-2 text-xs text-rose-400">
                    {errors.role}
                  </div>
                ) : null}
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
                      payType: e.target.value as EmployeeFormState["payType"],
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
                  placeholder="Например: 1 (каждого месяца)"
                  className={`h-[48px] w-full rounded-2xl border bg-white/[0.04] px-4 text-sm text-white outline-none placeholder:text-white/30 ${
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
                  Статус
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setForm((prev) => ({
                        ...prev,
                        isActive: true,
                      }))
                    }
                    className={`rounded-xl px-4 py-2 text-sm transition ${
                      form.isActive
                        ? "bg-emerald-500/20 text-emerald-300"
                        : "bg-white/[0.04] text-white/60 hover:text-white"
                    }`}
                  >
                    Активен
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setForm((prev) => ({
                        ...prev,
                        isActive: false,
                      }))
                    }
                    className={`rounded-xl px-4 py-2 text-sm transition ${
                      !form.isActive
                        ? "bg-amber-500/20 text-amber-300"
                        : "bg-white/[0.04] text-white/60 hover:text-white"
                    }`}
                  >
                    Приостановлен
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
                onClick={handleSaveEmployee}
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