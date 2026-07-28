import { useCallback, useEffect, useState } from "react";
import {
  copyToClipboard,
  fetchDistinctSources,
  fetchAuditEvents,
  fetchImportBatches,
  fetchWalletById,
  fetchWallets,
  removeWallet,
  resetConfirmation,
  restoreWallet,
  updateWallet,
} from "../features/whitelist/lib/adminApi";
import type {
  AuditEvent,
  ImportBatch,
  WalletFilters,
  WalletStatus,
  WhitelistWallet,
} from "../features/whitelist/lib/types";
import {
  confirmationMethodLabel,
  formatDateTime,
  formatEventType,
  statusLabel,
} from "../features/whitelist/lib/format";
import { sanitizeNotes } from "../features/whitelist/lib/sanitize";
import { shortenWalletAddress } from "../features/whitelist/lib/wallet";
import AddWalletPanel from "../features/whitelist/components/AddWalletPanel";

const PAGE_SIZE = 25;

export default function AdminWalletsPage() {
  const [wallets, setWallets] = useState<WhitelistWallet[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState<WalletFilters>({
    page: 1,
    pageSize: PAGE_SIZE,
    sortBy: "created_at",
    sortDir: "desc",
    status: "all",
    activeState: "all",
  });
  const [sources, setSources] = useState<string[]>([]);
  const [batches, setBatches] = useState<ImportBatch[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<WhitelistWallet | null>(null);
  const [detailAudit, setDetailAudit] = useState<AuditEvent[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadWallets = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await fetchWallets(filters);
      setWallets(result.wallets);
      setTotal(result.total);
    } catch {
      setError("Failed to load wallets.");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    document.title = "Wallets — Blackwater Labs Admin";
  }, []);

  useEffect(() => {
    void loadWallets();
  }, [loadWallets]);

  useEffect(() => {
    void fetchDistinctSources().then(setSources).catch(() => {});
    void fetchImportBatches().then(setBatches).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      setDetailAudit([]);
      return;
    }
    void fetchWalletById(selectedId).then(setDetail);
    void fetchAuditEvents(50, selectedId).then(setDetailAudit);
  }, [selectedId]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const handleCopy = async (wallet: WhitelistWallet) => {
    const ok = await copyToClipboard(wallet.wallet_address);
    if (ok) {
      setCopiedId(wallet.id);
      window.setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const handleStatusChange = async (status: WalletStatus) => {
    if (!detail) return;
    if (
      !window.confirm(`Change status to "${statusLabel(status)}"?`)
    ) {
      return;
    }
    const updated = await updateWallet(detail.id, { status }, "status_changed");
    setDetail(updated);
    void loadWallets();
  };

  const handleSaveNotes = async (notes: string) => {
    if (!detail) return;
    const updated = await updateWallet(detail.id, {
      internal_notes: sanitizeNotes(notes),
    });
    setDetail(updated);
  };

  const handleSpotsChange = async (spots: number) => {
    if (!detail || spots < 1) return;
    const updated = await updateWallet(detail.id, { wl_spots: spots });
    setDetail(updated);
    void loadWallets();
  };

  return (
    <div className="wl-admin-wallets">
      <div className="wl-admin__page-header">
        <div>
          <h1 className="wl-admin__page-title">Wallet Management</h1>
          <p className="wl-admin__page-lead">{total} records matching filters</p>
        </div>
        <button
          type="button"
          className="wl-admin__btn wl-admin__btn--primary"
          onClick={() => setShowAdd(true)}
        >
          Add Wallet
        </button>
      </div>

      <div className="wl-admin__filters">
        <input
          className="wl-admin__field-input"
          type="search"
          placeholder="Search wallet address…"
          value={filters.search ?? ""}
          onChange={(e) =>
            setFilters((f) => ({ ...f, search: e.target.value, page: 1 }))
          }
          aria-label="Search wallet address"
        />
        <select
          className="wl-admin__field-select"
          value={filters.status ?? "all"}
          onChange={(e) =>
            setFilters((f) => ({
              ...f,
              status: e.target.value as WalletFilters["status"],
              page: 1,
            }))
          }
          aria-label="Filter by status"
        >
          <option value="all">All statuses</option>
          <option value="unconfirmed">Unconfirmed</option>
          <option value="confirmed">Confirmed</option>
          <option value="needs_review">Needs review</option>
          <option value="removed">Removed</option>
        </select>
        <select
          className="wl-admin__field-select"
          value={filters.activeState ?? "all"}
          onChange={(e) =>
            setFilters((f) => ({
              ...f,
              activeState: e.target.value as WalletFilters["activeState"],
              page: 1,
            }))
          }
          aria-label="Filter by active state"
        >
          <option value="all">All active states</option>
          <option value="active">Active only</option>
          <option value="inactive">Inactive / removed</option>
        </select>
        <select
          className="wl-admin__field-select"
          value={filters.source ?? ""}
          onChange={(e) =>
            setFilters((f) => ({
              ...f,
              source: e.target.value || undefined,
              page: 1,
            }))
          }
          aria-label="Filter by source"
        >
          <option value="">All sources</option>
          {sources.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          className="wl-admin__field-select"
          value={filters.batchId ?? ""}
          onChange={(e) =>
            setFilters((f) => ({
              ...f,
              batchId: e.target.value || undefined,
              page: 1,
            }))
          }
          aria-label="Filter by import batch"
        >
          <option value="">All batches</option>
          {batches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <select
          className="wl-admin__field-select"
          value={`${filters.sortBy}-${filters.sortDir}`}
          onChange={(e) => {
            const [sortBy, sortDir] = e.target.value.split("-") as [
              WalletFilters["sortBy"],
              WalletFilters["sortDir"],
            ];
            setFilters((f) => ({ ...f, sortBy, sortDir }));
          }}
          aria-label="Sort wallets"
        >
          <option value="created_at-desc">Recently added</option>
          <option value="confirmed_at-desc">Recently confirmed</option>
          <option value="updated_at-desc">Recently updated</option>
        </select>
      </div>

      {error && <p className="wl-admin__error">{error}</p>}

      <div className="wl-admin__table-wrap">
        <table className="wl-admin__table">
          <thead>
            <tr>
              <th scope="col">Wallet</th>
              <th scope="col">Status</th>
              <th scope="col">Method</th>
              <th scope="col">Source</th>
              <th scope="col">Spots</th>
              <th scope="col">Added</th>
              <th scope="col">Confirmed</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8}>Loading…</td>
              </tr>
            ) : wallets.length === 0 ? (
              <tr>
                <td colSpan={8}>No wallets found.</td>
              </tr>
            ) : (
              wallets.map((wallet) => (
                <tr key={wallet.id}>
                  <td>
                    <code>{shortenWalletAddress(wallet.wallet_address)}</code>
                  </td>
                  <td>{statusLabel(wallet.status)}</td>
                  <td>{confirmationMethodLabel(wallet.confirmation_method)}</td>
                  <td>{wallet.source ?? "—"}</td>
                  <td>{wallet.wl_spots}</td>
                  <td>{formatDateTime(wallet.created_at)}</td>
                  <td>{formatDateTime(wallet.confirmed_at)}</td>
                  <td className="wl-admin__table-actions">
                    <button
                      type="button"
                      className="wl-admin__btn wl-admin__btn--ghost"
                      onClick={() => setSelectedId(wallet.id)}
                    >
                      View
                    </button>
                    <button
                      type="button"
                      className="wl-admin__btn wl-admin__btn--ghost"
                      onClick={() => void handleCopy(wallet)}
                    >
                      {copiedId === wallet.id ? "Copied" : "Copy"}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="wl-admin__pagination">
        <button
          type="button"
          className="wl-admin__btn wl-admin__btn--ghost"
          disabled={(filters.page ?? 1) <= 1}
          onClick={() =>
            setFilters((f) => ({ ...f, page: Math.max(1, (f.page ?? 1) - 1) }))
          }
        >
          Previous
        </button>
        <span>
          Page {filters.page ?? 1} of {totalPages}
        </span>
        <button
          type="button"
          className="wl-admin__btn wl-admin__btn--ghost"
          disabled={(filters.page ?? 1) >= totalPages}
          onClick={() =>
            setFilters((f) => ({
              ...f,
              page: Math.min(totalPages, (f.page ?? 1) + 1),
            }))
          }
        >
          Next
        </button>
      </div>

      {showAdd && (
        <AddWalletPanel
          onClose={() => setShowAdd(false)}
          onCreated={() => {
            setShowAdd(false);
            void loadWallets();
          }}
          onDuplicate={(wallet) => {
            setShowAdd(false);
            setSelectedId(wallet.id);
          }}
        />
      )}

      {detail && (
        <div
          className="wl-admin__modal-backdrop"
          role="presentation"
          onClick={() => setSelectedId(null)}
        >
          <div
            className="wl-admin__modal"
            role="dialog"
            aria-labelledby="wallet-detail-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="wallet-detail-title" className="wl-admin__modal-title">
              Wallet Details
            </h2>
            <dl className="wl-admin__detail-list">
              <dt>Address</dt>
              <dd>
                <code>{detail.wallet_address}</code>
              </dd>
              <dt>Status</dt>
              <dd>{statusLabel(detail.status)}</dd>
              <dt>Active</dt>
              <dd>{detail.is_active ? "Yes" : "No"}</dd>
              <dt>Spots</dt>
              <dd>
                <input
                  type="number"
                  min={1}
                  className="wl-admin__field-input wl-admin__field-input--small"
                  value={detail.wl_spots}
                  onChange={(e) =>
                    void handleSpotsChange(parseInt(e.target.value, 10))
                  }
                />
              </dd>
              <dt>Source</dt>
              <dd>{detail.source ?? "—"}</dd>
              <dt>Added</dt>
              <dd>{formatDateTime(detail.created_at)}</dd>
              <dt>Confirmed</dt>
              <dd>{formatDateTime(detail.confirmed_at)}</dd>
              <dt>Method</dt>
              <dd>{confirmationMethodLabel(detail.confirmation_method)}</dd>
              <dt>Notes</dt>
              <dd>
                <textarea
                  className="wl-admin__field-textarea"
                  rows={4}
                  defaultValue={detail.internal_notes ?? ""}
                  onBlur={(e) => void handleSaveNotes(e.target.value)}
                />
              </dd>
            </dl>

            {detailAudit.length > 0 && (
              <div className="wl-admin__section">
                <h3 className="wl-admin__section-title">Audit History</h3>
                <ul className="wl-admin__activity-list">
                  {detailAudit.map((event) => (
                    <li key={event.id} className="wl-admin__activity-item">
                      <span>{formatEventType(event.event_type)}</span>
                      <span className="wl-admin__activity-time">
                        {formatDateTime(event.created_at)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="wl-admin__modal-actions">
              <button
                type="button"
                className="wl-admin__btn wl-admin__btn--ghost"
                onClick={() => void handleStatusChange("needs_review")}
              >
                Mark Review
              </button>
              {detail.status !== "confirmed" && detail.is_active && (
                <button
                  type="button"
                  className="wl-admin__btn wl-admin__btn--ghost"
                  onClick={() => {
                    if (window.confirm("Confirm this wallet as admin?")) {
                      void updateWallet(
                        detail.id,
                        {
                          status: "confirmed",
                          confirmation_method: "admin",
                          confirmed_at: new Date().toISOString(),
                        },
                        "wallet_confirmed_admin",
                      ).then((w) => {
                        setDetail(w);
                        void loadWallets();
                      });
                    }
                  }}
                >
                  Confirm (Admin)
                </button>
              )}
              {detail.status === "removed" ? (
                <button
                  type="button"
                  className="wl-admin__btn wl-admin__btn--ghost"
                  onClick={() => {
                    if (window.confirm("Restore this wallet?")) {
                      void restoreWallet(detail.id).then((w) => {
                        setDetail(w);
                        void loadWallets();
                      });
                    }
                  }}
                >
                  Restore
                </button>
              ) : (
                <button
                  type="button"
                  className="wl-admin__btn wl-admin__btn--danger"
                  onClick={() => {
                    if (window.confirm("Remove/deactivate this wallet?")) {
                      void removeWallet(detail.id).then((w) => {
                        setDetail(w);
                        void loadWallets();
                      });
                    }
                  }}
                >
                  Remove
                </button>
              )}
              {detail.status === "confirmed" && (
                <button
                  type="button"
                  className="wl-admin__btn wl-admin__btn--ghost"
                  onClick={() => {
                    if (
                      window.confirm(
                        "Reset confirmation? This requires a deliberate admin action.",
                      )
                    ) {
                      void resetConfirmation(detail.id).then((w) => {
                        setDetail(w);
                        void loadWallets();
                      });
                    }
                  }}
                >
                  Reset Confirmation
                </button>
              )}
              <button
                type="button"
                className="wl-admin__btn wl-admin__btn--primary"
                onClick={() => setSelectedId(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
