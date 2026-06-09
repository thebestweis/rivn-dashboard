"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ensureSystemSettings,
  updateSystemSettings,
} from "../../lib/supabase/system-settings";
import { AppToast } from "../ui/app-toast";
import { queryKeys } from "../../lib/query-keys";

export function SystemSettingsTab() {
  const queryClient = useQueryClient();

  const [taxRate, setTaxRate] = useState("7");
  const [currency, setCurrency] = useState("RUB");
  const [payrollDay, setPayrollDay] = useState("1");
  const [defaultEmployeePay, setDefaultEmployeePay] = useState("₽5,000");

  const [isSaving, setIsSaving] = useState(false);

  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState<"success" | "error" | "info">(
    "success"
  );

  const { data: settings, isLoading } = useQuery({
    queryKey: queryKeys.systemSettings,
    queryFn: ensureSystemSettings,
    staleTime: 1000 * 60 * 5,
  });

  useEffect(() => {
    if (!settings) return;

    setTaxRate(String(settings.tax_rate));
    setCurrency(settings.currency);
    setPayrollDay(String(settings.payroll_day));
    setDefaultEmployeePay(settings.default_employee_pay);
  }, [settings]);

  useEffect(() => {
    if (!toastMessage) return;

    const timer = setTimeout(() => {
      setToastMessage("");
    }, 2200);

    return () => clearTimeout(timer);
  }, [toastMessage]);

  async function refreshSystemSettings() {
    await queryClient.invalidateQueries({
      queryKey: queryKeys.systemSettings,
    });
  }

  async function handleSave() {
    try {
      setIsSaving(true);

      await updateSystemSettings({
        tax_rate: Number(taxRate || 0),
        currency,
        payroll_day: Number(payrollDay || 1),
        default_employee_pay: defaultEmployeePay.trim() || "₽5,000",
      });

      await refreshSystemSettings();

      setToastType("success");
      setToastMessage("Системные настройки сохранены");
    } catch (error) {
      console.error(error);
      setToastType("error");
      setToastMessage(
        error instanceof Error
          ? error.message
          : "Не удалось сохранить системные настройки"
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <div className="rivn-card rivn-card-interactive p-5 sm:p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.18em] text-[#43ffc2]">Система</div>
            <h2 className="mt-2 text-2xl font-medium tracking-[-0.04em]">Системные параметры</h2>
            <div className="mt-2 text-sm text-white/55">
              Налог, валюта, день выплаты зарплаты и базовые параметры системы.
            </div>
          </div>
        </div>

        {isLoading ? (
            <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-sm text-white/45">
            Загрузка настроек...
          </div>
        ) : (
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm text-white/55">
                Налоговая ставка, %
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={taxRate}
                onChange={(e) => setTaxRate(e.target.value)}
                className="rivn-field"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm text-white/55">
                Валюта
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="rivn-field"
              >
                <option value="RUB">RUB</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm text-white/55">
                День выплаты зарплаты
              </label>
              <input
                type="number"
                min="1"
                max="31"
                value={payrollDay}
                onChange={(e) => setPayrollDay(e.target.value)}
                className="rivn-field"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm text-white/55">
                Ставка сотрудника по умолчанию
              </label>
              <input
                type="text"
                value={defaultEmployeePay}
                onChange={(e) => setDefaultEmployeePay(e.target.value)}
                className="rivn-field"
              />
            </div>
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={handleSave}
            disabled={isLoading || isSaving}
            className="rivn-button rivn-button-primary px-5 py-3 text-sm font-semibold disabled:opacity-60"
          >
            {isSaving ? "Сохраняем..." : "Сохранить настройки"}
          </button>
        </div>
      </div>

      {toastMessage ? (
        <AppToast message={toastMessage} type={toastType} />
      ) : null}
    </>
  );
}
