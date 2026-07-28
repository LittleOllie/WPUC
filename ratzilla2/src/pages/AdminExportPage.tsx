import { useEffect, useState } from "react";
import { fetchAllWalletsForExport, fetchImportBatches } from "../features/whitelist/lib/adminApi";
import {
  downloadCsv,
  exportFilename,
  filterWalletsForExport,
  walletsToCsv,
} from "../features/whitelist/lib/csv";
import type { ExportFilter, ImportBatch } from "../features/whitelist/lib/types";

export default function AdminExportPage() {
  const [filter, setFilter] = useState<ExportFilter>("all_active");
  const [batchId, setBatchId] = useState("");
  const [batches, setBatches] = useState<ImportBatch[]>([]);
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    document.title = "Export — Blackwater Labs Admin";
  }, []);

  useEffect(() => {
    void fetchImportBatches().then(setBatches).catch(() => {});
  }, []);

  const runExport = async () => {
    setExporting(true);
    setError("");
    setMessage("");

    try {
      const all = await fetchAllWalletsForExport();
      const filtered = filterWalletsForExport(
        all,
        filter,
        filter === "batch" ? batchId : undefined,
      );

      if (filtered.length === 0) {
        setError("No wallets match this export filter.");
        return;
      }

      const csv = walletsToCsv(filtered);
      downloadCsv(exportFilename(filter), csv);
      setMessage(`Exported ${filtered.length} wallets.`);
    } catch {
      setError("Export failed.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="wl-admin-export">
      <h1 className="wl-admin__page-title">Export Wallets</h1>
      <p className="wl-admin__page-lead">
        Generate CSV exports through the authenticated backend. Sensitive admin
        credentials are never included.
      </p>

      <label className="wl-admin__field-label" htmlFor="export-filter">
        Export filter
      </label>
      <select
        id="export-filter"
        className="wl-admin__field-select"
        value={filter}
        onChange={(e) => setFilter(e.target.value as ExportFilter)}
      >
        <option value="all_active">All active wallets</option>
        <option value="confirmed">Confirmed only</option>
        <option value="unconfirmed">Unconfirmed only</option>
        <option value="needs_review">Needs review</option>
        <option value="removed">Removed / inactive</option>
        <option value="batch">By import batch</option>
      </select>

      {filter === "batch" && (
        <>
          <label className="wl-admin__field-label" htmlFor="export-batch">
            Import batch
          </label>
          <select
            id="export-batch"
            className="wl-admin__field-select"
            value={batchId}
            onChange={(e) => setBatchId(e.target.value)}
          >
            <option value="">Select batch…</option>
            {batches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </>
      )}

      <button
        type="button"
        className="wl-admin__btn wl-admin__btn--primary"
        disabled={exporting || (filter === "batch" && !batchId)}
        onClick={() => void runExport()}
      >
        {exporting ? "Generating…" : "Download CSV"}
      </button>

      {message && <p className="wl-admin__success">{message}</p>}
      {error && <p className="wl-admin__error">{error}</p>}

      <section className="wl-admin__section wl-admin__section--muted">
        <h2 className="wl-admin__section-title">Email Notifications</h2>
        <p className="wl-admin__muted">
          No email provider is configured in this project. To add instant
          confirmation alerts, daily summaries, or import completion emails,
          integrate your preferred provider in{" "}
          <code>src/features/whitelist/lib/notifications.ts</code> and wire
          preferences in the admin dashboard.
        </p>
      </section>
    </div>
  );
}
