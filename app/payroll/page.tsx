"use client";

import { useEffect, useMemo, useState } from "react";
import { AppSidebar } from "../components/layout/app-sidebar";
import { PayrollPageHeader } from "../components/payroll/payroll-page-header";
import { PayrollAccrualsTable } from "../components/payroll/payroll-accruals-table";
import { PayrollPayoutsTable } from "../components/payroll/payroll-payouts-table";
import { PayrollExtraTable } from "../components/payroll/payroll-extra-table";
import { AppToast } from "../components/ui/app-toast";

import {
  generateEntityId,
  getEmployees,
  parseRubAmount,
  type StoredEmployee,
  type StoredPayrollAccrual,
  type StoredPayrollExtraPayment,
  type StoredPayrollPayout,
} from "../lib/storage";

import {
  fetchPayrollAccrualsFromSupabase,
  fetchPayrollExtraPaymentsFromSupabase,
  fetchPayrollPayoutsFromSupabase,
  createPayrollPayoutInSupabase,
  createPayrollExtraPaymentInSupabase,
  updatePayrollAccrualInSupabase,
  deletePayrollAccrualFromSupabase,
  updatePayrollPayoutInSupabase,
  deletePayrollPayoutFromSupabase,
  updatePayrollExtraPaymentInSupabase,
  deletePayrollExtraPaymentFromSupabase,
} from "../lib/supabase/payroll";

function getTodayDisplayDate() {
  const today = new Date();
  const day = String(today.getDate()).padStart(2, "0");
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const year = today.getFullYear();
  return `${day}.${month}.${year}`;
}

function getMonthLabelFromDate(value: string) {
  const monthNames = [
    "Январь",
    "Февраль",
    "Март",
    "Апрель",
    "Май",
    "Июнь",
    "Июль",
    "Август",
    "Сентябрь",
    "Октябрь",
    "Ноябрь",
    "Декабрь",
  ];

  if (value.includes(".")) {
    const parts = value.split(".");
    if (parts.length === 3) {
      const monthIndex = Number(parts[1]) - 1;
      const year = parts[2];
      return `${monthNames[monthIndex] ?? "Месяц"} ${year}`;
    }
  }

  const now = new Date();
  return `${monthNames[now.getMonth()]} ${now.getFullYear()}`;
}

export default function PayrollPage() {
  const [activeTab, setActiveTab] = useState<
    "accruals" | "payouts" | "extra"
  >("accruals");

  const [accruals, setAccruals] = useState<StoredPayrollAccrual[]>([]);
  const [payouts, setPayouts] = useState<StoredPayrollPayout[]>([]);
  const [extraPayments, setExtraPayments] = useState<
    StoredPayrollExtraPayment[]
  >([]);
  const [isLoadingPayroll, setIsLoadingPayroll] = useState(true);

  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState<"success" | "error" | "info">(
    "success"
  );

  const [isPeriodPickerOpen, setIsPeriodPickerOpen] = useState(false);
const [periodPreset, setPeriodPreset] = useState<
  "last7" | "last30" | "last90" | "thisMonth" | "prevMonth" | "custom"
>("last30");
const [customDateFrom, setCustomDateFrom] = useState("");
const [customDateTo, setCustomDateTo] = useState("");

  const [search, setSearch] = useState("");
const [employeeFilter, setEmployeeFilter] = useState("all");
const [monthFilter, setMonthFilter] = useState("all");
const [statusFilter, setStatusFilter] = useState("all");

  const [isEditAccrualOpen, setIsEditAccrualOpen] = useState(false);
  const [editingAccrualId, setEditingAccrualId] = useState<string | null>(null);

  const [editEmployee, setEditEmployee] = useState("");
  const [editEmployeeId, setEditEmployeeId] = useState("");
  const [editClient, setEditClient] = useState("");
  const [editProject, setEditProject] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editStatus, setEditStatus] = useState<"accrued" | "paid">("accrued");

  const [isEditPayoutOpen, setIsEditPayoutOpen] = useState(false);
  const [editingPayoutId, setEditingPayoutId] = useState<string | null>(null);
  const [editPayoutEmployee, setEditPayoutEmployee] = useState("");
  const [editPayoutEmployeeId, setEditPayoutEmployeeId] = useState("");
  const [editPayoutDate, setEditPayoutDate] = useState("");
  const [editPayoutAmount, setEditPayoutAmount] = useState("");
  const [editPayoutMonth, setEditPayoutMonth] = useState("");
  const [editPayoutStatus, setEditPayoutStatus] = useState<
    "scheduled" | "paid"
  >("paid");

  const [isEditExtraOpen, setIsEditExtraOpen] = useState(false);
  const [editingExtraId, setEditingExtraId] = useState<string | null>(null);
  const [editExtraEmployee, setEditExtraEmployee] = useState("");
  const [editExtraEmployeeId, setEditExtraEmployeeId] = useState("");
  const [editExtraReason, setEditExtraReason] = useState("");
  const [editExtraDate, setEditExtraDate] = useState("");
  const [editExtraAmount, setEditExtraAmount] = useState("");

  const [isCreatePayoutOpen, setIsCreatePayoutOpen] = useState(false);
  const [createPayoutType, setCreatePayoutType] = useState<"payout" | "extra">(
    "payout"
  );
  const [createEmployee, setCreateEmployee] = useState("");
  const [createEmployeeId, setCreateEmployeeId] = useState("");
  const [createPayoutDate, setCreatePayoutDate] = useState("");
  const [createPayoutAmount, setCreatePayoutAmount] = useState("");
  const [createPayoutMonth, setCreatePayoutMonth] = useState("");
  const [createPayoutStatus, setCreatePayoutStatus] = useState<
    "scheduled" | "paid"
  >("paid");
  const [createExtraReason, setCreateExtraReason] = useState("");

  useEffect(() => {
    if (!toastMessage) return;

    const timer = setTimeout(() => {
      setToastMessage("");
    }, 2200);

    return () => clearTimeout(timer);
  }, [toastMessage]);

  useEffect(() => {
    let isMounted = true;

    async function loadPayrollData() {
      try {
        setIsLoadingPayroll(true);

        const [accrualsData, payoutsData, extraData] = await Promise.all([
          fetchPayrollAccrualsFromSupabase(),
          fetchPayrollPayoutsFromSupabase(),
          fetchPayrollExtraPaymentsFromSupabase(),
        ]);

        if (!isMounted) return;

        setAccruals(accrualsData);
        setPayouts(payoutsData);
        setExtraPayments(extraData);
      } catch (error) {
        console.error(error);
        if (isMounted) {
          setToastType("error");
          setToastMessage("Не удалось загрузить payroll из Supabase");
        }
      } finally {
        if (isMounted) {
          setIsLoadingPayroll(false);
        }
      }
    }

    loadPayrollData();

    return () => {
      isMounted = false;
    };
  }, []);

  const employees = useMemo<StoredEmployee[]>(() => {
    return getEmployees().filter((employee) => employee.isActive);
  }, []);

  const employeeOptions = useMemo(() => {
    return employees.map((employee) => ({
      id: employee.id,
      name: employee.name,
      role: employee.role,
    }));
  }, [employees]);

  const projectOptions = useMemo(() => {
    return Array.from(
      new Set(
        accruals
          .map((item) => item.project.trim())
          .filter((value) => value.length > 0)
      )
    );
  }, [accruals]);

  const employeeFilterOptions = useMemo(() => {
  return Array.from(
    new Set(
      [
        ...accruals.map((item) => item.employee),
        ...payouts.map((item) => item.employee),
        ...extraPayments.map((item) => item.employee),
      ].filter(Boolean)
    )
  );
}, [accruals, payouts, extraPayments]);

