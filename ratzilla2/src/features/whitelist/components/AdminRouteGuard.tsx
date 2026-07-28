import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAdminAuth } from "../hooks/useAdminAuth";

export default function AdminRouteGuard() {
  const { loading, session, isAdmin, configured } = useAdminAuth();
  const location = useLocation();

  if (!configured) {
    return (
      <div className="wl-admin wl-admin--center">
        <p className="wl-admin__error">
          Admin area requires Supabase configuration. See documentation.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="wl-admin wl-admin--center">
        <p className="wl-admin__loading" role="status">
          Verifying clearance…
        </p>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/admin/login" state={{ from: location.pathname }} replace />;
  }

  if (!isAdmin) {
    return (
      <div className="wl-admin wl-admin--center">
        <p className="wl-admin__error">
          Access denied. This account is not authorised for admin operations.
        </p>
      </div>
    );
  }

  return <Outlet />;
}
