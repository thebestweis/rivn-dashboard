import { createClient } from "./client";
import type { StoredClient } from "../storage";

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
  const supabase = createClient();

  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data as DbClientRow[]).map(mapDbClient);
}

export async function fetchClientByIdFromSupabase(
  id: string
): Promise<StoredClient | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return mapDbClient(data as DbClientRow);
}

export async function createClientInSupabase(
  client: Omit<StoredClient, "id">
): Promise<StoredClient> {
  const supabase = createClient();

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
  };

  const { data, error } = await supabase
    .from("clients")
    .insert(payload)
    .select()
    .single();

  if (error) throw error;

  return mapDbClient(data as DbClientRow);
}

export async function updateClientInSupabase(
  id: string,
  client: Omit<StoredClient, "id">
): Promise<StoredClient> {
  const supabase = createClient();

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
    .select()
    .single();

  if (error) throw error;

  return mapDbClient(data as DbClientRow);
}

export async function deleteClientInSupabase(id: string): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase.from("clients").delete().eq("id", id);

  if (error) throw error;
}

export async function fetchMonthlyPlansFromSupabase(): Promise<
  SupabaseMonthlyPlan[]
> {
  return [];
}