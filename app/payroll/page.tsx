"use client";

import { AccessDenied } from "../components/access/access-denied";
import { usePageAccess } from "../lib/use-page-access";
import { canManageFinance, isAppRole, type AppRole } from "../lib/permissions";
import { useAppContextState } from "../providers/app-context-provider";

import { useEffect, useMemo, useRef, useState } from "react";
import { PayrollPageHeader } from "../components/payroll/payroll-page-header";
import { PayrollAccrualsTable } from "../components/payroll/payroll-accruals-table";
import { PayrollPayoutsTable } from "../components/payroll/payroll-payouts-table";
import { PayrollExtraTable } from "../components/payroll/payroll-extra-table";
import { AppToast } from "../components/ui/app-toast";
import { CustomSelect } from "../components/ui/custom-select";
import { useConfirmDialog } from "../components/ui/confirm-dialog-provider";
import {
  RivnDatePicker,
  RivnDateRangePicker,
} from "../components/ui/rivn-date-picker";

import { useQueryClient } from "@tanstack/react-query";

import {
  generateEntityId,
  parseRubAmount,
  formatRub,
  type StoredPayrollAccrual,
  type StoredPayrollExtraPayment,
  type StoredPayrollPayout,
} from "../lib/storage";

import {
  getWorkspaceMembers,
  getWorkspaceMemberDisplayName,
  type WorkspaceMemberItem,
} from "../lib/supabase/workspace-members";
import {
  ensureSystemSettings,
  type SystemSettings,
} from "../lib/supabase/system-settings";

import {
  fetchPayrollAccrualsFromSupabase,
  fetchPayrollExtraPaymentsFromSupabase,
  fetchPayrollPayoutsFromSupabase,
  createPayrollAccrualInSupabase,
  createPayrollPayoutInSupabase,
  createPayrollExtraPaymentInSupabase,
  updatePayrollAccrualInSupabase,
  deletePayrollAccrualFromSupabase,
  updatePayrollPayoutInSupabase,
  deletePayrollPayoutFromSupabase,
  updatePayrollExtraPaymentInSupabase,
  deletePayrollExtraPaymentFromSupabase,
} from "../lib/supabase/payroll";

import {
  sendSalaryAccruedNotification,
  sendSalaryPaidNotification,
} from "../lib/notifications-client";
import { queryKeys } from "../lib/query-keys";

function getTodayDisplayDate() {
  const today = new Date();
  const day = String(today.getDate()).padStart(2, "0");
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const year = today.getFullYear();
  return `${day}.${month}.${year}`;
}

