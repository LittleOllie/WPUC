import { useState, type FormEvent } from "react";
import { createWalletManual } from "../lib/adminApi";
import type { WhitelistWallet } from "../lib/types";
import { sanitizeNotes } from "../lib/sanitize";
import { validateWalletInput } from "../lib/wallet";

interface AddWalletPanelProps {
  onClose: () => void;
  onCreated: () => void;
  onDuplicate: (wallet: WhitelistWallet) => void;
}

export default function AddWalletPanel({
  onClose,
  onCreated,
  onDuplicate,
}: AddWalletPanelProps) {
  const [address, setAddress] = useState("");
  const [spots, setSpots] = useState(1);
  const [source, setSource] = useState("manual");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");

    const validation = validateWalletInput(address);
    if (!validation.valid) {
      setError(validation.error ?? "Invalid address.");
      return;
    }

    setSubmitting(true);
    try {
      const result = await createWalletManual({
        wallet_address: address,
        wl_spots: spots,
        source: source.trim() || "manual",
        internal_notes: sanitizeNotes(notes) || undefined,
      });

      if (result.duplicate && result.wallet) {
        setError("This wallet already exists.");
        onDuplicate(result.wallet);
        return;
      }

      onCreated();
    } catch {
      setError("Failed to add wallet.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="wl-admin__modal-backdrop"
      role="presentation"
      onClick={onClose}
    >
      <form
        className="wl-admin__modal"
        role="dialog"
        aria-labelledby="add-wallet-title"
        onSubmit={(e) => void onSubmit(e)}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="add-wallet-title" className="wl-admin__modal-title">
          Add Wallet
        </h2>

        <label className="wl-admin__field-label" htmlFor="add-wallet-address">
          Wallet address
        </label>
        <input
          id="add-wallet-address"
          className="wl-admin__field-input"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          required
        />

        <label className="wl-admin__field-label" htmlFor="add-wallet-spots">
          Whitelist spots
        </label>
        <input
          id="add-wallet-spots"
          className="wl-admin__field-input"
          type="number"
          min={1}
          value={spots}
          onChange={(e) => setSpots(parseInt(e.target.value, 10) || 1)}
        />

        <label className="wl-admin__field-label" htmlFor="add-wallet-source">
          Source / batch
        </label>
        <input
          id="add-wallet-source"
          className="wl-admin__field-input"
          value={source}
          onChange={(e) => setSource(e.target.value)}
        />

        <label className="wl-admin__field-label" htmlFor="add-wallet-notes">
          Internal notes
        </label>
        <textarea
          id="add-wallet-notes"
          className="wl-admin__field-textarea"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />

        {error && (
          <p className="wl-admin__error" role="alert">
            {error}
          </p>
        )}

        <div className="wl-admin__modal-actions">
          <button
            type="button"
            className="wl-admin__btn wl-admin__btn--ghost"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="wl-admin__btn wl-admin__btn--primary"
            disabled={submitting}
          >
            {submitting ? "Adding…" : "Add Wallet"}
          </button>
        </div>
      </form>
    </div>
  );
}
