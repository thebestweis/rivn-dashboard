"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getEmployees,
  saveEmployees,
  generateEntityId,
  type StoredEmployee,
} from "../../lib/storage";

type EmployeeFormState = {
  id: string | null;
  name: string;
  role: string;
  payValue: string;
  isActive: boolean;
};

const initialFormState: EmployeeFormState = {
  id: null,
  name: "",
  role: "",
  payValue: "₽5,000",
  isActive: true,
};

export function EmployeesSettingsTab() {
  const [employees, setEmployees] = useState<StoredEmployee[]>(() =>
    getEmployees()
  );

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState<EmployeeFormState>(initialFormState);

  useEffect(() => {
    saveEmployees(employees);
  }, [employees]);

  const sortedEmployees = useMemo(() => {
    return [...employees].sort((a, b) => Number(b.isActive) - Number(a.isActive));
  }, [employees]);

  function openCreateModal() {
    setForm(initialFormState);
    setIsModalOpen(true);
  }

  function openEditModal(employee: StoredEmployee) {
    setForm({
      id: employee.id,
      name: employee.name,
      role: employee.role,
      payValue: employee.payValue,
      isActive: employee.isActive,
    });
    setIsModalOpen(true);
  }

  function closeModal() {
    setForm(initialFormState);
    setIsModalOpen(false);
  }

  function handleSaveEmployee() {
    if (!form.name.trim()) return;
    if (!form.role.trim()) return;
    if (!form.payValue.trim()) return;

    if (form.id) {
      setEmployees((prev) =>
        prev.map((employee) =>
          employee.id === form.id
            ? {
                ...employee,
                name: form.name.trim(),
                role: form.role.trim(),
                payValue: form.payValue.trim(),
                isActive: form.isActive,
              }
            : employee
        )
      );
    } else {
      const newEmployee: StoredEmployee = {
        id: generateEntityId("employee"),
        name: form.name.trim(),
        role: form.role.trim(),
        payType: "fixed_per_paid_project",
        payValue: form.payValue.trim(),
        isActive: form.isActive,
      };

      setEmployees((prev) => [newEmployee, ...prev]);
    }

    closeModal();
  }

  function handleDeleteEmployee(employeeId: string) {
    const shouldDelete = window.confirm(
      "Удалить сотрудника? Это действие нельзя отменить."
    );

    if (!shouldDelete) return;

    setEmployees((prev) => prev.filter((employee) => employee.id !== employeeId));
  }

  return (
    <>
      <div className="rounded-[28px] border border-white/10 bg-[#121826] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.32)]">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-sm text-white/50">Сотрудники</div>
            <h2 className="mt-1 text-xl font-semibold">Управление сотрудниками</h2>
            <div className="mt-2 text-sm text-white/55">
              Добавляй сотрудников, меняй их статус и ставку для дальнейшей
              привязки к клиентам, проектам и зарплатам.
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
                <th className="px-4 py-3 font-medium">Ставка</th>
                <th className="px-4 py-3 font-medium">Статус</th>
                <th className="px-4 py-3 font-medium">Действия</th>
              </tr>
            </thead>

            <tbody>
              {sortedEmployees.map((item) => (
                <tr
                  key={item.id}
                  className="border-t border-white/6 bg-transparent transition hover:bg-white/[0.03]"
                >
                  <td className="px-4 py-3 font-medium">{item.name}</td>
                  <td className="px-4 py-3 text-white/75">{item.role}</td>
                  <td className="px-4 py-3 text-white/75">{item.payValue}</td>
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
              ))}

              {sortedEmployees.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-10 text-center text-sm text-white/45"
                  >
                    Пока нет сотрудников. Добавь первого сотрудника, чтобы
                    использовать его в клиентах, проектах и зарплатах.
                  </td>
                </tr>
              ) : null}
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
              >
                Закрыть
              </button>
            </div>

            <div className="mt-6 grid gap-4">
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
                  className="h-[48px] w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm text-white outline-none placeholder:text-white/30"
                />
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
                  className="h-[48px] w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm text-white outline-none placeholder:text-white/30"
                />
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
                  placeholder="Например: ₽5,000"
                  className="h-[48px] w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm text-white outline-none placeholder:text-white/30"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm text-white/55">Статус</label>
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
              >
                Отмена
              </button>

              <button
                type="button"
                onClick={handleSaveEmployee}
                className="rounded-2xl bg-emerald-400/15 px-4 py-3 text-sm font-medium text-emerald-300 shadow-[0_0_24px_rgba(16,185,129,0.18)] transition hover:bg-emerald-400/20"
              >
                Сохранить
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}