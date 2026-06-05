import { Link } from "react-router-dom";
import { useRatzilla2Boot } from "../hooks/useRatzilla2Boot";

const asset = (file: string) => `${import.meta.env.BASE_URL}assets/${file}`;

export default function Transmission() {
  useRatzilla2Boot();

  return (
    <div className="rz2-body">
      <div className="rz2-stage" id="rz2Stage">
        <div className="rz2-curtain" id="rz2Curtain" aria-hidden="true" />

        <div className="rz2-scene" aria-hidden="true">
          <div className="rz2-scene__frame" id="rz2SceneFrame">
            <img
              className="rz2-scene__img"
              src={asset("RatzillaTunelBG.png")}
              alt=""
              width={1920}
              height={1920}
              draggable={false}
              decoding="async"
            />
            <div className="rz2-scene__depth" />
            <div className="rz2-scene__tunnel-glow" />

            <div className="rz2-lights" aria-hidden="true">
              <div className="rz2-lights__red rz2-lights__red--a" />
              <div className="rz2-lights__red rz2-lights__red--b" />
              <div className="rz2-lights__red rz2-lights__red--r1" />
              <div className="rz2-lights__red rz2-lights__red--r2" />
              <div className="rz2-lights__red rz2-lights__red--r3" />
              <div className="rz2-lights__dim rz2-lights__dim--a" />
              <div className="rz2-lights__dim rz2-lights__dim--b" />
              <div className="rz2-lights__tunnel" />
            </div>

            <div className="rz2-tunnel-track" id="rz2TunnelTrack" aria-hidden="true">
              <canvas
                id="rz2RatSource"
                className="rz2-tunnel-track__source"
                aria-hidden="true"
              />
              <video
                id="rz2RatVideo"
                className="rz2-tunnel-track__video"
                playsInline
                muted
                loop
                preload="auto"
              />
            </div>
          </div>
        </div>

        <div className="rz2-fog rz2-fog--1" aria-hidden="true" />
        <div className="rz2-fog rz2-fog--2" aria-hidden="true" />
        <div className="rz2-fog rz2-fog--3" aria-hidden="true" />
        <div className="rz2-smoke" aria-hidden="true" />

        <header className="rz2-top">
          <div className="rz2-wordmark rz2-wordmark--full" aria-label="RATZILLA">
            <img
              className="rz2-logo"
              src={asset("RATZILLA2.PNG")}
              alt="RATZILLA"
              width={480}
              height={96}
              draggable={false}
            />
          </div>
        </header>

        <div className="rz2-mid-r" aria-hidden="true">
          <div className="rz2-mid-r__spinner">
            <img
              className="rz2-mid-r__img rz2-mid-r__img--front"
              src={asset("R2.PNG")}
              alt=""
              width={420}
              height={420}
              draggable={false}
            />
            <img
              className="rz2-mid-r__img rz2-mid-r__img--back"
              src={asset("R2.PNG")}
              alt=""
              width={420}
              height={420}
              draggable={false}
              aria-hidden="true"
            />
          </div>
        </div>

        <footer className="rz2-bottom">
          <p className="rz2-soon" aria-live="polite">
            <span className="rz2-soon__text" id="rz2Soon" />
            <span className="rz2-cursor" id="rz2Cursor" aria-hidden="true" />
          </p>
          <div className="rz2-rat-mark" id="rz2RatMark">
            <button
              type="button"
              className="rz2-skull-btn"
              id="rz2SkullBtn"
              aria-label="Press the rat to toggle TV static sound"
            >
              <img
                className="rz2-skull"
                src={asset("RatLogo.png")}
                alt=""
                width={80}
                height={80}
                draggable={false}
              />
            </button>
            <button
              type="button"
              className="rz2-press-sound is-muted"
              id="rz2PressSound"
              aria-label="Press the Rat to toggle TV static sound"
              aria-pressed={false}
            >
              <span className="rz2-press-sound__label">Press the Rat</span>
            </button>
          </div>
        </footer>

        <div className="rz2-fx" aria-hidden="true">
          <div className="rz2-fx__vignette" />
          <div className="rz2-fx__grain" />
          <div className="rz2-fx__scan" />
          <div className="rz2-fx__chroma" />
          <div className="rz2-fx__flicker" id="rz2Flicker" />
        </div>

        <Link to="/infection" className="rz-infect-btn">
          🦠 INFECT ME
        </Link>
      </div>
    </div>
  );
}
