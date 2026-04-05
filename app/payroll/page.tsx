"use client";

import { useEffect, useState } from "react";
import { AppSidebar } from "../components/layout/app-sidebar";
import { PayrollPageHeader } from "../components/payroll/payroll-page-header";
import { PayrollSummary } from "../components/payroll/payroll-summary";
import { PayrollAccrualsTable } from "../components/payroll/payroll-accruals-table";
import { PayrollPayoutsTable } from "../components/payroll/payroll-payouts-table";
import { PayrollExtraTable } from "../components/payroll/payroll-extra-table";
import { getPayrollPayouts, savePayrollPayouts } from "../lib/storage";

export default function PayrollPage() {
  const [activeTab, setActiveTab] = useState<
    "accruals" | "payouts" | "extra"
  >("accruals");

  const accruals = [
    {
      id: "1",
      employee: "Дмитрий",
      client: "Client Orion",
      project: "Avito Leadgen",
      amount: "₽5,000",
      date: "01.04",
      status: "accrued" as const,
    },
    {
      id: "2",
      employee: "Антон",
      client: "Client Nova",
      project: "Ads Growth",
      amount: "₽5,000",
      date: "28.03",
      status: "paid" as const,
    },
  ];

  const [payouts, setPayouts] = useState(() => getPayrollPayouts());

  useEffect(() => {
    savePayrollPayouts(payouts);
  }, [payouts]);

  const extraPayments = [
    {
      id: "1",
      employee: "Дмитрий",
      reason: "Бонус за перевыполнение",
      date: "03.04",
      amount: "₽10,000",
    },
    {
      id: "2",
      employee: "Антон",
      reason: "Разовая компенсация",
      date: "28.03",
      amount: "₽4,000",
    },
  ];

  return (
    <div className="min-h-screen bg-[#0B0F1A] text-white">
      <div className="flex min-h-screen">
        <AppSidebar />

        <main className="flex-1">

          <div className="space-y-6 px-5 py-6 lg:px-8">
            <PayrollPageHeader
              activeTab={activeTab}
              setActiveTab={setActiveTab}
            />

            <PayrollSummary
              totalAccrued="₽45,000"
              totalPaid="₽20,000"
              totalExtra="₽14,000"
            />

            {activeTab === "accruals" ? (
              <PayrollAccrualsTable items={accruals} />
            ) : activeTab === "payouts" ? (
              <PayrollPayoutsTable items={payouts} />
            ) : (
              <PayrollExtraTable items={extraPayments} />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}