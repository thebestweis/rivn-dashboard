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

export function useExpensesQuery(enabled = true) {
  const { workspace } = useAppContextState();
  const workspaceId = workspace?.id ?? "";

  return useQuery({
    queryKey: queryKeys.expensesByWorkspace(workspaceId),
    queryFn: getExpensesFromSupabase,
    enabled: enabled && Boolean(workspaceId),
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
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
      queryClient.setQueryData<Expense[]>(
        queryKeys.expensesByWorkspace(workspaceId),
        (prev = []) => [createdExpense, ...prev]
      );
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
      queryClient.setQueryData<Expense[]>(
        queryKeys.expensesByWorkspace(workspaceId),
        (prev = []) =>
          prev.map((expense) =>
            expense.id === updatedExpense.id ? updatedExpense : expense
          )
      );
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
      queryClient.setQueryData<Expense[]>(
        queryKeys.expensesByWorkspace(workspaceId),
        (prev = []) =>
          prev.filter((expense) => expense.id !== deletedExpenseId)
      );
    },
  });
}