"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

type ConfirmTone = "default" | "danger";

type ConfirmDialogOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
};

type ConfirmDialogContextValue = {
  confirm: (options: ConfirmDialogOptions) => Promise<boolean>;
};

type PendingConfirm = ConfirmDialogOptions & {
  resolve: (value: boolean) => void;
};

const ConfirmDialogContext = createContext<ConfirmDialogContextValue | null>(null);

export function ConfirmDialogProvider({ children }: { children: ReactNode }) {
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(
    null
  );
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((options: ConfirmDialogOptions) => {
    return new Promise<boolean>((resolve) => {
      resolverRef.current?.(false);
      resolverRef.current = resolve;

      setPendingConfirm({
        ...options,
        resolve,
      });
    });
  }, []);

  const close = useCallback((result: boolean) => {
    resolverRef.current?.(result);
    resolverRef.current = null;
    setPendingConfirm(null);
  }, []);

  const value = useMemo(() => ({ confirm }), [confirm]);

  return (
    <ConfirmDialogContext.Provider value={value}>
      {children}

      {pendingConfirm ? (
        <div className="fixed inset-0 z-[220] flex items-end justify-center bg-[#020617]/60 px-3 py-4 backdrop-blur-sm sm:items-center sm:px-4">
          <button
            type="button"
            aria-label="Закрыть подтверждение"
            className="absolute inset-0 cursor-default"
            onClick={() => close(false)}
          />

          <div
            role="dialog"
            aria-modal="true"
            className="relative w-full max-w-md rounded-[28px] border border-slate-200 bg-white p-5 text-slate-950 shadow-[0_28px_90px_rgba(15,23,42,0.22)] dark:border-white/10 dark:bg-[#121826] dark:text-white sm:p-6"
          >
            <div
              className={
                pendingConfirm.tone === "danger"
                  ? "mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-red-500/20 bg-red-500/10 text-xl text-red-500 dark:text-red-200"
                  : "mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-500/20 bg-emerald-500/10 text-xl text-emerald-600 dark:text-emerald-200"
              }
            >
              {pendingConfirm.tone === "danger" ? "!" : "?"}
            </div>

            <h2 className="text-xl font-semibold tracking-tight">
              {pendingConfirm.title}
            </h2>

            {pendingConfirm.description ? (
              <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-white/62">
                {pendingConfirm.description}
              </p>
            ) : null}

            <div className="mt-6 grid gap-3 sm:flex sm:justify-end">
              <button
                type="button"
                onClick={() => close(false)}
                className="rounded-2xl border border-slate-200 bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-200 dark:border-white/10 dark:bg-white/5 dark:text-white/72 dark:hover:bg-white/10 dark:hover:text-white"
              >
                {pendingConfirm.cancelLabel ?? "Отмена"}
              </button>

              <button
                type="button"
                onClick={() => close(true)}
                className={
                  pendingConfirm.tone === "danger"
                    ? "rounded-2xl bg-red-500 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_18px_45px_rgba(239,68,68,0.26)] transition hover:bg-red-400"
                    : "rounded-2xl bg-emerald-400 px-4 py-2.5 text-sm font-semibold text-[#06120f] shadow-[0_18px_45px_rgba(16,185,129,0.28)] transition hover:bg-emerald-300"
                }
              >
                {pendingConfirm.confirmLabel ?? "Подтвердить"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </ConfirmDialogContext.Provider>
  );
}

export function useConfirmDialog() {
  const context = useContext(ConfirmDialogContext);

  if (!context) {
    throw new Error("useConfirmDialog must be used inside ConfirmDialogProvider");
  }

  return context;
}
