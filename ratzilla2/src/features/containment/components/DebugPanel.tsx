import { useState } from "react";
import type { GameSimulation } from "../engine/GameSimulation";

interface DebugPanelProps {
  sim: GameSimulation;
}

export default function DebugPanel({ sim }: DebugPanelProps) {
  const [open, setOpen] = useState(false);
  const [speed, setSpeed] = useState(1);

  if (!open) {
    return (
      <button
        type="button"
        className="cp-debug-toggle"
        onClick={() => setOpen(true)}
      >
        DEBUG
      </button>
    );
  }

  return (
    <div className="cp-debug">
      <button type="button" onClick={() => setOpen(false)}>
        ×
      </button>
      <p>Seed: {sim.incident.seedLabel}</p>
      <p>Tick: {sim.tick}</p>
      <label>
        Speed
        <select
          value={speed}
          onChange={(e) => setSpeed(Number(e.target.value))}
        >
          <option value={0.5}>0.5×</option>
          <option value={1}>1×</option>
          <option value={2}>2×</option>
          <option value={4}>4×</option>
        </select>
      </label>
      <button
        type="button"
        onClick={() => {
          if (sim.selectedRoomId) sim.debugAddInfection(sim.selectedRoomId, 0.5);
        }}
      >
        +Infect room
      </button>
      <button
        type="button"
        onClick={() => {
          if (sim.selectedRoomId) sim.debugClearRoom(sim.selectedRoomId);
        }}
      >
        Clear room
      </button>
      <button
        type="button"
        onClick={() => {
          if (sim.selectedCorridorId) sim.debugDamageDoor(sim.selectedCorridorId);
        }}
      >
        Damage door
      </button>
      <button type="button" onClick={() => sim.debugAddResources()}>
        +Resources
      </button>
      <button
        type="button"
        onClick={() => sim.debugTriggerMutation("corrosive_response")}
      >
        Mutation
      </button>
      <button type="button" onClick={() => sim.debugForceGameOver()}>
        Game over
      </button>
    </div>
  );
}
