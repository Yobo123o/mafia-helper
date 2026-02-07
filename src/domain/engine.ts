import type { RoleType } from "./types";

export type ResolutionPhase =
  | "TargetModifiers"
  | "AbilityBlocks"
  | "Protection"
  | "Kills"
  | "PassiveEffects"
  | "Investigations";

export const RESOLUTION_ORDER: ResolutionPhase[] = [
  "TargetModifiers",
  "AbilityBlocks",
  "Protection",
  "Kills",
  "PassiveEffects",
  "Investigations",
];

export const KILL_ROLES: RoleType[] = [
  "Mafia",
  "Vigilante",
  "SerialKiller",
  "Magician",
];
