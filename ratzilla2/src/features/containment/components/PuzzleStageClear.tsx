interface PuzzleStageClearProps {
  stage: number;
  score: number;
}

export default function PuzzleStageClear({ stage, score }: PuzzleStageClearProps) {
  return (
    <div className="cp-puzzle-stage-clear" aria-live="polite">
      <p className="cp-puzzle-stage-clear__title">STAGE {stage} CONTAINED</p>
      <p className="cp-puzzle-stage-clear__score">SCORE {score.toLocaleString()}</p>
    </div>
  );
}
