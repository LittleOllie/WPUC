import { ALL_MUTATIONS } from "./layoutValidation";
import { MUTATIONS, TUTORIAL } from "../config/balance";
import type {
  BehaviourProfile,
  IncidentConfig,
  MutationId,
} from "../types";
import { ALPHA_LAYOUT } from "../data/alphaLayout";
import {
  formatIncidentLabel,
  hashStringToSeed,
  SeededRandom,
} from "../utils/SeededRandom";

const PROFILES: BehaviourProfile[] = [
  "expansive",
  "predatory",
  "burrowing",
  "dormant",
];

export function createIncidentFromSeed(
  seed: number,
  tutorialMode = false,
): IncidentConfig {
  const rng = new SeededRandom(seed);
  const candidates =
    ALPHA_LAYOUT.infectionStartCandidates ??
    ALPHA_LAYOUT.rooms
      .filter((r) => r.type === "standard_lab")
      .map((r) => r.id);

  const infectionStartRoomId = tutorialMode
    ? TUTORIAL.startRoomId
    : rng.pick(candidates);
  const behaviourProfile = rng.pick(PROFILES);
  const mutationOrder = rng.shuffle([...ALL_MUTATIONS]) as MutationId[];

  return {
    seed,
    seedLabel: formatIncidentLabel(seed),
    behaviourProfile,
    infectionStartRoomId,
    mutationOrder,
    tutorialMode,
  };
}

export function createNewIncident(tutorialMode = false): IncidentConfig {
  const seed = (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0 || 1;
  return createIncidentFromSeed(seed, tutorialMode);
}

export function createIncidentFromLabel(label: string): IncidentConfig {
  return createIncidentFromSeed(hashStringToSeed(label));
}

export function getMutationSchedule(
  incident: IncidentConfig,
): { id: MutationId; atMs: number }[] {
  const base = incident.tutorialMode
    ? MUTATIONS.tutorialFirstMutationMs
    : MUTATIONS.firstMutationMs;
  const gap = MUTATIONS.secondMutationMs - MUTATIONS.firstMutationMs;

  return incident.mutationOrder.map((id, i) => ({
    id,
    atMs: base + gap * i,
  }));
}

export function getMutationDescription(id: MutationId): {
  title: string;
  body: string;
} {
  switch (id) {
    case "corrosive_response":
      return {
        title: "CORROSIVE RESPONSE",
        body: "Bulkhead decay increased.",
      };
    case "dormant_carriers":
      return {
        title: "DORMANT CARRIERS",
        body: "Incubation stages partially obscured.",
      };
    case "airborne":
      return {
        title: "AIRBORNE",
        body: "Infection may bypass one sealed route under high density.",
      };
    default:
      return { title: "UNKNOWN", body: "" };
  }
}
