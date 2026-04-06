import { useEffect, useRef } from "react";
import { assetUrl } from "../config/site";
import { useModalFocusRestore } from "../hooks/useModalFocusRestore";
import { HowToMineIllustration } from "./HowToMineIllustration";
import "./HowToPlayModal.css";

export type HowToPlayModalProps = {
  onClose: () => void;
};

export function HowToPlayModal({ onClose }: HowToPlayModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useModalFocusRestore(true, dialogRef, "button.howto-modal-close");

  useEffect(() => {
    const onKey: EventListener = (e) => {
      if (e instanceof globalThis.KeyboardEvent && e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <div className="howto-modal-overlay" role="presentation" onClick={onClose}>
      <div
        ref={dialogRef}
        className="howto-modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="howto-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="howto-modal-header">
          <h2 id="howto-modal-title" className="howto-modal-title">
            How to play
          </h2>
          <button type="button" className="howto-modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="howto-modal-body">
          <section className="howto-hero">
            <div className="howto-hero-scene" aria-hidden="true">
              <img src={assetUrl("assets/bg0.png")} alt="" className="howto-hero-bg" />
              <img src={assetUrl("assets/player.png")} alt="" className="howto-hero-player" />
            </div>
            <p className="howto-modal-lead">
              Fly your <strong>character</strong> through each <strong>scene</strong>. Flap past the steel pillars, collect the pickups that help you, and avoid the hazards. More characters and scenes are on the way.
            </p>
          </section>

          <section className="howto-section">
            <h3 className="howto-heading">Controls</h3>
            <p>
              <strong>Tap</strong>, <strong>click</strong>, or press <strong>Space</strong> to flap. Stay inside the gap between the pillars. Don’t hit the pillars, the ceiling, or the floor.
            </p>
          </section>

          <section className="howto-section">
            <h3 className="howto-heading">Scoring</h3>
            <p>Each pillar gap you pass through safely adds <strong>+1</strong> to your score. Pickups add bonuses on top.</p>
          </section>

          <section className="howto-section">
            <h3 className="howto-heading howto-heading--good">Collect — good</h3>
            <ul className="howto-pickup-list">
              <li className="howto-asset-row">
                <span className="howto-asset-wrap">
                  <img src={assetUrl("assets/bean.png")} alt="" className="howto-asset-img" />
                </span>
                <span>
                  <strong>Bubble</strong> — +1 score, +1 bubble in your tally.
                </span>
              </li>
              <li className="howto-asset-row">
                <span className="howto-asset-wrap">
                  <img src={assetUrl("assets/bean_golden.png")} alt="" className="howto-asset-img" />
                </span>
                <span>
                  <strong>Golden bubble</strong> — +5 score, +1 bubble, and a <strong>shield</strong> (one charge — see below).
                </span>
              </li>
              <li className="howto-asset-row">
                <span className="howto-asset-wrap">
                  <img
                    src={assetUrl("assets/cup_red.png")}
                    alt=""
                    className="howto-asset-img howto-asset-img--fish"
                  />
                </span>
                <span>
                  <strong>Red fish</strong> — +8 score.
                </span>
              </li>
            </ul>
          </section>

          <section className="howto-section">
            <h3 className="howto-heading howto-heading--shield">Shield</h3>
            <p>
              If you have a shield from a golden bubble, the <strong>next</strong> hit from a <strong>mine</strong> or <strong>pillar</strong> is absorbed — you lose the shield instead of the run. You can only hold one shield at a time.
            </p>
          </section>

          <section className="howto-section">
            <h3 className="howto-heading howto-heading--bad">Avoid — don’t hit</h3>
            <ul className="howto-pickup-list">
              <li className="howto-asset-row">
                <span className="howto-asset-wrap howto-asset-wrap--mine" aria-hidden="true">
                  <HowToMineIllustration />
                </span>
                <span>
                  <strong>Underwater mine</strong> — touching one explodes. If you have no shield (and you’re past the short start grace), it’s game over.
                </span>
              </li>
              <li className="howto-asset-row">
                <span className="howto-asset-wrap">
                  <img src={assetUrl("assets/pillar_cup.png")} alt="" className="howto-asset-img howto-asset-img--pillar" />
                </span>
                <span>
                  <strong>Steel pillars</strong> — don’t fly into the metal — only through the open gap.
                </span>
              </li>
            </ul>
          </section>

          <p className="howto-modal-foot">Stay alive, stack bubbles, and chase your best score.</p>
        </div>

        <div className="howto-modal-actions">
          <button type="button" className="howto-modal-done" onClick={onClose}>
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
