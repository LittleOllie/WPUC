import { Link } from "react-router-dom";
import BlackwaterXLink from "../components/BlackwaterXLink";
import OutbreakStatus from "../components/OutbreakStatus";
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
          <OutbreakStatus className="rz-outbreak--header" />
          <div className="rz2-wordmark rz2-wordmark--full" aria-label="BLACKWATER">
            <img
              className="rz2-logo rz2-logo--blackwater"
              src={asset("BlackwaterLogo.png")}
              alt="BLACKWATER"
              width={791}
              height={318}
              draggable={false}
              decoding="async"
            />
          </div>
        </header>

        <footer className="rz2-bottom">
          <div className="rz-infect-entry rz-infect-entry--landing">
            <Link to="/infection" className="rz-infect-btn">
              🦠 INFECT ME
            </Link>
          </div>

          <p className="rz2-soon" aria-live="polite">
            <span className="rz2-soon__text" id="rz2Soon" />
            <span className="rz2-cursor" id="rz2Cursor" aria-hidden="true" />
          </p>

          <nav className="rz-bw-socials" aria-label="Blackwater media">
            <BlackwaterXLink />
          </nav>

          <p className="rz2-powered">
            Powered by Little Ollie Labs for BlackWater Labs
          </p>
        </footer>

        <div className="rz2-fx" aria-hidden="true">
          <div className="rz2-fx__vignette" />
          <div className="rz2-fx__grain" />
          <div className="rz2-fx__scan" />
          <div className="rz2-fx__chroma" />
          <div className="rz2-fx__flicker" id="rz2Flicker" />
        </div>
      </div>
    </div>
  );
}
