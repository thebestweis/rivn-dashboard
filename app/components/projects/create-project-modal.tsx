"use client";

import { useEffect, useState } from "react";

import { CustomSelect } from "../ui/custom-select";
import type { Project, ProjectStatus } from "../../lib/supabase/projects";

type ClientOption = {
  id: string;
  name: string;
};

type MemberOption = {
  id: string;
  name: string;
};

export type CreateProjectFormValues = {
  name: string;
  client_id: string;
  employee_id: string;
  status: ProjectStatus;
  start_date: string | null;
  revenue: number;
  profit: number;
  description: string;
  project_overview: string;
  important_links: string;
};

type CreateProjectModalFormState = {
  name: string;
  client_id: string;
  employee_id: string;
  status: ProjectStatus;
  start_date: string | null;
  revenue: string;
  profit: string;
  description: string;
  project_overview: string;
  important_links: string;
};

type CreateProjectModalProps = {
  isOpen: boolean;
  clients: ClientOption[];
  employees: MemberOption[];
  isSubmitting: boolean;
  mode?: "create" | "edit";
  initialProject?: Project | null;
  onClose: () => void;
  onSubmit: (values: CreateProjectFormValues) => Promise<void>;
};

const initialFormState: CreateProjectModalFormState = {
  name: "",
  client_id: "",
  employee_id: "",
  status: "active",
  start_date: null,
  revenue: "",
  profit: "",
  description: "",
  project_overview: "",
  important_links: "",
};

function getFormStateFromProject(project: Project): CreateProjectModalFormState {
  return {
    name: project.name,
    client_id: project.client_id,
    employee_id: project.employee_id ?? "",
    status: project.status,
    start_date: project.start_date,
    revenue: project.revenue ? String(project.revenue) : "",
    profit: project.profit ? String(project.profit) : "",
    description: project.description ?? "",
    project_overview: project.project_overview ?? "",
    important_links: project.important_links ?? "",
  };
}

function normalizeNumericInput(value: string) {
  return value.replace(/[^\d]/g, "");
}

function toNumberOrZero(value: string) {
  if (!value.trim()) {
    return 0;
  }

  return Number(value);
}

