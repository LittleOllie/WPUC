import type {
  ExportFilter,
  ImportPreviewRow,
  ImportPreviewSummary,
  WhitelistWallet,
} from "./types";
import { isValidEvmWalletAddress, normaliseWalletAddress } from "./wallet";

const WALLET_COLUMN_NAMES = [
  "wallet",
  "wallet_address",
  "address",
  "wallet address",
  "eth_address",
  "ethereum_address",
];

const SPOTS_COLUMN_NAMES = ["spots", "wl_spots", "whitelist_spots", "amount"];
const SOURCE_COLUMN_NAMES = ["source", "batch", "origin"];
const NOTES_COLUMN_NAMES = ["notes", "internal_notes", "comment"];

const MAX_IMPORT_ROWS = 5000;
const MAX_FILE_BYTES = 2 * 1024 * 1024;

export function getImportLimits() {
  return { maxRows: MAX_IMPORT_ROWS, maxFileBytes: MAX_FILE_BYTES };
}

function detectDelimiter(line: string): "," | "\t" | ";" {
  const counts = [
    [",", (line.match(/,/g) ?? []).length] as const,
    ["\t", (line.match(/\t/g) ?? []).length] as const,
    [";", (line.match(/;/g) ?? []).length] as const,
  ];
  counts.sort((a, b) => b[1] - a[1]);
  return (counts[0][1] > 0 ? counts[0][0] : ",") as "," | "\t" | ";";
}

function parseCsvLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

function findColumnIndex(headers: string[], names: string[]): number {
  const lower = headers.map((h) => h.toLowerCase().trim());
  for (const name of names) {
    const idx = lower.indexOf(name);
    if (idx >= 0) return idx;
  }
  return -1;
}

export interface ParsedImportInput {
  rows: Array<{
    line: number;
    address: string;
    wl_spots: number;
    source: string | null;
    notes: string | null;
  }>;
  totalLines: number;
}

export function parseImportText(text: string): ParsedImportInput {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) {
    return { rows: [], totalLines: 0 };
  }

  const delimiter = detectDelimiter(lines[0]);
  const firstFields = parseCsvLine(lines[0], delimiter);
  const walletCol = findColumnIndex(firstFields, WALLET_COLUMN_NAMES);
  const hasHeader =
    walletCol >= 0 ||
    firstFields.some((f) =>
      WALLET_COLUMN_NAMES.includes(f.toLowerCase().trim()),
    );

  const startIdx = hasHeader ? 1 : 0;
  const headers = hasHeader ? firstFields : [];
  const resolvedWalletCol = hasHeader
    ? findColumnIndex(headers, WALLET_COLUMN_NAMES)
    : 0;
  const spotsCol = hasHeader ? findColumnIndex(headers, SPOTS_COLUMN_NAMES) : -1;
  const sourceCol = hasHeader ? findColumnIndex(headers, SOURCE_COLUMN_NAMES) : -1;
  const notesCol = hasHeader ? findColumnIndex(headers, NOTES_COLUMN_NAMES) : -1;

  const rows: ParsedImportInput["rows"] = [];

  for (let i = startIdx; i < lines.length && rows.length < MAX_IMPORT_ROWS; i++) {
    const fields = parseCsvLine(lines[i], delimiter);
    const address =
      resolvedWalletCol >= 0
        ? fields[resolvedWalletCol] ?? ""
        : fields[0] ?? "";

    if (!address.trim()) continue;

    const spotsRaw =
      spotsCol >= 0 ? parseInt(fields[spotsCol] ?? "1", 10) : 1;
    const wl_spots = Number.isFinite(spotsRaw) && spotsRaw > 0 ? spotsRaw : 1;

    rows.push({
      line: i + 1,
      address: address.trim(),
      wl_spots,
      source: sourceCol >= 0 ? fields[sourceCol]?.trim() || null : null,
      notes: notesCol >= 0 ? fields[notesCol]?.trim() || null : null,
    });
  }

  return { rows, totalLines: lines.length };
}

