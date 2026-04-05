import { createClient } from "./client";

const supabase = createClient();

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
import type { StoredClient } from "../storage";

type DbClientRow = {
  id: string;
  name: string;
  status: "active" | "paused" | "problem" | "completed";
  owner: string;
  model: string;
  next_invoice: string | null;
  amount: string | null;
  profit: string | null;
};

function mapDbClient(row: DbClientRow): StoredClient {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    owner: row.owner,
    model: row.model,
    nextInvoice: row.next_invoice ?? "",
    amount: row.amount ?? "",
    profit: row.profit ?? "",
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
    model: client.model,
    next_invoice: client.nextInvoice,
    amount: client.amount,
    profit: client.profit,
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
    model: client.model,
    next_invoice: client.nextInvoice,
    amount: client.amount,
    profit: client.profit,
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