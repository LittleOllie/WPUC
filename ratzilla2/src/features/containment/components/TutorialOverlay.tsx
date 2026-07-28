import type { TutorialStepInfo } from "../types";

interface TutorialOverlayProps {
  tutorial: TutorialStepInfo;
  onSkip: () => void;
}

export default function TutorialOverlay({ tutorial, onSkip }: TutorialOverlayProps) {
  if (!tutorial.active || tutorial.complete) return null;

  return (
    <div className="cp-tutorial-banner" role="status" aria-live="polite">
      <div className="cp-tutorial-banner__text">
        <strong>{tutorial.title}</strong>
        {tutorial.body && <span>{tutorial.body}</span>}
      </div>
      <button type="button" className="cp-tutorial-banner__skip" onClick={onSkip}>
        SKIP TUTORIAL
      </button>
    </div>
  );
}
