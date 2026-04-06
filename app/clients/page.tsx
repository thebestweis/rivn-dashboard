"use client";

import { useEffect, useMemo, useState } from "react";
import { ClientsPageHeader } from "../components/clients/clients-page-header";
import { AppSidebar } from "../components/layout/app-sidebar";
import { ClientsTable } from "../components/dashboard/clients-table";
import { CreateClientModal } from "../components/clients/create-client-modal";
import { EmptyState } from "../components/ui/empty-state";
import { AppToast } from "../components/ui/app-toast";
import {
  fetchClientsFromSupabase,
  createClientInSupabase,
  deleteClientInSupabase,
} from "../lib/supabase/clients";

export default function ClientsPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");

  const [clients, setClients] = useState<any[]>([]);
  const [isLoadingClients, setIsLoadingClients] = useState(true);

  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const [newName, setNewName] = useState("");
  const [newOwner, setNewOwner] = useState("");
  const [newOwnerId, setNewOwnerId] = useState("");
  const [newModel, setNewModel] = useState("");
  const [newStatus, setNewStatus] = useState<
    "active" | "paused" | "problem" | "completed"
  >("active");
  const [newNextInvoice, setNewNextInvoice] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newProfit, setNewProfit] = useState("");

  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState<"success" | "error" | "info">(
    "success"
  );

  useEffect(() => {
    let isMounted = true;

    async function loadClients() {
      try {
        const data = await fetchClientsFromSupabase();
        if (isMounted) {
          setClients(data);
        }
      } catch (error) {
        console.error(error);
        setToastType("error");
        setToastMessage("Не удалось загрузить клиентов из Supabase");
      } finally {
        if (isMounted) {
          setIsLoadingClients(false);
        }
      }
    }

    loadClients();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!toastMessage) return;

    const timer = setTimeout(() => {
      setToastMessage("");
    }, 2200);

    return () => clearTimeout(timer);
  }, [toastMessage]);

  const filteredClients = useMemo(() => {
    return clients.filter((client) => {
      const matchesSearch = client.name
        .toLowerCase()
        .includes(search.toLowerCase());

      const matchesStatus =
        status === "all" ? true : client.status === status;

      return matchesSearch && matchesStatus;
    });
  }, [clients, search, status]);

  async function handleCreateClient(client: {
  name: string;
  status: "active" | "paused" | "problem" | "completed";
  owner: string;
  ownerId?: string | null;
  model: string;
  nextInvoice: string;
  amount: string;
  profit: string;
}) {
    try {
      const createdClient = await createClientInSupabase(client);

      setClients((prev) => [createdClient, ...prev]);

      setIsCreateOpen(false);
      setNewName("");
      setNewOwner("");
      setNewOwnerId("");
      setNewModel("");
      setNewStatus("active");
      setNewNextInvoice("");
      setNewAmount("");
      setNewProfit("");

      setToastType("success");
      setToastMessage(`Клиент "${client.name}" создан`);
    } catch (error) {
      console.error(error);
      setToastType("error");
      setToastMessage("Не удалось создать клиента");
    }
  }

  async function handleDeleteClient(clientId: string) {
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
      await deleteClientInSupabase(clientId);
      setClients((prev) => prev.filter((item) => item.id !== clientId));
      setToastType("success");
      setToastMessage(`Клиент "${target.name}" удалён`);
    } catch (error) {
      console.error(error);
      setToastType("error");
      setToastMessage("Не удалось удалить клиента");
    }
  }

  return (
    <div className="min-h-screen bg-[#0B0F1A] text-white">
      <div className="flex min-h-screen">
        <AppSidebar />

        <main className="flex-1">

          <div className="space-y-6 px-5 py-6 lg:px-8">
            <ClientsPageHeader
              search={search}
              setSearch={setSearch}
              status={status}
              setStatus={setStatus}
              onAddClient={() => setIsCreateOpen(true)}
            />

            {isLoadingClients ? (
              <div className="rounded-[28px] border border-white/10 bg-[#121826] p-8 text-white/60">
                Загрузка клиентов...
              </div>
            ) : filteredClients.length > 0 ? (
              <ClientsTable
                clients={filteredClients}
                onDelete={handleDeleteClient}
              />
            ) : (
              <EmptyState
                title={clients.length === 0 ? "Клиентов пока нет" : "Ничего не найдено"}
                description={
                  clients.length === 0
                    ? "Добавь первого клиента, чтобы начать управлять проектами, статусами и оплатами."
                    : "Попробуй изменить поиск или фильтр статуса."
                }
                actionLabel={clients.length === 0 ? "Добавить клиента" : undefined}
                onAction={clients.length === 0 ? () => setIsCreateOpen(true) : undefined}
              />
            )}
          </div>

          <CreateClientModal
  isOpen={isCreateOpen}
  onClose={() => setIsCreateOpen(false)}
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
/>
        </main>
      </div>

      {toastMessage ? (
        <AppToast message={toastMessage} type={toastType} />
      ) : null}
    </div>
  );
}