export function CreateProjectModal({
  isOpen,
  clients,
  employees,
  isSubmitting,
  mode = "create",
  initialProject = null,
  onClose,
  onSubmit,
}: CreateProjectModalProps) {
  const [form, setForm] = useState<CreateProjectModalFormState>(initialFormState);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    if (!isOpen) {
      setForm(initialFormState);
      setFormError("");
      return;
    }

    if (mode === "edit" && initialProject) {
      setForm(getFormStateFromProject(initialProject));
      setFormError("");
      return;
    }

    if (clients.length > 0) {
      setForm({
        ...initialFormState,
        client_id: clients[0].id,
        employee_id: "",
      });
      setFormError("");
      return;
    }

    setForm(initialFormState);
    setFormError("");
  }, [isOpen, mode, initialProject, clients]);

  if (!isOpen) {
    return null;
  }

  function updateField<K extends keyof CreateProjectModalFormState>(
    key: K,
    value: CreateProjectModalFormState[K]
  ) {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");

    if (!form.name.trim()) {
      setFormError("Укажи название проекта");
      return;
    }

    if (!form.client_id) {
      setFormError("Выбери клиента");
      return;
    }

    try {
      await onSubmit({
        name: form.name.trim(),
        client_id: form.client_id,
        employee_id: form.employee_id,
        status: form.status,
        start_date: form.start_date,
        revenue: toNumberOrZero(form.revenue),
        profit: toNumberOrZero(form.profit),
        description: form.description.trim(),
        project_overview: form.project_overview.trim(),
        important_links: form.important_links.trim(),
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : mode === "edit"
            ? "Не удалось обновить проект"
            : "Не удалось создать проект";

      setFormError(message);
    }
  }

  const title = mode === "edit" ? "Редактировать проект" : "Добавить проект";
  const description =
    mode === "edit"
      ? "Обнови данные проекта и сохрани изменения."
      : "Создай новый проект и привяжи его к нужному клиенту.";
  const submitLabel = isSubmitting
    ? mode === "edit"
      ? "Сохраняем..."
      : "Создаём..."
    : mode === "edit"
      ? "Сохранить изменения"
      : "Создать проект";

  const clientOptions = clients.map((client) => ({
    value: client.id,
    label: client.name,
  }));

  const memberOptions = [
    { value: "", label: "Не выбран" },
    ...employees.map((member) => ({
      value: member.id,
      label: member.name,
    })),
  ];

  const statusOptions = [
    { value: "active", label: "Активный" },
    { value: "paused", label: "На паузе" },
    { value: "completed", label: "Завершён" },
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 px-4 py-6">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[28px] border border-white/10 bg-[#121826] p-6 shadow-[0_20px_80px_rgba(0,0,0,0.45)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-white">{title}</h2>
            <p className="mt-2 text-sm text-white/55">{description}</p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/70 transition hover:bg-white/10 hover:text-white"
            disabled={isSubmitting}
          >
            Закрыть
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="block">
              <div className="mb-2 text-sm text-white/65">Название проекта</div>
              <input
                type="text"
                value={form.name}
                onChange={(event) => updateField("name", event.target.value)}
                placeholder="Например: Авито продвижение"
                className="h-11 w-full rounded-2xl border border-white/10 bg-[#0F1724] px-4 text-sm text-white outline-none placeholder:text-white/30"
              />
            </label>

            <label className="block">
              <div className="mb-2 text-sm text-white/65">Клиент</div>
              {clients.length === 0 ? (
                <div className="flex h-11 w-full items-center rounded-2xl border border-white/10 bg-[#0F1724] px-4 text-sm text-white/40">
                  Нет доступных клиентов
                </div>
              ) : (
                <CustomSelect
                  value={form.client_id}
                  onChange={(value) => updateField("client_id", value)}
                  options={clientOptions}
                  placeholder="Выбери клиента"
                  className="w-full"
                />
              )}
            </label>

            <label className="block">
              <div className="mb-2 text-sm text-white/65">
                Ответственный пользователь
              </div>
              <CustomSelect
                value={form.employee_id}
                onChange={(value) => updateField("employee_id", value)}
                options={memberOptions}
                placeholder="Выбери пользователя"
                className="w-full"
              />
            </label>

            <label className="block">
              <div className="mb-2 text-sm text-white/65">Статус</div>
              <CustomSelect
                value={form.status}
                onChange={(value) => updateField("status", value as ProjectStatus)}
                options={statusOptions}
                className="w-full"
              />
            </label>

            <label className="block">
              <div className="mb-2 text-sm text-white/65">Дата начала</div>
              <input
                type="date"
                value={form.start_date ?? ""}
                onChange={(event) =>
                  updateField("start_date", event.target.value || null)
                }
                className="h-11 w-full rounded-2xl border border-white/10 bg-[#0F1724] px-4 text-sm text-white outline-none"
              />
            </label>

            <label className="block">
              <div className="mb-2 text-sm text-white/65">Доход</div>
              <input
                type="text"
                inputMode="numeric"
                value={form.revenue}
                onChange={(event) =>
                  updateField("revenue", normalizeNumericInput(event.target.value))
                }
                placeholder="Введите сумму"
                className="h-11 w-full rounded-2xl border border-white/10 bg-[#0F1724] px-4 text-sm text-white outline-none placeholder:text-white/30"
              />
            </label>

            <label className="block">
              <div className="mb-2 text-sm text-white/65">Прибыль</div>
              <input
                type="text"
                inputMode="numeric"
                value={form.profit}
                onChange={(event) =>
                  updateField("profit", normalizeNumericInput(event.target.value))
                }
                placeholder="Введите сумму"
                className="h-11 w-full rounded-2xl border border-white/10 bg-[#0F1724] px-4 text-sm text-white outline-none placeholder:text-white/30"
              />
            </label>
          </div>

          <label className="block">
            <div className="mb-2 text-sm text-white/65">Описание проекта</div>
            <textarea
              value={form.description}
              onChange={(event) => updateField("description", event.target.value)}
              rows={4}
              placeholder="Коротко опиши суть проекта, важные договорённости или контекст"
              className="w-full rounded-2xl border border-white/10 bg-[#0F1724] px-4 py-3 text-sm text-white outline-none placeholder:text-white/30"
            />
          </label>

          <label className="block">
            <div className="mb-2 text-sm text-white/65">Основная информация</div>
            <textarea
              value={form.project_overview}
              onChange={(event) =>
                updateField("project_overview", event.target.value)
              }
              rows={4}
              placeholder="Важные вводные по проекту, формат работы, особенности, доступы, организационные детали"
              className="w-full rounded-2xl border border-white/10 bg-[#0F1724] px-4 py-3 text-sm text-white outline-none placeholder:text-white/30"
            />
          </label>

          <label className="block">
            <div className="mb-2 text-sm text-white/65">Важные ссылки</div>
            <textarea
              value={form.important_links}
              onChange={(event) =>
                updateField("important_links", event.target.value)
              }
              rows={4}
              placeholder="Вставь ссылки через новую строку"
              className="w-full rounded-2xl border border-white/10 bg-[#0F1724] px-4 py-3 text-sm text-white outline-none placeholder:text-white/30"
            />
          </label>

          {formError ? (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">
              {formError}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/70 transition hover:bg-white/10 hover:text-white"
              disabled={isSubmitting}
            >
              Отмена
            </button>

            <button
              type="submit"
              className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isSubmitting || clients.length === 0}
            >
              {submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}