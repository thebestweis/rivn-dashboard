"use client";

import { useEffect, useState } from "react";
import {
  ensureSystemSettings,
  updateSystemSettings,
} from "../../lib/supabase/system-settings";

export function SystemSettingsTab() {
  const [taxRate, setTaxRate] = useState("7");
  const [currency, setCurrency] = useState("RUB");
  const [payrollDay, setPayrollDay] = useState("1");
  const [defaultEmployeePay, setDefaultEmployeePay] = useState("₽5,000");

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      try {
        setIsLoading(true);
        const settings = await ensureSystemSettings();

        if (!isMounted) return;

        setTaxRate(String(settings.tax_rate));
        setCurrency(settings.currency);
        setPayrollDay(String(settings.payroll_day));
        setDefaultEmployeePay(settings.default_employee_pay);
      } catch (error) {
        console.error("Ошибка загрузки system settings:", error);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    load();

    return () => {
      isMounted = false;
    };
  }, []);

  async function handleSave() {
    try {
      setIsSaving(true);

      await updateSystemSettings({
        tax_rate: Number(taxRate || 0),
        currency,
        payroll_day: Number(payrollDay || 1),
        default_employee_pay: defaultEmployeePay.trim() || "₽5,000",
      });

      window.alert("Системные настройки сохранены");
    } catch (error) {
      console.error(error);
      window.alert("Не удалось сохранить системные настройки");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="rounded-[28px] border border-white/10 bg-[#121826] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.32)]">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-sm text-white/50">Система</div>
          <h2 className="mt-1 text-xl font-semibold">Системные параметры</h2>
          <div className="mt-2 text-sm text-white/55">
            Налог, валюта, день выплаты зарплаты и базовые параметры системы.
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="mt-6 text-sm text-white/45">Загрузка настроек...</div>
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
              className="h-[48px] w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm text-white outline-none"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-white/55">Валюта</label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="h-[48px] w-full rounded-2xl border border-white/10 bg-[#0F1524] px-4 text-sm text-white outline-none"
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
              className="h-[48px] w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm text-white outline-none"
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
              className="h-[48px] w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm text-white outline-none"
            />
          </div>
        </div>
      )}

      <div className="mt-6 flex justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={isLoading || isSaving}
          className="rounded-2xl bg-emerald-400/15 px-4 py-3 text-sm font-medium text-emerald-300 shadow-[0_0_24px_rgba(16,185,129,0.18)] transition hover:bg-emerald-400/20 disabled:opacity-60"
        >
          {isSaving ? "Сохраняем..." : "Сохранить настройки"}
        </button>
      </div>
    </div>
  );
}