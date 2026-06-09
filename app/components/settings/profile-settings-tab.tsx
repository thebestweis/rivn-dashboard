"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Camera, Save, Upload, X } from "lucide-react";
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
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState("");
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
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
  const avatarPreviewSrc = avatarPreviewUrl || form.avatarUrl.trim();

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
    setAvatarFile(null);
    if (avatarInputRef.current) {
      avatarInputRef.current.value = "";
    }
  }, [currentMember]);

  useEffect(() => {
    if (!avatarFile) {
      setAvatarPreviewUrl("");
      return;
    }

    const nextPreviewUrl = URL.createObjectURL(avatarFile);
    setAvatarPreviewUrl(nextPreviewUrl);

    return () => URL.revokeObjectURL(nextPreviewUrl);
  }, [avatarFile]);

  useEffect(() => {
    if (!toastMessage) return;

    const timer = window.setTimeout(() => setToastMessage(""), 2400);
    return () => window.clearTimeout(timer);
  }, [toastMessage]);

  async function submitProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setIsSaving(true);
      await updateMyWorkspaceMemberProfile({ ...form, avatarFile });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.workspaceMembers }),
        workspace?.id
          ? queryClient.invalidateQueries({
              queryKey: queryKeys.workspaceMembersByWorkspace(workspace.id),
            })
          : Promise.resolve(),
        queryClient.invalidateQueries({
          queryKey: workspace?.id
            ? ["workspace-members-settings", "workspace", workspace.id]
            : ["workspace-members-settings"],
        }),
      ]);
      setAvatarFile(null);
      if (avatarInputRef.current) {
        avatarInputRef.current.value = "";
      }
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
      <section className="rivn-card p-6 text-white/60">
        Загружаем профиль...
      </section>
    );
  }

  return (
    <>
      <section className="grid gap-5 xl:grid-cols-[0.82fr_1.18fr]">
        <div className="rivn-card rivn-card-interactive p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#43ffc2]">Карточка профиля</p>
          <div className="mt-5 flex items-center gap-4">
            {avatarPreviewSrc ? (
              <img
                src={avatarPreviewSrc}
                alt={previewName}
                className="h-20 w-20 rounded-3xl border border-white/10 object-cover shadow-[0_18px_45px_rgba(0,0,0,0.28)]"
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-3xl border border-white/12 bg-[radial-gradient(circle_at_30%_25%,#7dffd6,#00f5a8_48%,#7c5cff)] text-2xl font-bold text-[#06101d] shadow-[0_20px_55px_rgba(0,245,168,0.16),inset_0_1px_0_rgba(255,255,255,0.42)]">
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

          <div className="mt-6 rounded-[24px] border border-white/10 bg-white/[0.045] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
            <p className="text-sm leading-6 text-white/65">
              {form.profileDescription.trim() ||
                "Здесь будет короткое описание сотрудника: зона ответственности, сильные стороны и полезная информация для команды."}
            </p>
          </div>

          <div className="mt-4 grid gap-3 text-sm text-white/60">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 transition duration-300 hover:bg-white/[0.065]">
              Телефон: {form.phone.trim() || "не указан"}
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 transition duration-300 hover:bg-white/[0.065]">
              Telegram: {form.telegram.trim() || "не указан"}
            </div>
          </div>
        </div>

        <form
          onSubmit={submitProfile}
          className="rivn-card p-6"
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#43ffc2]">Мои данные</p>
            <h2 className="mt-2 text-2xl font-medium tracking-[-0.04em]">Профиль сотрудника</h2>
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
                className="rivn-field mt-2"
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
                className="rivn-field mt-2"
                placeholder="Например: Менеджер по продажам"
              />
            </label>

            <label className="text-sm font-semibold text-white/60 md:col-span-2">
              Аватарка
              <div className="mt-2 flex flex-col gap-3 rounded-[22px] border border-white/10 bg-white/[0.04] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] sm:flex-row sm:items-center sm:justify-between">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-white/50">
                  {avatarPreviewSrc ? (
                    <img
                      src={avatarPreviewSrc}
                      alt={previewName}
                      className="h-full w-full rounded-xl object-cover"
                    />
                  ) : (
                    <Camera className="h-5 w-5" />
                  )}
                </div>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="hidden"
                  onChange={(event) =>
                    setAvatarFile(event.target.files?.[0] ?? null)
                  }
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm text-white/80">
                    {avatarFile?.name || "Загрузи фото профиля"}
                  </div>
                  <div className="mt-1 text-xs text-white/40">
                    PNG, JPG, WebP или GIF до 5 МБ.
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => avatarInputRef.current?.click()}
                    className="rivn-button px-3 py-2 text-xs font-semibold"
                  >
                    <Upload className="h-4 w-4" />
                    Загрузить
                  </button>
                  {avatarPreviewSrc ? (
                    <button
                      type="button"
                      onClick={() => {
                        setAvatarFile(null);
                        setAvatarPreviewUrl("");
                        setForm((current) => ({ ...current, avatarUrl: "" }));
                        if (avatarInputRef.current) {
                          avatarInputRef.current.value = "";
                        }
                      }}
                      className="inline-flex items-center gap-2 rounded-2xl border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-xs font-semibold text-rose-200 transition duration-300 hover:-translate-y-0.5 hover:bg-rose-400/15 active:translate-y-0 active:scale-[0.985]"
                    >
                      <X className="h-4 w-4" />
                      Убрать
                    </button>
                  ) : null}
                </div>
              </div>
            </label>

            <label className="hidden">
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
                  className="rivn-field"
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
                className="rivn-field mt-2"
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
                className="rivn-field mt-2"
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
                className="rivn-field rivn-textarea mt-2"
                placeholder="Коротко: чем занимается сотрудник, за что отвечает, какие клиенты или процессы ведёт."
              />
            </label>
          </div>

          <div className="mt-6 flex justify-end">
            <button
              type="submit"
              disabled={isSaving}
              className="rivn-button rivn-button-primary px-5 py-3 text-sm font-semibold disabled:opacity-60"
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
