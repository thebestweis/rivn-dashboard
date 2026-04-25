"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../query-keys";
import {
  createExpenseInSupabase,
  deleteExpenseFromSupabase,
  getExpensesFromSupabase,
  updateExpenseInSupabase,
} from "../supabase/expenses";
import type { Expense, ExpenseFormData } from "../types/expense";
import { useAppContextState } from "../../providers/app-context-provider";

const STALE_TIME = 1000 * 60 * 10;
const GC_TIME = 1000 * 60 * 60;

export function useExpensesQuery(enabled = true) {
  const { workspace } = useAppContextState();
  const workspaceId = workspace?.id ?? "";

  return useQuery({
    queryKey: queryKeys.expensesByWorkspace(workspaceId),
    queryFn: getExpensesFromSupabase,
    enabled: enabled && Boolean(workspaceId),
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: true,
    placeholderData: (previousData) => previousData,
  });
}

export function useCreateExpenseMutation() {
  const queryClient = useQueryClient();
  const { workspace } = useAppContextState();
  const workspaceId = workspace?.id ?? "";

  return useMutation({
    mutationFn: createExpenseInSupabase,
    onSuccess: (createdExpense) => {
      if (!workspaceId) return;

      queryClient.setQueryData<Expense[]>(
        queryKeys.expensesByWorkspace(workspaceId),
        (prev = []) => [createdExpense, ...prev]
      );

      void queryClient.invalidateQueries({
        queryKey: queryKeys.expensesByWorkspace(workspaceId),
        refetchType: "all",
      });
    },
  });
}

export function useUpdateExpenseMutation() {
  const queryClient = useQueryClient();
  const { workspace } = useAppContextState();
  const workspaceId = workspace?.id ?? "";

  return useMutation({
    mutationFn: ({
      expenseId,
      values,
    }: {
      expenseId: string;
      values: ExpenseFormData;
    }) => updateExpenseInSupabase(expenseId, values),
    onSuccess: (updatedExpense) => {
      if (!workspaceId) return;

      queryClient.setQueryData<Expense[]>(
        queryKeys.expensesByWorkspace(workspaceId),
        (prev = []) =>
          prev.map((expense) =>
            expense.id === updatedExpense.id ? updatedExpense : expense
          )
      );

      void queryClient.invalidateQueries({
        queryKey: queryKeys.expensesByWorkspace(workspaceId),
        refetchType: "all",
      });
    },
  });
}

export function useDeleteExpenseMutation() {
  const queryClient = useQueryClient();
  const { workspace } = useAppContextState();
  const workspaceId = workspace?.id ?? "";

  return useMutation({
    mutationFn: deleteExpenseFromSupabase,
    onSuccess: (_, deletedExpenseId) => {
      if (!workspaceId) return;

      queryClient.setQueryData<Expense[]>(
        queryKeys.expensesByWorkspace(workspaceId),
        (prev = []) =>
          prev.filter((expense) => expense.id !== deletedExpenseId)
      );

      void queryClient.invalidateQueries({
        queryKey: queryKeys.expensesByWorkspace(workspaceId),
        refetchType: "all",
      });
    },
  });
}
