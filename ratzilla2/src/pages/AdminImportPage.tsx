import { useEffect, useState, type ChangeEvent } from "react";
import {
  bulkImportWallets,
  fetchAllNormalisedAddresses,
} from "../features/whitelist/lib/adminApi";
import {
  buildImportPreview,
  getImportLimits,
  parseImportText,
} from "../features/whitelist/lib/csv";
import type { ImportPreviewSummary } from "../features/whitelist/lib/types";

export default function AdminImportPage() {
  const [text, setText] = useState("");
  const [batchName, setBatchName] = useState("Original WL Import");
  const [preview, setPreview] = useState<ImportPreviewSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<string>("");
  const [error, setError] = useState("");
  const limits = getImportLimits();

  useEffect(() => {
    document.title = "Import — Blackwater Labs Admin";
  }, []);

  const runPreview = async () => {
    setError("");
    setResult("");
    setLoading(true);

    try {
      const parsed = parseImportText(text);
      if (parsed.rows.length === 0) {
        setError("No wallet rows detected.");
        setPreview(null);
        return;
      }

      if (parsed.rows.length > limits.maxRows) {
        setError(`Import exceeds maximum of ${limits.maxRows} rows.`);
        setPreview(null);
        return;
      }

      const existing = await fetchAllNormalisedAddresses();
      setPreview(buildImportPreview(parsed, existing));
    } catch {
      setError("Preview failed.");
      setPreview(null);
    } finally {
      setLoading(false);
    }
  };

  const runImport = async () => {
    if (!preview) return;

    setImporting(true);
    setError("");
    setResult("");

    try {
      const rows = preview.rows
        .filter((r) => r.valid && !r.duplicateInFile && !r.existsInDb)
        .map((r) => ({
          address: r.address!,
          wl_spots: r.wl_spots,
          source: r.source,
          notes: r.notes,
        }));

      const summary = await bulkImportWallets(batchName.trim() || "Import", rows, {
        defaultSource: batchName.trim() || "Import",
      });

      setResult(
        `Import complete: ${summary.imported} added, ${summary.skipped} skipped.`,
      );
      setPreview(null);
      setText("");
    } catch {
      setError("Import failed. No partial commit — please retry.");
    } finally {
      setImporting(false);
    }
  };

  const onFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > limits.maxFileBytes) {
      setError(`File exceeds ${limits.maxFileBytes / 1024 / 1024}MB limit.`);
      return;
    }

    const content = await file.text();
    setText(content);
    setPreview(null);
    setResult("");
  };

  return (
    <div className="wl-admin-import">
      <h1 className="wl-admin__page-title">Bulk Import</h1>
      <p className="wl-admin__page-lead">
        Upload CSV or paste one wallet address per line. Preview before committing.
      </p>

      <label className="wl-admin__field-label" htmlFor="import-batch">
        Import batch name
      </label>
      <input
        id="import-batch"
        className="wl-admin__field-input"
        value={batchName}
        onChange={(e) => setBatchName(e.target.value)}
      />

      <label className="wl-admin__field-label" htmlFor="import-file">
        CSV file
      </label>
      <input
        id="import-file"
        type="file"
        accept=".csv,.txt,text/csv,text/plain"
        onChange={(e) => void onFileChange(e)}
      />

      <label className="wl-admin__field-label" htmlFor="import-text">
        Paste wallets
      </label>
      <textarea
        id="import-text"
        className="wl-admin__field-textarea wl-admin__field-textarea--large"
        rows={12}
        placeholder="0xabc…&#10;0xdef…"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setPreview(null);
        }}
      />

      <div className="wl-admin__modal-actions">
        <button
          type="button"
          className="wl-admin__btn wl-admin__btn--ghost"
          disabled={loading || !text.trim()}
          onClick={() => void runPreview()}
        >
          {loading ? "Analysing…" : "Preview Import"}
        </button>
        <button
          type="button"
          className="wl-admin__btn wl-admin__btn--primary"
          disabled={importing || !preview || preview.newRows === 0}
          onClick={() => void runImport()}
        >
          {importing ? "Importing…" : `Commit ${preview?.newRows ?? 0} Wallets`}
        </button>
      </div>

      {error && <p className="wl-admin__error">{error}</p>}
      {result && <p className="wl-admin__success">{result}</p>}

      {preview && (
        <div className="wl-admin__preview">
          <h2 className="wl-admin__section-title">Preview Summary</h2>
          <ul className="wl-admin__preview-stats">
            <li>Total rows: {preview.totalRows}</li>
            <li>Valid: {preview.validRows}</li>
            <li>Invalid: {preview.invalidRows}</li>
            <li>Duplicates in file: {preview.duplicateInFile}</li>
            <li>Already in database: {preview.existsInDb}</li>
            <li>New to add: {preview.newRows}</li>
            <li>Requires review: {preview.needsReview}</li>
          </ul>

          {preview.invalidRows > 0 && (
            <details className="wl-admin__preview-details">
              <summary>Invalid rows</summary>
              <ul>
                {preview.rows
                  .filter((r) => !r.valid)
                  .slice(0, 20)
                  .map((r) => (
                    <li key={r.line}>
                      Line {r.line}: {r.raw}
                    </li>
                  ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
