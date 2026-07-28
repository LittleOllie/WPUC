import { DOORS, TUTORIAL } from "../config/balance";
import type { CorridorRuntime, RoomRuntime } from "../types";

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
  canSkip: boolean;
}

const TOTAL_STEPS = TUTORIAL.steps.length;

export class TutorialSystem {
  step = 0;
  skipped = false;
  readonly enabled: boolean;
  readonly targetRoomId: string;
  readonly targetCorridorId: string;
  sealedTargetDoor = false;
  serumDeployed = false;
  reinforced = false;

  constructor(
    enabled: boolean,
    targetRoomId = TUTORIAL.startRoomId,
    targetCorridorId = TUTORIAL.targetCorridorId,
  ) {
    this.enabled = enabled;
    this.targetRoomId = targetRoomId;
    this.targetCorridorId = targetCorridorId;
  }

  reset(): void {
    this.step = 0;
    this.skipped = false;
    this.sealedTargetDoor = false;
    this.serumDeployed = false;
    this.reinforced = false;
  }

  skip(): void {
    this.skipped = true;
    this.step = TOTAL_STEPS;
  }

  isActive(): boolean {
    return this.enabled && !this.skipped && this.step < TOTAL_STEPS;
  }

  getStepInfo(): TutorialStepInfo {
    const def = TUTORIAL.steps[this.step] ?? TUTORIAL.steps[TOTAL_STEPS - 1]!;
    return {
      step: this.step,
      title: def.title,
      body: def.body,
      complete: this.step >= TOTAL_STEPS,
      canSkip: true,
    };
  }

  getHighlights(
    _selectedRoomId: string | null,
    selectedCorridorId: string | null,
    corridors: CorridorRuntime[],
  ): TutorialHighlights {
    if (!this.isActive()) {
      return {
        roomId: null,
        corridorId: null,
        highlightSeal: false,
        highlightSerum: false,
        highlightReinforce: false,
        pulseRoom: false,
        pulseCorridor: false,
      };
    }

    const targetCorridor = corridors.find((c) => c.id === this.targetCorridorId);
    const doorIntegrity = targetCorridor?.integrity ?? 100;

    switch (this.step) {
      case 0:
        return {
          roomId: this.targetRoomId,
          corridorId: null,
          highlightSeal: false,
          highlightSerum: false,
          highlightReinforce: false,
          pulseRoom: true,
          pulseCorridor: false,
        };
      case 1:
      case 2:
        return {
          roomId: this.targetRoomId,
          corridorId: this.targetCorridorId,
          highlightSeal: false,
          highlightSerum: false,
          highlightReinforce: false,
          pulseRoom: true,
          pulseCorridor: true,
        };
      case 3:
        return {
          roomId: this.targetRoomId,
          corridorId: selectedCorridorId === this.targetCorridorId ? this.targetCorridorId : this.targetCorridorId,
          highlightSeal: selectedCorridorId === this.targetCorridorId,
          highlightSerum: false,
          highlightReinforce: false,
          pulseRoom: true,
          pulseCorridor: true,
        };
      case 4:
        return {
          roomId: this.targetRoomId,
          corridorId: this.targetCorridorId,
          highlightSeal: false,
          highlightSerum: false,
          highlightReinforce: false,
          pulseRoom: true,
          pulseCorridor: true,
        };
      case 5:
        return {
          roomId: this.targetRoomId,
          corridorId: null,
          highlightSeal: false,
          highlightSerum: true,
          highlightReinforce: false,
          pulseRoom: true,
          pulseCorridor: false,
        };
      case 6:
        return {
          roomId: null,
          corridorId: this.targetCorridorId,
          highlightSeal: false,
          highlightSerum: false,
          highlightReinforce: doorIntegrity <= TUTORIAL.reinforceIntegrityThreshold,
          pulseRoom: false,
          pulseCorridor: true,
        };
      case 7:
        return {
          roomId: "core",
          corridorId: null,
          highlightSeal: false,
          highlightSerum: false,
          highlightReinforce: false,
          pulseRoom: true,
          pulseCorridor: false,
        };
      default:
        return {
          roomId: null,
          corridorId: null,
          highlightSeal: false,
          highlightSerum: false,
          highlightReinforce: false,
          pulseRoom: false,
          pulseCorridor: false,
        };
    }
  }

  /** Block simulation spread until player seals the tutorial door */
  shouldBlockSpread(): boolean {
    return this.isActive() && this.step < 4 && !this.sealedTargetDoor;
  }

  onRoomSelected(roomId: string): void {
    if (!this.isActive()) return;
    if (this.step === 2 && roomId === this.targetRoomId) {
      /* room select ok but need corridor */
    }
    if (this.step === 5 && roomId === this.targetRoomId) {
      /* waiting for serum action */
    }
  }

  onCorridorSelected(corridorId: string): boolean {
    if (!this.isActive()) return true;
    if (this.step === 2) {
      if (corridorId === this.targetCorridorId) {
        this.step = 3;
        return true;
      }
      return false;
    }
    if (this.step === 3) return corridorId === this.targetCorridorId;
    return true;
  }

  onDoorSealed(corridorId: string): void {
    if (corridorId === this.targetCorridorId) {
      this.sealedTargetDoor = true;
      if (this.step === 3) this.step = 4;
    }
  }

  onSerumDeployed(roomId: string): void {
    if (roomId === this.targetRoomId) {
      this.serumDeployed = true;
      if (this.step === 5) this.step = 6;
    }
  }

  onReinforced(corridorId: string): void {
    if (corridorId === this.targetCorridorId) {
      this.reinforced = true;
      if (this.step === 6) this.step = 7;
    }
  }

  tick(
    elapsedMs: number,
    corridors: CorridorRuntime[],
    startRoom: RoomRuntime | undefined,
  ): void {
    if (!this.isActive()) return;

    if (this.step === 0 && elapsedMs > 0) {
      this.step = 1;
    }

    if (this.step === 1 && elapsedMs > 2000) {
      this.step = 2;
    }

    if (this.step === 4 && elapsedMs > 0) {
      const c = corridors.find((x) => x.id === this.targetCorridorId);
      if (c && c.state === "sealed" && c.pressure > 8) {
        if (startRoom && startRoom.infectionStage !== "incubation") {
          if (startRoom.infectionStage === "exposure") {
            startRoom.infectionStage = "incubation";
            startRoom.state = "incubating";
            startRoom.infectionAmount = 0.35;
          }
        }
        if (elapsedMs > 3000 || c.pressure > 15) {
          this.step = 5;
        }
      }
    }

    if (this.step === 6) {
      const c = corridors.find((x) => x.id === this.targetCorridorId);
      if (c && c.integrity <= TUTORIAL.reinforceIntegrityThreshold) {
        /* reinforce step active */
      } else if (this.reinforced) {
        this.step = 7;
      }
    }

    if (this.step === 7 && elapsedMs > 5000) {
      this.step = TOTAL_STEPS;
    }
  }

  getPressureMultiplier(): number {
    if (this.isActive() && this.sealedTargetDoor) {
      return DOORS.tutorialPressureMultiplier;
    }
    return 1;
  }

  getSpreadIntervalMultiplier(): number {
    if (this.isActive() && this.step < 4) return 999;
    if (this.isActive()) return 1.8;
    return 1;
  }
}
