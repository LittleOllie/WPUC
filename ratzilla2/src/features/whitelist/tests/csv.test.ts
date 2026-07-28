import { describe, expect, it } from "vitest";
import {
  buildImportPreview,
  parseImportText,
  sanitizeCsvCell,
  walletsToCsv,
} from "../lib/csv";
import type { WhitelistWallet } from "../lib/types";

describe("csv import and export", () => {
  const validA = "0x1111111111111111111111111111111111111111";
  const validB = "0x2222222222222222222222222222222222222222";

  it("parses plain-text one wallet per line", () => {
    const parsed = parseImportText(`${validA}\n${validB}\n`);
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.rows[0].address).toBe(validA);
  });

  it("parses CSV with wallet column header", () => {
    const parsed = parseImportText(
      "wallet_address,spots\n" + `${validA},2\n${validB},1\n`,
    );
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.rows[0].wl_spots).toBe(2);
  });

  it("detects duplicates within uploaded list", () => {
    const parsed = parseImportText(`${validA}\n${validA.toUpperCase()}\n`);
    const preview = buildImportPreview(parsed, new Set());
    expect(preview.duplicateInFile).toBe(1);
    expect(preview.newRows).toBe(1);
  });

  it("detects addresses already in database", () => {
    const parsed = parseImportText(`${validA}\n${validB}\n`);
    const existing = new Set([validA.toLowerCase()]);
    const preview = buildImportPreview(parsed, existing);
    expect(preview.existsInDb).toBe(1);
    expect(preview.newRows).toBe(1);
  });

  it("flags invalid rows in preview", () => {
    const parsed = parseImportText(`${validA}\nnot-valid\n`);
    const preview = buildImportPreview(parsed, new Set());
    expect(preview.invalidRows).toBe(1);
    expect(preview.validRows).toBe(1);
  });

  it("sanitises CSV formula injection cells", () => {
    expect(sanitizeCsvCell("=1+1")).toBe("'=1+1");
    expect(sanitizeCsvCell("+cmd")).toBe("'+cmd");
    expect(sanitizeCsvCell("safe")).toBe("safe");
  });

  it("exports wallets to CSV with expected columns", () => {
    const wallet: WhitelistWallet = {
      id: "id-1",
      wallet_address: validA,
      wallet_address_normalised: validA,
      status: "confirmed",
      is_active: true,
      wl_spots: 1,
      source: "manual",
      import_batch_id: null,
      internal_notes: null,
      confirmation_method: "manual_check",
      confirmed_at: "2026-01-01T00:00:00Z",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
      created_by: null,
      updated_by: null,
    };

    const csv = walletsToCsv([wallet]);
    expect(csv).toContain("wallet_address");
    expect(csv).toContain(validA);
    expect(csv).toContain("confirmed");
  });
});