const monthFilterOptions = useMemo(() => {
  return Array.from(
    new Set([
      ...accruals.map((item) => getMonthLabelFromDate(item.date)),
      ...payouts.map((item) => item.month),
      ...extraPayments.map((item) => getMonthLabelFromDate(item.date)),
    ])
  );
}, [accruals, payouts, extraPayments]);

function parseDisplayDateToDate(value: string) {
  if (!value) return null;

  if (value.includes(".")) {
    const [day, month, year] = value.split(".");
    if (!day || !month || !year) return null;

    const date = new Date(Number(year), Number(month) - 1, Number(day));
    date.setHours(0, 0, 0, 0);
    return date;
  }

  if (value.includes("-")) {
    const [year, month, day] = value.split("-");
    if (!day || !month || !year) return null;

    const date = new Date(Number(year), Number(month) - 1, Number(day));
    date.setHours(0, 0, 0, 0);
    return date;
  }

  return null;
}

function formatDateToInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatInputDateToDisplay(value: string) {
  if (!value) return "";

  const [year, month, day] = value.split("-");
  if (!day || !month || !year) return value;

  return `${day}.${month}.${year}`;
}

  async function reloadPayrollData() {
    const [accrualsData, payoutsData, extraData] = await Promise.all([
      fetchPayrollAccrualsFromSupabase(),
      fetchPayrollPayoutsFromSupabase(),
      fetchPayrollExtraPaymentsFromSupabase(),
    ]);

    setAccruals(accrualsData);
    setPayouts(payoutsData);
    setExtraPayments(extraData);
  }

  const visibleAccruals = useMemo(() => {
    return accruals.filter((item) => item.status === "accrued");
  }, [accruals]);

  const totalAccrued = useMemo(() => {
    return accruals
      .filter((item) => item.status === "accrued")
      .reduce((sum, item) => {
        return sum + parseRubAmount(item.amount);
      }, 0);
  }, [accruals]);

  const totalPaid = useMemo(() => {
    return payouts
      .filter((item) => item.status === "paid")
      .reduce((sum, item) => {
        return sum + parseRubAmount(item.amount);
      }, 0);
  }, [payouts]);

  const totalExtra = useMemo(() => {
  return extraPayments
    .filter((item) => isDateInSelectedPeriod(item.date))
    .reduce((sum, item) => {
      return sum + parseRubAmount(item.amount);
    }, 0);
}, [extraPayments, isDateInSelectedPeriod]);

  const selectedPeriod = useMemo(() => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let from: Date | null = null;
  let to: Date | null = null;
  let label = "Последние 30 дней";

  if (periodPreset === "last7") {
    const start = new Date(today);
    start.setDate(today.getDate() - 6);
    from = start;
    to = today;
    label = "Последние 7 дней";
  }

  if (periodPreset === "last30") {
    const start = new Date(today);
    start.setDate(today.getDate() - 29);
    from = start;
    to = today;
    label = "Последние 30 дней";
  }

  if (periodPreset === "last90") {
    const start = new Date(today);
    start.setDate(today.getDate() - 89);
    from = start;
    to = today;
    label = "Последние 90 дней";
  }

  if (periodPreset === "thisMonth") {
    from = new Date(today.getFullYear(), today.getMonth(), 1);
    to = today;
    label = "Текущий месяц";
  }

  if (periodPreset === "prevMonth") {
    const prevMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    from = new Date(prevMonthDate.getFullYear(), prevMonthDate.getMonth(), 1);
    to = new Date(prevMonthDate.getFullYear(), prevMonthDate.getMonth() + 1, 0);
    to.setHours(0, 0, 0, 0);
    label = "Прошлый месяц";
  }

  if (periodPreset === "custom") {
    from = customDateFrom ? parseDisplayDateToDate(customDateFrom) : null;
    to = customDateTo ? parseDisplayDateToDate(customDateTo) : null;

    if (from && to) {
      label = `${customDateFrom} — ${customDateTo}`;
    } else {
      label = "Свой период";
    }
  }

  return { from, to, label };
}, [periodPreset, customDateFrom, customDateTo]);

function isDateInSelectedPeriod(value: string) {
  const targetDate = parseDisplayDateToDate(value);
  if (!targetDate) return false;

  if (selectedPeriod.from && targetDate < selectedPeriod.from) return false;
  if (selectedPeriod.to && targetDate > selectedPeriod.to) return false;

  return true;
}

  const pendingEmployeePayouts = useMemo(() => {
    const groups = new Map<
      string,
      {
        employee: string;
        employeeId: string | null;
        total: number;
        accrualIds: string[];
        month: string;
      }
    >();

    accruals
      .filter((item) => item.status === "accrued")
      .forEach((item) => {
        const key = item.employeeId || item.employee;
        const existing = groups.get(key);

        if (existing) {
          existing.total += parseRubAmount(item.amount);
          existing.accrualIds.push(item.id);
          return;
        }

        groups.set(key, {
          employee: item.employee,
          employeeId: item.employeeId ?? null,
          total: parseRubAmount(item.amount),
          accrualIds: [item.id],
          month: getMonthLabelFromDate(item.date),
        });
      });

    return Array.from(groups.values());
  }, [accruals]);

  const filteredAccruals = useMemo(() => {
  return visibleAccruals.filter((item) => {
    const matchesSearch =
      item.employee.toLowerCase().includes(search.toLowerCase()) ||
      item.client.toLowerCase().includes(search.toLowerCase()) ||
      item.project.toLowerCase().includes(search.toLowerCase());

    const matchesEmployee =
      employeeFilter === "all" ? true : item.employee === employeeFilter;

    const matchesMonth =
      monthFilter === "all"
        ? true
        : getMonthLabelFromDate(item.date) === monthFilter;

    const matchesStatus =
      statusFilter === "all" ? true : item.status === statusFilter;

    return matchesSearch && matchesEmployee && matchesMonth && matchesStatus;
  });
}, [visibleAccruals, search, employeeFilter, monthFilter, statusFilter]);

