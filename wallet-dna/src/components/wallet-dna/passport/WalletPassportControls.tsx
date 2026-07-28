import type { WalletPassportPreferences } from "@/lib/wallet-dna/types";

type Props = {
  prefs: WalletPassportPreferences;
  onChange: (patch: Partial<WalletPassportPreferences>) => void;
  onCycleLayout: () => void;
};

export function WalletPassportControls({ prefs, onChange, onCycleLayout }: Props) {
  return (
    <div className="wdna-passport-controls">
      <fieldset className="wdna-passport-controls__group">
        <legend>Profile details</legend>
        <div className="wdna-passport-controls__toggles">
          <Toggle label="Show ENS or address" checked={prefs.showENS || prefs.showShortAddress} onChange={(v) => onChange({ showENS: v, showShortAddress: v })} />
          <Toggle label="Show analysis date" checked={prefs.showGeneratedDate} onChange={(v) => onChange({ showGeneratedDate: v })} />
          <Toggle label="Show collector-since year" checked={prefs.showCollectorSince} onChange={(v) => onChange({ showCollectorSince: v })} />
          <Toggle label="Show DNA ID" checked={prefs.showPassportNumber} onChange={(v) => onChange({ showPassportNumber: v })} />
          <Toggle label="Show DNA scores" checked={prefs.showScores} onChange={(v) => onChange({ showScores: v })} />
          <Toggle label="Show badges" checked={prefs.showBadges} onChange={(v) => onChange({ showBadges: v })} />
          <Toggle label="Show DNA markers" checked={prefs.showStamps} onChange={(v) => onChange({ showStamps: v })} />
          <Toggle label="Show Little Ollie artwork" checked={prefs.showOllie} onChange={(v) => onChange({ showOllie: v })} />
        </div>
      </fieldset>

      <fieldset className="wdna-passport-controls__group">
        <legend>Marker density</legend>
        <div className="wdna-passport-density" role="radiogroup" aria-label="Marker density">
          {(["minimal", "standard", "full"] as const).map((d) => (
            <label key={d} className={`wdna-density-btn${prefs.stampDensity === d ? " wdna-density-btn--active" : ""}`}>
              <input
                type="radio"
                name="stamp-density"
                value={d}
                checked={prefs.stampDensity === d}
                onChange={() => onChange({ stampDensity: d })}
              />
              {d === "minimal" ? "Minimal" : d === "standard" ? "Standard" : "Full"}
            </label>
          ))}
        </div>
      </fieldset>

      {prefs.showStamps && (
        <button type="button" className="wdna-btn wdna-btn--ghost" onClick={onCycleLayout}>
          Try another marker layout
        </button>
      )}
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="wdna-passport-toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

export function StampDensityControl({
  value,
  onChange,
}: {
  value: WalletPassportPreferences["stampDensity"];
  onChange: (v: WalletPassportPreferences["stampDensity"]) => void;
}) {
  return (
    <div className="wdna-passport-density" role="radiogroup" aria-label="Marker density">
      {(["minimal", "standard", "full"] as const).map((d) => (
        <label key={d} className={`wdna-density-btn${value === d ? " wdna-density-btn--active" : ""}`}>
          <input type="radio" name="stamp-density-standalone" value={d} checked={value === d} onChange={() => onChange(d)} />
          {d.charAt(0).toUpperCase() + d.slice(1)}
        </label>
      ))}
    </div>
  );
}
