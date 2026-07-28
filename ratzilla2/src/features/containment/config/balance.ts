/** Central balance configuration — tune gameplay here */

export const SIM = {
  tickMs: 50,
  maxCatchUpTicks: 5,
} as const;

export const RESOURCES = {
  powerMax: 100,
  serumMax: 8,
  engineeringMax: 12,
  purgeMax: 2,
  initialPower: 85,
  initialSerum: 4,
  initialEngineering: 6,
  initialPurge: 2,
  powerRegenNormal: 0.09,
  powerRegenReduced: 0.025,
  powerRegenEmergency: 0.012,
  serumRegenNormal: 0.018,
  serumRegenReduced: 0.005,
  engineeringRegenNormal: 0.014,
  engineeringRegenReduced: 0.004,
} as const;

export const DOORS = {
  baseMaxIntegrity: 100,
  sealPowerCost: 2,
  reopenPowerCost: 0,
  doorActionCooldownMs: 350,
  pressureBuildRate: 0.48,
  integrityDecayRate: 0.32,
  breachSpreadBurst: 0.55,
  reinforceCost: 3,
  reinforceAmount: 35,
  reinforceMaxBonus: 25,
  securityIntegrityBonus: 15,
  corrosiveDecayMultiplier: 1.8,
  /** Tutorial: pressure builds faster on sealed door so step 5–6 is visible */
  tutorialPressureMultiplier: 2.2,
} as const;

export const INFECTION = {
  incubationMs: 5000,
  exposureToIncubationMs: 2800,
  spreadIntervalMs: 1300,
  spreadAmount: 0.24,
  criticalThreshold: 0.72,
  collapseThreshold: 1,
  chainGrowthRate: 0.065,
  serumReduction: 0.55,
  serumProtectionMs: 12000,
  serumCooldownMs: 2200,
  pressureContribution: 0.72,
  coreDamageRate: 0.11,
  /** Standard mode: first anomaly ~6s after playing starts */
  firstAnomalyDelayMs: 6000,
  /** Tutorial: controlled ~8s */
  tutorialFirstAnomalyMs: 8000,
  /** Second infection front — standard mode */
  secondFrontDelayMs: 30000,
  tutorialSecondFrontDelayMs: 90000,
  incubationGrowthRate: 0.004,
  activeGrowthRate: 0.0025,
} as const;

export const ABILITIES = {
  lockdownDurationMs: 6000,
  lockdownPowerCost: 25,
  lockdownCooldownMs: 40000,
  lockdownPressureMultiplier: 0.4,
  purgeConfirmMs: 600,
  reinforceDurationMs: 1500,
} as const;

export const MUTATIONS = {
  firstMutationMs: 52000,
  secondMutationMs: 110000,
  thirdMutationMs: 180000,
  tutorialFirstMutationMs: 120000,
  airborneThreshold: 0.65,
  airborneVentilationReduction: 0.7,
  dormantObscureChance: 0.55,
} as const;

export const SCORING = {
  timeMultiplier: 10,
  coreIntegrityBonus: 50,
  systemBonus: 25,
  purgePenalty: 100,
  infectionClearBonus: 15,
  bulkheadBonus: 5,
} as const;

export const CORE = {
  maxIntegrity: 100,
  facilityIntegrity: 100,
} as const;

export const RUN_FLOW = {
  bootDurationMs: 2200,
  introDurationMs: 4500,
  briefingMinMs: 2000,
} as const;

/** Scripted tutorial — fixed room/corridor for first run */
export const TUTORIAL = {
  startRoomId: "lab-ne-3",
  targetCorridorId: "c-ne2-ne3",
  steps: [
    { id: 0, title: "ANOMALY DETECTED", body: "LAB-NE3" },
    { id: 1, title: "INFECTION SPREADS", body: "Through open corridors" },
    { id: 2, title: "SELECT THE HIGHLIGHTED CORRIDOR", body: "" },
    { id: 3, title: "PRESS SEAL / OPEN", body: "Block infection spread" },
    { id: 4, title: "BULKHEAD SEALED", body: "Pressure will build behind this door" },
    { id: 5, title: "SELECT THE INFECTED ROOM", body: "DEPLOY SERUM" },
    { id: 6, title: "DOOR WEAKENING", body: "Select sealed bulkhead → REINFORCE" },
    { id: 7, title: "PROTECT THE CONTAINMENT CORE", body: "Core at 0% = incident lost" },
  ],
  /** Reinforce step triggers when tutorial door integrity drops below this */
  reinforceIntegrityThreshold: 55,
} as const;

export const ROOM_LABELS: Record<string, string> = {
  containment_core: "CORE",
  power_generator: "PWR",
  serum_synthesis: "SER",
  scanner_array: "SCN",
  security_control: "SEC",
  standard_lab: "LAB",
  maintenance: "MNT",
  ventilation: "VNT",
};

export const ROOM_TYPE_NAMES: Record<string, string> = {
  containment_core: "Containment Core",
  power_generator: "Power Generator",
  serum_synthesis: "Serum Synthesis",
  scanner_array: "Scanner Array",
  security_control: "Security Control",
  standard_lab: "Standard Lab",
  maintenance: "Maintenance",
  ventilation: "Ventilation",
};

/** Display id for corridors e.g. B-04 */
export function corridorDisplayId(corridorId: string): string {
  const hash = corridorId.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return `B-${String((hash % 90) + 10).padStart(2, "0")}`;
}
