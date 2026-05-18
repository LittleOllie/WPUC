import { CLOUDS } from "../lib/assets.js";

export default function ShellAmbience() {
  return (
    <div className="pog-shell-ambience" aria-hidden>
      <div
        className="pog-shell-cloud pog-shell-cloud--a"
        style={{ top: "12%", animationDuration: "420s" }}
      >
        <img src={CLOUDS[1]} alt="" draggable={false} />
      </div>
      <div
        className="pog-shell-cloud pog-shell-cloud--b"
        style={{ top: "28%", animationDuration: "520s", animationDelay: "-200s" }}
      >
        <img src={CLOUDS[2]} alt="" draggable={false} />
      </div>
    </div>
  );
}
