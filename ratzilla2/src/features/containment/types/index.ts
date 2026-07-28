/** Core types for Containment Protocol Z-26 simulation */

export type RoomType =
  | "containment_core"
  | "power_generator"
  | "serum_synthesis"
  | "scanner_array"
  | "security_control"
  | "standard_lab"
  | "maintenance"
  | "ventilation";

export type RoomState =
  | "stable"
  | "exposed"
  | "incubating"
  | "infected"
  | "critical"
  | "lost"
  | "purged"
  | "offline"
  | "protected"
  | "hidden";

export type InfectionStage =
  | "none"
  | "exposure"
  | "incubation"
  | "active_contamination"
  | "critical_mass"
  | "collapse";

export type CorridorState = "open" | "sealed" | "breached" | "destroyed";

export type PressureWarning = "safe" | "strained" | "critical" | "breaching";

export type BehaviourProfile =
  | "expansive"
  | "predatory"
  | "burrowing"
  | "dormant";

export type MutationId =
  | "corrosive_response"
  | "dormant_carriers"
  | "airborne";

export type PlayerAction =
  | "seal_door"
  | "reopen_door"
  | "deploy_serum"
  | "reinforce"
  | "emergency_purge"
  | "facility_lockdown";

export type GamePhase =
  | "boot"
  | "intro"
  | "briefing"
  | "playing"
  | "paused"
  | "game_over";

export type FailureReason =
  | "core_lost"
  | "all_sectors_lost"
  | "structural_failure";

export interface AxialCoord {
  q: number;
  r: number;
}

export interface Vec2 {
  x: number;
  y: number;
}

export interface RoomDefinition {
  id: string;
  type: RoomType;
  coord: AxialCoord;
  label?: string;
}

export interface CorridorDefinition {
  id: string;
  roomA: string;
  roomB: string;
}

export interface LayoutDefinition {
  id: string;
  name: string;
  rooms: RoomDefinition[];
  corridors: CorridorDefinition[];
  infectionStartCandidates?: string[];
}

export interface RoomRuntime {
  id: string;
  type: RoomType;
  coord: AxialCoord;
  displayPos: Vec2;
  state: RoomState;
  infectionAmount: number;
  infectionStage: InfectionStage;
  operationalHealth: number;
  powered: boolean;
  visibleToScanner: boolean;
  temporaryProtectionUntil: number;
  chainDensity: number;
  connectedCorridorIds: string[];
  label: string;
}

export interface CorridorRuntime {
  id: string;
  roomA: string;
  roomB: string;
  state: CorridorState;
  integrity: number;
  maxIntegrity: number;
  pressure: number;
  reinforcementLevel: number;
  lockUntil: number;
  breached: boolean;
  orientation: number;
}

export interface Resources {
  power: number;
  serum: number;
  engineering: number;
  purgeCharges: number;
}

export interface Cooldowns {
  serum: number;
  reinforce: number;
  purge: number;
  lockdown: number;
  doorAction: number;
}

export interface ActiveMutation {
  id: MutationId;
  activatedAt: number;
  announced: boolean;
}

export interface IncidentConfig {
  seed: number;
  seedLabel: string;
  behaviourProfile: BehaviourProfile;
  infectionStartRoomId: string;
  mutationOrder: MutationId[];
  tutorialMode: boolean;
}

export interface TutorialHighlights {
  roomId: string | null;
  corridorId: string | null;
  highlightSeal: boolean;
  highlightSerum: boolean;
  highlightReinforce: boolean;
  pulseRoom: boolean;
  pulseCorridor: boolean;
}

export interface TutorialStepInfo {
  step: number;
  title: string;
  body: string;
  complete: boolean;
  active: boolean;
}

export interface SimulationSnapshot {
  tick: number;
  elapsedMs: number;
  phase: GamePhase;
  rooms: RoomRuntime[];
  corridors: CorridorRuntime[];
  resources: Resources;
  cooldowns: Cooldowns;
  coreIntegrity: number;
  facilityIntegrity: number;
  activeMutations: ActiveMutation[];
  lockdownUntil: number;
  score: number;
  infectionRoomsCleared: number;
  bulkheadsRemaining: number;
  failureReason: FailureReason | null;
  incident: IncidentConfig;
  selectedRoomId: string | null;
  selectedCorridorId: string | null;
  tutorialStep: number;
  firstAnomalyAt: number;
  messages: GameMessage[];
  tutorial: TutorialStepInfo | null;
  tutorialHighlights: TutorialHighlights | null;
  recentBreachCorridorId: string | null;
  recentSpreadRoomId: string | null;
}

export interface GameMessage {
  id: string;
  text: string;
  kind: "info" | "warning" | "mutation" | "tutorial";
  expiresAt: number;
}

export type SimulationEvent =
  | { type: "door_sealed"; corridorId: string }
  | { type: "door_reopened"; corridorId: string }
  | { type: "door_breach"; corridorId: string }
  | { type: "room_infected"; roomId: string }
  | { type: "room_lost"; roomId: string }
  | { type: "room_purged"; roomId: string }
  | { type: "serum_deployed"; roomId: string }
  | { type: "mutation"; mutationId: MutationId }
  | { type: "game_over"; reason: FailureReason }
  | { type: "lockdown_start" }
  | { type: "lockdown_end" };
