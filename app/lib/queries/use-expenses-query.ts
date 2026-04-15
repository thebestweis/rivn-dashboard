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

export function useExpensesQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.expenses,
    queryFn: getExpensesFromSupabase,
    enabled,
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

  return useMutation({
    mutationFn: createExpenseInSupabase,
    onSuccess: (createdExpense) => {
      queryClient.setQueryData<Expense[]>(queryKeys.expenses, (prev = []) => [
        createdExpense,
        ...prev,
      ]);
    },
  });
}

export function useUpdateExpenseMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      expenseId,
      values,
    }: {
      expenseId: string;
      values: ExpenseFormData;
    }) => updateExpenseInSupabase(expenseId, values),
    onSuccess: (updatedExpense) => {
      queryClient.setQueryData<Expense[]>(queryKeys.expenses, (prev = []) =>
        prev.map((expense) =>
          expense.id === updatedExpense.id ? updatedExpense : expense
        )
      );
    },
  });
}

export function useDeleteExpenseMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteExpenseFromSupabase,
    onSuccess: (_, deletedExpenseId) => {
      queryClient.setQueryData<Expense[]>(queryKeys.expenses, (prev = []) =>
        prev.filter((expense) => expense.id !== deletedExpenseId)
      );
    },
  });
}