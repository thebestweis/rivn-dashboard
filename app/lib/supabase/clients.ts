import type { StoredClient } from "../storage";
import { requireBillingAccess } from "../billing-guards";
import { getMonthlyPlansFromSupabase } from "./monthly-plans";
import { getAppContext } from "./app-context";

export type SupabaseMonthlyPlan = {
  id: string;
  month: string;
  revenue_plan: number;
  profit_plan: number;
  expenses_plan: number;
  fot_plan: number;
  created_at: string;
  updated_at: string;
};

type DbClientRow = {
  id: string;
  user_id: string;
  workspace_id: string;
  name: string;
  status: "active" | "paused" | "problem" | "completed";
  owner: string;
  owner_id: string | null;
  model: string;
  next_invoice: string | null;
  amount: string | null;
  profit: string | null;
  notes: string | null;
};

function mapDbClient(row: DbClientRow): StoredClient {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    owner: row.owner,
    ownerId: row.owner_id,
    model: row.model,
    nextInvoice: row.next_invoice ?? "",
    amount: row.amount ?? "",
    profit: row.profit ?? "",
    notes: row.notes ?? "",
  };
}

export async function fetchClientsFromSupabase(): Promise<StoredClient[]> {
  const { supabase, workspace } = await getAppContext();

  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .eq("workspace_id", workspace.id)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Не удалось загрузить клиентов: ${error.message}`);
  }

  return ((data ?? []) as DbClientRow[]).map(mapDbClient);
}

export async function fetchClientByIdFromSupabase(
  id: string
): Promise<StoredClient | null> {
  const { supabase, workspace } = await getAppContext();

  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .eq("id", id)
    .eq("workspace_id", workspace.id)
    .maybeSingle();

  if (error) {
    throw new Error(`Не удалось загрузить клиента: ${error.message}`);
  }

  if (!data) return null;

  return mapDbClient(data as DbClientRow);
}

export async function createClientInSupabase(
  client: Omit<StoredClient, "id">
): Promise<StoredClient> {
  await requireBillingAccess();

  const { supabase, workspace, user } = await getAppContext();

  const payload = {
    user_id: user.id,
    workspace_id: workspace.id,
    name: client.name,
    status: client.status,
    owner: client.owner,
    owner_id: client.ownerId ?? null,
    model: client.model,
    next_invoice: client.nextInvoice,
    amount: client.amount,
    profit: client.profit,
    notes: client.notes ?? "",
  };

  const { data, error } = await supabase
    .from("clients")
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Не удалось создать клиента: ${error.message}`);
  }

  return mapDbClient(data as DbClientRow);
}

export async function updateClientInSupabase(
  id: string,
  client: Omit<StoredClient, "id">
): Promise<StoredClient> {
  await requireBillingAccess();

  const { supabase, workspace } = await getAppContext();

  const payload = {
    name: client.name,
    status: client.status,
    owner: client.owner,
    owner_id: client.ownerId ?? null,
    model: client.model,
    next_invoice: client.nextInvoice,
    amount: client.amount,
    profit: client.profit,
    notes: client.notes ?? "",
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("clients")
    .update(payload)
    .eq("id", id)
    .eq("workspace_id", workspace.id)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Не удалось обновить клиента: ${error.message}`);
  }

  return mapDbClient(data as DbClientRow);
}

export async function deleteClientInSupabase(id: string): Promise<void> {
  const { supabase, workspace } = await getAppContext();

  const { error } = await supabase
    .from("clients")
    .delete()
    .eq("id", id)
    .eq("workspace_id", workspace.id);

  if (error) {
    throw new Error(`Не удалось удалить клиента: ${error.message}`);
  }
}

export async function fetchMonthlyPlansFromSupabase(): Promise<
  SupabaseMonthlyPlan[]
> {
  return getMonthlyPlansFromSupabase();
}