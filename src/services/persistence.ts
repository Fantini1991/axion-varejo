import { supabase } from "../lib/supabase";

export type EntityName =
  | "produtos"
  | "clientes"
  | "fornecedores"
  | "estoque-movimentacoes"
  | "pdv-vendas"
  | "pedidos-compra"
  | "contas-receber"
  | "contas-pagar"
  | "despesas"
  | "empresa-config"
  | "campanhas-fidelidade"
  | "pontos-fidelidade";

export type PersistedRecord<TData extends Record<string, unknown> = Record<string, unknown>> = {
  id: string;
  createdAt: string;
  updatedAt: string;
  data: TData;
};

type SupabaseRow = {
  id: string;
  entity: string;
  tenant_id: string;
  data: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

function toRecord<TData extends Record<string, unknown>>(row: SupabaseRow): PersistedRecord<TData> {
  return {
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    data: row.data as TData,
  };
}

async function currentTenantId(): Promise<string> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error("Sessão expirada. Faça login novamente.");
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", userData.user.id)
    .single();
  if (error || !profile) throw new Error("Usuário sem tenant vinculado.");
  return profile.tenant_id as string;
}

export async function listRecords<TData extends Record<string, unknown>>(entity: EntityName): Promise<PersistedRecord<TData>[]> {
  const { data, error } = await supabase
    .from("records")
    .select("*")
    .eq("entity", entity)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data as SupabaseRow[]).map(toRecord<TData>);
}

export async function createRecord<TData extends Record<string, unknown>>(
  entity: EntityName,
  data: TData,
): Promise<PersistedRecord<TData>> {
  const { data: userData } = await supabase.auth.getUser();
  const tenantId = await currentTenantId();

  const { data: row, error } = await supabase
    .from("records")
    .insert({ entity, data, tenant_id: tenantId, created_by: userData.user?.id })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return toRecord<TData>(row as SupabaseRow);
}

export async function updateRecord<TData extends Record<string, unknown>>(
  entity: EntityName,
  id: string,
  data: TData,
): Promise<PersistedRecord<TData>> {
  const { data: row, error } = await supabase
    .from("records")
    .update({ data })
    .eq("id", id)
    .eq("entity", entity)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return toRecord<TData>(row as SupabaseRow);
}

export async function deleteRecord(entity: EntityName, id: string): Promise<void> {
  const { error } = await supabase.from("records").delete().eq("id", id).eq("entity", entity);
  if (error) throw new Error(error.message);
}

/** Envia uma foto para o bucket `produtos` (isolado por tenant) e retorna a URL pública. */
export async function uploadProdutoFoto(file: File): Promise<string> {
  const tenantId = await currentTenantId();
  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `${tenantId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("produtos").upload(path, file, { upsert: false });
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from("produtos").getPublicUrl(path);
  return data.publicUrl;
}

/** Envia a logo da empresa para o bucket `empresa` (isolado por tenant) e retorna a URL pública. */
export async function uploadEmpresaLogo(file: File): Promise<string> {
  const tenantId = await currentTenantId();
  const ext = file.name.split(".").pop() ?? "png";
  const path = `${tenantId}/logo-${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("empresa").upload(path, file, { upsert: false });
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from("empresa").getPublicUrl(path);
  return data.publicUrl;
}

/** Busca (ou cria, se ainda não existir) o registro único de configuração da empresa do tenant atual. */
export async function getOrCreateSingleton<TData extends Record<string, unknown>>(
  entity: EntityName,
  defaults: TData,
): Promise<PersistedRecord<TData>> {
  const rows = await listRecords<TData>(entity);
  if (rows[0]) return rows[0];
  return createRecord(entity, defaults);
}
