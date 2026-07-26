/** Username and URL normalisation + validation. */

const USERNAME_RE = /^[A-Za-z0-9_]{1,15}$/;

export interface NormaliseResult {
  ok: true;
  username: string;
}

export interface NormaliseError {
  ok: false;
  reason: string;
}

export type NormaliseUsernameResult = NormaliseResult | NormaliseError;

function stripQueryAndHash(path: string): string {
  return path.split(/[?#]/)[0] ?? path;
}

export function normaliseUsername(input: string): NormaliseUsernameResult {
  let raw = String(input ?? "").trim();
  if (!raw) return { ok: false, reason: "Username cannot be blank." };

  try {
    if (/^https?:\/\//i.test(raw)) {
      const url = new URL(raw);
      const host = url.hostname.toLowerCase();
      if (!["x.com", "twitter.com", "www.x.com", "www.twitter.com", "mobile.twitter.com"].includes(host)) {
        return { ok: false, reason: "Please enter an X profile URL or username, not an arbitrary link." };
      }
      const parts = stripQueryAndHash(url.pathname).split("/").filter(Boolean);
      if (parts.length === 0 || parts[0] === "home" || parts[0] === "search") {
        return { ok: false, reason: "Could not find a username in that URL." };
      }
      raw = parts[0]!;
    }
  } catch {
    return { ok: false, reason: "That URL does not look valid." };
  }

  raw = raw.replace(/^@+/, "").trim();
  raw = stripQueryAndHash(raw).replace(/\/+$/, "");

  if (raw.includes("/") || raw.includes("\\") || raw.includes("..")) {
    return { ok: false, reason: "Username cannot contain path characters." };
  }

  if (!USERNAME_RE.test(raw)) {
    return {
      ok: false,
      reason: "Usernames may only contain letters, numbers and underscores (max 15 characters).",
    };
  }

  return { ok: true, username: raw };
}

export function profileUrlForUsername(username: string): string {
  return `https://x.com/${username}`;
}

/** Strip HTML-like content from user-facing strings. */
export function sanitiseDisplayText(text: string, maxLen = 280): string {
  return String(text ?? "")
    .replace(/[<>&"']/g, "")
    .slice(0, maxLen)
    .trim();
}
