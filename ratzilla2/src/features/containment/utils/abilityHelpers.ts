import { ABILITIES, DOORS } from "../config/balance";
import type { Cooldowns, Resources, SimulationSnapshot } from "../types";

export interface AbilityState {
  id: "seal" | "serum" | "reinforce" | "purge" | "lockdown";
  label: string;
  cost: string;
  description: string;
  disabled: boolean;
  disabledReason: string | null;
  highlighted: boolean;
  cooldownRemaining: number;
}

function cooldownLeft(cooldowns: Cooldowns, elapsedMs: number, key: keyof Cooldowns): number {
  const until = cooldowns[key];
  return until > elapsedMs ? Math.ceil((until - elapsedMs) / 1000) : 0;
}

export function getAbilityStates(
  snapshot: SimulationSnapshot,
  highlights: { seal: boolean; serum: boolean; reinforce: boolean },
): AbilityState[] {
  const { resources, cooldowns, elapsedMs, selectedRoomId, selectedCorridorId } = snapshot;
  const room = selectedRoomId
    ? snapshot.rooms.find((r) => r.id === selectedRoomId)
    : undefined;
  const corridor = selectedCorridorId
    ? snapshot.corridors.find((c) => c.id === selectedCorridorId)
    : undefined;

  const serumCd = cooldownLeft(cooldowns, elapsedMs, "serum");
  const reinforceCd = cooldownLeft(cooldowns, elapsedMs, "reinforce");
  const lockdownCd = cooldownLeft(cooldowns, elapsedMs, "lockdown");
  const doorCd = cooldownLeft(cooldowns, elapsedMs, "doorAction");

  const isInfected =
    room &&
    (room.state === "infected" ||
      room.state === "critical" ||
      room.state === "incubating" ||
      room.state === "exposed") &&
    room.infectionAmount > 0;

  const sealState = getSealState(resources, corridor, doorCd);
  const serumState = getSerumState(resources, isInfected, room, serumCd);
  const reinforceState = getReinforceState(resources, corridor, reinforceCd);
  const purgeState = getPurgeState(resources, room);
  const lockdownState = getLockdownState(resources, lockdownCd);

  return [
    { ...sealState, id: "seal", label: "SEAL / OPEN", highlighted: highlights.seal },
    { ...serumState, id: "serum", label: "SERUM", highlighted: highlights.serum },
    { ...reinforceState, id: "reinforce", label: "REINFORCE", highlighted: highlights.reinforce },
    { ...purgeState, id: "purge", label: "PURGE", highlighted: false },
    { ...lockdownState, id: "lockdown", label: "LOCKDOWN", highlighted: false },
  ];
}

function getSealState(
  resources: Resources,
  corridor: SimulationSnapshot["corridors"][0] | undefined,
  doorCd: number,
): Omit<AbilityState, "id" | "label" | "highlighted"> {
  if (!corridor) {
    return {
      cost: `${DOORS.sealPowerCost} PWR`,
      description: "Block infection through corridor",
      disabled: true,
      disabledReason: "Select a corridor",
      cooldownRemaining: 0,
    };
  }
  if (doorCd > 0) {
    return {
      cost: `${DOORS.sealPowerCost} PWR`,
      description: corridor.state === "sealed" ? "Reopen bulkhead" : "Seal bulkhead",
      disabled: true,
      disabledReason: `Cooldown ${doorCd}s`,
      cooldownRemaining: doorCd,
    };
  }
  if (corridor.state !== "sealed" && resources.power < DOORS.sealPowerCost) {
    return {
      cost: `${DOORS.sealPowerCost} PWR`,
      description: "Seal to block spread",
      disabled: true,
      disabledReason: "Not enough power",
      cooldownRemaining: 0,
    };
  }
  return {
    cost: corridor.state === "sealed" ? "Free" : `${DOORS.sealPowerCost} PWR`,
    description: corridor.state === "sealed" ? "Reopen bulkhead" : "Seal bulkhead",
    disabled: false,
    disabledReason: null,
    cooldownRemaining: 0,
  };
}

