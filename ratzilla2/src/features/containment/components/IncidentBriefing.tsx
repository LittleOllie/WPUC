import type { IncidentConfig } from "../types";

interface IncidentBriefingProps {
  incident: IncidentConfig;
  onDismiss: () => void;
}

export default function IncidentBriefing({ incident, onDismiss }: IncidentBriefingProps) {
  return (
    <div className="cp-briefing" role="dialog" aria-label="Incident briefing">
      <button type="button" className="cp-briefing__skip" onClick={onDismiss}>
        TAP TO CONTINUE
      </button>
      <div className="cp-briefing__card">
        <p className="cp-briefing__label">BLACKWATER INCIDENT</p>
        <p className="cp-briefing__id">{incident.seedLabel}</p>
        <dl className="cp-briefing__meta">
          <div>
            <dt>FACILITY</dt>
            <dd>Containment Site 03</dd>
          </div>
          <div>
            <dt>THREAT PROFILE</dt>
            <dd>{incident.behaviourProfile.toUpperCase().replace("_", " ")}</dd>
          </div>
          <div>
            <dt>PRIMARY DIRECTIVE</dt>
            <dd>Protect the Containment Core</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
