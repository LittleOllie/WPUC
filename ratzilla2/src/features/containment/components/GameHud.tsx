import type { SimulationSnapshot } from "../types";

function formatTime(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

interface GameHudProps {
  snapshot: SimulationSnapshot;
  onPause: () => void;
  onReturn: () => void;
  onHowToPlay: () => void;
}

export default function GameHud({ snapshot, onPause, onReturn, onHowToPlay }: GameHudProps) {
  const mutation = snapshot.activeMutations.at(-1);

  return (
    <header className="cp-hud">
      <div className="cp-hud__left">
        <button type="button" className="cp-hud__back" onClick={onReturn}>
          ← BLACKWATER
        </button>
        <span className="cp-hud__incident">{snapshot.incident.seedLabel}</span>
      </div>

      <div className="cp-hud__center">
        <span className="cp-hud__timer">{formatTime(snapshot.elapsedMs)}</span>
      </div>

      <div className="cp-hud__right">
        <div className="cp-hud__core">
          <span className="cp-hud__label">CORE</span>
          <meter
            className="cp-hud__meter cp-hud__meter--core"
            min={0}
            max={100}
            value={snapshot.coreIntegrity}
          />
          <span>{Math.round(snapshot.coreIntegrity)}%</span>
        </div>
        {mutation && (
          <span className="cp-hud__mutation" title={mutation.id}>
            MUT
          </span>
        )}
        <button type="button" className="cp-hud__help" onClick={onHowToPlay}>
          ?
        </button>
        <button type="button" className="cp-hud__pause" onClick={onPause}>
          PAUSE
        </button>
      </div>

      <div className="cp-hud__resources">
        <span>PWR {Math.round(snapshot.resources.power)}</span>
        <span>SER {Math.round(snapshot.resources.serum)}</span>
        <span>ENG {Math.round(snapshot.resources.engineering)}</span>
        <span>PRG {snapshot.resources.purgeCharges}</span>
      </div>
    </header>
  );
}
