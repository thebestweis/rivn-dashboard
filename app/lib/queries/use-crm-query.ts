"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAppContextState } from "../../providers/app-context-provider";
import { queryKeys } from "../query-keys";
import {
  createCrmStage,
  createCrmDeal,
  createCrmDealComment,
  createCrmDealTask,
  getCrmBootstrap,
  getCrmDealDetails,
  moveCrmDeal,
  updateCrmDeal,
  updateCrmDealTask,
  updateCrmStage,
  updateCrmStageOrder,
  type CrmBootstrap,
  type CrmDeal,
  type CrmDealActivity,
  type CrmDealComment,
  type CrmDealDetails,
  type CrmDealTask,
  type CrmBootstrapFilters,
  type CrmStage,
} from "../supabase/crm";

const STALE_TIME = 1000 * 60 * 5;
const GC_TIME = 1000 * 60 * 30;

function buildCrmFiltersKey(filters: CrmBootstrapFilters) {
  return JSON.stringify({
    search: filters.search?.trim() ?? "",
    sourceId: filters.sourceId ?? "",
    assigneeId: filters.assigneeId ?? "",
    status: filters.status ?? "all",
  });
}

export function useCrmBootstrapQuery(
  enabled = true,
  filters: CrmBootstrapFilters = {}
) {
  const { workspace } = useAppContextState();
  const workspaceId = workspace?.id ?? "";
  const filtersKey = buildCrmFiltersKey(filters);

  return useQuery({
    queryKey: workspaceId
      ? queryKeys.crmBootstrap(workspaceId, filtersKey)
      : ["crm", "bootstrap"],
    queryFn: () => getCrmBootstrap(filters),
    enabled: enabled && Boolean(workspaceId),
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
    placeholderData: (previousData) => previousData,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  });
}

export function useCrmDealDetailsQuery(
  dealId: string | null | undefined,
  enabled = true
) {
  const { workspace } = useAppContextState();
  const workspaceId = workspace?.id ?? "";

  return useQuery({
    queryKey:
      workspaceId && dealId
        ? queryKeys.crmDealDetails(workspaceId, dealId)
        : ["crm", "deal-details"],
    queryFn: () => getCrmDealDetails(dealId ?? ""),
    enabled: enabled && Boolean(workspaceId && dealId),
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
    placeholderData: (previousData) => previousData,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  });
}

function upsertDealInBootstrap(deal: CrmDeal, current?: CrmBootstrap) {
  if (!current) return current;

  const exists = current.deals.some((item) => item.id === deal.id);

  return {
    ...current,
    deals: exists
      ? current.deals.map((item) => (item.id === deal.id ? deal : item))
      : [deal, ...current.deals],
  };
}

function upsertStageInBootstrap(stage: CrmStage, current?: CrmBootstrap) {
  if (!current) return current;

  const exists = current.stages.some((item) => item.id === stage.id);

  return {
    ...current,
    stages: exists
      ? current.stages
          .map((item) => (item.id === stage.id ? stage : item))
          .filter((item) => item.is_active)
          .sort((a, b) => a.sort_order - b.sort_order)
      : [...current.stages, stage].sort((a, b) => a.sort_order - b.sort_order),
  };
}

function upsertDealTaskInBootstrap(
  task: CrmDealTask,
  current?: CrmDealDetails
) {
  if (!current) return current;

  const exists = current.dealTasks.some((item) => item.id === task.id);

  return {
    ...current,
    dealTasks: exists
      ? current.dealTasks.map((item) => (item.id === task.id ? task : item))
      : [task, ...current.dealTasks],
  };
}

function upsertDealCommentInBootstrap(
  comment: CrmDealComment,
  current?: CrmDealDetails
) {
  if (!current) return current;

  const exists = current.dealComments.some((item) => item.id === comment.id);

  return {
    ...current,
    dealComments: exists
      ? current.dealComments.map((item) =>
          item.id === comment.id ? comment : item
        )
      : [comment, ...current.dealComments],
  };
}

function prependActivityPlaceholder(
  activity: CrmDealActivity,
  current?: CrmDealDetails
) {
  if (!current) return current;

  return {
    ...current,
    dealActivities: [activity, ...current.dealActivities],
  };
}

