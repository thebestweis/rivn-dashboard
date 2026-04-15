"use client";

import { useEffect, useMemo, useState } from "react";
import { ClientsPageHeader } from "../components/clients/clients-page-header";
import { ClientsTable } from "../components/dashboard/clients-table";
import { CreateClientModal } from "../components/clients/create-client-modal";
import { EditClientModal } from "../components/clients/edit-client-modal";
import { EmptyState } from "../components/ui/empty-state";
import { AppToast } from "../components/ui/app-toast";
import { canEditClients, isAppRole, type AppRole } from "../lib/permissions";
import { useAppContextState } from "../providers/app-context-provider";
import { getBillingErrorMessage } from "../lib/billing-errors";
import { BillingAccessBanner } from "../components/ui/billing-access-banner";
import {
  useClientEmployeesQuery,
  useClientsQuery,
  useCreateClientMutation,
  useDeleteClientMutation,
  useUpdateClientMutation,
} from "../lib/queries/use-clients-query";
import { Skeleton } from "../components/ui/skeleton";

type ClientStatus = "active" | "paused" | "problem" | "completed";

type ClientFormValues = {
  name: string;
  status: ClientStatus;
  owner: string;
  ownerId?: string | null;
  model: string;
  nextInvoice: string;
  amount: string;
  profit: string;
};

