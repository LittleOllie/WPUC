import { useCallback, useEffect, useState, type ChangeEvent, type ClipboardEvent, type KeyboardEvent } from "react";
import { normalizeHandleInput, saveHandle } from "../xhandle";
import "./UsernameModal.css";

export type UsernameModalProps = {
  /** Called after a non-blank handle is saved and stored. */
  onSaved: () => void;
  /** Prefill when reopening (e.g. edit). */
  initialHandle?: string;
  /** True when changing an existing saved handle. */
  isEdit?: boolean;
  /** When editing, Escape closes without saving. */
  onCancel?: () => void;
};

export function UsernameModal({ onSaved, initialHandle = "", isEdit = false, onCancel }: UsernameModalProps) {
  const [value, setValue] = useState(() => normalizeHandleInput(initialHandle));

  useEffect(() => {
    setValue(normalizeHandleInput(initialHandle));
  }, [initialHandle]);

  useEffect(() => {
    if (!isEdit || !onCancel) return;
    const onKey: EventListener = (e) => {
      if (!(e instanceof globalThis.KeyboardEvent) || e.key !== "Escape") return;
      e.preventDefault();
      onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isEdit, onCancel]);

  const applyNormalized = useCallback((raw: string) => {
    setValue(normalizeHandleInput(raw));
  }, []);

  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    applyNormalized(e.target.value);
  };

  const onPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text") || "";
    applyNormalized(value + text);
  };

  const canSave = value.trim().length > 0;

  const onSave = () => {
    const h = normalizeHandleInput(value);
    if (!h) return;
    saveHandle(h);
    onSaved();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && canSave) onSave();
  };

  return (
    <div className="username-modal-overlay" role="presentation">
      <div
        className="username-modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="username-modal-title"
      >
        <h2 id="username-modal-title" className="username-modal-title">
          {isEdit ? "Edit your handle" : "Welcome"}
        </h2>
        <p className="username-modal-sub">
          {isEdit
            ? "Update the X handle shown in-game."
            : "Drop Dead Gorgez — set your X handle to play."}
        </p>
        <div className="username-modal-field">
          <input
            className="username-modal-input"
            type="text"
            inputMode="text"
            autoComplete="username"
            maxLength={15}
            placeholder="Enter your X handle"
            value={value}
            onChange={onChange}
            onPaste={onPaste}
            onKeyDown={onKeyDown}
            autoFocus
          />
          <div className="username-modal-meta">{value.length}/15</div>
        </div>
        <div className="username-modal-actions">
          <button type="button" className="username-modal-save" disabled={!canSave} onClick={onSave}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

export { getSavedHandle } from "../xhandle";
