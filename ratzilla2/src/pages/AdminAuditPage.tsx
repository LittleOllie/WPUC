import { useEffect, useState } from "react";
import { fetchAuditEvents } from "../features/whitelist/lib/adminApi";
import type { AuditEvent } from "../features/whitelist/lib/types";
import {
  formatDateTime,
  formatEventType,
} from "../features/whitelist/lib/format";
import { shortenWalletAddress } from "../features/whitelist/lib/wallet";

export default function AdminAuditPage() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    document.title = "Audit Log — Blackwater Labs Admin";
  }, []);

  useEffect(() => {
    void fetchAuditEvents(200)
      .then(setEvents)
      .catch(() => setError("Failed to load audit log."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="wl-admin-audit">
      <h1 className="wl-admin__page-title">Audit Log</h1>
      <p className="wl-admin__page-lead">
        Record of whitelist operations and confirmations.
      </p>

      {loading && <p className="wl-admin__loading">Loading…</p>}
      {error && <p className="wl-admin__error">{error}</p>}

      {!loading && !error && (
        <div className="wl-admin__table-wrap">
          <table className="wl-admin__table">
            <thead>
              <tr>
                <th scope="col">Time</th>
                <th scope="col">Event</th>
                <th scope="col">Wallet</th>
                <th scope="col">Source</th>
              </tr>
            </thead>
            <tbody>
              {events.length === 0 ? (
                <tr>
                  <td colSpan={4}>No audit events yet.</td>
                </tr>
              ) : (
                events.map((event) => (
                  <tr key={event.id}>
                    <td>{formatDateTime(event.created_at)}</td>
                    <td>{formatEventType(event.event_type)}</td>
                    <td>
                      {event.wallet_address_snapshot
                        ? shortenWalletAddress(event.wallet_address_snapshot)
                        : "—"}
                    </td>
                    <td>{event.event_source}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