export function useCreateCrmDealMutation() {
  const queryClient = useQueryClient();
  const { workspace } = useAppContextState();
  const workspaceId = workspace?.id ?? "";

  return useMutation({
    mutationFn: createCrmDeal,
    onSuccess: (deal) => {
      if (!workspaceId) return;

      queryClient.setQueryData<CrmBootstrap>(
        queryKeys.crmBootstrap(workspaceId),
        (current) => upsertDealInBootstrap(deal, current)
      );

      void queryClient.invalidateQueries({
        queryKey: ["crm", "bootstrap", workspaceId],
      });
    },
  });
}

export function useUpdateCrmDealMutation() {
  const queryClient = useQueryClient();
  const { workspace } = useAppContextState();
  const workspaceId = workspace?.id ?? "";

  return useMutation({
    mutationFn: ({
      dealId,
      values,
    }: {
      dealId: string;
      values: Parameters<typeof updateCrmDeal>[1];
    }) => updateCrmDeal(dealId, values),
    onSuccess: (deal) => {
      if (!workspaceId) return;

      queryClient.setQueryData<CrmBootstrap>(
        queryKeys.crmBootstrap(workspaceId),
        (current) => upsertDealInBootstrap(deal, current)
      );

      void queryClient.invalidateQueries({
        queryKey: ["crm", "bootstrap", workspaceId],
      });
    },
  });
}

export function useMoveCrmDealMutation() {
  const queryClient = useQueryClient();
  const { workspace } = useAppContextState();
  const workspaceId = workspace?.id ?? "";

  return useMutation({
    mutationFn: moveCrmDeal,
    onMutate: async (input) => {
      if (!workspaceId) return;

      await queryClient.cancelQueries({
        queryKey: queryKeys.crmBootstrap(workspaceId),
      });

      const previous = queryClient.getQueryData<CrmBootstrap>(
        queryKeys.crmBootstrap(workspaceId)
      );

      queryClient.setQueryData<CrmBootstrap>(
        queryKeys.crmBootstrap(workspaceId),
        (current) => {
          if (!current) return current;

          return {
            ...current,
            deals: current.deals.map((deal) =>
              deal.id === input.dealId
                ? {
                    ...deal,
                    pipeline_id: input.pipelineId,
                    stage_id: input.stageId,
                    position: input.position,
                    status: input.status ?? "open",
                    loss_reason_id: input.loss_reason_id ?? null,
                    loss_comment: input.loss_comment ?? null,
                    updated_at: new Date().toISOString(),
                  }
                : deal
            ),
          };
        }
      );

      return { previous };
    },
    onError: (_error, _input, context) => {
      if (!workspaceId || !context?.previous) return;

      queryClient.setQueryData(
        queryKeys.crmBootstrap(workspaceId),
        context.previous
      );
    },
    onSuccess: (deal) => {
      if (!workspaceId) return;

      queryClient.setQueryData<CrmBootstrap>(
        queryKeys.crmBootstrap(workspaceId),
        (current) => upsertDealInBootstrap(deal, current)
      );

      void queryClient.invalidateQueries({
        queryKey: ["crm", "bootstrap", workspaceId],
      });
    },
  });
}

export function useCreateCrmStageMutation() {
  const queryClient = useQueryClient();
  const { workspace } = useAppContextState();
  const workspaceId = workspace?.id ?? "";

  return useMutation({
    mutationFn: createCrmStage,
    onSuccess: (stage) => {
      if (!workspaceId) return;

      queryClient.setQueryData<CrmBootstrap>(
        queryKeys.crmBootstrap(workspaceId),
        (current) => upsertStageInBootstrap(stage, current)
      );

      void queryClient.invalidateQueries({
        queryKey: ["crm", "bootstrap", workspaceId],
      });
    },
  });
}

export function useUpdateCrmStageMutation() {
  const queryClient = useQueryClient();
  const { workspace } = useAppContextState();
  const workspaceId = workspace?.id ?? "";

  return useMutation({
    mutationFn: ({
      stageId,
      values,
    }: {
      stageId: string;
      values: Parameters<typeof updateCrmStage>[1];
    }) => updateCrmStage(stageId, values),
    onSuccess: (stage) => {
      if (!workspaceId) return;

      queryClient.setQueryData<CrmBootstrap>(
        queryKeys.crmBootstrap(workspaceId),
        (current) => upsertStageInBootstrap(stage, current)
      );

      void queryClient.invalidateQueries({
        queryKey: ["crm", "bootstrap", workspaceId],
      });
    },
  });
}