function getSerumState(
  resources: Resources,
  isInfected: boolean | undefined,
  room: SimulationSnapshot["rooms"][0] | undefined,
  serumCd: number,
): Omit<AbilityState, "id" | "label" | "highlighted"> {
  if (!room) {
    return {
      cost: `${Math.floor(resources.serum)} SER`,
      description: "Cleanse infected room",
      disabled: true,
      disabledReason: "Select infected room",
      cooldownRemaining: 0,
    };
  }
  if (!isInfected) {
    return {
      cost: `${Math.floor(resources.serum)} SER`,
      description: "Cleanse infected room",
      disabled: true,
      disabledReason: "Room not infected",
      cooldownRemaining: 0,
    };
  }
  if (serumCd > 0) {
    return {
      cost: `${Math.floor(resources.serum)} SER`,
      description: "Reduce infection chains",
      disabled: true,
      disabledReason: `Cooldown ${serumCd}s`,
      cooldownRemaining: serumCd,
    };
  }
  if (resources.serum < 1) {
    return {
      cost: "0 SER",
      description: "Reduce infection chains",
      disabled: true,
      disabledReason: "Not enough serum",
      cooldownRemaining: 0,
    };
  }
  return {
    cost: `${Math.floor(resources.serum)} SER`,
    description: "Reduce infection chains",
    disabled: false,
    disabledReason: null,
    cooldownRemaining: 0,
  };
}

function getReinforceState(
  resources: Resources,
  corridor: SimulationSnapshot["corridors"][0] | undefined,
  reinforceCd: number,
): Omit<AbilityState, "id" | "label" | "highlighted"> {
  if (!corridor) {
    return {
      cost: `${DOORS.reinforceCost} ENG`,
      description: "Restore bulkhead integrity",
      disabled: true,
      disabledReason: "Select sealed corridor",
      cooldownRemaining: 0,
    };
  }
  if (corridor.state !== "sealed") {
    return {
      cost: `${DOORS.reinforceCost} ENG`,
      description: "Restore bulkhead integrity",
      disabled: true,
      disabledReason: "Select sealed corridor",
      cooldownRemaining: 0,
    };
  }
  if (reinforceCd > 0) {
    return {
      cost: `${DOORS.reinforceCost} ENG`,
      description: "Restore bulkhead integrity",
      disabled: true,
      disabledReason: `Cooldown ${reinforceCd}s`,
      cooldownRemaining: reinforceCd,
    };
  }
  if (resources.engineering < DOORS.reinforceCost) {
    return {
      cost: `${Math.floor(resources.engineering)} ENG`,
      description: "Restore bulkhead integrity",
      disabled: true,
      disabledReason: "Not enough engineering",
      cooldownRemaining: 0,
    };
  }
  return {
    cost: `${DOORS.reinforceCost} ENG`,
    description: "Restore bulkhead integrity",
    disabled: false,
    disabledReason: null,
    cooldownRemaining: 0,
  };
}

function getPurgeState(
  resources: Resources,
  room: SimulationSnapshot["rooms"][0] | undefined,
): Omit<AbilityState, "id" | "label" | "highlighted"> {
  if (!room) {
    return {
      cost: `${resources.purgeCharges} charges`,
      description: "Hold to destroy room",
      disabled: true,
      disabledReason: "Select a room",
      cooldownRemaining: 0,
    };
  }
  if (room.type === "containment_core") {
    return {
      cost: `${resources.purgeCharges} charges`,
      description: "Hold to destroy room",
      disabled: true,
      disabledReason: "Cannot purge Core",
      cooldownRemaining: 0,
    };
  }
  if (resources.purgeCharges < 1) {
    return {
      cost: "0 charges",
      description: "Hold to destroy room",
      disabled: true,
      disabledReason: "No purge charges",
      cooldownRemaining: 0,
    };
  }
  return {
    cost: `${resources.purgeCharges} charges`,
    description: "Hold to destroy room",
    disabled: false,
    disabledReason: null,
    cooldownRemaining: 0,
  };
}

function getLockdownState(
  resources: Resources,
  lockdownCd: number,
): Omit<AbilityState, "id" | "label" | "highlighted"> {
  if (lockdownCd > 0) {
    return {
      cost: `${ABILITIES.lockdownPowerCost} PWR`,
      description: `Pause spread ${ABILITIES.lockdownDurationMs / 1000}s`,
      disabled: true,
      disabledReason: `Cooldown ${lockdownCd}s`,
      cooldownRemaining: lockdownCd,
    };
  }
  if (resources.power < ABILITIES.lockdownPowerCost) {
    return {
      cost: `${ABILITIES.lockdownPowerCost} PWR`,
      description: `Pause spread ${ABILITIES.lockdownDurationMs / 1000}s`,
      disabled: true,
      disabledReason: "Not enough power",
      cooldownRemaining: 0,
    };
  }
  return {
    cost: `${ABILITIES.lockdownPowerCost} PWR`,
    description: `Pause spread ${ABILITIES.lockdownDurationMs / 1000}s`,
    disabled: false,
    disabledReason: null,
    cooldownRemaining: 0,
  };
}
