import { assetUrl, SITE_BASE_URL } from "../config/site";

export type GameShellProps = {
  displayHandle: string;
  onEditHandle: () => void;
  onOpenLeaderboard: () => void;
  onOpenHowToPlay: () => void;
};

export function GameShell({ displayHandle, onEditHandle, onOpenLeaderboard, onOpenHowToPlay }: GameShellProps) {
  const handle = displayHandle;

  return (
    <div className="page page-fullscreen">
      <div className="frappy-bg" aria-hidden="true" />
      <div className="frappy-bg-overlay" aria-hidden="true" />

      {handle ? (
        <div className="player-welcome" aria-live="polite">
          Welcome <span className="player-welcome-handle">{handle}</span>
        </div>
      ) : null}

      <div id="introSplash" className="intro-splash" aria-hidden="false">
        <div className="intro-splash-inner">
          <img
            src={assetUrl("assets/lo.png")}
            alt="Little Ollie"
            className="intro-splash-lo"
            width={400}
            height={120}
          />
          <span className="intro-splash-x" aria-hidden="true">
            ×
          </span>
          <img src={assetUrl("assets/ddg.png")} alt="DDG" className="intro-splash-ddg" width={120} height={120} />
          <p id="introSplashLoading" className="intro-splash-loading">
            Loading…
          </p>
          <button type="button" id="introPlayBtn" className="btn-primary intro-play-btn" disabled>
            <span className="btn-primary-text">PLAY</span>
          </button>
          <div className="intro-actions-stack">
            <button
              type="button"
              className="intro-stack-btn intro-stack-btn--gold"
              onClick={(e) => {
                e.stopPropagation();
                onOpenHowToPlay();
              }}
            >
              HOW TO PLAY
            </button>
            <button
              type="button"
              className="intro-stack-btn intro-stack-btn--ghost"
              onClick={(e) => {
                e.stopPropagation();
                onEditHandle();
              }}
            >
              Edit X handle
            </button>
            <button
              type="button"
              className="intro-stack-btn intro-stack-btn--gold"
              onClick={(e) => {
                e.stopPropagation();
                onOpenLeaderboard();
              }}
            >
              Leaderboard
            </button>
          </div>
        </div>
      </div>

      <div className="game-top-bar">
        <div className="co-brand-bar" aria-label="LO x DDG">
          <img src={assetUrl("assets/lo.png")} alt="LO" className="co-brand-img co-brand-lo" width={120} height={40} />
          <span className="co-brand-x" aria-hidden="true">
            ×
          </span>
          <img src={assetUrl("assets/ddg.png")} alt="DDG" className="co-brand-img co-brand-ddg" width={40} height={40} />
        </div>
        <div className="hud hud-overlay">
          <div className="hud-pill">
            <span>Score</span>
            <span id="scoreValue">0</span>
          </div>
          <div className="hud-pill">
            <span>Bubbles</span>
            <span id="beansValue">0</span>
          </div>
          <div className="hud-pill">
            <span>Best</span>
            <span id="bestValue">0</span>
          </div>
        </div>
      </div>

      <div className="game-viewport">
        <div className="canvas-wrap" id="canvasWrap">
          <canvas id="gameCanvas" />
          <div id="overlay" className="overlay">
            <div className="overlay-card hidden" id="startCard" aria-hidden="true">
              <div className="overlay-card-brand" aria-hidden="true">
                <img src={assetUrl("assets/lo.png")} alt="" className="overlay-brand-lo" />
                <span className="co-brand-x">×</span>
                <img src={assetUrl("assets/ddg.png")} alt="" className="overlay-brand-ddg" />
              </div>
              <p id="loadingText" className="loading-text" style={{ display: "none" }}>
                Loading…
              </p>
              <h2 className="ready-title">Ready?</h2>
              <p className="ready-desc">
                Tap or click to flap.
                <br />
                Stay alive and collect bubbles.
              </p>
              <button id="startBtn" type="button" className="btn-primary" disabled>
                <span className="btn-primary-content">
                  <img src={assetUrl("assets/lo.png")} alt="" className="btn-brand-lo" />
                  <span className="btn-primary-text">Start</span>
                  <img src={assetUrl("assets/ddg.png")} alt="" className="btn-brand-ddg" />
                </span>
              </button>
            </div>
            <div className="overlay-card overlay-card--gameover hidden" id="gameOverCard">
              <div className="game-over-fireworks" id="gameOverFireworks" aria-hidden="true" />
              <div className="overlay-card-ddg-watermark" aria-hidden="true">
                <img src={assetUrl("assets/ddg.png")} alt="" />
              </div>
              <div className="overlay-card-gameover-body">
                <h2 id="gameOverTitle">Game Over</h2>
                <p id="gameOverCelebration" className="game-over-celebration-msg" />
                <p id="summaryText" />
                <button id="playAgainBtn" type="button" className="btn-primary btn-primary-text-only">
                  <span className="btn-primary-text">Play Again</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <button type="button" className="btn-leaderboard-float" onClick={onOpenLeaderboard}>
        Leaderboard
      </button>

      <a href={SITE_BASE_URL} className="btn-back btn-back-float">
        ← Back
      </a>

      <div className="controls-hint controls-hint-float">
        <span>Tap / Click or Spacebar to flap</span>
      </div>
    </div>
  );
}
