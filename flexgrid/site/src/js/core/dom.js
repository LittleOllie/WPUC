/** DOM helpers */

export const $ = (id) => document.getElementById(id);

export function safeText(s) {
  if (s == null) return "";
  return String(s);
}