function getDefaultPayrollDate(payrollDay?: number | null) {
  const today = new Date();
  const safeDay = Math.min(Math.max(Number(payrollDay || 1), 1), 31);

  const year = today.getFullYear();
  const month = today.getMonth();
  const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
  const targetDay = Math.min(safeDay, lastDayOfMonth);

  const result = new Date(year, month, targetDay);

  const day = String(result.getDate()).padStart(2, "0");
  const monthValue = String(result.getMonth() + 1).padStart(2, "0");
  const yearValue = result.getFullYear();

  return `${day}.${monthValue}.${yearValue}`;
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

function getCurrentMonthAccrualLabel() {
  return getMonthLabelFromDate(getTodayDisplayDate());
}

function isSalaryAccrualForMonth(
  item: StoredPayrollAccrual,
  employeeId: string,
  monthLabel: string
) {
  return (
    item.employeeId === employeeId &&
    item.client === "Оклад" &&
    item.project === `Оклад за ${monthLabel}`
  );
}





function hasPayoutForMonth(
  payouts: StoredPayrollPayout[],
  employeeId: string | null | undefined,
  employeeName: string,
  monthLabel: string
) {
  return payouts.some((item) => {
    const sameMonth = item.month === monthLabel;
    const sameEmployee = employeeId
      ? item.employeeId === employeeId
      : item.employee === employeeName;

    return sameMonth && sameEmployee;
  });
}

function calculateWorkspaceMemberPayrollAmount(member: WorkspaceMemberItem) {
  const projectRate = parseRubAmount(member.pay_value ?? "");
  const fixedSalary = parseRubAmount(member.fixed_salary ?? "");

  if (member.pay_type === "fixed_salary") {
    return fixedSalary;
  }

  if (member.pay_type === "fixed_salary_plus_project") {
    return fixedSalary + projectRate;
  }

  return projectRate;
}

function isActivePayrollMember(member: WorkspaceMemberItem) {
  return member.status === "active" && (member.is_payroll_active ?? true);
}

function getMemberNameById(
  members: WorkspaceMemberItem[],
  memberId: string | null | undefined,
  fallback = "Без имени"
) {
  if (!memberId) return fallback;

  const member = members.find((item) => item.id === memberId);
  if (!member) return fallback;

  return getWorkspaceMemberDisplayName(member);
}

function getPayrollRoleLabel(role: string | null | undefined) {
  const labels: Record<string, string> = {
    owner: "Владелец",
    admin: "Администратор",
    manager: "Менеджер",
    analyst: "Аналитик",
    employee: "Сотрудник",
    sales_head: "РОП",
    sales_manager: "Менеджер продаж",
  };

  return labels[String(role ?? "")] ?? "Сотрудник";
}

export default function PayrollPage() {
  const { confirm } = useConfirmDialog();
  const queryClient = useQueryClient();

  const {
    role,
    workspace,
    user,
    profile,
    membership,
    isLoading: isAppContextLoading,
  } = useAppContextState();
  const { isLoading: isAccessLoading, hasAccess } = usePageAccess("payroll");

const currentRole: AppRole | null = isAppRole(role) ? role : null;
const canManagePayroll = currentRole ? canManageFinance(currentRole) : false;

const [members, setMembers] = useState<WorkspaceMemberItem[]>([]);
const [systemSettings, setSystemSettings] = useState<SystemSettings | null>(null);

  const [activeTab, setActiveTab] = useState<"accruals" | "payouts" | "extra">(
    "accruals"
  );

  const [accruals, setAccruals] = useState<StoredPayrollAccrual[]>([]);
  const [payouts, setPayouts] = useState<StoredPayrollPayout[]>([]);
  const [extraPayments, setExtraPayments] = useState<StoredPayrollExtraPayment[]>([]);
  const [isLoadingPayroll, setIsLoadingPayroll] = useState(true);

  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState<"success" | "error" | "info">(
    "success"
  );

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
  const [editPayoutStatus, setEditPayoutStatus] = useState<"scheduled" | "paid">(
    "paid"
  );

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
  const [createPayoutStatus, setCreatePayoutStatus] = useState<"scheduled" | "paid">(
    "paid"
  );
  const [createExtraReason, setCreateExtraReason] = useState("");

  const [isMounted, setIsMounted] = useState(false);

    const isAccruingSalariesRef = useRef(false);

useEffect(() => {
  setIsMounted(true);
}, []);

  useEffect(() => {
    if (!toastMessage) return;

    const timer = setTimeout(() => {
      setToastMessage("");
    }, 2200);

    return () => clearTimeout(timer);
  }, [toastMessage]);

    useEffect(() => {
    if (canManagePayroll) return;

    setIsEditAccrualOpen(false);
    setEditingAccrualId(null);

    setIsEditPayoutOpen(false);
    setEditingPayoutId(null);

    setIsEditExtraOpen(false);
    setEditingExtraId(null);

    setIsCreatePayoutOpen(false);
  }, [canManagePayroll]);

    useEffect(() => {
  if (isAppContextLoading || isAccessLoading || !hasAccess) return;


    let isMounted = true;

    async function loadPayrollData() {
      try {
        const cachedAccruals = workspace?.id
          ? queryClient.getQueryData<StoredPayrollAccrual[]>(
              queryKeys.payrollAccrualsByWorkspace(workspace.id)
            )
          : undefined;
        const cachedPayouts = workspace?.id
          ? queryClient.getQueryData<StoredPayrollPayout[]>(
              queryKeys.payrollPayoutsByWorkspace(workspace.id)
            )
          : undefined;
        const cachedExtraPayments = workspace?.id
          ? queryClient.getQueryData<StoredPayrollExtraPayment[]>(
              queryKeys.payrollExtraPaymentsByWorkspace(workspace.id)
            )
          : undefined;
        const cachedMembers = workspace?.id
          ? queryClient.getQueryData<WorkspaceMemberItem[]>(
              queryKeys.workspaceMembersByWorkspace(workspace.id)
            )
          : undefined;
        const hasCachedPayrollData =
          cachedAccruals &&
          cachedPayouts &&
          cachedExtraPayments &&
          cachedMembers;

        if (hasCachedPayrollData) {
          setAccruals(cachedAccruals);
          setPayouts(cachedPayouts);
          setExtraPayments(cachedExtraPayments);
          setMembers(cachedMembers);
          setIsLoadingPayroll(false);
        } else {
          setIsLoadingPayroll(true);
        }

        const [
          accrualsData,
          payoutsData,
          extraData,
          membersData,
          settingsData,
        ] = await Promise.all([
          fetchPayrollAccrualsFromSupabase(),
          fetchPayrollPayoutsFromSupabase(),
          fetchPayrollExtraPaymentsFromSupabase(),
          getWorkspaceMembers(),
          ensureSystemSettings(),
        ]);

        if (!isMounted) return;

        setAccruals(accrualsData);
setPayouts(payoutsData);
setExtraPayments(extraData);
setMembers(membersData);
setSystemSettings(settingsData);
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
  }, [isAppContextLoading, isAccessLoading, hasAccess, queryClient, workspace?.id]);

  const memberOptions = useMemo(() => {
    const options = members
      .filter(isActivePayrollMember)
      .map((member) => ({
        id: member.id,
        name: getWorkspaceMemberDisplayName(member),
        role: member.role,
        payType: member.pay_type ?? "fixed_per_paid_project",
        payValue: member.pay_value ?? "₽0",
        fixedSalary: member.fixed_salary ?? "",
        payoutDay: member.payout_day ?? null,
      }));

    const currentMembershipId = membership?.id ? String(membership.id) : "";
    const alreadyHasCurrentUser = options.some(
      (member) => member.id === currentMembershipId
    );

    if (currentMembershipId && !alreadyHasCurrentUser) {
      const fallbackName =
        profile?.display_name?.trim?.() ||
        profile?.name?.trim?.() ||
        user?.email?.split("@")[0] ||
        "Владелец кабинета";

      options.unshift({
        id: currentMembershipId,
        name: fallbackName,
        role: (membership?.role ?? role ?? "owner") as WorkspaceMemberItem["role"],
        payType: "fixed_per_paid_project",
        payValue: systemSettings?.default_employee_pay || "₽0",
        fixedSalary: "",
        payoutDay: systemSettings?.payroll_day ?? null,
      });
    }

    return options;
  }, [members, membership, profile, role, systemSettings, user]);

  const memberSelectOptions = useMemo(() => {
    return memberOptions.map((member) => ({
      value: member.id,
      label: `${member.name} — ${getPayrollRoleLabel(member.role)}`,
    }));
  }, [memberOptions]);

  const payoutStatusOptions = useMemo(
    () => [
      { value: "paid", label: "Выплачено" },
      { value: "scheduled", label: "Запланировано" },
    ],
    []
  );

  const accrualStatusOptions = useMemo(
    () => [
      { value: "accrued", label: "Начислено" },
      { value: "paid", label: "Выплачено" },
    ],
    []
  );

  const projectOptions = useMemo(() => {
    return Array.from(
      new Set(
        accruals
          .map((item) => item.project.trim())
          .filter((value) => value.length > 0)
      )
    );
  }, [accruals]);

  const projectSelectOptions = useMemo(
    () => [
      { value: "", label: "Выбери проект" },
      ...projectOptions.map((project) => ({ value: project, label: project })),
    ],
    [projectOptions]
  );

  const membersMap = useMemo(() => {
  return new Map(members.map((member) => [member.id, member]));
}, [members]);

  function getMemberAmountById(memberId: string | null | undefined) {
  if (!memberId) {
    return systemSettings?.default_employee_pay || "₽5,000";
  }

  const member = membersMap.get(memberId);

  if (!member) {
    return systemSettings?.default_employee_pay || "₽5,000";
  }

  return formatRub(calculateWorkspaceMemberPayrollAmount(member));
}

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

  function displayDateToPickerValue(value: string) {
    const date = parseDisplayDateToDate(value);
    return date ? formatDateToInputValue(date) : "";
  }

  async function reloadPayrollData() {
    const [
      accrualsData,
      payoutsData,
      extraData,
      membersData,
      settingsData,
    ] = await Promise.all([
      fetchPayrollAccrualsFromSupabase(),
      fetchPayrollPayoutsFromSupabase(),
      fetchPayrollExtraPaymentsFromSupabase(),
      getWorkspaceMembers(),
      ensureSystemSettings(),
    ]);

    setAccruals(accrualsData);
setPayouts(payoutsData);
setExtraPayments(extraData);
setMembers(membersData);
setSystemSettings(settingsData);

    if (workspace?.id) {
      queryClient.setQueryData(
        queryKeys.payrollAccrualsByWorkspace(workspace.id),
        accrualsData
      );
      queryClient.setQueryData(
        queryKeys.payrollPayoutsByWorkspace(workspace.id),
        payoutsData
      );
      queryClient.setQueryData(
        queryKeys.payrollExtraPaymentsByWorkspace(workspace.id),
        extraData
      );
    }
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

  const totalExtra = useMemo(() => {
    return extraPayments
      .filter((item) => isDateInSelectedPeriod(item.date))
      .reduce((sum, item) => {
        return sum + parseRubAmount(item.amount);
      }, 0);
  }, [extraPayments, selectedPeriod]);

    async function invalidatePayrollQueries() {
    await queryClient.invalidateQueries({
      predicate: (query) =>
        Array.isArray(query.queryKey) &&
        query.queryKey.some(
          (part) =>
            typeof part === "string" &&
            part.toLowerCase().includes("payroll")
        ),
      refetchType: "all",
    });
  }

  const pendingEmployeePayouts = useMemo(() => {
  const currentMonthLabel = getMonthLabelFromDate(getTodayDisplayDate());

  const groups = new Map<
    string,
    {
      employee: string;
      employeeId: string | null;
      total: number;
      accrualIds: string[];
      month: string;
      salaryPart: number;
      projectPart: number;
      payType: WorkspaceMemberItem["pay_type"];
    }
  >();

  const activeMembers = members.filter(isActivePayrollMember);

  activeMembers.forEach((member) => {
    const memberName = getWorkspaceMemberDisplayName(member);

    const alreadyHasPayoutThisMonth = hasPayoutForMonth(
      payouts,
      member.id,
      memberName,
      currentMonthLabel
    );

    const alreadyHasSalaryAccrualThisMonth = accruals.some((item) =>
      isSalaryAccrualForMonth(item, member.id, currentMonthLabel)
    );

    const baseSalary =
      !alreadyHasPayoutThisMonth &&
      !alreadyHasSalaryAccrualThisMonth &&
      (member.pay_type === "fixed_salary" ||
        member.pay_type === "fixed_salary_plus_project")
        ? parseRubAmount(member.fixed_salary || "0")
        : 0;

    groups.set(member.id, {
      employee: memberName,
      employeeId: member.id,
      total: baseSalary,
      accrualIds: [],
      month: currentMonthLabel,
      salaryPart: baseSalary,
      projectPart: 0,
      payType: member.pay_type,
    });
  });

  accruals
    .filter((item) => item.status === "accrued")
    .forEach((item) => {
      const key = item.employeeId || item.employee;
      const amount = parseRubAmount(item.amount);
      const existing = groups.get(key);

      const isSalaryAccrual =
        item.employeeId
          ? isSalaryAccrualForMonth(item, item.employeeId, currentMonthLabel)
          : false;

      if (existing) {
        existing.total += amount;

        if (isSalaryAccrual) {
          existing.salaryPart += amount;
        } else {
          existing.projectPart += amount;
        }

        existing.accrualIds.push(item.id);
        return;
      }

      groups.set(key, {
        employee: item.employee,
        employeeId: item.employeeId ?? null,
        total: amount,
        accrualIds: [item.id],
        month: getMonthLabelFromDate(item.date),
        salaryPart: isSalaryAccrual ? amount : 0,
        projectPart: isSalaryAccrual ? 0 : amount,
        payType: null,
      });
    });

  return Array.from(groups.values()).filter((item) => item.total > 0);
}, [accruals, members, payouts]);

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
        if (!canManagePayroll) {
      setToastType("error");
      setToastMessage("У тебя нет прав на редактирование payroll");
      return;
    }
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
        if (!canManagePayroll) {
      setToastType("error");
      setToastMessage("У тебя нет прав на редактирование payroll");
      return;
    }
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
      await invalidatePayrollQueries();

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
        if (!canManagePayroll) {
      setToastType("error");
      setToastMessage("У тебя нет прав на удаление payroll-записей");
      return;
    }
    const target = accruals.find((item) => item.id === id);

    if (!target) {
      setToastType("error");
      setToastMessage("Начисление не найдено");
      return;
    }

    const confirmed = await confirm({
      title: "Удалить начисление?",
      description: `Начисление для "${target.employee}" на сумму ${target.amount} будет удалено.`,
      confirmLabel: "Удалить",
      tone: "danger",
    });

    if (!confirmed) return;

    try {
      await deletePayrollAccrualFromSupabase(id);

      if (editingAccrualId === id) {
        handleCloseEditAccrual();
      }

      await reloadPayrollData();
      await invalidatePayrollQueries();

      setToastType("success");
      setToastMessage("Начисление удалено");
    } catch (error) {
      console.error(error);
      setToastType("error");
      setToastMessage("Не удалось удалить начисление");
    }
  }

  async function handlePaySingleAccrual(id: string) {
        if (!canManagePayroll) {
      setToastType("error");
      setToastMessage("У тебя нет прав на проведение выплат");
      return;
    }
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

    const confirmed = await confirm({
      title: "Провести выплату?",
      description: `Начисление для "${target.employee}" на сумму ${target.amount} будет отмечено как выплаченное.`,
      confirmLabel: "Провести",
    });

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
      await invalidatePayrollQueries();

      setToastType("success");
      setToastMessage("Начисление выплачено и перенесено во внеплановые");
    } catch (error) {
      console.error(error);
      setToastType("error");
      setToastMessage("Не удалось провести внеплановую выплату");
    }
  }

  async function handlePayEmployee(employeeKey: string) {
        if (!canManagePayroll) {
      setToastType("error");
      setToastMessage("У тебя нет прав на проведение выплат");
      return;
    }
    const targetGroup = pendingEmployeePayouts.find(
      (item) => (item.employeeId || item.employee) === employeeKey
    );

    if (!targetGroup) {
      setToastType("error");
      setToastMessage("Не удалось найти начисления пользователя");
      return;
    }

    const confirmed = await confirm({
      title: "Выплатить сотруднику?",
      description: `Будет создана выплата для "${targetGroup.employee}" на сумму ₽${targetGroup.total.toLocaleString("ru-RU")}.`,
      confirmLabel: "Выплатить",
    });

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

            const createdPayoutId = generateEntityId("payroll_payout");
      const payoutAmount = `₽${targetGroup.total.toLocaleString("ru-RU")}`;

      await createPayrollPayoutInSupabase({
        id: createdPayoutId,
        employee: targetGroup.employee,
        employeeId: targetGroup.employeeId,
        payoutDate,
        amount: payoutAmount,
        month: targetGroup.month,
        status: "paid",
      });

      try {
        await sendSalaryPaidNotification({
          payoutId: createdPayoutId,
          employeeName: targetGroup.employee,
          amount: payoutAmount,
          payoutDate,
          monthLabel: targetGroup.month,
        });
      } catch (notificationError) {
        console.error(
          "Ошибка отправки Telegram-уведомления о выплате зарплаты:",
          notificationError
        );
      }

      await reloadPayrollData();
      await invalidatePayrollQueries();

      setActiveTab("payouts");
      setToastType("success");
      setToastMessage(`Выплата пользователю "${targetGroup.employee}" проведена`);
    } catch (error) {
      console.error(error);
      setToastType("error");
      setToastMessage("Не удалось Провести выплату пользователю");
    }
  }

  async function handlePayAllEmployees() {
        if (!canManagePayroll) {
      setToastType("error");
      setToastMessage("У тебя нет прав на проведение выплат");
      return;
    }
    if (pendingEmployeePayouts.length === 0) {
      setToastType("info");
      setToastMessage("Сейчас нет начислений для выплаты");
      return;
    }

    const totalAmount = pendingEmployeePayouts.reduce(
      (sum, item) => sum + item.total,
      0
    );

    const confirmed = await confirm({
      title: "Оплатить всё?",
      description: `Будет создано выплат: ${pendingEmployeePayouts.length}. Общая сумма: ₽${totalAmount.toLocaleString("ru-RU")}.`,
      confirmLabel: "Оплатить всё",
    });

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

                const createdPayoutId = generateEntityId("payroll_payout");
        const payoutAmount = `₽${group.total.toLocaleString("ru-RU")}`;

        await createPayrollPayoutInSupabase({
          id: createdPayoutId,
          employee: group.employee,
          employeeId: group.employeeId,
          payoutDate,
          amount: payoutAmount,
          month: group.month,
          status: "paid",
        });

        try {
          await sendSalaryPaidNotification({
            payoutId: createdPayoutId,
            employeeName: group.employee,
            amount: payoutAmount,
            payoutDate,
            monthLabel: group.month,
          });
        } catch (notificationError) {
          console.error(
            "Ошибка отправки Telegram-уведомления о выплате зарплаты:",
            notificationError
          );
        }
      }

      await reloadPayrollData();
      await invalidatePayrollQueries();

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
        if (!canManagePayroll) {
      setToastType("error");
      setToastMessage("У тебя нет прав на редактирование payroll");
      return;
    }
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
        if (!canManagePayroll) {
      setToastType("error");
      setToastMessage("У тебя нет прав на редактирование payroll");
      return;
    }
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
      await invalidatePayrollQueries();

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
        if (!canManagePayroll) {
      setToastType("error");
      setToastMessage("У тебя нет прав на удаление payroll-записей");
      return;
    }
    const target = payouts.find((item) => item.id === id);

    if (!target) {
      setToastType("error");
      setToastMessage("Выплата не найдена");
      return;
    }

    const confirmed = await confirm({
      title: "Удалить выплату?",
      description: `Выплата для "${target.employee}" на сумму ${target.amount} будет удалена.`,
      confirmLabel: "Удалить",
      tone: "danger",
    });

    if (!confirmed) return;

    try {
      await deletePayrollPayoutFromSupabase(id);

      if (editingPayoutId === id) {
        handleCloseEditPayout();
      }

      await reloadPayrollData();
      await invalidatePayrollQueries();

      setToastType("success");
      setToastMessage("Выплата удалена");
    } catch (error) {
      console.error(error);
      setToastType("error");
      setToastMessage("Не удалось удалить выплату");
    }
  }

  function handleStartEditExtra(item: StoredPayrollExtraPayment) {
        if (!canManagePayroll) {
      setToastType("error");
      setToastMessage("У тебя нет прав на редактирование payroll");
      return;
    }
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
        if (!canManagePayroll) {
      setToastType("error");
      setToastMessage("У тебя нет прав на редактирование payroll");
      return;
    }
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
      await invalidatePayrollQueries();

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
        if (!canManagePayroll) {
      setToastType("error");
      setToastMessage("У тебя нет прав на удаление payroll-записей");
      return;
    }
    const target = extraPayments.find((item) => item.id === id);

    if (!target) {
      setToastType("error");
      setToastMessage("Внеплановая выплата не найдена");
      return;
    }

    const confirmed = await confirm({
      title: "Удалить внеплановую выплату?",
      description: `Внеплановая выплата для "${target.employee}" на сумму ${target.amount} будет удалена.`,
      confirmLabel: "Удалить",
      tone: "danger",
    });

    if (!confirmed) return;

    try {
      await deletePayrollExtraPaymentFromSupabase(id);

      if (editingExtraId === id) {
        handleCloseEditExtra();
      }

      await reloadPayrollData();
      await invalidatePayrollQueries();

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
      if (!canManagePayroll) {
    setToastType("error");
    setToastMessage("У тебя нет прав на создание выплат");
    return;
  }
  if (!createEmployee.trim()) {
    setToastType("error");
    setToastMessage("Выбери пользователя");
    return;
  }

  if (!createPayoutDate.trim()) {
    setToastType("error");
    setToastMessage("Укажи дату");
    return;
  }

  const normalizedCreateAmount =
    createPayoutAmount.trim() ||
    getMemberAmountById(createEmployeeId || null);

  try {
    if (createPayoutType === "payout") {
      if (!createPayoutMonth.trim()) {
        setToastType("error");
        setToastMessage("Укажи месяц");
        return;
      }

      if (createPayoutStatus === "scheduled") {
        await createPayrollAccrualInSupabase({
          id: generateEntityId("payroll_accrual"),
          employee: createEmployee,
          employeeId: createEmployeeId || null,
          client: "Ручное начисление",
          clientId: null,
          project: `Плановая зарплата — ${createPayoutMonth}`,
          projectId: null,
          paymentId: null,
          amount: normalizedCreateAmount,
          date: createPayoutDate,
          status: "accrued",
        });

        await reloadPayrollData();
        await invalidatePayrollQueries();
        handleCloseCreatePayout();
        setActiveTab("accruals");
        setToastType("success");
        setToastMessage("Запланированная выплата добавлена в начисления");
        return;
      }

            const createdPayoutId = generateEntityId("payroll_payout");

      await createPayrollPayoutInSupabase({
        id: createdPayoutId,
        employee: createEmployee,
        employeeId: createEmployeeId || null,
        payoutDate: createPayoutDate,
        amount: normalizedCreateAmount,
        month: createPayoutMonth,
        status: "paid",
      });

      try {
        await sendSalaryPaidNotification({
          payoutId: createdPayoutId,
          employeeName: createEmployee,
          amount: normalizedCreateAmount,
          payoutDate: createPayoutDate,
          monthLabel: createPayoutMonth,
        });
      } catch (notificationError) {
        console.error(
          "Ошибка отправки Telegram-уведомления о выплате зарплаты:",
          notificationError
        );
      }

      await reloadPayrollData();
      await invalidatePayrollQueries();
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
      amount: normalizedCreateAmount,
    });

    await reloadPayrollData();
    await invalidatePayrollQueries();
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

async function handleAccrueSalaries() {
  if (!canManagePayroll) {
    setToastType("error");
    setToastMessage("У тебя нет прав на начисление окладов");
    return;
  }

  if (isAccruingSalariesRef.current) {
    setToastType("info");
    setToastMessage("Начисление окладов уже выполняется");
    return;
  }

  isAccruingSalariesRef.current = true;

  try {
    const monthLabel = getCurrentMonthAccrualLabel();

    const targetMembers = members.filter(
      (member) =>
        isActivePayrollMember(member) &&
        (member.pay_type === "fixed_salary" ||
          member.pay_type === "fixed_salary_plus_project") &&
        parseRubAmount(member.fixed_salary || "0") > 0
    );

    if (targetMembers.length === 0) {
      setToastType("info");
      setToastMessage("Нет пользователей с окладной системой оплаты");
      return;
    }

    const [freshAccruals, freshPayouts] = await Promise.all([
      fetchPayrollAccrualsFromSupabase(),
      fetchPayrollPayoutsFromSupabase(),
    ]);

    const membersWithoutAccrual = targetMembers.filter((member) => {
      const memberName = getWorkspaceMemberDisplayName(member);

      const hasSalaryAccrual = freshAccruals.some((item) =>
        isSalaryAccrualForMonth(item, member.id, monthLabel)
      );

      const hasMonthPayout = hasPayoutForMonth(
        freshPayouts,
        member.id,
        memberName,
        monthLabel
      );

      return !hasSalaryAccrual && !hasMonthPayout;
    });

    if (membersWithoutAccrual.length === 0) {
      setToastType("info");
      setToastMessage("Окладные начисления за этот месяц уже созданы");
      await reloadPayrollData();
      await invalidatePayrollQueries();
      return;
    }

    for (const member of membersWithoutAccrual) {
      await createPayrollAccrualInSupabase({
        id: generateEntityId("payroll_accrual"),
        employee: getWorkspaceMemberDisplayName(member),
        employeeId: member.id,
        client: "Оклад",
        clientId: null,
        project: `Оклад за ${monthLabel}`,
        projectId: null,
        paymentId: null,
        amount: member.fixed_salary || "₽0",
        date: getTodayDisplayDate(),
        status: "accrued",
      });
    }

    try {
      const totalAmount = membersWithoutAccrual.reduce((sum, member) => {
        return sum + parseRubAmount(member.fixed_salary || "0");
      }, 0);

      await sendSalaryAccruedNotification({
        accrualMonth: monthLabel,
        employeesCount: membersWithoutAccrual.length,
        totalAmount: formatRub(totalAmount),
      });
    } catch (notificationError) {
      console.error(
        "Ошибка отправки Telegram-уведомления о начислении окладов:",
        notificationError
      );
    }

    await reloadPayrollData();
    await invalidatePayrollQueries();

    setActiveTab("accruals");
    setToastType("success");
    setToastMessage(
      `Окладные начисления созданы: ${membersWithoutAccrual.length}`
    );
  } catch (error) {
    console.error(error);
    setToastType("error");
    setToastMessage("Не удалось создать окладные начисления");
  } finally {
    isAccruingSalariesRef.current = false;
  }
}

if (!isMounted || isAppContextLoading || isAccessLoading) {
  return (
    <main className="rivn-scope flex-1">
      <div className="space-y-5 px-4 py-4 sm:px-5 sm:py-5 lg:px-8">
        <div className="rounded-[28px] border border-white/10 bg-[#121826] p-4 text-white/60 shadow-[0_10px_40px_rgba(0,0,0,0.32)] sm:p-8">
          Загрузка payroll...
        </div>
      </div>
    </main>
  );
}

if (!hasAccess) {
  return <AccessDenied />;
}
  return (
  <>
  
    <main className="rivn-scope flex-1">
      <div className="space-y-5 px-4 py-4 sm:px-5 sm:py-5 lg:px-8">
                {!isAppContextLoading && !canManagePayroll ? (
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            У тебя доступ только на просмотр зарплат. Начисление, выплаты, редактирование и удаление недоступны.
          </div>
        ) : null}
                <PayrollPageHeader
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          canManagePayroll={canManagePayroll}
          search={search}
          setSearch={setSearch}
          employeeFilterControl={
            <CustomSelect
              value={employeeFilter}
              onChange={setEmployeeFilter}
              options={[
                { value: "all", label: "Все пользователи" },
                ...employeeFilterOptions.map((employee) => ({
                  value: employee,
                  label: employee,
                })),
              ]}
              className="w-full"
              buttonClassName="h-11"
            />
          }
          searchPlaceholder={
            activeTab === "accruals"
              ? "Поиск по пользователю, клиенту, проекту..."
              : activeTab === "payouts"
                ? "Поиск по пользователю..."
                : "Поиск по пользователю, причине..."
          }
          onAccrueSalaries={handleAccrueSalaries}
          onAddPayout={() => {
            if (!canManagePayroll) {
              setToastType("error");
              setToastMessage("У тебя нет прав на создание выплат");
              return;
            }

            setCreatePayoutDate(getDefaultPayrollDate(systemSettings?.payroll_day));
            setIsCreatePayoutOpen(true);
          }}
        />

        <div className="rivn-panel p-4 sm:p-5">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="text-sm text-white/50">Сводка за период</div>
              <div className="mt-1 text-sm text-white/70">
                {selectedPeriod.label}
              </div>
            </div>

            <RivnDateRangePicker
              from={displayDateToPickerValue(customDateFrom)}
              to={displayDateToPickerValue(customDateTo)}
              onChange={({ from, to }) => {
                if (!from && !to) {
                  setPeriodPreset("last30");
                  setCustomDateFrom("");
                  setCustomDateTo("");
                  return;
                }

                setPeriodPreset("custom");
                setCustomDateFrom(formatInputDateToDisplay(from));
                setCustomDateTo(formatInputDateToDisplay(to));
              }}
              placeholder="Выбери период"
              iconOnly
            />
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <div className="rivn-panel-inner px-4 py-2.5">
              <div className="text-sm text-white/55">Начислено</div>
              <div className="mt-1 text-2xl font-semibold tracking-tight text-violet-300">
                ₽{totalAccrued.toLocaleString("ru-RU")}
              </div>
            </div>

            <div className="rivn-panel-inner px-4 py-2.5">
              <div className="text-sm text-white/55">Выплачено</div>
              <div className="mt-1 text-2xl font-semibold tracking-tight text-emerald-300">
                ₽{totalPaid.toLocaleString("ru-RU")}
              </div>
            </div>

            <div className="rivn-panel-inner px-4 py-2.5">
              <div className="text-sm text-white/55">Внеплановые</div>
              <div className="mt-1 text-2xl font-semibold tracking-tight text-amber-300">
                ₽{totalExtra.toLocaleString("ru-RU")}
              </div>
            </div>
          </div>
        </div>

        {isLoadingPayroll ? (
          <div className="rounded-[28px] border border-white/10 bg-[#121826] p-4 text-white/60 sm:p-8">
            Загрузка payroll...
          </div>
        ) : (
          <>
            {activeTab === "accruals" ? (
              <div className="rounded-[28px] border border-white/10 bg-[#121826] p-4 shadow-[0_10px_40px_rgba(0,0,0,0.32)] sm:p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-sm text-white/50">Готово к выплате</div>

                                    {canManagePayroll ? (
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
                  ) : (
                    <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-white/50">
                      Только просмотр
                    </div>
                  )}
                </div>

                <div className="mt-4 grid gap-3">
                  {pendingEmployeePayouts.length > 0 ? (
                    pendingEmployeePayouts.map((item) => (
                      <div
                        key={item.employeeId || item.employee}
                        className="rounded-[24px] border border-white/10 bg-white/[0.035] p-4 transition hover:border-[#00f5a8]/25 hover:bg-white/[0.055] md:grid md:grid-cols-[1fr_1fr_auto_auto] md:items-center md:gap-4"
                      >
                        <div className="text-sm text-white/45">Пользователь</div>
                        <div className="mt-1 text-lg font-semibold">
                          {item.employee}
                        </div>

                        <div className="mt-4 text-sm text-white/45">
                          К выплате
                        </div>
                        <div className="mt-1 text-2xl font-semibold text-emerald-300">
                          ₽{item.total.toLocaleString("ru-RU")}
                        </div>

                        <div className="mt-2 space-y-1 text-sm text-white/50">
                          <div>{item.month}</div>

                          {item.salaryPart > 0 ? (
                            <div>Оклад: {formatRub(item.salaryPart)}</div>
                          ) : null}

                          {item.projectPart > 0 ? (
                            <div>Проектная часть: {formatRub(item.projectPart)}</div>
                          ) : null}
                        </div>

                                                {canManagePayroll ? (
                          <button
                            type="button"
                            onClick={() =>
                              handlePayEmployee(item.employeeId || item.employee)
                            }
                            className="mt-4 rounded-2xl bg-emerald-400/15 px-4 py-3 text-sm font-medium text-emerald-300 shadow-[0_0_24px_rgba(16,185,129,0.18)] transition hover:bg-emerald-400/20"
                          >
                            Выплатить пользователю
                          </button>
                        ) : null}
                      </div>
                    ))
                  ) : (
                    <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5 text-sm text-white/45">
                      Сейчас нет начислений со статусом «Начислено», готовых к
                      общей выплате.
                    </div>
                  )}
                </div>
              </div>
            ) : null}

            <div className="hidden">
              <div className="grid gap-3 xl:flex xl:items-center xl:overflow-x-auto">
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={
                    activeTab === "accruals"
                      ? "Поиск по пользователю, клиенту, проекту..."
                      : activeTab === "payouts"
                      ? "Поиск по пользователю..."
                      : "Поиск по пользователю, причине..."
                  }
                  className="hidden"
                />

                <CustomSelect
                  value={employeeFilter}
                  onChange={setEmployeeFilter}
                  options={[
                    { value: "all", label: "Все пользователи" },
                    ...employeeFilterOptions.map((employee) => ({
                      value: employee,
                      label: employee,
                    })),
                  ]}
                  className="xl:min-w-[220px] xl:flex-1"
                  buttonClassName="h-[48px]"
                />

                <CustomSelect
                  value={monthFilter}
                  onChange={setMonthFilter}
                  options={[
                    { value: "all", label: "Все месяцы" },
                    ...monthFilterOptions.map((month) => ({
                      value: month,
                      label: month,
                    })),
                  ]}
                  className="xl:min-w-[220px] xl:flex-1"
                  buttonClassName="h-[48px]"
                />

                {activeTab === "accruals" || activeTab === "payouts" ? (
                  <CustomSelect
                    value={statusFilter}
                    onChange={setStatusFilter}
                    options={[
                      { value: "all", label: "Все статусы" },
                      ...(activeTab === "accruals"
                        ? accrualStatusOptions
                        : payoutStatusOptions),
                    ]}
                    className="xl:min-w-[190px] xl:flex-1"
                    buttonClassName="h-[48px]"
                  />
                ) : null}

                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setEmployeeFilter("all");
                    setMonthFilter("all");
                    setStatusFilter("all");
                  }}
                  className="rivn-button h-[48px] w-full px-4 text-sm xl:min-w-[180px]"
                >
                  Сбросить
                </button>
              </div>
            </div>

            {activeTab === "accruals" ? (
                            <PayrollAccrualsTable
                items={filteredAccruals}
                onEdit={handleStartEditAccrual}
                onDelete={handleDeleteAccrual}
                onPay={handlePaySingleAccrual}
                canManagePayroll={canManagePayroll}
              />
            ) : activeTab === "payouts" ? (
                            <PayrollPayoutsTable
                items={filteredPayouts}
                onEdit={handleStartEditPayout}
                onDelete={handleDeletePayout}
                canManagePayroll={canManagePayroll}
              />
            ) : (
                            <PayrollExtraTable
  items={filteredExtraPayments}
  onEdit={handleStartEditExtra}
  onDelete={handleDeleteExtra}
  canManagePayroll={canManagePayroll}
/>
            )}
          </>
        )}
      </div>

            {canManagePayroll && isEditAccrualOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 px-3 py-4 sm:items-center sm:px-4">
          <div className="max-h-[92vh] w-full max-w-[640px] overflow-y-auto rounded-[28px] border border-white/10 bg-[#121826] p-4 shadow-[0_20px_80px_rgba(0,0,0,0.45)] sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
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

            <div className="mt-4 text-xs text-white/35">
  Доступно пользователей для выплаты: {memberOptions.length}
</div>

            <div className="mt-6 grid gap-3 sm:gap-4 md:grid-cols-2">
              <CustomSelect
                value={editEmployeeId}
                options={memberSelectOptions}
                onChange={(nextEmployeeId) => {
                  const selectedMember = memberOptions.find(
                    (member) => member.id === nextEmployeeId
                  );

                  setEditEmployeeId(nextEmployeeId);
                  setEditEmployee(selectedMember?.name ?? "");
                }}
                placeholder="Выбери пользователя"
                buttonClassName="h-[48px]"
              />

              <input
                value={editClient}
                onChange={(e) => setEditClient(e.target.value)}
                placeholder="Клиент"
                className="rivn-field"
              />

              <CustomSelect
                value={editProject}
                onChange={setEditProject}
                options={projectSelectOptions}
                placeholder="Выбери проект"
                buttonClassName="h-[48px]"
              />

              <input
                value={editAmount}
                onChange={(e) => setEditAmount(e.target.value)}
                placeholder="Сумма"
                className="rivn-field"
              />

              <RivnDatePicker
                value={displayDateToPickerValue(editDate)}
                onChange={(value) => setEditDate(formatInputDateToDisplay(value))}
                placeholder="Дата"
              />

              <CustomSelect
                value={editStatus}
                onChange={(value) => setEditStatus(value as "accrued" | "paid")}
                options={accrualStatusOptions}
                buttonClassName="h-[48px]"
              />
            </div>

            <div className="mt-6 grid gap-3 sm:flex sm:justify-end">
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

            {canManagePayroll && isEditPayoutOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 px-3 py-4 sm:items-center sm:px-4">
          <div className="max-h-[92vh] w-full max-w-[640px] overflow-y-auto rounded-[28px] border border-white/10 bg-[#121826] p-4 shadow-[0_20px_80px_rgba(0,0,0,0.45)] sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
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

            <div className="mt-6 grid gap-3 sm:gap-4 md:grid-cols-2">
              <CustomSelect
                value={editPayoutEmployeeId}
                options={memberSelectOptions}
                onChange={(nextEmployeeId) => {
                  const selectedMember = memberOptions.find(
                    (member) => member.id === nextEmployeeId
                  );

                  setEditPayoutEmployeeId(nextEmployeeId);
                  setEditPayoutEmployee(selectedMember?.name ?? "");
                }}
                placeholder="Выбери пользователя"
                buttonClassName="h-[48px]"
              />

              <input
                value={editPayoutMonth}
                onChange={(e) => setEditPayoutMonth(e.target.value)}
                placeholder="Месяц"
                className="rivn-field"
              />

              <RivnDatePicker
                value={displayDateToPickerValue(editPayoutDate)}
                onChange={(value) => setEditPayoutDate(formatInputDateToDisplay(value))}
                placeholder="Дата выплаты"
              />

              <input
                value={editPayoutAmount}
                onChange={(e) => setEditPayoutAmount(e.target.value)}
                placeholder="Сумма"
                className="rivn-field"
              />

              <CustomSelect
                value={editPayoutStatus}
                onChange={(value) =>
                  setEditPayoutStatus(value as "scheduled" | "paid")
                }
                options={payoutStatusOptions}
                className="md:col-span-2"
                buttonClassName="h-[48px]"
              />
            </div>

            <div className="mt-6 grid gap-3 sm:flex sm:justify-end">
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

            {canManagePayroll && isEditExtraOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 px-3 py-4 sm:items-center sm:px-4">
          <div className="max-h-[92vh] w-full max-w-[640px] overflow-y-auto rounded-[28px] border border-white/10 bg-[#121826] p-4 shadow-[0_20px_80px_rgba(0,0,0,0.45)] sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="text-sm text-white/50">Внеплановая выплата</div>
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

            <div className="mt-6 grid gap-3 sm:gap-4 md:grid-cols-2">
              <CustomSelect
                value={editExtraEmployeeId}
                options={memberSelectOptions}
                onChange={(nextEmployeeId) => {
                  const selectedMember = memberOptions.find(
                    (member) => member.id === nextEmployeeId
                  );

                  setEditExtraEmployeeId(nextEmployeeId);
                  setEditExtraEmployee(selectedMember?.name ?? "");
                }}
                placeholder="Выбери пользователя"
                buttonClassName="h-[48px]"
              />

              <RivnDatePicker
                value={displayDateToPickerValue(editExtraDate)}
                onChange={(value) => setEditExtraDate(formatInputDateToDisplay(value))}
                placeholder="Дата"
              />

              <input
                value={editExtraReason}
                onChange={(e) => setEditExtraReason(e.target.value)}
                placeholder="Причина"
                className="rivn-field md:col-span-2"
              />

              <input
                value={editExtraAmount}
                onChange={(e) => setEditExtraAmount(e.target.value)}
                placeholder="Сумма"
                className="rivn-field md:col-span-2"
              />
            </div>

            <div className="mt-6 grid gap-3 sm:flex sm:justify-end">
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

            {canManagePayroll && isCreatePayoutOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 px-3 py-4 sm:items-center sm:px-4">
          <div className="max-h-[92vh] w-full max-w-[640px] overflow-y-auto rounded-[28px] border border-white/10 bg-[#121826] p-4 shadow-[0_20px_80px_rgba(0,0,0,0.45)] sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
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

            <div className="mt-6 grid gap-3 sm:gap-4 md:grid-cols-2">
              <CustomSelect
                value={createEmployeeId}
                options={memberSelectOptions}
                onChange={(nextEmployeeId) => {
                  const selectedMember = memberOptions.find(
                    (member) => member.id === nextEmployeeId
                  );

                  setCreateEmployeeId(nextEmployeeId);
                  setCreateEmployee(selectedMember?.name ?? "");

                  if (!createPayoutAmount.trim() && selectedMember) {
                    if (
                      selectedMember.payType === "fixed_salary" ||
                      selectedMember.payType === "fixed_salary_plus_project"
                    ) {
                      setCreatePayoutAmount(selectedMember.fixedSalary || "");
                    } else {
                      setCreatePayoutAmount(selectedMember.payValue || "");
                    }
                  }
                }}
                placeholder="Выбери пользователя"
                buttonClassName="h-[48px] border-white/10 bg-[#0F1524] text-white shadow-none"
                dropdownClassName="bg-[#121826]"
                disabled={memberSelectOptions.length === 0}
              />

              <RivnDatePicker
                value={displayDateToPickerValue(createPayoutDate)}
                onChange={(value) => setCreatePayoutDate(formatInputDateToDisplay(value))}
                placeholder="Дата"
              />

              <input
                value={createPayoutAmount}
                onChange={(e) => setCreatePayoutAmount(e.target.value)}
                placeholder="Сумма"
                className="rivn-field"
              />

              {createPayoutType === "payout" ? (
                <input
                  value={createPayoutMonth}
                  onChange={(e) => setCreatePayoutMonth(e.target.value)}
                  placeholder="Месяц"
                  className="rivn-field"
                />
              ) : (
                <input
                  value={createExtraReason}
                  onChange={(e) => setCreateExtraReason(e.target.value)}
                  placeholder="Причина"
                  className="rivn-field"
                />
              )}

              {createPayoutType === "payout" ? (
                <CustomSelect
                  value={createPayoutStatus}
                  options={payoutStatusOptions}
                  onChange={(value) =>
                    setCreatePayoutStatus(value as "scheduled" | "paid")
                  }
                  buttonClassName="h-[48px] border-white/10 bg-[#0F1524] text-white shadow-none"
                  dropdownClassName="bg-[#121826]"
                  className="md:col-span-2"
                />
              ) : null}
            </div>

            <div className="mt-6 grid gap-3 sm:flex sm:justify-end">
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

    {toastMessage ? (
      <AppToast message={toastMessage} type={toastType} />
    ) : null}
  </>
);
}
