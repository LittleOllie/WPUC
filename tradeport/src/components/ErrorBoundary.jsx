import { Component } from "react";

export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            minHeight: "100vh",
            padding: "2rem 1.5rem",
            background: "#0a0a12",
            color: "#f0f0f8",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          <h1 style={{ fontSize: "1.25rem", marginBottom: "0.75rem" }}>TradePort couldn&apos;t load</h1>
          <p style={{ color: "#8b8ba3", fontSize: "0.9rem", lineHeight: 1.5 }}>
            Try a hard refresh, or open in Safari (not an in-app browser). If this keeps happening, clear
            website data for littleollielabs.com.
          </p>
          <p style={{ marginTop: "1rem", fontSize: "0.75rem", color: "#6b6b80", wordBreak: "break-word" }}>
            {this.state.error?.message}
          </p>
          <a
            href="/tradeport/"
            style={{
              display: "inline-block",
              marginTop: "1.25rem",
              padding: "0.75rem 1.25rem",
              background: "#7c5cff",
              color: "#fff",
              borderRadius: "0.75rem",
              textDecoration: "none",
              fontWeight: 600,
            }}
          >
            Reload TradePort
          </a>
        </div>
      );
    }
    return this.props.children;
  }
}
