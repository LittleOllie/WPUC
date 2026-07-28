import { useEffect, useState, type FormEvent } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { useAdminAuth } from "../features/whitelist/hooks/useAdminAuth";

export default function AdminLoginPage() {
  const { loading, session, isAdmin, configured, signIn } = useAdminAuth();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const from =
    (location.state as { from?: string } | null)?.from ?? "/admin";

  useEffect(() => {
    document.title = "Admin Login — Blackwater Labs";
  }, []);

  if (!configured) {
    return (
      <div className="wl-admin wl-admin--center">
        <p className="wl-admin__error">Supabase is not configured.</p>
        <Link to="/">Return home</Link>
      </div>
    );
  }

  if (!loading && session && isAdmin) {
    return <Navigate to={from} replace />;
  }

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      await signIn(email.trim(), password);
    } catch {
      setError("Invalid credentials or unauthorised account.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="wl-admin wl-admin--login">
      <form className="wl-admin__login-card" onSubmit={(e) => void onSubmit(e)}>
        <p className="wl-admin__login-eyebrow">BLACKWATER LABS</p>
        <h1 className="wl-admin__login-title">Admin Clearance</h1>
        <p className="wl-admin__login-lead">
          Authorised personnel only. All actions are logged.
        </p>

        <label className="wl-admin__field-label" htmlFor="admin-email">
          Email
        </label>
        <input
          id="admin-email"
          className="wl-admin__field-input"
          type="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <label className="wl-admin__field-label" htmlFor="admin-password">
          Password
        </label>
        <input
          id="admin-password"
          className="wl-admin__field-input"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        {error && (
          <p className="wl-admin__login-error" role="alert">
            {error}
          </p>
        )}

        <button
          type="submit"
          className="wl-admin__btn wl-admin__btn--primary"
          disabled={submitting}
        >
          {submitting ? "Signing in…" : "Sign In"}
        </button>

        <p className="wl-admin__login-back">
          <Link to="/">← Return to site</Link>
        </p>
      </form>
    </div>
  );
}