export function useUpdateCrmStageOrderMutation() {
  const queryClient = useQueryClient();
  const { workspace } = useAppContextState();
  const workspaceId = workspace?.id ?? "";

  return useMutation({
    mutationFn: updateCrmStageOrder,
    onMutate: async (updates) => {
      if (!workspaceId) return;

      await queryClient.cancelQueries({
        queryKey: queryKeys.crmBootstrap(workspaceId),
      });

      const previous = queryClient.getQueryData<CrmBootstrap>(
        queryKeys.crmBootstrap(workspaceId)
      );

      const orderByStageId = new Map(
        updates.map((item) => [item.stageId, item.sortOrder])
      );

      queryClient.setQueryData<CrmBootstrap>(
        queryKeys.crmBootstrap(workspaceId),
        (current) => {
          if (!current) return current;

          return {
            ...current,
            stages: current.stages
              .map((stage) => ({
                ...stage,
                sort_order: orderByStageId.get(stage.id) ?? stage.sort_order,
              }))
              .sort((a, b) => a.sort_order - b.sort_order),
          };
        }
      );

      return { previous };
    },
    onError: (_error, _updates, context) => {
      if (!workspaceId || !context?.previous) return;

      queryClient.setQueryData(
        queryKeys.crmBootstrap(workspaceId),
        context.previous
      );
    },
    onSuccess: (stages) => {
      if (!workspaceId) return;

      queryClient.setQueryData<CrmBootstrap>(
        queryKeys.crmBootstrap(workspaceId),
        (current) => {
          if (!current) return current;

          const stageById = new Map(stages.map((stage) => [stage.id, stage]));

          return {
            ...current,
            stages: current.stages
              .map((stage) => stageById.get(stage.id) ?? stage)
              .sort((a, b) => a.sort_order - b.sort_order),
          };
        }
      );

      void queryClient.invalidateQueries({
        queryKey: ["crm", "bootstrap", workspaceId],
      });
    },
  });
}

export function useCreateCrmDealTaskMutation() {
  const queryClient = useQueryClient();
  const { workspace } = useAppContextState();
  const workspaceId = workspace?.id ?? "";

  return useMutation({
    mutationFn: createCrmDealTask,
    onSuccess: (task) => {
      if (!workspaceId) return;

      queryClient.setQueryData<CrmDealDetails>(
        queryKeys.crmDealDetails(workspaceId, task.deal_id),
        (current) =>
          prependActivityPlaceholder(
            {
              id: `local-task-${task.id}`,
              workspace_id: task.workspace_id,
              deal_id: task.deal_id,
              actor_member_id: null,
              action: "task_created",
              payload: { task_id: task.id, title: task.title },
              created_at: new Date().toISOString(),
            },
            upsertDealTaskInBootstrap(task, current)
          )
      );
    },
  });
}

export function useUpdateCrmDealTaskMutation() {
  const queryClient = useQueryClient();
  const { workspace } = useAppContextState();
  const workspaceId = workspace?.id ?? "";

  return useMutation({
    mutationFn: ({
      taskId,
      values,
    }: {
      taskId: string;
      values: Parameters<typeof updateCrmDealTask>[1];
    }) => updateCrmDealTask(taskId, values),
    onSuccess: (task) => {
      if (!workspaceId) return;

      queryClient.setQueryData<CrmDealDetails>(
        queryKeys.crmDealDetails(workspaceId, task.deal_id),
        (current) =>
          prependActivityPlaceholder(
            {
              id: `local-task-update-${task.id}-${Date.now()}`,
              workspace_id: task.workspace_id,
              deal_id: task.deal_id,
              actor_member_id: null,
              action: task.status === "done" ? "task_completed" : "task_updated",
              payload: { task_id: task.id },
              created_at: new Date().toISOString(),
            },
            upsertDealTaskInBootstrap(task, current)
          )
      );
    },
  });
}

export function useCreateCrmDealCommentMutation() {
  const queryClient = useQueryClient();
  const { workspace } = useAppContextState();
  const workspaceId = workspace?.id ?? "";

  return useMutation({
    mutationFn: createCrmDealComment,
    onSuccess: (comment) => {
      if (!workspaceId) return;

      queryClient.setQueryData<CrmDealDetails>(
        queryKeys.crmDealDetails(workspaceId, comment.deal_id),
        (current) =>
          prependActivityPlaceholder(
            {
              id: `local-comment-${comment.id}`,
              workspace_id: comment.workspace_id,
              deal_id: comment.deal_id,
              actor_member_id: comment.author_member_id,
              action: "comment_created",
              payload: { comment_id: comment.id },
              created_at: new Date().toISOString(),
            },
            upsertDealCommentInBootstrap(comment, current)
          )
      );
    },
  });
}
