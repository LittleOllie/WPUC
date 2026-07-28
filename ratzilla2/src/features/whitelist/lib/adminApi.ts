import { getSupabase } from "./supabase";
import type {
  AuditEvent,
  DashboardStats,
  ImportBatch,
  ManualWalletInput,
  WalletFilters,
  WhitelistWallet,
} from "./types";
import {
  isValidEvmWalletAddress,
  normaliseWalletAddress,
  preserveDisplayAddress,
} from "./wallet";

export async function checkIsAdmin(): Promise<boolean> {
  const supabase = getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return false;

  const { data, error } = await supabase
    .from("admin_profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !data) return false;
  return data.is_admin === true;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc("admin_dashboard_stats");

  if (error) throw error;
  return data as DashboardStats;
}

export async function fetchWallets(
  filters: WalletFilters = {},
): Promise<{ wallets: WhitelistWallet[]; total: number }> {
  const supabase = getSupabase();
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 25;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("whitelist_wallets")
    .select("*", { count: "exact" });

  if (filters.search?.trim()) {
    const term = filters.search.trim().toLowerCase();
    query = query.ilike("wallet_address_normalised", `%${term}%`);
  }

  if (filters.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  }

  if (filters.activeState === "active") {
    query = query.eq("is_active", true).neq("status", "removed");
  } else if (filters.activeState === "inactive") {
    query = query.or("is_active.eq.false,status.eq.removed");
  }

  if (filters.source) {
    query = query.eq("source", filters.source);
  }

  if (filters.batchId) {
    query = query.eq("import_batch_id", filters.batchId);
  }

  const sortBy = filters.sortBy ?? "created_at";
  const ascending = filters.sortDir === "asc";
  query = query.order(sortBy, { ascending, nullsFirst: false });
  query = query.range(from, to);

  const { data, error, count } = await query;

  if (error) throw error;
  return { wallets: (data ?? []) as WhitelistWallet[], total: count ?? 0 };
}

export async function fetchWalletById(
  id: string,
): Promise<WhitelistWallet | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("whitelist_wallets")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return data as WhitelistWallet | null;
}

export async function fetchWalletByNormalised(
  normalised: string,
): Promise<WhitelistWallet | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("whitelist_wallets")
    .select("*")
    .eq("wallet_address_normalised", normalised)
    .maybeSingle();

  if (error) throw error;
  return data as WhitelistWallet | null;
}

export async function fetchAllNormalisedAddresses(): Promise<Set<string>> {
  const supabase = getSupabase();
  const result = new Set<string>();
  const pageSize = 1000;
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("whitelist_wallets")
      .select("wallet_address_normalised")
      .range(from, from + pageSize - 1);

    if (error) throw error;
    if (!data?.length) break;

    for (const row of data) {
      result.add(row.wallet_address_normalised);
    }

    if (data.length < pageSize) break;
    from += pageSize;
  }

  return result;
}

export async function createWalletManual(
  input: ManualWalletInput,
): Promise<{ wallet: WhitelistWallet | null; duplicate: boolean }> {
  if (!isValidEvmWalletAddress(input.wallet_address)) {
    throw new Error("Invalid wallet address.");
  }

  const normalised = normaliseWalletAddress(input.wallet_address);
  const existing = await fetchWalletByNormalised(normalised);
  if (existing) {
    return { wallet: existing, duplicate: true };
  }

  const supabase = getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("whitelist_wallets")
    .insert({
      wallet_address: preserveDisplayAddress(input.wallet_address),
      wallet_address_normalised: normalised,
      wl_spots: input.wl_spots ?? 1,
      source: input.source ?? "manual",
      internal_notes: input.internal_notes ?? null,
      status: input.status ?? "unconfirmed",
      is_active: input.is_active ?? true,
      created_by: user?.id ?? null,
      updated_by: user?.id ?? null,
    })
    .select()
    .single();

  if (error) throw error;

  await logAuditEvent("wallet_added_manually", data.id, data.wallet_address, {
    wl_spots: data.wl_spots,
    source: data.source,
  });

  return { wallet: data as WhitelistWallet, duplicate: false };
}

export async function updateWallet(
  id: string,
  updates: Partial<
    Pick<
      WhitelistWallet,
      | "status"
      | "is_active"
      | "wl_spots"
      | "source"
      | "internal_notes"
      | "confirmation_method"
      | "confirmed_at"
    >
  >,
  auditType = "wallet_edited",
): Promise<WhitelistWallet> {
  const supabase = getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const existing = await fetchWalletById(id);
  if (!existing) throw new Error("Wallet not found.");

  const payload = {
    ...updates,
    updated_by: user?.id ?? null,
  };

  if (updates.status === "confirmed" && !updates.confirmed_at) {
    payload.confirmed_at = new Date().toISOString();
    if (!updates.confirmation_method) {
      payload.confirmation_method = "admin";
    }
  }

  const { data, error } = await supabase
    .from("whitelist_wallets")
    .update(payload)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;

  await logAuditEvent(auditType, id, data.wallet_address, {
    before: {
      status: existing.status,
      is_active: existing.is_active,
      wl_spots: existing.wl_spots,
    },
    after: {
      status: data.status,
      is_active: data.is_active,
      wl_spots: data.wl_spots,
    },
  });

  return data as WhitelistWallet;
}

