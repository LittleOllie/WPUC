import type { GameMessage, GamePhase } from "../types";

interface BootSequenceProps {
  phase: GamePhase;
  messages: GameMessage[];
  onHowToPlay: () => void;
  onStart?: () => void;
}

export default function BootSequence({
  phase,
  messages,
  onHowToPlay,
  onStart,
}: BootSequenceProps) {
  return (
    <div className="cp-boot" aria-hidden={phase === "playing"}>
      <div className="cp-boot__scanlines" />
      <div className="cp-boot__content">
        {messages.slice(-4).map((m) => (
          <p key={m.id} className={`cp-boot__line cp-boot__line--${m.kind}`}>
            {m.text}
          </p>
        ))}
        {phase === "boot" && <p className="cp-boot__line cp-boot__cursor">▌</p>}
      </div>
      <div className="cp-boot__actions">
        <button type="button" className="cp-boot__btn" onClick={onHowToPlay}>
          HOW TO PLAY
        </button>
        {onStart && phase === "intro" && (
          <button type="button" className="cp-boot__btn cp-boot__btn--primary" onClick={onStart}>
            ACCESS CONTAINMENT
          </button>
        )}
      </div>
    </div>
  );
}
