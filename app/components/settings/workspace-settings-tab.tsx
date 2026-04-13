"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createWorkspace,
  getAccessibleWorkspaces,
  setActiveWorkspace,
  updateWorkspace,
  type AccessibleWorkspace,
} from "../../lib/supabase/workspaces";

type WorkspaceFormState = {
  id: string | null;
  name: string;
  slug: string;
  type: "agency" | "freelancer" | "digital_specialist" | "team" | "other";
  monthlyRevenueRange: string;
  targetMonthlyRevenue: string;
};

const initialForm: WorkspaceFormState = {
  id: null,
  name: "",
  slug: "",
  type: "other",
  monthlyRevenueRange: "",
  targetMonthlyRevenue: "",
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9а-яё\s-]/gi, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function getTypeLabel(type: AccessibleWorkspace["type"]) {
  switch (type) {
    case "agency":
      return "Агентство";
    case "freelancer":
      return "Фрилансер";
    case "digital_specialist":
      return "Диджитал-специалист";
    case "team":
      return "Команда";
    case "other":
      return "Другое";
    default:
      return type;
  }
}

function getRoleLabel(role: AccessibleWorkspace["membership_role"]) {
  switch (role) {
    case "owner":
      return "Владелец";
    case "admin":
      return "Админ";
    case "manager":
      return "Менеджер";
    case "analyst":
      return "Аналитик";
    case "employee":
      return "Сотрудник";
    default:
      return role;
  }
}