export default function ClientsPage() {
  const {
    role,
    billingAccess,
    isLoading: isAppContextLoading,
  } = useAppContextState();

  const currentRole: AppRole | null = isAppRole(role) ? role : null;
  const canManageClients = currentRole ? canEditClients(currentRole) : false;
  const isBillingReadOnly = billingAccess?.isReadOnly ?? false;
  const canManageClientsWithBilling = canManageClients && !isBillingReadOnly;

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingClientId, setEditingClientId] = useState("");

  const [editName, setEditName] = useState("");
  const [editOwner, setEditOwner] = useState("");
  const [editOwnerId, setEditOwnerId] = useState("");
  const [editModel, setEditModel] = useState("");
  const [editStatus, setEditStatus] = useState<ClientStatus>("active");
  const [editNextInvoice, setEditNextInvoice] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editProfit, setEditProfit] = useState("");

  const [newName, setNewName] = useState("");
  const [newOwner, setNewOwner] = useState("");
  const [newOwnerId, setNewOwnerId] = useState("");
  const [newModel, setNewModel] = useState("");
  const [newStatus, setNewStatus] = useState<ClientStatus>("active");
  const [newNextInvoice, setNewNextInvoice] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newProfit, setNewProfit] = useState("");

  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState<"success" | "error" | "info">(
    "success"
  );

  useEffect(() => {
    if (canManageClientsWithBilling) return;

    setIsCreateOpen(false);
    setIsEditOpen(false);
    setEditingClientId("");
  }, [canManageClientsWithBilling]);

  const {
    data: clients = [],
    isLoading: isLoadingClientsQuery,
    error: clientsError,
  } = useClientsQuery(!isAppContextLoading);

  const {
    data: employees = [],
    isLoading: isLoadingEmployeesQuery,
    error: employeesError,
  } = useClientEmployeesQuery(!isAppContextLoading);

  const createClientMutation = useCreateClientMutation();
  const updateClientMutation = useUpdateClientMutation();
  const deleteClientMutation = useDeleteClientMutation();

  useEffect(() => {
    if (!toastMessage) return;

    const timer = setTimeout(() => {
      setToastMessage("");
    }, 2200);

    return () => clearTimeout(timer);
  }, [toastMessage]);

  useEffect(() => {
    if (!clientsError) return;

    console.error(clientsError);
    setToastType("error");
    setToastMessage(
      clientsError instanceof Error
        ? clientsError.message
        : "Не удалось загрузить клиентов"
    );
  }, [clientsError]);

  useEffect(() => {
    if (!employeesError) return;

    console.error(employeesError);
    setToastType("error");
    setToastMessage(
      employeesError instanceof Error
        ? employeesError.message
        : "Не удалось загрузить сотрудников"
    );
  }, [employeesError]);

  const filteredClients = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return clients.filter((client) => {
      const matchesSearch = normalizedSearch
        ? client.name.toLowerCase().includes(normalizedSearch)
        : true;

      const matchesStatus = status === "all" ? true : client.status === status;

      return matchesSearch && matchesStatus;
    });
  }, [clients, search, status]);

  const isLoadingClients =
    isAppContextLoading ||
    ((isLoadingClientsQuery || isLoadingEmployeesQuery) &&
      clients.length === 0 &&
      employees.length === 0);

  function resetCreateForm() {
    setNewName("");
    setNewOwner("");
    setNewOwnerId("");
    setNewModel("");
    setNewStatus("active");
    setNewNextInvoice("");
    setNewAmount("");
    setNewProfit("");
  }

  function resetEditForm() {
    setEditingClientId("");
    setEditName("");
    setEditOwner("");
    setEditOwnerId("");
    setEditModel("");
    setEditStatus("active");
    setEditNextInvoice("");
    setEditAmount("");
    setEditProfit("");
  }

  async function handleCreateClient(client: ClientFormValues) {
    if (!canManageClients) {
      setToastType("error");
      setToastMessage("У тебя нет прав на создание клиентов");
      return;
    }

    if (isBillingReadOnly) {
      setToastType("error");
      setToastMessage("Подписка неактивна. Доступен только режим просмотра.");
      return;
    }

    try {
      await createClientMutation.mutateAsync(client);

      setIsCreateOpen(false);
      resetCreateForm();

      setToastType("success");
      setToastMessage(`Клиент "${client.name}" создан`);
    } catch (error) {
      console.error(error);
      setToastType("error");
      setToastMessage(getBillingErrorMessage(error));
    }
  }

  function handleOpenEditClient(clientId: string) {
    if (!canManageClients) {
      setToastType("error");
      setToastMessage("У тебя нет прав на редактирование клиентов");
      return;
    }

    const target = clients.find((item) => item.id === clientId);

    if (!target) {
      setToastType("error");
      setToastMessage("Клиент не найден");
      return;
    }

    setEditingClientId(target.id);
    setEditName(target.name);
    setEditOwner(target.owner ?? "");
    setEditOwnerId(target.ownerId ?? "");
    setEditModel(target.model ?? "");
    setEditStatus(target.status);
    setEditNextInvoice(target.nextInvoice ?? "");
    setEditAmount(target.amount ?? "");
    setEditProfit(target.profit ?? "");
    setIsEditOpen(true);
  }

  async function handleDeleteClient(clientId: string) {
    if (!canManageClients) {
      setToastType("error");
      setToastMessage("У тебя нет прав на удаление клиентов");
      return;
    }

    if (isBillingReadOnly) {
      setToastType("error");
      setToastMessage("Подписка неактивна. Доступен только режим просмотра.");
      return;
    }

    const target = clients.find((item) => item.id === clientId);

    if (!target) {
      setToastType("error");
      setToastMessage("Клиент не найден");
      return;
    }

    const confirmed = window.confirm(
      `Удалить клиента "${target.name}"? Это действие нельзя отменить.`
    );

    if (!confirmed) return;

    try {
      await deleteClientMutation.mutateAsync(clientId);
      setToastType("success");
      setToastMessage(`Клиент "${target.name}" удалён`);
    } catch (error) {
      console.error(error);
      setToastType("error");
      setToastMessage(getBillingErrorMessage(error));
    }
  }

  async function handleSaveClient(client: ClientFormValues) {
    if (!canManageClients) {
      setToastType("error");
      setToastMessage("У тебя нет прав на редактирование клиентов");
      return;
    }

    if (isBillingReadOnly) {
      setToastType("error");
      setToastMessage("Подписка неактивна. Доступен только режим просмотра.");
      return;
    }

    if (!editingClientId) return;

    try {
      await updateClientMutation.mutateAsync({
        clientId: editingClientId,
        values: client,
      });

      setIsEditOpen(false);
      resetEditForm();

      setToastType("success");
      setToastMessage(`Клиент "${client.name}" сохранён`);
    } catch (error) {
      console.error(error);
      setToastType("error");
      setToastMessage(getBillingErrorMessage(error));
    }
  }

  const isMutating =
    createClientMutation.isPending ||
    updateClientMutation.isPending ||
    deleteClientMutation.isPending;

  return (
    <>
      <main className="flex-1">
        <div className="space-y-6 px-5 py-6 lg:px-8">
          <BillingAccessBanner
            isLoading={isAppContextLoading}
            isBillingReadOnly={isBillingReadOnly}
            canManage={canManageClients}
            readOnlyMessage="Подписка неактивна. Раздел клиентов доступен только в режиме просмотра, пока ты не активируешь тариф."
            roleRestrictedMessage="У тебя доступ только на просмотр клиентов. Создание, редактирование и удаление клиентов недоступны."
          />

          <ClientsPageHeader
            search={search}
            setSearch={setSearch}
            status={status}
            setStatus={setStatus}
            onAddClient={() => {
              if (!canManageClients) {
                setToastType("error");
                setToastMessage("У тебя нет прав на создание клиентов");
                return;
              }

              if (isBillingReadOnly) {
                setToastType("error");
                setToastMessage(
                  "Подписка неактивна. Доступен только режим просмотра."
                );
                return;
              }

              setIsCreateOpen(true);
            }}
            canAddClient={canManageClientsWithBilling}
          />

          {isLoadingClients ? (
            <div className="rounded-[28px] border border-white/10 bg-[#121826] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.32)]">
              <div className="flex items-center justify-between">
                <div>
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="mt-2 h-7 w-32" />
                </div>

                <Skeleton className="h-10 w-32" />
              </div>

              <div className="mt-5 overflow-hidden rounded-[24px] border border-white/8">
                <div className="bg-white/[0.04] px-4 py-3">
                  <div className="grid grid-cols-8 gap-4">
                    {Array.from({ length: 8 }).map((_, index) => (
                      <Skeleton key={index} className="h-4 w-full" />
                    ))}
                  </div>
                </div>

                <div className="space-y-0">
                  {Array.from({ length: 6 }).map((_, rowIndex) => (
                    <div
                      key={rowIndex}
                      className="grid grid-cols-8 gap-4 border-t border-white/6 px-4 py-4"
                    >
                      <Skeleton className="h-5 w-32" />
                      <Skeleton className="h-6 w-24 rounded-full" />
                      <Skeleton className="h-5 w-28" />
                      <Skeleton className="h-5 w-24" />
                      <Skeleton className="h-5 w-20" />
                      <Skeleton className="h-5 w-20" />
                      <Skeleton className="h-5 w-20" />
                      <Skeleton className="h-8 w-28" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : filteredClients.length > 0 ? (
            <ClientsTable
              clients={filteredClients}
              employees={employees}
              onDelete={handleDeleteClient}
              onEdit={handleOpenEditClient}
              canManageClients={canManageClientsWithBilling}
            />
          ) : (
            <EmptyState
              title={clients.length === 0 ? "Клиентов пока нет" : "Ничего не найдено"}
              description={
                clients.length === 0
                  ? canManageClientsWithBilling
                    ? "Добавь первого клиента, чтобы начать управлять проектами, статусами и оплатами."
                    : "В этом кабинете пока нет клиентов."
                  : "Попробуй изменить поиск или фильтр статуса."
              }
              actionLabel={
                clients.length === 0 && canManageClientsWithBilling
                  ? "Добавить клиента"
                  : undefined
              }
              onAction={
                clients.length === 0 && canManageClientsWithBilling
                  ? () => setIsCreateOpen(true)
                  : undefined
              }
            />
          )}
        </div>

        {canManageClientsWithBilling ? (
          <CreateClientModal
            isOpen={isCreateOpen}
            onClose={() => {
              if (!isMutating) {
                setIsCreateOpen(false);
              }
            }}
            onCreate={handleCreateClient}
            name={newName}
            setName={setNewName}
            owner={newOwner}
            setOwner={setNewOwner}
            ownerId={newOwnerId}
            setOwnerId={setNewOwnerId}
            model={newModel}
            setModel={setNewModel}
            status={newStatus}
            setStatus={setNewStatus}
            nextInvoice={newNextInvoice}
            setNextInvoice={setNewNextInvoice}
            amount={newAmount}
            setAmount={setNewAmount}
            profit={newProfit}
            setProfit={setNewProfit}
            employees={employees}
          />
        ) : null}

        {canManageClientsWithBilling ? (
          <EditClientModal
            isOpen={isEditOpen}
            onClose={() => {
              if (!isMutating) {
                setIsEditOpen(false);
              }
            }}
            onSave={handleSaveClient}
            name={editName}
            setName={setEditName}
            owner={editOwner}
            setOwner={setEditOwner}
            ownerId={editOwnerId}
            setOwnerId={setEditOwnerId}
            model={editModel}
            setModel={setEditModel}
            status={editStatus}
            setStatus={setEditStatus}
            nextInvoice={editNextInvoice}
            setNextInvoice={setEditNextInvoice}
            amount={editAmount}
            setAmount={setEditAmount}
            profit={editProfit}
            setProfit={setEditProfit}
            employees={employees}
          />
        ) : null}
      </main>

      {toastMessage ? <AppToast message={toastMessage} type={toastType} /> : null}
    </>
  );
}