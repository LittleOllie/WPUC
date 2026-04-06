import { useEffect, useId, useRef } from "react";
import { assetUrl } from "../config/site";
import "./HowToPlayModal.css";

type Props = {
  open: boolean;
  onClose: () => void;
};

export function HowToPlayModal({ open, onClose }: Props) {
  const titleId = useId();
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const lastFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (open) {
      lastFocusRef.current = document.activeElement as HTMLElement;
      document.body.classList.add("modal-scroll-lock");
      requestAnimationFrame(() => closeBtnRef.current?.focus());
    } else {
      document.body.classList.remove("modal-scroll-lock");
      lastFocusRef.current?.focus?.();
    }
    return () => {
      document.body.classList.remove("modal-scroll-lock");
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const bg = assetUrl("assets/bg0.png");
  const player = assetUrl("assets/player.png");
  const bean = assetUrl("assets/bean.png");
  const beanGold = assetUrl("assets/bean_golden.png");
  const cupRed = assetUrl("assets/cup_red.png");

  return (
    <div
      className="howto-overlay"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="howto-dialog"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="howto-header">
          <h2 id={titleId} className="howto-title">
            How to play
          </h2>
          <button
            ref={closeBtnRef}
            type="button"
            className="howto-close"
            aria-label="Close"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <div className="howto-body">
          <div className="howto-hero">
            <div
              className="howto-hero-bg"
              style={{ backgroundImage: `url(${bg})` }}
              aria-hidden
            />
            <div className="howto-hero-player">
              <img src={player} alt="" width={120} height={120} />
            </div>
          </div>

          <section className="howto-section">
            <h3>Controls</h3>
            <p>Tap, click, or press Space to flap. Stay in the gap between the steel pillars and keep moving forward.</p>
          </section>

          <section className="howto-section">
            <h3>Scoring</h3>
            <p>
              You earn points by passing pillars and collecting pickups. Your best run is saved in the browser on this
              device.
            </p>
          </section>

          <section className="howto-section">
            <h3>Collect</h3>
            <div className="howto-row">
              <img src={bean} alt="" width={48} height={48} />
              <div className="howto-row-text">
                <strong>Bubble</strong>
                <span>Worth points and counts toward your bubble total.</span>
              </div>
            </div>
            <div className="howto-row">
              <img src={beanGold} alt="" width={48} height={48} />
              <div className="howto-row-text">
                <strong>Golden bubble</strong>
                <span>Extra points and grants one shield hit — the next hazard consumes the shield instead of ending your run.</span>
              </div>
            </div>
            <div className="howto-row">
              <img src={cupRed} alt="" width={48} height={48} />
              <div className="howto-row-text">
                <strong>Red fish</strong>
                <span>Big score bonus — grab it when you can.</span>
              </div>
            </div>
          </section>

          <section className="howto-section">
            <h3>Shield</h3>
            <p>Pick up a golden bubble to gain a shield. The next mine hit uses the shield instead of ending the game.</p>
          </section>

          <section className="howto-section">
            <h3>Avoid</h3>
            <div className="howto-row">
              <div className="howto-mine" aria-hidden>
                <div className="howto-mine-visual">
                  <div className="howto-mine-body" />
                </div>
              </div>
              <div className="howto-row-text">
                <strong>Underwater mine</strong>
                <span>Explodes on contact. With no shield, it is game over.</span>
              </div>
            </div>
            <div className="howto-row">
              <div className="howto-pillar-thumb" aria-hidden />
              <div className="howto-row-text">
                <strong>Steel pillar</strong>
                <span>Do not hit the top or bottom segments — only the gap is safe.</span>
              </div>
            </div>
          </section>

          <p className="howto-footer">LO × DDG — Frappy Brew. Good luck!</p>
          <div className="howto-footer-actions">
            <button type="button" className="howto-gotit" onClick={onClose}>
              Got it
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