export async function removeWallet(id: string): Promise<WhitelistWallet> {
  return updateWallet(
    id,
    { status: "removed", is_active: false },
    "wallet_removed",
  );
}

export async function restoreWallet(id: string): Promise<WhitelistWallet> {
  return updateWallet(
    id,
    { status: "unconfirmed", is_active: true },
    "wallet_restored",
  );
}

export async function resetConfirmation(id: string): Promise<WhitelistWallet> {
  return updateWallet(
    id,
    {
      status: "unconfirmed",
      confirmation_method: null,
      confirmed_at: null,
    },
    "confirmation_reset",
  );
}

export async function bulkImportWallets(
  batchName: string,
  rows: Array<{
    address: string;
    wl_spots: number;
    source: string | null;
    notes: string | null;
  }>,
  options: {
    originalFilename?: string;
    updateExisting?: boolean;
    defaultSource?: string;
  } = {},
): Promise<{
  imported: number;
  skipped: number;
  batchId: string;
}> {
  const supabase = getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const existingSet = await fetchAllNormalisedAddresses();
  const toInsert: Array<Record<string, unknown>> = [];
  let skipped = 0;
  let invalid = 0;

  for (const row of rows) {
    if (!isValidEvmWalletAddress(row.address)) {
      skipped++;
      invalid++;
      continue;
    }

    const normalised = normaliseWalletAddress(row.address);
    if (existingSet.has(normalised)) {
      skipped++;
      continue;
    }

    existingSet.add(normalised);
    toInsert.push({
      wallet_address: preserveDisplayAddress(row.address),
      wallet_address_normalised: normalised,
      wl_spots: row.wl_spots,
      source: row.source ?? options.defaultSource ?? batchName,
      internal_notes: row.notes,
      status: "unconfirmed",
      is_active: true,
      created_by: user?.id ?? null,
      updated_by: user?.id ?? null,
    });
  }

  const { data: batch, error: batchError } = await supabase
    .from("import_batches")
    .insert({
      name: batchName,
      original_filename: options.originalFilename ?? null,
      total_rows: rows.length,
      valid_rows: toInsert.length + (skipped - invalid),
      invalid_rows: invalid,
      duplicate_rows: skipped - invalid,
      imported_rows: toInsert.length,
      skipped_rows: skipped,
      created_by: user?.id ?? null,
    })
    .select()
    .single();

  if (batchError) throw batchError;

  const batchId = (batch as ImportBatch).id;
  const chunkSize = 100;
  let imported = 0;

  for (let i = 0; i < toInsert.length; i += chunkSize) {
    const chunk = toInsert.slice(i, i + chunkSize).map((row) => ({
      ...row,
      import_batch_id: batchId,
    }));

    const { error } = await supabase.from("whitelist_wallets").insert(chunk);
    if (error) throw error;
    imported += chunk.length;
  }

  await logAuditEvent("bulk_import_completed", null, null, {
    batch_id: batchId,
    batch_name: batchName,
    imported,
    skipped,
    total_rows: rows.length,
  });

  return { imported, skipped, batchId };
}

export async function fetchImportBatches(): Promise<ImportBatch[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("import_batches")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as ImportBatch[];
}

export async function fetchAuditEvents(
  limit = 50,
  walletId?: string,
): Promise<AuditEvent[]> {
  const supabase = getSupabase();
  let query = supabase
    .from("audit_events")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (walletId) {
    query = query.eq("wallet_id", walletId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as AuditEvent[];
}

export async function fetchRecentActivity(limit = 10): Promise<AuditEvent[]> {
  return fetchAuditEvents(limit);
}

export async function fetchAllWalletsForExport(): Promise<WhitelistWallet[]> {
  const supabase = getSupabase();
  const all: WhitelistWallet[] = [];
  const pageSize = 1000;
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("whitelist_wallets")
      .select("*")
      .order("created_at", { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) throw error;
    if (!data?.length) break;

    all.push(...(data as WhitelistWallet[]));
    if (data.length < pageSize) break;
    from += pageSize;
  }

  return all;
}

async function logAuditEvent(
  eventType: string,
  walletId: string | null,
  walletAddress: string | null,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  const supabase = getSupabase();

  const { error } = await supabase.rpc("log_admin_audit", {
    p_event_type: eventType,
    p_wallet_id: walletId,
    p_wallet_address: walletAddress,
    p_event_source: "admin",
    p_metadata: metadata,
  });

  if (error) {
    console.error("Audit log failed", error);
  }
}

export async function fetchDistinctSources(): Promise<string[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("whitelist_wallets")
    .select("source")
    .not("source", "is", null);

  if (error) throw error;

  const sources = new Set<string>();
  for (const row of data ?? []) {
    if (row.source) sources.add(row.source);
  }
  return Array.from(sources).sort();
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