export function WorkspaceSettingsTab() {
  const router = useRouter();

  const [workspaces, setWorkspaces] = useState<AccessibleWorkspace[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState<WorkspaceFormState>(initialForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [statusMessage, setStatusMessage] = useState("");

  async function loadWorkspaces() {
    try {
      setIsLoading(true);
      const data = await getAccessibleWorkspaces();
      setWorkspaces(data);
    } catch (error) {
      console.error("Ошибка загрузки кабинетов:", error);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadWorkspaces();
  }, []);

  const sortedWorkspaces = useMemo(() => {
    return [...workspaces].sort((a, b) => a.name.localeCompare(b.name, "ru"));
  }, [workspaces]);

  function openCreateModal() {
    setForm(initialForm);
    setErrors({});
    setStatusMessage("");
    setIsModalOpen(true);
  }

  function openEditModal(workspace: AccessibleWorkspace) {
    setForm({
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
      type: workspace.type,
      monthlyRevenueRange: workspace.monthly_revenue_range ?? "",
      targetMonthlyRevenue:
        workspace.target_monthly_revenue !== null &&
        workspace.target_monthly_revenue !== undefined
          ? String(workspace.target_monthly_revenue)
          : "",
    });
    setErrors({});
    setStatusMessage("");
    setIsModalOpen(true);
  }

  function closeModal() {
    if (isSaving) return;
    setIsModalOpen(false);
    setForm(initialForm);
    setErrors({});
    setStatusMessage("");
  }

  async function handleSaveWorkspace() {
    const nextErrors: Record<string, string> = {};

    if (!form.name.trim()) {
      nextErrors.name = "Укажи название кабинета";
    }

    if (!form.slug.trim()) {
      nextErrors.slug = "Укажи адрес кабинета";
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    try {
      setIsSaving(true);
      setErrors({});
      setStatusMessage("");

      if (form.id) {
        await updateWorkspace({
          workspaceId: form.id,
          name: form.name.trim(),
          slug: form.slug.trim(),
          type: form.type,
          monthlyRevenueRange: form.monthlyRevenueRange.trim() || undefined,
          targetMonthlyRevenue: form.targetMonthlyRevenue.trim()
            ? Number(form.targetMonthlyRevenue)
            : null,
        });

        await loadWorkspaces();
        closeModal();
        router.refresh();
        return;
      }

      const created = await createWorkspace({
        name: form.name.trim(),
        slug: form.slug.trim(),
        type: form.type,
        monthlyRevenueRange: form.monthlyRevenueRange.trim() || undefined,
        targetMonthlyRevenue: form.targetMonthlyRevenue.trim()
          ? Number(form.targetMonthlyRevenue)
          : null,
      });

      await setActiveWorkspace(created.id);
      await loadWorkspaces();

      closeModal();
      router.refresh();
    } catch (error) {
      console.error(error);
      setStatusMessage(
        error instanceof Error ? error.message : "Не удалось сохранить кабинет"
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <div className="rounded-[28px] border border-white/10 bg-[#121826] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.32)]">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-sm text-white/50">Workspace</div>
            <h2 className="mt-1 text-xl font-semibold">Кабинеты</h2>
            <div className="mt-2 text-sm text-white/55">
              Здесь ты можешь создавать новые кабинеты, редактировать их параметры и разделять работу по разным бизнес-направлениям.
            </div>
          </div>

          <button
            type="button"
            onClick={openCreateModal}
            className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white/80 transition hover:bg-white/[0.06] hover:text-white"
          >
            Создать кабинет
          </button>
        </div>

        <div className="mt-5 overflow-hidden rounded-[24px] border border-white/8">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/[0.04] text-white/45">
              <tr>
                <th className="px-4 py-3 font-medium">Название</th>
                <th className="px-4 py-3 font-medium">Адрес кабинета</th>
                <th className="px-4 py-3 font-medium">Тип</th>
                <th className="px-4 py-3 font-medium">Роль</th>
                <th className="px-4 py-3 font-medium">Статус</th>
                <th className="px-4 py-3 font-medium">Действия</th>
              </tr>
            </thead>

            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-white/45">
                    Загрузка кабинетов...
                  </td>
                </tr>
              ) : sortedWorkspaces.length > 0 ? (
                sortedWorkspaces.map((workspace) => (
                  <tr
                    key={workspace.id}
                    className="border-t border-white/6 bg-transparent transition hover:bg-white/[0.03]"
                  >
                    <td className="px-4 py-3 font-medium text-white">{workspace.name}</td>
                    <td className="px-4 py-3 text-white/75">
                      <div className="text-sm text-white/80">{workspace.slug}</div>
                      <div className="mt-1 text-xs text-white/35">
                        Используется как понятный адрес и идентификатор кабинета внутри системы
                      </div>
                    </td>
                    <td className="px-4 py-3 text-white/75">{getTypeLabel(workspace.type)}</td>
                    <td className="px-4 py-3 text-white/75">
                      {getRoleLabel(workspace.membership_role)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs text-emerald-300">
                        {workspace.membership_status === "active" ? "Активен" : workspace.membership_status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => openEditModal(workspace)}
                        className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white/80 transition hover:text-white"
                      >
                        Редактировать
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-white/45">
                    Кабинетов пока нет
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-[640px] rounded-[28px] border border-white/10 bg-[#121826] p-6 shadow-[0_20px_80px_rgba(0,0,0,0.45)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm text-white/50">
                  {form.id ? "Редактирование кабинета" : "Новый кабинет"}
                </div>
                <h3 className="mt-1 text-xl font-semibold text-white">
                  {form.id ? "Изменить параметры workspace" : "Создание workspace"}
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

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="mb-2 block text-sm text-white/55">Название кабинета</label>
                <input
                  value={form.name}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      name: e.target.value,
                      slug: prev.slug ? prev.slug : slugify(e.target.value),
                    }))
                  }
                  placeholder="Например: RIVN Agency"
                  className={`h-[48px] w-full rounded-2xl border bg-white/[0.04] px-4 text-sm text-white outline-none placeholder:text-white/30 ${
                    errors.name ? "border-rose-500/50" : "border-white/10"
                  }`}
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-2 block text-sm text-white/55">Адрес кабинета</label>
                <input
                  value={form.slug}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      slug: slugify(e.target.value),
                    }))
                  }
                  placeholder="Например: rivn-agency"
                  className={`h-[48px] w-full rounded-2xl border bg-white/[0.04] px-4 text-sm text-white outline-none placeholder:text-white/30 ${
                    errors.slug ? "border-rose-500/50" : "border-white/10"
                  }`}
                />
                <div className="mt-2 text-xs text-white/35">
                  Это короткий понятный идентификатор кабинета. Он нужен системе для различения кабинетов и будет использоваться как внутренний адрес workspace.
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm text-white/55">Тип работы</label>
                <select
                  value={form.type}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      type: e.target.value as WorkspaceFormState["type"],
                    }))
                  }
                  className="h-[48px] w-full rounded-2xl border border-white/10 bg-[#0F1524] px-4 text-sm text-white outline-none"
                >
                  <option value="agency">Агентство</option>
                  <option value="freelancer">Фрилансер</option>
                  <option value="digital_specialist">Диджитал-специалист</option>
                  <option value="team">Команда</option>
                  <option value="other">Другое</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm text-white/55">Текущий оборот</label>
                <input
                  value={form.monthlyRevenueRange}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      monthlyRevenueRange: e.target.value,
                    }))
                  }
                  placeholder="Например: 300k-500k"
                  className="h-[48px] w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm text-white outline-none placeholder:text-white/30"
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-2 block text-sm text-white/55">Цель по обороту</label>
                <input
                  type="number"
                  value={form.targetMonthlyRevenue}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      targetMonthlyRevenue: e.target.value,
                    }))
                  }
                  placeholder="Например: 1000000"
                  className="h-[48px] w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm text-white outline-none placeholder:text-white/30"
                />
              </div>
            </div>

            {statusMessage ? (
              <div className="mt-4 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
                {statusMessage}
              </div>
            ) : null}

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
                onClick={handleSaveWorkspace}
                disabled={isSaving}
                className="rounded-2xl bg-emerald-400/15 px-4 py-3 text-sm font-medium text-emerald-300 shadow-[0_0_24px_rgba(16,185,129,0.18)] transition hover:bg-emerald-400/20 disabled:opacity-60"
              >
                {isSaving
                  ? form.id
                    ? "Сохраняем..."
                    : "Создаём..."
                  : form.id
                    ? "Сохранить изменения"
                    : "Создать кабинет"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}