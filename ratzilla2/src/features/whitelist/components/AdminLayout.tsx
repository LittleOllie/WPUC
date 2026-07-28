import { Link, NavLink, Outlet } from "react-router-dom";
import { useAdminAuth } from "../hooks/useAdminAuth";

const NAV = [
  { to: "/admin", label: "Dashboard", end: true },
  { to: "/admin/wallets", label: "Wallets", end: false },
  { to: "/admin/import", label: "Import", end: false },
  { to: "/admin/audit", label: "Audit Log", end: false },
  { to: "/admin/export", label: "Export", end: false },
];

export default function AdminLayout() {
  const { user, signOut } = useAdminAuth();

  return (
    <div className="wl-admin">
      <header className="wl-admin__header">
        <div className="wl-admin__brand">
          <Link to="/" className="wl-admin__brand-link">
            BLACKWATER LABS
          </Link>
          <span className="wl-admin__brand-sub">Whitelist Admin</span>
        </div>
        <nav className="wl-admin__nav" aria-label="Admin navigation">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `wl-admin__nav-link${isActive ? " is-active" : ""}`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="wl-admin__user">
          <span className="wl-admin__user-email">{user?.email}</span>
          <button
            type="button"
            className="wl-admin__btn wl-admin__btn--ghost"
            onClick={() => void signOut()}
          >
            Sign Out
          </button>
        </div>
      </header>
      <main className="wl-admin__main">
        <Outlet />
      </main>
    </div>
  );
}
