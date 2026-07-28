import { useEffect, useRef } from "react";
import { ABILITIES } from "../config/balance";
import { getAbilityStates } from "../utils/abilityHelpers";
import type { SimulationSnapshot } from "../types";

interface AbilityBarProps {
  snapshot: SimulationSnapshot;
  purgeTarget: string | null;
  purgeHold: number;
  onSeal: () => void;
  onSerum: () => void;
  onReinforce: () => void;
  onPurgeStart: (roomId: string | null) => void;
  onPurgeHold: (value: number) => void;
  onPurgeConfirm: () => void;
  onLockdown: () => void;
}

export default function AbilityBar({
  snapshot,
  purgeTarget,
  purgeHold,
  onSeal,
  onSerum,
  onReinforce,
  onPurgeStart,
  onPurgeHold,
  onPurgeConfirm,
  onLockdown,
}: AbilityBarProps) {
  const holdRef = useRef<number | null>(null);
  const highlights = snapshot.tutorialHighlights;

  const abilities = getAbilityStates(snapshot, {
    seal: highlights?.highlightSeal ?? false,
    serum: highlights?.highlightSerum ?? false,
    reinforce: highlights?.highlightReinforce ?? false,
  });

  useEffect(() => {
    return () => {
      if (holdRef.current) window.clearInterval(holdRef.current);
    };
  }, []);

  const handlers: Record<string, () => void> = {
    seal: onSeal,
    serum: onSerum,
    reinforce: onReinforce,
    lockdown: onLockdown,
  };

  const startPurgeHold = () => {
    if (!snapshot.selectedRoomId) return;
    onPurgeStart(snapshot.selectedRoomId);
    let v = 0;
    holdRef.current = window.setInterval(() => {
      v += 100;
      onPurgeHold(v);
      if (v >= ABILITIES.purgeConfirmMs) {
        if (holdRef.current) window.clearInterval(holdRef.current);
        onPurgeConfirm();
      }
    }, 100);
  };

  const cancelPurgeHold = () => {
    if (holdRef.current) window.clearInterval(holdRef.current);
    onPurgeStart(null);
    onPurgeHold(0);
  };

  const activeHint = abilities.find((a) => a.highlighted && !a.disabled);

  return (
    <footer className="cp-abilities-wrap">
      {activeHint && (
        <p className="cp-abilities-hint">{activeHint.description.toUpperCase()}</p>
      )}
      <div className="cp-abilities">
        {abilities.map((a) => {
          const isPurge = a.id === "purge";
          return (
            <button
              key={a.id}
              type="button"
              className={`cp-ability${a.highlighted ? " cp-ability--highlight" : ""}${a.disabled ? " cp-ability--disabled" : ""}`}
              onClick={isPurge ? undefined : handlers[a.id]}
              onPointerDown={isPurge ? startPurgeHold : undefined}
              onPointerUp={isPurge ? cancelPurgeHold : undefined}
              onPointerLeave={isPurge ? cancelPurgeHold : undefined}
              disabled={a.disabled && !isPurge}
              title={a.disabledReason ?? a.description}
            >
              <span className="cp-ability__name">{a.label}</span>
              <span className="cp-ability__cost">{a.cost}</span>
              <span className="cp-ability__desc">{a.description}</span>
              {a.disabled && a.disabledReason && (
                <span className="cp-ability__reason">{a.disabledReason}</span>
              )}
              {isPurge && purgeTarget && purgeHold > 0 && (
                <span className="cp-ability__reason">{Math.round(purgeHold)}ms</span>
              )}
            </button>
          );
        })}
      </div>
    </footer>
  );
}
