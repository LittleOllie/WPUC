import type { ContainmentPersistedData } from "../persistence/storage";

interface SettingsPanelProps {
  settings: ContainmentPersistedData;
  onChange: (patch: Partial<ContainmentPersistedData>) => void;
  onClose: () => void;
}

export default function SettingsPanel({
  settings,
  onChange,
  onClose,
}: SettingsPanelProps) {
  return (
    <div className="cp-overlay" role="dialog" aria-label="Settings">
      <div className="cp-panel">
        <h2>SETTINGS</h2>
        <label className="cp-setting">
          <input
            type="checkbox"
            checked={settings.muted}
            onChange={(e) => onChange({ muted: e.target.checked })}
          />
          Mute audio
        </label>
        <label className="cp-setting">
          <input
            type="checkbox"
            checked={settings.reducedMotion}
            onChange={(e) => onChange({ reducedMotion: e.target.checked })}
          />
          Reduced motion
        </label>
        <label className="cp-setting">
          <input
            type="checkbox"
            checked={settings.screenShake}
            onChange={(e) => onChange({ screenShake: e.target.checked })}
          />
          Screen shake
        </label>
        <label className="cp-setting">
          <input
            type="checkbox"
            checked={settings.autoPauseOnHide}
            onChange={(e) => onChange({ autoPauseOnHide: e.target.checked })}
          />
          Auto-pause when tab hidden
        </label>
        <label className="cp-setting">
          Alarm intensity
          <input
            type="range"
            min={0}
            max={1}
            step={0.1}
            value={settings.alarmIntensity}
            onChange={(e) =>
              onChange({ alarmIntensity: Number(e.target.value) })
            }
          />
        </label>
        <button type="button" onClick={onClose}>
          CLOSE
        </button>
      </div>
    </div>
  );
}
