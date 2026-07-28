export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

export function formatEventType(eventType: string): string {
  return eventType
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function statusLabel(status: string): string {
  switch (status) {
    case "unconfirmed":
      return "Unconfirmed";
    case "confirmed":
      return "Confirmed";
    case "needs_review":
      return "Needs Review";
    case "removed":
      return "Removed";
    default:
      return status;
  }
}

export function confirmationMethodLabel(method: string | null): string {
  if (!method) return "—";
  switch (method) {
    case "manual_check":
      return "Manual Check";
    case "wallet_signature":
      return "Wallet Signature";
    case "admin":
      return "Admin";
    default:
      return method;
  }
}
