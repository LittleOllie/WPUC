import {
  corridorDisplayId,
  DOORS,
  ROOM_TYPE_NAMES,
} from "../config/balance";
import type { SimulationSnapshot } from "../types";

interface SelectionDetailPanelProps {
  snapshot: SimulationSnapshot;
}

function roomStatusLabel(room: SimulationSnapshot["rooms"][0]): string {
  if (room.state === "incubating") return "INCUBATING";
  if (room.state === "infected") return "INFECTED";
  if (room.state === "critical") return "CRITICAL";
  if (room.state === "exposed") return "EXPOSED";
  if (room.state === "protected") return "PROTECTED";
  if (room.state === "lost") return "LOST";
  if (room.state === "offline") return "OFFLINE";
  return "STABLE";
}

function roomEffect(type: SimulationSnapshot["rooms"][0]["type"]): string {
  switch (type) {
    case "containment_core":
      return "Primary objective — loss at 0% integrity";
    case "power_generator":
      return "Power regeneration";
    case "serum_synthesis":
      return "Serum production";
    case "scanner_array":
      return "Exposure warnings";
    case "security_control":
      return "Bulkhead durability";
    case "maintenance":
      return "Engineering regeneration";
    case "ventilation":
      return "Airborne resistance";
    default:
      return "Route / sacrifice sector";
  }
}

export default function SelectionDetailPanel({ snapshot }: SelectionDetailPanelProps) {
  const { selectedRoomId, selectedCorridorId } = snapshot;

  if (selectedRoomId) {
    const room = snapshot.rooms.find((r) => r.id === selectedRoomId);
    if (!room) return null;
    const infected =
      room.infectionAmount > 0 ||
      room.state === "infected" ||
      room.state === "incubating" ||
      room.state === "critical";

    return (
      <aside className="cp-details" aria-label="Room details">
        <p className="cp-details__title">{room.label}</p>
        <p className="cp-details__type">{ROOM_TYPE_NAMES[room.type] ?? room.type}</p>
        <p className="cp-details__row">
          <span>Status</span>
          <strong>{roomStatusLabel(room)}</strong>
        </p>
        {room.infectionAmount > 0 && (
          <p className="cp-details__row">
            <span>Infection</span>
            <strong>{Math.round(room.infectionAmount * 100)}%</strong>
          </p>
        )}
        <p className="cp-details__effect">{roomEffect(room.type)}</p>
        <p className="cp-details__action">
          {infected ? "→ Deploy Serum" : "Select corridor to seal routes"}
        </p>
      </aside>
    );
  }

  if (selectedCorridorId) {
    const c = snapshot.corridors.find((x) => x.id === selectedCorridorId);
    if (!c) return null;
    const roomA = snapshot.rooms.find((r) => r.id === c.roomA);
    const roomB = snapshot.rooms.find((r) => r.id === c.roomB);
    const displayId = corridorDisplayId(c.id);
    const stateLabel =
      c.state === "sealed"
        ? "SEALED"
        : c.state === "breached"
          ? "BREACHED"
          : "OPEN";

    return (
      <aside className="cp-details" aria-label="Bulkhead details">
        <p className="cp-details__title">BULKHEAD {displayId}</p>
        <p className="cp-details__row">
          <span>Connects</span>
          <strong>
            {roomA?.label ?? "?"} ↔ {roomB?.label ?? "?"}
          </strong>
        </p>
        <p className="cp-details__row">
          <span>Status</span>
          <strong>{stateLabel}</strong>
        </p>
        <p className="cp-details__row">
          <span>Integrity</span>
          <strong>{Math.round(c.integrity)}%</strong>
        </p>
        <p className="cp-details__row">
          <span>Pressure</span>
          <strong>{Math.round(c.pressure)}</strong>
        </p>
        {c.reinforcementLevel > 0 && (
          <p className="cp-details__row">
            <span>Reinforced</span>
            <strong>Lv{c.reinforcementLevel}</strong>
          </p>
        )}
        <p className="cp-details__action">
          {c.state === "sealed"
            ? `→ Reinforce (${DOORS.reinforceCost} ENG) or Reopen`
            : `→ Seal (${DOORS.sealPowerCost} PWR)`}
        </p>
      </aside>
    );
  }

  return (
    <aside className="cp-details cp-details--hint" aria-label="Selection hint">
      <p className="cp-details__action">Tap a corridor or room to inspect</p>
    </aside>
  );
}
