import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  filterHandleInput,
  MAX_HANDLE_LENGTH,
  normalizeHandle,
} from "../handleStorage";
import "./UsernameModal.css";

type Props = {
  open: boolean;
  mode: "welcome" | "edit";
  initialValue: string;
  onSave: (normalized: string) => void;
  onClose: () => void;
};

export function UsernameModal({ open, mode, initialValue, onSave, onClose }: Props) {
  const titleId = useId();
  const descId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const lastFocusRef = useRef<HTMLElement | null>(null);
  const [value, setValue] = useState(initialValue);

  const required = mode === "welcome";

  useEffect(() => {
    if (open) {
      lastFocusRef.current = document.activeElement as HTMLElement;
      setValue(initialValue);
      document.body.classList.add("modal-scroll-lock");
      requestAnimationFrame(() => inputRef.current?.focus());
    } else {
      document.body.classList.remove("modal-scroll-lock");
      lastFocusRef.current?.focus?.();
    }
    return () => {
      document.body.classList.remove("modal-scroll-lock");
    };
  }, [open, initialValue]);

  const normalized = normalizeHandle(value);
  const canSave = normalized.length > 0;

  const save = useCallback(() => {
    if (!canSave) return;
    onSave(normalized);
  }, [canSave, normalized, onSave]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" && canSave) {
        e.preventDefault();
        save();
      }
      if (e.key === "Escape" && !required) {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, canSave, required, save, onClose]);

  if (!open) return null;

  return (
    <div
      className="username-modal-overlay"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !required) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="username-modal"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 id={titleId} className="username-modal-title">
          {mode === "welcome" ? "Welcome" : "Edit your handle"}
        </h2>
        <p id={descId} className="username-modal-desc">
          Choose your X (Twitter) handle. It is stored on this device only and is not sent to any
          server.
        </p>
        <label htmlFor="frappy-x-handle-input" className="username-modal-label">
          X handle
        </label>
        <div className="username-modal-input-wrap">
          <input
            ref={inputRef}
            id="frappy-x-handle-input"
            className="username-modal-input"
            type="text"
            autoComplete="username"
            inputMode="text"
            maxLength={MAX_HANDLE_LENGTH}
            placeholder="yourhandle"
            value={value}
            onChange={(e) => setValue(filterHandleInput(e.target.value))}
          />
        </div>
        <p
          className={`username-modal-count${
            normalized.length >= MAX_HANDLE_LENGTH ? " username-modal-count--warn" : ""
          }`}
          aria-live="polite"
        >
          {normalized.length}/{MAX_HANDLE_LENGTH}
        </p>
        <div className="username-modal-actions">
          {!required ? (
            <button type="button" className="username-modal-btn username-modal-btn--ghost" onClick={onClose}>
              Cancel
            </button>
          ) : null}
          <button
            type="button"
            className="username-modal-btn username-modal-btn--primary"
            disabled={!canSave}
            onClick={save}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
