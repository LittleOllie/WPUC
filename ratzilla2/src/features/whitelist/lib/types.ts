export type WalletStatus =
  | "unconfirmed"
  | "confirmed"
  | "needs_review"
  | "removed";

export type ConfirmationMethod =
  | "manual_check"
  | "wallet_signature"
  | "admin";

export interface WhitelistWallet {
  id: string;
  wallet_address: string;
  wallet_address_normalised: string;
  status: WalletStatus;
  is_active: boolean;
  wl_spots: number;
  source: string | null;
  import_batch_id: string | null;
  internal_notes: string | null;
  confirmation_method: ConfirmationMethod | null;
  confirmed_at: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

export interface ImportBatch {
  id: string;
  name: string;
  original_filename: string | null;
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
  duplicate_rows: number;
  imported_rows: number;
  skipped_rows: number;
  created_by: string | null;
  created_at: string;
}

export interface AuditEvent {
  id: string;
  event_type: string;
  wallet_id: string | null;
  wallet_address_snapshot: string | null;
  admin_user_id: string | null;
  event_source: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface DashboardStats {
  total_active: number;
  confirmed: number;
  unconfirmed: number;
  needs_review: number;
  removed: number;
  manual: number;
  recent_confirmed: number;
  confirmation_progress: number;
}

export type PublicLookupOutcome =
  | "found"
  | "not_found"
  | "invalid_address"
  | "error"
  | "rate_limited";

export interface PublicLookupFound {
  outcome: "found";
  wallet_address: string;
  status: WalletStatus;
  confirmed: boolean;
  wl_spots: number;
}

export interface PublicLookupNotFound {
  outcome: "not_found";
}

export interface PublicLookupInvalid {
  outcome: "invalid_address";
}

export interface PublicLookupError {
  outcome: "error" | "rate_limited";
}

export type PublicLookupResult =
  | PublicLookupFound
  | PublicLookupNotFound
  | PublicLookupInvalid
  | PublicLookupError;

export type PublicConfirmOutcome =
  | "confirmed"
  | "already_confirmed"
  | "not_found"
  | "invalid_address"
  | "error"
  | "rate_limited";

export interface PublicConfirmResult {
  outcome: PublicConfirmOutcome;
  wallet_address?: string;
  confirmed_at?: string;
}

export interface WalletFilters {
  search?: string;
  status?: WalletStatus | "all";
  activeState?: "active" | "inactive" | "all";
  source?: string;
  batchId?: string;
  sortBy?: "created_at" | "confirmed_at" | "updated_at";
  sortDir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

export interface ImportPreviewRow {
  line: number;
  raw: string;
  address: string | null;
  normalised: string | null;
  valid: boolean;
  duplicateInFile: boolean;
  existsInDb: boolean;
  wl_spots: number;
  source: string | null;
  notes: string | null;
}

export interface ImportPreviewSummary {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateInFile: number;
  existsInDb: number;
  newRows: number;
  needsReview: number;
  rows: ImportPreviewRow[];
}

export interface ManualWalletInput {
  wallet_address: string;
  wl_spots?: number;
  source?: string;
  internal_notes?: string;
  status?: WalletStatus;
  is_active?: boolean;
}

export type ExportFilter =
  | "all_active"
  | "confirmed"
  | "unconfirmed"
  | "needs_review"
  | "removed"
  | "batch"
  | "post_import";
