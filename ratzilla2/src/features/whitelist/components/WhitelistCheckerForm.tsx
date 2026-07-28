import {
  useCallback,
  useId,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { Link } from "react-router-dom";
import { checkWalletPublic, confirmWalletPublic } from "../lib/publicApi";
import type { PublicLookupFound } from "../lib/types";
import { shortenWalletAddress, validateWalletInput } from "../lib/wallet";
import { isSupabaseConfigured } from "../lib/supabase";

type CheckerPhase =
  | "idle"
  | "loading"
  | "found"
  | "not_found"
  | "invalid"
  | "error"
  | "rate_limited"
  | "confirming"
  | "confirmed"
  | "already_confirmed";

export default function WhitelistCheckerForm() {
  const inputId = useId();
  const statusId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [address, setAddress] = useState("");
  const [phase, setPhase] = useState<CheckerPhase>("idle");
  const [foundWallet, setFoundWallet] = useState<PublicLookupFound | null>(
    null,
  );
  const [statusMessage, setStatusMessage] = useState("");

  const configured = isSupabaseConfigured();

  const runCheck = useCallback(async () => {
    const validation = validateWalletInput(address);
    if (!validation.valid) {
      setPhase("invalid");
      setStatusMessage(validation.error ?? "Invalid address.");
      setFoundWallet(null);
      return;
    }

    setPhase("loading");
    setStatusMessage("Searching whitelist records…");
    setFoundWallet(null);

    try {
      const result = await checkWalletPublic(address);

      if (result.outcome === "invalid_address") {
        setPhase("invalid");
        setStatusMessage("Enter a valid EVM wallet address.");
      } else if (result.outcome === "not_found") {
        setPhase("not_found");
        setStatusMessage(
          "This wallet is not currently on the whitelist. Check the spelling or try the address you originally submitted.",
        );
      } else if (result.outcome === "rate_limited") {
        setPhase("rate_limited");
        setStatusMessage(
          "Too many requests. Please wait a moment and try again.",
        );
      } else if (result.outcome === "error") {
        setPhase("error");
        setStatusMessage(
          "Unable to check whitelist right now. Please try again shortly.",
        );
      } else if (result.outcome === "found") {
        setFoundWallet(result);
        if (result.confirmed) {
          setPhase("already_confirmed");
          setStatusMessage("This wallet is on the whitelist and already confirmed.");
        } else {
          setPhase("found");
          setStatusMessage("Whitelist place found. Confirm when ready.");
        }
      }
    } catch {
      setPhase("error");
      setStatusMessage("Network error. Check your connection and try again.");
    }
  }, [address]);

  const runConfirm = useCallback(async () => {
    setPhase("confirming");
    setStatusMessage("Recording confirmation…");

    try {
      const result = await confirmWalletPublic(address);

      if (result.outcome === "confirmed") {
        setPhase("confirmed");
        setStatusMessage(
          "Wallet confirmed. Thank you — your whitelist place has been marked as confirmed by you.",
        );
      } else if (result.outcome === "already_confirmed") {
        setPhase("already_confirmed");
        setStatusMessage("This wallet was already confirmed.");
      } else if (result.outcome === "not_found") {
        setPhase("not_found");
        setStatusMessage("Wallet not found on the whitelist.");
      } else if (result.outcome === "rate_limited") {
        setPhase("rate_limited");
        setStatusMessage("Too many confirmation attempts. Please wait.");
      } else {
        setPhase("error");
        setStatusMessage("Confirmation failed. Please try again.");
      }
    } catch {
      setPhase("error");
      setStatusMessage("Network error during confirmation.");
    }
  }, [address]);

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    void runCheck();
  };

  const onInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      void runCheck();
    }
  };

  const showConfirmButton =
    foundWallet !== null &&
    !foundWallet.confirmed &&
    (phase === "found" || phase === "confirming");

  if (!configured) {
    return (
      <div className="wl-checker__panel">
        <p className="wl-checker__status wl-checker__status--error" role="alert">
          Whitelist checker is not yet configured for this environment.
        </p>
      </div>
    );
  }

  return (
    <div className="wl-checker">
      <form className="wl-checker__form" onSubmit={onSubmit} noValidate>
        <label className="wl-checker__label" htmlFor={inputId}>
          Wallet address
        </label>
        <input
          ref={inputRef}
          id={inputId}
          className="wl-checker__input"
          type="text"
          inputMode="text"
          autoComplete="off"
          spellCheck={false}
          placeholder="0x…"
          value={address}
          onChange={(e) => {
            setAddress(e.target.value);
            if (phase !== "idle" && phase !== "loading") {
              setPhase("idle");
              setStatusMessage("");
            }
          }}
          onKeyDown={onInputKeyDown}
          aria-describedby={statusMessage ? statusId : undefined}
          aria-invalid={phase === "invalid"}
          disabled={phase === "loading" || phase === "confirming"}
        />

        <div className="wl-checker__actions">
          <button
            type="submit"
            className="wl-checker__btn wl-checker__btn--primary"
            disabled={phase === "loading" || phase === "confirming" || !address.trim()}
          >
            {phase === "loading" ? "Checking…" : "Check Whitelist"}
          </button>

          {showConfirmButton && (
            <button
              type="button"
              className="wl-checker__btn wl-checker__btn--confirm"
              disabled={phase === "confirming"}
              onClick={() => void runConfirm()}
            >
              {phase === "confirming" ? "Confirming…" : "Confirm This Wallet"}
            </button>
          )}
        </div>
      </form>

      {statusMessage && (
        <div
          id={statusId}
          className={`wl-checker__status wl-checker__status--${phase}`}
          role="status"
          aria-live="polite"
        >
          {statusMessage}
        </div>
      )}

      {foundWallet && (phase === "found" || phase === "already_confirmed" || phase === "confirmed") && (
        <div className="wl-checker__result" aria-label="Whitelist result">
          <div className="wl-checker__result-row">
            <span className="wl-checker__result-label">Address</span>
            <span className="wl-checker__result-value">
              {shortenWalletAddress(foundWallet.wallet_address)}
            </span>
          </div>
          <div className="wl-checker__result-row">
            <span className="wl-checker__result-label">Status</span>
            <span className="wl-checker__result-value">
              {foundWallet.confirmed || phase === "confirmed"
                ? "Confirmed"
                : "Awaiting confirmation"}
            </span>
          </div>
          <div className="wl-checker__result-row">
            <span className="wl-checker__result-label">Spots</span>
            <span className="wl-checker__result-value">{foundWallet.wl_spots}</span>
          </div>
        </div>
      )}

      <p className="wl-checker__disclaimer">
        Confirmation records that you have acknowledged this wallet on the whitelist.
        It does not cryptographically verify wallet ownership.
      </p>

      <p className="wl-checker__back">
        <Link to="/">← Return to Blackwater Labs</Link>
      </p>
    </div>
  );
}
