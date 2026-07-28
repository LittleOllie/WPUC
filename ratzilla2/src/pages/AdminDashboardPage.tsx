import { useEffect, useState } from "react";
import {
  fetchRecentActivity,
  getDashboardStats,
} from "../features/whitelist/lib/adminApi";
import type { AuditEvent, DashboardStats } from "../features/whitelist/lib/types";
import {
  formatDateTime,
  formatEventType,
  formatPercent,
} from "../features/whitelist/lib/format";
import { shortenWalletAddress } from "../features/whitelist/lib/wallet";

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activity, setActivity] = useState<AuditEvent[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = "Admin Dashboard — Blackwater Labs";
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [statsData, activityData] = await Promise.all([
          getDashboardStats(),
          fetchRecentActivity(12),
        ]);
        if (!cancelled) {
          setStats(statsData);
          setActivity(activityData);
        }
      } catch {
        if (!cancelled) setError("Failed to load dashboard data.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return <p className="wl-admin__loading">Loading dashboard…</p>;
  }

  if (error || !stats) {
    return <p className="wl-admin__error">{error || "No data available."}</p>;
  }

  const cards = [
    { label: "Active Wallets", value: stats.total_active },
    { label: "Confirmed", value: stats.confirmed },
    { label: "Unconfirmed", value: stats.unconfirmed },
    { label: "Needs Review", value: stats.needs_review },
    { label: "Removed / Inactive", value: stats.removed },
    { label: "Added Manually", value: stats.manual },
    { label: "Confirmed (7 days)", value: stats.recent_confirmed },
    {
      label: "Confirmation Progress",
      value: formatPercent(stats.confirmation_progress),
    },
  ];

  return (
    <div className="wl-admin-dashboard">
      <h1 className="wl-admin__page-title">Dashboard</h1>
      <p className="wl-admin__page-lead">
        {stats.total_active} active wallets · {stats.confirmed} confirmed ·{" "}
        {formatPercent(stats.confirmation_progress)} confirmation progress
      </p>

      <div className="wl-admin__cards">
        {cards.map((card) => (
          <div key={card.label} className="wl-admin__card">
            <span className="wl-admin__card-label">{card.label}</span>
            <span className="wl-admin__card-value">{card.value}</span>
          </div>
        ))}
      </div>

      <section className="wl-admin__section">
        <h2 className="wl-admin__section-title">Recent Activity</h2>
        {activity.length === 0 ? (
          <p className="wl-admin__muted">No recent activity.</p>
        ) : (
          <ul className="wl-admin__activity-list">
            {activity.map((event) => (
              <li key={event.id} className="wl-admin__activity-item">
                <span className="wl-admin__activity-type">
                  {formatEventType(event.event_type)}
                </span>
                {event.wallet_address_snapshot && (
                  <span className="wl-admin__activity-wallet">
                    {shortenWalletAddress(event.wallet_address_snapshot)}
                  </span>
                )}
                <span className="wl-admin__activity-time">
                  {formatDateTime(event.created_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