export function buildImportPreview(
  parsed: ParsedImportInput,
  existingNormalised: Set<string>,
): ImportPreviewSummary {
  const seenInFile = new Set<string>();
  const previewRows: ImportPreviewRow[] = [];

  let validRows = 0;
  let invalidRows = 0;
  let duplicateInFile = 0;
  let existsInDb = 0;
  let newRows = 0;
  let needsReview = 0;

  for (const row of parsed.rows) {
    const valid = isValidEvmWalletAddress(row.address);
    const normalised = valid ? normaliseWalletAddress(row.address) : null;
    const duplicateInFileFlag =
      normalised !== null && seenInFile.has(normalised);
    const existsInDbFlag =
      normalised !== null && existingNormalised.has(normalised);

    if (normalised) seenInFile.add(normalised);

    if (!valid) {
      invalidRows++;
    } else {
      validRows++;
      if (duplicateInFileFlag) duplicateInFile++;
      else if (existsInDbFlag) existsInDb++;
      else newRows++;
    }

    if (valid && (duplicateInFileFlag || existsInDbFlag)) {
      needsReview++;
    }

    previewRows.push({
      line: row.line,
      raw: row.address,
      address: valid ? row.address : null,
      normalised,
      valid,
      duplicateInFile: duplicateInFileFlag,
      existsInDb: existsInDbFlag,
      wl_spots: row.wl_spots,
      source: row.source,
      notes: row.notes,
    });
  }

  return {
    totalRows: parsed.rows.length,
    validRows,
    invalidRows,
    duplicateInFile,
    existsInDb,
    newRows,
    needsReview,
    rows: previewRows,
  };
}

/** Prefix cells that could trigger CSV formula injection in Excel. */
export function sanitizeCsvCell(value: string | number | null | undefined): string {
  const str = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(str)) {
    return `'${str}`;
  }
  return str;
}

export function walletsToCsv(wallets: WhitelistWallet[]): string {
  const headers = [
    "wallet_address",
    "wallet_address_normalised",
    "status",
    "confirmation_method",
    "wl_spots",
    "source",
    "is_active",
    "created_at",
    "confirmed_at",
  ];

  const lines = [headers.join(",")];

  for (const w of wallets) {
    lines.push(
      [
        sanitizeCsvCell(w.wallet_address),
        sanitizeCsvCell(w.wallet_address_normalised),
        sanitizeCsvCell(w.status),
        sanitizeCsvCell(w.confirmation_method ?? ""),
        sanitizeCsvCell(w.wl_spots),
        sanitizeCsvCell(w.source ?? ""),
        sanitizeCsvCell(w.is_active ? "true" : "false"),
        sanitizeCsvCell(w.created_at),
        sanitizeCsvCell(w.confirmed_at ?? ""),
      ].join(","),
    );
  }

  return lines.join("\n");
}

export function downloadCsv(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function filterWalletsForExport(
  wallets: WhitelistWallet[],
  filter: ExportFilter,
  batchId?: string,
  importCutoff?: string,
): WhitelistWallet[] {
  switch (filter) {
    case "all_active":
      return wallets.filter((w) => w.is_active && w.status !== "removed");
    case "confirmed":
      return wallets.filter((w) => w.status === "confirmed" && w.is_active);
    case "unconfirmed":
      return wallets.filter((w) => w.status === "unconfirmed" && w.is_active);
    case "needs_review":
      return wallets.filter((w) => w.status === "needs_review");
    case "removed":
      return wallets.filter((w) => w.status === "removed" || !w.is_active);
    case "batch":
      return wallets.filter((w) => w.import_batch_id === batchId);
    case "post_import":
      return wallets.filter(
        (w) => importCutoff && w.created_at > importCutoff,
      );
    default:
      return wallets;
  }
}

export function exportFilename(filter: ExportFilter): string {
  const date = new Date().toISOString().slice(0, 10);
  return `blackwater-whitelist-${filter}-${date}.csv`;
}
