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
  const [employees, setEmployees] = useState<StoredEmployee[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [defaultEmployeePay, setDefaultEmployeePay] = useState("₽5,000");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState<EmployeeFormState>(initialFormState);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function loadEmployees() {
    try {
      setIsLoading(true);

      const [employeesData, systemSettings] = await Promise.all([
        fetchEmployeesFromSupabase(),
        ensureSystemSettings(),
      ]);

      setEmployees(employeesData);
      setDefaultEmployeePay(
        systemSettings?.default_employee_pay?.trim() || "₽5,000"
      );
    } catch (error) {
      console.error("Ошибка загрузки сотрудников:", error);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadEmployees();
  }, []);

  const sortedEmployees = useMemo(() => {
    return [...employees].sort(
      (a, b) => Number(b.isActive) - Number(a.isActive)
    );
  }, [employees]);

  function openCreateModal() {
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
    setIsModalOpen(true);
  }

  function openEditModal(employee: StoredEmployee) {
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
    setIsModalOpen(false);
  }

  async function handleSaveEmployee() {
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

        setEmployees((prev) =>
          prev.map((employee) =>
            employee.id === updated.id ? updated : employee
          )
        );
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

        setEmployees((prev) => [created, ...prev]);
      }

      closeModal();
    } catch (error) {
      console.error("Ошибка сохранения сотрудника:", error);
      window.alert("Не удалось сохранить сотрудника");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteEmployee(employeeId: string) {
    const shouldDelete = window.confirm(
      "Удалить сотрудника? Это действие нельзя отменить."
    );

    if (!shouldDelete) return;

    try {
      await deleteEmployeeFromSupabase(employeeId);
      setEmployees((prev) =>
        prev.filter((employee) => employee.id !== employeeId)
      );
    } catch (error) {
      console.error("Ошибка удаления сотрудника:", error);
      window.alert("Не удалось удалить сотрудника");
    }
  }

  return (
    <>
      <div className="rounded-[28px] border border-white/10 bg-[#121826] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.32)]">
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
            className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white/80 transition hover:bg-white/[0.06] hover:text-white"
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
                          className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white/80 transition hover:text-white"
                        >
                          Редактировать
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteEmployee(item.id)}
                          className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-300 transition hover:bg-rose-500/15"
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
    </>
  );
}