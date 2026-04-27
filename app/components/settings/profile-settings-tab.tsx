"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Camera, Save } from "lucide-react";
import { queryKeys } from "../../lib/query-keys";
import {
  getWorkspaceMemberDisplayName,
  updateMyWorkspaceMemberProfile,
} from "../../lib/supabase/workspace-members";
import { useActiveWorkspaceMembers } from "../../lib/queries/use-workspace-members-query";
import { useAppContextState } from "../../providers/app-context-provider";
import { AppToast } from "../ui/app-toast";

type ProfileForm = {
  displayName: string;
  avatarUrl: string;
  profileTitle: string;
  profileDescription: string;
  phone: string;
  telegram: string;
};

const emptyProfileForm: ProfileForm = {
  displayName: "",
  avatarUrl: "",
  profileTitle: "",
  profileDescription: "",
  phone: "",
  telegram: "",
};

export function ProfileSettingsTab() {
  const queryClient = useQueryClient();
  const { membership, workspace, isReady } = useAppContextState();
  const { activeMembers = [], isLoading } = useActiveWorkspaceMembers(isReady);
  const [form, setForm] = useState<ProfileForm>(emptyProfileForm);
  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState<"success" | "error" | "info">(
    "success"
  );

  const currentMember = useMemo(
    () => activeMembers.find((member) => member.id === membership?.id) ?? null,
    [activeMembers, membership?.id]
  );
  const previewName = form.displayName.trim() || getWorkspaceMemberDisplayName(currentMember ?? {});
  const initials =
    previewName
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("") || "R";

  useEffect(() => {
    if (!currentMember) return;

    setForm({
      displayName: currentMember.display_name ?? "",
      avatarUrl: currentMember.avatar_url ?? "",
      profileTitle: currentMember.profile_title ?? "",
      profileDescription: currentMember.profile_description ?? "",
      phone: currentMember.phone ?? "",
      telegram: currentMember.telegram ?? "",
    });
  }, [currentMember]);

  useEffect(() => {
    if (!toastMessage) return;

    const timer = window.setTimeout(() => setToastMessage(""), 2400);
    return () => window.clearTimeout(timer);
  }, [toastMessage]);

  async function submitProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setIsSaving(true);
      await updateMyWorkspaceMemberProfile(form);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.workspaceMembers }),
        queryClient.invalidateQueries({
          queryKey: workspace?.id
            ? ["workspace-members-settings", "workspace", workspace.id]
            : ["workspace-members-settings"],
        }),
      ]);
      setToastType("success");
      setToastMessage("Профиль сохранён");
    } catch (error) {
      setToastType("error");
      setToastMessage(
        error instanceof Error ? error.message : "Не удалось сохранить профиль"
      );
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading || !currentMember) {
    return (
      <section className="rounded-[28px] border border-white/10 bg-[#121826] p-6 text-white/60">
        Загружаем профиль...
      </section>
    );
  }

  return (
    <>
      <section className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
        <div className="rounded-[28px] border border-white/10 bg-[#121826] p-6 shadow-[0_10px_40px_rgba(0,0,0,0.24)]">
          <p className="text-sm font-semibold text-white/50">Карточка профиля</p>
          <div className="mt-5 flex items-center gap-4">
            {form.avatarUrl.trim() ? (
              <img
                src={form.avatarUrl.trim()}
                alt={previewName}
                className="h-20 w-20 rounded-2xl object-cover"
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-emerald-400 text-2xl font-bold text-white">
                {initials}
              </div>
            )}
            <div className="min-w-0">
              <h2 className="truncate text-2xl font-semibold">{previewName}</h2>
              <p className="mt-1 text-sm text-white/55">
                {form.profileTitle.trim() || "Должность не указана"}
              </p>
              <p className="mt-1 text-xs text-white/40">{currentMember.email}</p>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <p className="text-sm leading-6 text-white/65">
              {form.profileDescription.trim() ||
                "Здесь будет короткое описание сотрудника: зона ответственности, сильные стороны и полезная информация для команды."}
            </p>
          </div>

          <div className="mt-4 grid gap-3 text-sm text-white/60">
            <div className="rounded-2xl bg-white/[0.04] px-4 py-3">
              Телефон: {form.phone.trim() || "не указан"}
            </div>
            <div className="rounded-2xl bg-white/[0.04] px-4 py-3">
              Telegram: {form.telegram.trim() || "не указан"}
            </div>
          </div>
        </div>

        <form
          onSubmit={submitProfile}
          className="rounded-[28px] border border-white/10 bg-[#121826] p-6 shadow-[0_10px_40px_rgba(0,0,0,0.24)]"
        >
          <div>
            <p className="text-sm font-semibold text-white/50">Мои данные</p>
            <h2 className="mt-1 text-2xl font-semibold">Профиль сотрудника</h2>
            <p className="mt-2 text-sm leading-6 text-white/55">
              Эти данные будут использоваться в CRM, задачах, чатах и командных блоках.
            </p>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <label className="text-sm font-semibold text-white/60">
              Имя и фамилия
              <input
                value={form.displayName}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    displayName: event.target.value,
                  }))
                }
                className="mt-2 w-full rounded-xl border border-white/10 bg-[#0B0F1A] px-4 py-3 text-white outline-none transition focus:border-violet-400"
                placeholder="Например: Иван Петров"
              />
            </label>

            <label className="text-sm font-semibold text-white/60">
              Должность
              <input
                value={form.profileTitle}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    profileTitle: event.target.value,
                  }))
                }
                className="mt-2 w-full rounded-xl border border-white/10 bg-[#0B0F1A] px-4 py-3 text-white outline-none transition focus:border-violet-400"
                placeholder="Например: Менеджер по продажам"
              />
            </label>

            <label className="text-sm font-semibold text-white/60 md:col-span-2">
              Ссылка на аватарку
              <div className="mt-2 flex gap-2">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/50">
                  <Camera className="h-5 w-5" />
                </div>
                <input
                  value={form.avatarUrl}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      avatarUrl: event.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-white/10 bg-[#0B0F1A] px-4 py-3 text-white outline-none transition focus:border-violet-400"
                  placeholder="https://..."
                />
              </div>
            </label>

            <label className="text-sm font-semibold text-white/60">
              Телефон
              <input
                value={form.phone}
                onChange={(event) =>
                  setForm((current) => ({ ...current, phone: event.target.value }))
                }
                className="mt-2 w-full rounded-xl border border-white/10 bg-[#0B0F1A] px-4 py-3 text-white outline-none transition focus:border-violet-400"
                placeholder="+7..."
              />
            </label>

            <label className="text-sm font-semibold text-white/60">
              Telegram
              <input
                value={form.telegram}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    telegram: event.target.value,
                  }))
                }
                className="mt-2 w-full rounded-xl border border-white/10 bg-[#0B0F1A] px-4 py-3 text-white outline-none transition focus:border-violet-400"
                placeholder="@username"
              />
            </label>

            <label className="text-sm font-semibold text-white/60 md:col-span-2">
              Описание
              <textarea
                value={form.profileDescription}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    profileDescription: event.target.value,
                  }))
                }
                rows={5}
                className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-[#0B0F1A] px-4 py-3 text-white outline-none transition focus:border-violet-400"
                placeholder="Коротко: чем занимается сотрудник, за что отвечает, какие клиенты или процессы ведёт."
              />
            </label>
          </div>

          <div className="mt-6 flex justify-end">
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:opacity-60"
            >
              <Save className="h-4 w-4" />
              {isSaving ? "Сохраняем..." : "Сохранить профиль"}
            </button>
          </div>
        </form>
      </section>

      <AppToast message={toastMessage} type={toastType} />
    </>
  );
}
