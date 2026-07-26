/**
 * Central error logging + optional user toasts.
 */

import { $ } from "./dom.js";
import { escapeHtml } from "./escapeHtml.js";
import { DEV, SHOW_ERROR_PANEL } from "./constants.js";
import { showToast, userMessageForError } from "../ui/notifications.js";

export const errorLog = {
  errors: [],
  maxErrors: 50,
  imageErrorCount: 0,
  imageErrorThrottleMax: 3,
};

/**
 * @param {unknown} error
 * @param {string} [context]
 * @param {{ userToast?: boolean, toastLevel?: "info"|"warn"|"error" }} [opts]
 */
export function addError(error, context = "", opts = {}) {
  const timestamp = new Date().toLocaleTimeString();
  const message = error?.message || String(error);
  const errorEntry = {
    timestamp,
    message,
    context,
    stack: error?.stack,
    fullError: error,
  };

  errorLog.errors.unshift(errorEntry);
  if (errorLog.errors.length > errorLog.maxErrors) {
    errorLog.errors = errorLog.errors.slice(0, errorLog.maxErrors);
  }

  if (DEV) {
    console.warn("[FlexGrid]", context || "Error", error);
  }

  updateErrorLogDisplay();

  const showUserToast = opts.userToast === true;
  if (showUserToast) {
    const userMsg = userMessageForError(error, context);
    const level = opts.toastLevel || "error";
    showToast(userMsg, level, { dedupeKey: `${context}:${userMsg}` });
  }
}

export function updateErrorLogDisplay() {
  const errorLogEl = $("errorLog");
  const errorLogContent = $("errorLogContent");

  if (!SHOW_ERROR_PANEL) {
    if (errorLogEl) errorLogEl.style.display = "none";
    return;
  }

  if (!errorLogEl || !errorLogContent) return;

  if (errorLog.errors.length === 0) {
    errorLogEl.style.display = "none";
    return;
  }

  errorLogEl.style.display = "block";
  errorLogContent.innerHTML = errorLog.errors
    .map((err) => {
      const contextText = err.context
        ? ` <span style="opacity: 0.7;">[${escapeHtml(err.context)}]</span>`
        : "";
      const stackText =
        err.stack && DEV
          ? `<div style="margin-top: 4px; padding-left: 12px; opacity: 0.6; font-size: 13px;">${err.stack
              .split("\n")
              .slice(0, 3)
              .map((line) => escapeHtml(line))
              .join("<br>")}</div>`
          : "";
      return `
      <div style="padding: 6px 0; border-bottom: 1px solid rgba(244, 67, 54, 0.2);">
        <div style="color: #f44336; font-weight: 700;">
          <span style="opacity: 0.7; font-size: 13px;">[${escapeHtml(err.timestamp)}]</span>${contextText}
        </div>
        <div style="margin-top: 2px; color: #ffcdd2;">${escapeHtml(err.message)}</div>
        ${stackText}
      </div>
    `;
    })
    .join("");
}

export function clearErrorLog() {
  errorLog.errors = [];
  updateErrorLogDisplay();
}