const filteredPayouts = useMemo(() => {
  return payouts.filter((item) => {
    const matchesSearch = item.employee
      .toLowerCase()
      .includes(search.toLowerCase());

    const matchesEmployee =
      employeeFilter === "all" ? true : item.employee === employeeFilter;

    const matchesMonth =
      monthFilter === "all" ? true : item.month === monthFilter;

    const matchesStatus =
      statusFilter === "all" ? true : item.status === statusFilter;

    return matchesSearch && matchesEmployee && matchesMonth && matchesStatus;
  });
}, [payouts, search, employeeFilter, monthFilter, statusFilter]);

const filteredExtraPayments = useMemo(() => {
  return extraPayments.filter((item) => {
    const matchesSearch =
      item.employee.toLowerCase().includes(search.toLowerCase()) ||
      item.reason.toLowerCase().includes(search.toLowerCase());

    const matchesEmployee =
      employeeFilter === "all" ? true : item.employee === employeeFilter;

    const matchesMonth =
      monthFilter === "all"
        ? true
        : getMonthLabelFromDate(item.date) === monthFilter;

    return matchesSearch && matchesEmployee && matchesMonth;
  });
}, [extraPayments, search, employeeFilter, monthFilter]);

  function handleStartEditAccrual(item: StoredPayrollAccrual) {
    setEditingAccrualId(item.id);
    setEditEmployee(item.employee);
    setEditEmployeeId(item.employeeId ?? "");
    setEditClient(item.client);
    setEditProject(item.project);
    setEditAmount(item.amount);
    setEditDate(item.date);
    setEditStatus(item.status);
    setIsEditAccrualOpen(true);
  }

  function handleCloseEditAccrual() {
    setEditingAccrualId(null);
    setEditEmployee("");
    setEditEmployeeId("");
    setEditClient("");
    setEditProject("");
    setEditAmount("");
    setEditDate("");
    setEditStatus("accrued");
    setIsEditAccrualOpen(false);
  }

  async function handleSaveAccrual() {
    if (!editingAccrualId) return;
    if (!editEmployee.trim()) return;
    if (!editClient.trim()) return;
    if (!editAmount.trim()) return;
    if (!editDate.trim()) return;

    const current = accruals.find((item) => item.id === editingAccrualId);
    if (!current) return;

    try {
      await updatePayrollAccrualInSupabase(editingAccrualId, {
        employee: editEmployee.trim(),
        employeeId: editEmployeeId || null,
        client: editClient.trim(),
        clientId: current.clientId ?? null,
        project: editProject.trim(),
        projectId: current.projectId ?? null,
        paymentId: current.paymentId ?? null,
        amount: editAmount.trim(),
        date: editDate.trim(),
        status: editStatus,
      });

      await reloadPayrollData();

      handleCloseEditAccrual();
      setToastType("success");
      setToastMessage("Начисление сохранено");
    } catch (error) {
      console.error(error);
      setToastType("error");
      setToastMessage("Не удалось сохранить начисление");
    }
  }

  async function handleDeleteAccrual(id: string) {
    const target = accruals.find((item) => item.id === id);

    if (!target) {
      setToastType("error");
      setToastMessage("Начисление не найдено");
      return;
    }

    const confirmed = window.confirm(
      `Удалить начисление для "${target.employee}" на сумму ${target.amount}?`
    );

    if (!confirmed) return;

    try {
      await deletePayrollAccrualFromSupabase(id);

      if (editingAccrualId === id) {
        handleCloseEditAccrual();
      }

      await reloadPayrollData();

      setToastType("success");
      setToastMessage("Начисление удалено");
    } catch (error) {
      console.error(error);
      setToastType("error");
      setToastMessage("Не удалось удалить начисление");
    }
  }

  async function handlePaySingleAccrual(id: string) {
    const target = accruals.find((item) => item.id === id);

    if (!target) {
      setToastType("error");
      setToastMessage("Начисление не найдено");
      return;
    }

    if (target.status === "paid") {
      setToastType("info");
      setToastMessage("Это начисление уже выплачено");
      return;
    }

    const confirmed = window.confirm(
      `Провести внеплановую выплату сотруднику "${target.employee}" на сумму ${target.amount}?`
    );

    if (!confirmed) return;

    try {
      await updatePayrollAccrualInSupabase(id, {
        employee: target.employee,
        employeeId: target.employeeId ?? null,
        client: target.client,
        clientId: target.clientId ?? null,
        project: target.project,
        projectId: target.projectId ?? null,
        paymentId: target.paymentId ?? null,
        amount: target.amount,
        date: target.date,
        status: "paid",
      });

      await createPayrollExtraPaymentInSupabase({
        id: generateEntityId("payroll_extra"),
        employee: target.employee,
        employeeId: target.employeeId ?? null,
        reason: `Внеплановая выплата по проекту "${target.project}"`,
        date: getTodayDisplayDate(),
        amount: target.amount,
      });

      await reloadPayrollData();

      setToastType("success");
      setToastMessage("Начисление выплачено и перенесено во внеплановые");
    } catch (error) {
      console.error(error);
      setToastType("error");
      setToastMessage("Не удалось провести внеплановую выплату");
    }
  }

  async function handlePayEmployee(employeeKey: string) {
    const targetGroup = pendingEmployeePayouts.find(
      (item) => (item.employeeId || item.employee) === employeeKey
    );

    if (!targetGroup) {
      setToastType("error");
      setToastMessage("Не удалось найти начисления сотрудника");
      return;
    }

    const confirmed = window.confirm(
      `Провести выплату сотруднику "${targetGroup.employee}" на сумму ₽${targetGroup.total.toLocaleString(
        "ru-RU"
      )}?`
    );

    if (!confirmed) return;

    const payoutDate = getTodayDisplayDate();

    try {
      const targetAccruals = accruals.filter((item) =>
        targetGroup.accrualIds.includes(item.id)
      );

      await Promise.all(
        targetAccruals.map((item) =>
          updatePayrollAccrualInSupabase(item.id, {
            employee: item.employee,
            employeeId: item.employeeId ?? null,
            client: item.client,
            clientId: item.clientId ?? null,
            project: item.project,
            projectId: item.projectId ?? null,
            paymentId: item.paymentId ?? null,
            amount: item.amount,
            date: item.date,
            status: "paid",
          })
        )
      );

      await createPayrollPayoutInSupabase({
        id: generateEntityId("payroll_payout"),
        employee: targetGroup.employee,
        employeeId: targetGroup.employeeId,
        payoutDate,
        amount: `₽${targetGroup.total.toLocaleString("ru-RU")}`,
        month: targetGroup.month,
        status: "paid",
      });

      await reloadPayrollData();

      setActiveTab("payouts");
      setToastType("success");
      setToastMessage(`Выплата сотруднику "${targetGroup.employee}" проведена`);
    } catch (error) {
      console.error(error);
      setToastType("error");
      setToastMessage("Не удалось провести выплату сотруднику");
    }
  }

  async function handlePayAllEmployees() {
    if (pendingEmployeePayouts.length === 0) {
      setToastType("info");
      setToastMessage("Сейчас нет начислений для выплаты");
      return;
    }

    const totalAmount = pendingEmployeePayouts.reduce(
      (sum, item) => sum + item.total,
      0
    );

    const confirmed = window.confirm(
      `Провести выплату всех начислений сразу? Будет создано ${pendingEmployeePayouts.length} выплат(ы) на общую сумму ₽${totalAmount.toLocaleString(
        "ru-RU"
      )}.`
    );

    if (!confirmed) return;

    const payoutDate = getTodayDisplayDate();

    try {
      for (const group of pendingEmployeePayouts) {
        const targetAccruals = accruals.filter((item) =>
          group.accrualIds.includes(item.id)
        );

        await Promise.all(
          targetAccruals.map((item) =>
            updatePayrollAccrualInSupabase(item.id, {
              employee: item.employee,
              employeeId: item.employeeId ?? null,
              client: item.client,
              clientId: item.clientId ?? null,
              project: item.project,
              projectId: item.projectId ?? null,
              paymentId: item.paymentId ?? null,
              amount: item.amount,
              date: item.date,
              status: "paid",
            })
          )
        );

        await createPayrollPayoutInSupabase({
          id: generateEntityId("payroll_payout"),
          employee: group.employee,
          employeeId: group.employeeId,
          payoutDate,
          amount: `₽${group.total.toLocaleString("ru-RU")}`,
          month: group.month,
          status: "paid",
        });
      }

      await reloadPayrollData();

      setActiveTab("payouts");
      setToastType("success");
      setToastMessage("Все начисления успешно выплачены");
    } catch (error) {
      console.error(error);
      setToastType("error");
      setToastMessage("Не удалось провести общую выплату");
    }
  }

  function handleStartEditPayout(item: StoredPayrollPayout) {
    setEditingPayoutId(item.id);
    setEditPayoutEmployee(item.employee);
    setEditPayoutEmployeeId(item.employeeId ?? "");
    setEditPayoutDate(item.payoutDate);
    setEditPayoutAmount(item.amount);
    setEditPayoutMonth(item.month);
    setEditPayoutStatus(item.status);
    setIsEditPayoutOpen(true);
  }

  function handleCloseEditPayout() {
    setEditingPayoutId(null);
    setEditPayoutEmployee("");
    setEditPayoutEmployeeId("");
    setEditPayoutDate("");
    setEditPayoutAmount("");
    setEditPayoutMonth("");
    setEditPayoutStatus("paid");
    setIsEditPayoutOpen(false);
  }

  async function handleSavePayout() {
    if (!editingPayoutId) return;
    if (!editPayoutEmployee.trim()) return;
    if (!editPayoutDate.trim()) return;
    if (!editPayoutAmount.trim()) return;
    if (!editPayoutMonth.trim()) return;

    try {
      await updatePayrollPayoutInSupabase(editingPayoutId, {
        employee: editPayoutEmployee.trim(),
        employeeId: editPayoutEmployeeId || null,
        payoutDate: editPayoutDate.trim(),
        amount: editPayoutAmount.trim(),
        month: editPayoutMonth.trim(),
        status: editPayoutStatus,
      });

      await reloadPayrollData();

      handleCloseEditPayout();
      setToastType("success");
      setToastMessage("Выплата сохранена");
    } catch (error) {
      console.error(error);
      setToastType("error");
      setToastMessage("Не удалось сохранить выплату");
    }
  }

  async function handleDeletePayout(id: string) {
    const target = payouts.find((item) => item.id === id);

    if (!target) {
      setToastType("error");
      setToastMessage("Выплата не найдена");
      return;
    }

    const confirmed = window.confirm(
      `Удалить выплату для "${target.employee}" на сумму ${target.amount}?`
    );

    if (!confirmed) return;

    try {
      await deletePayrollPayoutFromSupabase(id);

      if (editingPayoutId === id) {
        handleCloseEditPayout();
      }

      await reloadPayrollData();

      setToastType("success");
      setToastMessage("Выплата удалена");
    } catch (error) {
      console.error(error);
      setToastType("error");
      setToastMessage("Не удалось удалить выплату");
    }
  }

  function handleStartEditExtra(item: StoredPayrollExtraPayment) {
    setEditingExtraId(item.id);
    setEditExtraEmployee(item.employee);
    setEditExtraEmployeeId(item.employeeId ?? "");
    setEditExtraReason(item.reason);
    setEditExtraDate(item.date);
    setEditExtraAmount(item.amount);
    setIsEditExtraOpen(true);
  }

  function handleCloseEditExtra() {
    setEditingExtraId(null);
    setEditExtraEmployee("");
    setEditExtraEmployeeId("");
    setEditExtraReason("");
    setEditExtraDate("");
    setEditExtraAmount("");
    setIsEditExtraOpen(false);
  }

  async function handleSaveExtra() {
    if (!editingExtraId) return;
    if (!editExtraEmployee.trim()) return;
    if (!editExtraReason.trim()) return;
    if (!editExtraDate.trim()) return;
    if (!editExtraAmount.trim()) return;

    try {
      await updatePayrollExtraPaymentInSupabase(editingExtraId, {
        employee: editExtraEmployee.trim(),
        employeeId: editExtraEmployeeId || null,
        reason: editExtraReason.trim(),
        date: editExtraDate.trim(),
        amount: editExtraAmount.trim(),
      });

      await reloadPayrollData();

      handleCloseEditExtra();
      setToastType("success");
      setToastMessage("Внеплановая выплата сохранена");
    } catch (error) {
      console.error(error);
      setToastType("error");
      setToastMessage("Не удалось сохранить внеплановую выплату");
    }
  }

  async function handleDeleteExtra(id: string) {
    const target = extraPayments.find((item) => item.id === id);

    if (!target) {
      setToastType("error");
      setToastMessage("Внеплановая выплата не найдена");
      return;
    }

    const confirmed = window.confirm(
      `Удалить внеплановую выплату для "${target.employee}" на сумму ${target.amount}?`
    );

    if (!confirmed) return;

    try {
      await deletePayrollExtraPaymentFromSupabase(id);

      if (editingExtraId === id) {
        handleCloseEditExtra();
      }

      await reloadPayrollData();

      setToastType("success");
      setToastMessage("Внеплановая выплата удалена");
    } catch (error) {
      console.error(error);
      setToastType("error");
      setToastMessage("Не удалось удалить внеплановую выплату");
    }
  }

  function handleCloseCreatePayout() {
    setIsCreatePayoutOpen(false);
    setCreatePayoutType("payout");
    setCreateEmployee("");
    setCreateEmployeeId("");
    setCreatePayoutDate("");
    setCreatePayoutAmount("");
    setCreatePayoutMonth("");
    setCreatePayoutStatus("paid");
    setCreateExtraReason("");
  }

  async function handleCreateManualPayout() {
    if (!createEmployee.trim()) {
      setToastType("error");
      setToastMessage("Выбери сотрудника");
      return;
    }

    if (!createPayoutDate.trim()) {
      setToastType("error");
      setToastMessage("Укажи дату");
      return;
    }

    if (!createPayoutAmount.trim()) {
      setToastType("error");
      setToastMessage("Укажи сумму");
      return;
    }

    try {
      if (createPayoutType === "payout") {
        if (!createPayoutMonth.trim()) {
          setToastType("error");
          setToastMessage("Укажи месяц");
          return;
        }

        await createPayrollPayoutInSupabase({
          id: generateEntityId("payroll_payout"),
          employee: createEmployee,
          employeeId: createEmployeeId || null,
          payoutDate: createPayoutDate,
          amount: createPayoutAmount,
          month: createPayoutMonth,
          status: createPayoutStatus,
        });

        await reloadPayrollData();
        handleCloseCreatePayout();
        setActiveTab("payouts");
        setToastType("success");
        setToastMessage("Выплата добавлена");
        return;
      }

      if (!createExtraReason.trim()) {
        setToastType("error");
        setToastMessage("Укажи причину внеплановой выплаты");
        return;
      }

      await createPayrollExtraPaymentInSupabase({
        id: generateEntityId("payroll_extra"),
        employee: createEmployee,
        employeeId: createEmployeeId || null,
        reason: createExtraReason,
        date: createPayoutDate,
        amount: createPayoutAmount,
      });

      await reloadPayrollData();
      handleCloseCreatePayout();
      setActiveTab("extra");
      setToastType("success");
      setToastMessage("Внеплановая выплата добавлена");
    } catch (error) {
      console.error(error);
      setToastType("error");
      setToastMessage("Не удалось добавить выплату");
    }
  }

  return (
    <div className="min-h-screen bg-[#0B0F1A] text-white">
      <div className="flex min-h-screen">
        <AppSidebar />

        <main className="flex-1">
          <div className="space-y-6 px-5 py-6 lg:px-8">
            <PayrollPageHeader
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              onAddPayout={() => {
                setCreatePayoutDate(getTodayDisplayDate());
                setIsCreatePayoutOpen(true);
              }}
            />

            <div className="rounded-[28px] border border-white/10 bg-[#121826] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.32)]">
  <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
    <div>
      <div className="text-sm text-white/50">Сводка за период</div>
      <div className="mt-1 text-sm text-white/70">
        {selectedPeriod.label}
      </div>
    </div>

    <div className="relative">
      <button
        type="button"
        onClick={() => setIsPeriodPickerOpen((prev) => !prev)}
        className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/80 transition hover:bg-white/[0.06] hover:text-white"
      >
        Изменить период
      </button>

      {isPeriodPickerOpen ? (
        <div className="absolute right-0 top-[calc(100%+12px)] z-30 w-[360px] rounded-[24px] border border-white/10 bg-[#121826] p-4 shadow-[0_20px_80px_rgba(0,0,0,0.45)]">
          <div className="text-sm text-white/50">Быстрый выбор</div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            {[
              { key: "last7", label: "7 дней" },
              { key: "last30", label: "30 дней" },
              { key: "last90", label: "90 дней" },
              { key: "thisMonth", label: "Этот месяц" },
              { key: "prevMonth", label: "Прошлый месяц" },
              { key: "custom", label: "Свой период" },
            ].map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() =>
                  setPeriodPreset(
                    item.key as
                      | "last7"
                      | "last30"
                      | "last90"
                      | "thisMonth"
                      | "prevMonth"
                      | "custom"
                  )
                }
                className={`rounded-xl px-3 py-2 text-sm transition ${
                  periodPreset === item.key
                    ? "bg-[#7B61FF] text-white shadow-[0_0_24px_rgba(123,97,255,0.35)]"
                    : "bg-white/[0.04] text-white/70 hover:text-white"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {periodPreset === "custom" ? (
            <div className="mt-4 grid gap-3">
              <div>
                <label className="mb-2 block text-sm text-white/55">Дата от</label>
                <input
                  type="date"
                  value={customDateFrom ? formatDateToInputValue(parseDisplayDateToDate(customDateFrom) ?? new Date()) : ""}
                  onChange={(e) =>
                    setCustomDateFrom(formatInputDateToDisplay(e.target.value))
                  }
                  className="h-[48px] w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm text-white outline-none"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm text-white/55">Дата до</label>
                <input
                  type="date"
                  value={customDateTo ? formatDateToInputValue(parseDisplayDateToDate(customDateTo) ?? new Date()) : ""}
                  onChange={(e) =>
                    setCustomDateTo(formatInputDateToDisplay(e.target.value))
                  }
                  className="h-[48px] w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm text-white outline-none"
                />
              </div>
            </div>
          ) : null}

          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={() => setIsPeriodPickerOpen(false)}
              className="rounded-2xl bg-emerald-400/15 px-4 py-3 text-sm font-medium text-emerald-300 shadow-[0_0_24px_rgba(16,185,129,0.18)] transition hover:bg-emerald-400/20"
            >
              Готово
            </button>
          </div>
        </div>
      ) : null}
    </div>
  </div>

  <div className="mt-5 grid gap-4 md:grid-cols-3">
    <div className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.28)]">
      <div className="text-sm text-white/55">Начислено</div>
      <div className="mt-3 text-2xl font-semibold tracking-tight text-violet-300">
        ₽{totalAccrued.toLocaleString("ru-RU")}
      </div>
    </div>

    <div className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.28)]">
      <div className="text-sm text-white/55">Выплачено</div>
      <div className="mt-3 text-2xl font-semibold tracking-tight text-emerald-300">
        ₽{totalPaid.toLocaleString("ru-RU")}
      </div>
    </div>

    <div className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.28)]">
      <div className="text-sm text-white/55">Внеплановые</div>
      <div className="mt-3 text-2xl font-semibold tracking-tight text-amber-300">
        ₽{totalExtra.toLocaleString("ru-RU")}
      </div>
    </div>
  </div>
</div>
            {isLoadingPayroll ? (
              <div className="rounded-[28px] border border-white/10 bg-[#121826] p-8 text-white/60">
                Загрузка payroll...
              </div>
            ) : activeTab === "accruals" ? (
              <>
                <div className="rounded-[28px] border border-white/10 bg-[#121826] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.32)]">
                  <div className="flex items-center justify-between gap-4">
                    <div className="text-sm text-white/50">
                      Готово к выплате
                    </div>

                    <button
                      type="button"
                      onClick={handlePayAllEmployees}
                      disabled={pendingEmployeePayouts.length === 0}
                      className={`rounded-2xl px-4 py-3 text-sm font-medium transition ${
                        pendingEmployeePayouts.length === 0
                          ? "cursor-not-allowed bg-white/[0.04] text-white/35"
                          : "bg-emerald-400/15 text-emerald-300 shadow-[0_0_24px_rgba(16,185,129,0.18)] hover:bg-emerald-400/20"
                      }`}
                    >
                      Оплатить всё
                    </button>
                  </div>

                  <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {pendingEmployeePayouts.length > 0 ? (
                      pendingEmployeePayouts.map((item) => (
                        <div
                          key={item.employeeId || item.employee}
                          className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4"
                        >
                          <div className="text-sm text-white/45">
                            Сотрудник
                          </div>
                          <div className="mt-1 text-lg font-semibold">
                            {item.employee}
                          </div>

                          <div className="mt-4 text-sm text-white/45">
                            К выплате
                          </div>
                          <div className="mt-1 text-2xl font-semibold text-emerald-300">
                            ₽{item.total.toLocaleString("ru-RU")}
                          </div>

                          <div className="mt-2 text-sm text-white/50">
                            {item.month}
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              handlePayEmployee(item.employeeId || item.employee)
                            }
                            className="mt-4 rounded-2xl bg-emerald-400/15 px-4 py-3 text-sm font-medium text-emerald-300 shadow-[0_0_24px_rgba(16,185,129,0.18)] transition hover:bg-emerald-400/20"
                          >
                            Выплатить сотруднику
                          </button>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5 text-sm text-white/45 md:col-span-2 xl:col-span-3">
                        Сейчас нет начислений со статусом «Начислено», готовых к
                        общей выплате.
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-[28px] border border-white/10 bg-[#121826] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.32)]">
  <div className="flex items-center gap-3 overflow-x-auto">
    <input
      value={search}
      onChange={(e) => setSearch(e.target.value)}
      placeholder="Поиск по сотруднику, клиенту, проекту..."
      className="h-[48px] min-w-[320px] flex-[1.4] rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm text-white outline-none placeholder:text-white/30"
    />

    <select
      value={employeeFilter}
      onChange={(e) => setEmployeeFilter(e.target.value)}
      className="h-[48px] min-w-[220px] flex-1 rounded-2xl border border-white/10 bg-[#0F1524] px-4 text-sm text-white outline-none"
    >
      <option value="all">Все сотрудники</option>
      {employeeFilterOptions.map((employee) => (
        <option key={employee} value={employee}>
          {employee}
        </option>
      ))}
    </select>

    <select
      value={monthFilter}
      onChange={(e) => setMonthFilter(e.target.value)}
      className="h-[48px] min-w-[220px] flex-1 rounded-2xl border border-white/10 bg-[#0F1524] px-4 text-sm text-white outline-none"
    >
      <option value="all">Все месяцы</option>
      {monthFilterOptions.map((month) => (
        <option key={month} value={month}>
          {month}
        </option>
      ))}
    </select>

    {activeTab !== "extra" ? (
      <select
        value={statusFilter}
        onChange={(e) => setStatusFilter(e.target.value)}
        className="h-[48px] min-w-[190px] flex-1 rounded-2xl border border-white/10 bg-[#0F1524] px-4 text-sm text-white outline-none"
      >
        <option value="all">Все статусы</option>
        {activeTab === "accruals" ? (
          <>
            <option value="accrued">Начислено</option>
            <option value="paid">Выплачено</option>
          </>
        ) : (
          <>
            <option value="scheduled">Запланировано</option>
            <option value="paid">Выплачено</option>
          </>
        )}
      </select>
    ) : null}

    <button
      type="button"
      onClick={() => {
        setSearch("");
        setEmployeeFilter("all");
        setMonthFilter("all");
        setStatusFilter("all");
      }}
      className="h-[48px] min-w-[180px] rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm text-white/80 transition hover:bg-white/[0.06] hover:text-white"
    >
      Сбросить
    </button>
  </div>
</div>


                <PayrollAccrualsTable
  items={filteredAccruals}
  onEdit={handleStartEditAccrual}
  onDelete={handleDeleteAccrual}
  onPay={handlePaySingleAccrual}
/>
              </>
            ) : activeTab === "payouts" ? (
              <PayrollPayoutsTable
  items={filteredPayouts}
  onEdit={handleStartEditPayout}
  onDelete={handleDeletePayout}
/>
            ) : (
              <PayrollExtraTable
  items={filteredExtraPayments}
  onEdit={handleStartEditExtra}
  onDelete={handleDeleteExtra}
/>
            )}
          </div>

          {isEditAccrualOpen ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
              <div className="w-full max-w-[640px] rounded-[28px] border border-white/10 bg-[#121826] p-6 shadow-[0_20px_80px_rgba(0,0,0,0.45)]">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm text-white/50">Начисление</div>
                    <h3 className="mt-1 text-xl font-semibold text-white">
                      Редактирование начисления
                    </h3>
                  </div>

                  <button
                    type="button"
                    onClick={handleCloseEditAccrual}
                    className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white/70 transition hover:text-white"
                  >
                    Закрыть
                  </button>
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  <select
                    value={editEmployeeId}
                    onChange={(e) => {
                      const nextEmployeeId = e.target.value;
                      const selectedEmployee = employees.find(
                        (employee) => employee.id === nextEmployeeId
                      );

                      setEditEmployeeId(nextEmployeeId);
                      setEditEmployee(selectedEmployee?.name ?? "");
                    }}
                    className="h-[48px] rounded-2xl border border-white/10 bg-[#0F1524] px-4 text-sm text-white outline-none"
                  >
                    <option value="">Выбери сотрудника</option>
                    {employeeOptions.map((employee) => (
                      <option key={employee.id} value={employee.id}>
                        {employee.name} — {employee.role}
                      </option>
                    ))}
                  </select>

                  <input
                    value={editClient}
                    onChange={(e) => setEditClient(e.target.value)}
                    placeholder="Клиент"
                    className="h-[48px] rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm text-white outline-none placeholder:text-white/30"
                  />

                  <select
                    value={editProject}
                    onChange={(e) => setEditProject(e.target.value)}
                    className="h-[48px] rounded-2xl border border-white/10 bg-[#0F1524] px-4 text-sm text-white outline-none"
                  >
                    <option value="">Выбери проект</option>
                    {projectOptions.map((project) => (
                      <option key={project} value={project}>
                        {project}
                      </option>
                    ))}
                  </select>

                  <input
                    value={editAmount}
                    onChange={(e) => setEditAmount(e.target.value)}
                    placeholder="Сумма"
                    className="h-[48px] rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm text-white outline-none placeholder:text-white/30"
                  />

                  <input
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    placeholder="Дата"
                    className="h-[48px] rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm text-white outline-none placeholder:text-white/30"
                  />

                  <select
                    value={editStatus}
                    onChange={(e) =>
                      setEditStatus(e.target.value as "accrued" | "paid")
                    }
                    className="h-[48px] rounded-2xl border border-white/10 bg-[#0F1524] px-4 text-sm text-white outline-none"
                  >
                    <option value="accrued">Начислено</option>
                    <option value="paid">Выплачено</option>
                  </select>
                </div>

                <div className="mt-6 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={handleCloseEditAccrual}
                    className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/80 transition hover:bg-white/[0.06] hover:text-white"
                  >
                    Отмена
                  </button>

                  <button
                    type="button"
                    onClick={handleSaveAccrual}
                    className="rounded-2xl bg-emerald-400/15 px-4 py-3 text-sm font-medium text-emerald-300 shadow-[0_0_24px_rgba(16,185,129,0.18)] transition hover:bg-emerald-400/20"
                  >
                    Сохранить
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {isEditPayoutOpen ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
              <div className="w-full max-w-[640px] rounded-[28px] border border-white/10 bg-[#121826] p-6 shadow-[0_20px_80px_rgba(0,0,0,0.45)]">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm text-white/50">Выплата</div>
                    <h3 className="mt-1 text-xl font-semibold text-white">
                      Редактирование выплаты
                    </h3>
                  </div>

                  <button
                    type="button"
                    onClick={handleCloseEditPayout}
                    className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white/70 transition hover:text-white"
                  >
                    Закрыть
                  </button>
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  <select
                    value={editPayoutEmployeeId}
                    onChange={(e) => {
                      const nextEmployeeId = e.target.value;
                      const selectedEmployee = employees.find(
                        (employee) => employee.id === nextEmployeeId
                      );

                      setEditPayoutEmployeeId(nextEmployeeId);
                      setEditPayoutEmployee(selectedEmployee?.name ?? "");
                    }}
                    className="h-[48px] rounded-2xl border border-white/10 bg-[#0F1524] px-4 text-sm text-white outline-none"
                  >
                    <option value="">Выбери сотрудника</option>
                    {employeeOptions.map((employee) => (
                      <option key={employee.id} value={employee.id}>
                        {employee.name} — {employee.role}
                      </option>
                    ))}
                  </select>

                  <input
                    value={editPayoutMonth}
                    onChange={(e) => setEditPayoutMonth(e.target.value)}
                    placeholder="Месяц"
                    className="h-[48px] rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm text-white outline-none placeholder:text-white/30"
                  />

                  <input
                    value={editPayoutDate}
                    onChange={(e) => setEditPayoutDate(e.target.value)}
                    placeholder="Дата выплаты"
                    className="h-[48px] rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm text-white outline-none placeholder:text-white/30"
                  />

                  <input
                    value={editPayoutAmount}
                    onChange={(e) => setEditPayoutAmount(e.target.value)}
                    placeholder="Сумма"
                    className="h-[48px] rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm text-white outline-none placeholder:text-white/30"
                  />

                  <select
                    value={editPayoutStatus}
                    onChange={(e) =>
                      setEditPayoutStatus(e.target.value as "scheduled" | "paid")
                    }
                    className="h-[48px] rounded-2xl border border-white/10 bg-[#0F1524] px-4 text-sm text-white outline-none md:col-span-2"
                  >
                    <option value="scheduled">Запланировано</option>
                    <option value="paid">Выплачено</option>
                  </select>
                </div>

                <div className="mt-6 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={handleCloseEditPayout}
                    className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/80 transition hover:bg-white/[0.06] hover:text-white"
                  >
                    Отмена
                  </button>

                  <button
                    type="button"
                    onClick={handleSavePayout}
                    className="rounded-2xl bg-emerald-400/15 px-4 py-3 text-sm font-medium text-emerald-300 shadow-[0_0_24px_rgba(16,185,129,0.18)] transition hover:bg-emerald-400/20"
                  >
                    Сохранить
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {isEditExtraOpen ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
              <div className="w-full max-w-[640px] rounded-[28px] border border-white/10 bg-[#121826] p-6 shadow-[0_20px_80px_rgba(0,0,0,0.45)]">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm text-white/50">
                      Внеплановая выплата
                    </div>
                    <h3 className="mt-1 text-xl font-semibold text-white">
                      Редактирование внеплановой выплаты
                    </h3>
                  </div>

                  <button
                    type="button"
                    onClick={handleCloseEditExtra}
                    className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white/70 transition hover:text-white"
                  >
                    Закрыть
                  </button>
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  <select
                    value={editExtraEmployeeId}
                    onChange={(e) => {
                      const nextEmployeeId = e.target.value;
                      const selectedEmployee = employees.find(
                        (employee) => employee.id === nextEmployeeId
                      );

                      setEditExtraEmployeeId(nextEmployeeId);
                      setEditExtraEmployee(selectedEmployee?.name ?? "");
                    }}
                    className="h-[48px] rounded-2xl border border-white/10 bg-[#0F1524] px-4 text-sm text-white outline-none"
                  >
                    <option value="">Выбери сотрудника</option>
                    {employeeOptions.map((employee) => (
                      <option key={employee.id} value={employee.id}>
                        {employee.name} — {employee.role}
                      </option>
                    ))}
                  </select>

                  <input
                    value={editExtraDate}
                    onChange={(e) => setEditExtraDate(e.target.value)}
                    placeholder="Дата"
                    className="h-[48px] rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm text-white outline-none placeholder:text-white/30"
                  />

                  <input
                    value={editExtraReason}
                    onChange={(e) => setEditExtraReason(e.target.value)}
                    placeholder="Причина"
                    className="h-[48px] rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm text-white outline-none placeholder:text-white/30 md:col-span-2"
                  />

                  <input
                    value={editExtraAmount}
                    onChange={(e) => setEditExtraAmount(e.target.value)}
                    placeholder="Сумма"
                    className="h-[48px] rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm text-white outline-none placeholder:text-white/30 md:col-span-2"
                  />
                </div>

                <div className="mt-6 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={handleCloseEditExtra}
                    className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/80 transition hover:bg-white/[0.06] hover:text-white"
                  >
                    Отмена
                  </button>

                  <button
                    type="button"
                    onClick={handleSaveExtra}
                    className="rounded-2xl bg-emerald-400/15 px-4 py-3 text-sm font-medium text-emerald-300 shadow-[0_0_24px_rgba(16,185,129,0.18)] transition hover:bg-emerald-400/20"
                  >
                    Сохранить
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {isCreatePayoutOpen ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
              <div className="w-full max-w-[640px] rounded-[28px] border border-white/10 bg-[#121826] p-6 shadow-[0_20px_80px_rgba(0,0,0,0.45)]">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm text-white/50">Новая выплата</div>
                    <h3 className="mt-1 text-xl font-semibold text-white">
                      Добавить выплату
                    </h3>
                  </div>

                  <button
                    type="button"
                    onClick={handleCloseCreatePayout}
                    className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white/70 transition hover:text-white"
                  >
                    Закрыть
                  </button>
                </div>

                <div className="mt-6 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setCreatePayoutType("payout")}
                    className={`rounded-xl px-4 py-2 text-sm transition ${
                      createPayoutType === "payout"
                        ? "bg-emerald-500/20 text-emerald-300"
                        : "bg-white/[0.04] text-white/60 hover:text-white"
                    }`}
                  >
                    Плановая выплата
                  </button>

                  <button
                    type="button"
                    onClick={() => setCreatePayoutType("extra")}
                    className={`rounded-xl px-4 py-2 text-sm transition ${
                      createPayoutType === "extra"
                        ? "bg-amber-500/20 text-amber-300"
                        : "bg-white/[0.04] text-white/60 hover:text-white"
                    }`}
                  >
                    Внеплановая выплата
                  </button>
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  <select
                    value={createEmployeeId}
                    onChange={(e) => {
                      const nextEmployeeId = e.target.value;
                      const selectedEmployee = employees.find(
                        (employee) => employee.id === nextEmployeeId
                      );

                      setCreateEmployeeId(nextEmployeeId);
                      setCreateEmployee(selectedEmployee?.name ?? "");
                    }}
                    className="h-[48px] rounded-2xl border border-white/10 bg-[#0F1524] px-4 text-sm text-white outline-none"
                  >
                    <option value="">Выбери сотрудника</option>
                    {employeeOptions.map((employee) => (
                      <option key={employee.id} value={employee.id}>
                        {employee.name} — {employee.role}
                      </option>
                    ))}
                  </select>

                  <input
                    value={createPayoutDate}
                    onChange={(e) => setCreatePayoutDate(e.target.value)}
                    placeholder="Дата"
                    className="h-[48px] rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm text-white outline-none placeholder:text-white/30"
                  />

                  <input
                    value={createPayoutAmount}
                    onChange={(e) => setCreatePayoutAmount(e.target.value)}
                    placeholder="Сумма"
                    className="h-[48px] rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm text-white outline-none placeholder:text-white/30"
                  />

                  {createPayoutType === "payout" ? (
                    <input
                      value={createPayoutMonth}
                      onChange={(e) => setCreatePayoutMonth(e.target.value)}
                      placeholder="Месяц"
                      className="h-[48px] rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm text-white outline-none placeholder:text-white/30"
                    />
                  ) : (
                    <input
                      value={createExtraReason}
                      onChange={(e) => setCreateExtraReason(e.target.value)}
                      placeholder="Причина"
                      className="h-[48px] rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm text-white outline-none placeholder:text-white/30"
                    />
                  )}

                  {createPayoutType === "payout" ? (
                    <select
                      value={createPayoutStatus}
                      onChange={(e) =>
                        setCreatePayoutStatus(
                          e.target.value as "scheduled" | "paid"
                        )
                      }
                      className="h-[48px] rounded-2xl border border-white/10 bg-[#0F1524] px-4 text-sm text-white outline-none md:col-span-2"
                    >
                      <option value="paid">Выплачено</option>
                      <option value="scheduled">Запланировано</option>
                    </select>
                  ) : null}
                </div>

                <div className="mt-6 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={handleCloseCreatePayout}
                    className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/80 transition hover:bg-white/[0.06] hover:text-white"
                  >
                    Отмена
                  </button>

                  <button
                    type="button"
                    onClick={handleCreateManualPayout}
                    className="rounded-2xl bg-emerald-400/15 px-4 py-3 text-sm font-medium text-emerald-300 shadow-[0_0_24px_rgba(16,185,129,0.18)] transition hover:bg-emerald-400/20"
                  >
                    Сохранить
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </main>
      </div>

      {toastMessage ? (
        <AppToast message={toastMessage} type={toastType} />
      ) : null}
    </div>
  );
}