import type { NightResult, RoleStateMap, RoleType } from "@/domain/types";

export type PlayerEntry = { id: string; name: string };

export type NightActionState = Record<
  RoleType,
  { targetIds: string[]; metadata?: { choice?: "kill" | "save" | "none" } }
>;

export type RoleAssignments = Record<RoleType, string[]>;

export type NightHistorySnapshot = {
  nightNumber: number;
  deadPlayerIds: string[];
  roleAssignments: RoleAssignments;
  nightActions: NightActionState;
  roleStates: RoleStateMap;
  loverPairs: [string, string][];
  convertedOrigins?: Record<string, RoleType>;
};

export type TimelineEntry = {
  id: string;
  kind: "night" | "day" | "system";
  title: string;
  detail?: string;
  nightNumber?: number;
  dayNumber?: number;
};

export type SessionState = {
  schemaVersion?: number;
  players: PlayerEntry[];
  roleCounts: Record<RoleType, number>;
  nightNumber: number;
  dayNumber?: number;
  nightInProgress: boolean;
  dayInProgress?: boolean;
  dayEliminationDone?: boolean;
  wakeIndex: number;
  sessionActive: boolean;
  roleAssignments: RoleAssignments;
  nightActions: NightActionState;
  deadPlayerIds?: string[];
  roleStates?: RoleStateMap;
  loverPairs?: [string, string][];
  previousNightSnapshot?: NightHistorySnapshot | null;
  historySnapshots?: NightHistorySnapshot[];
  timeline?: TimelineEntry[];
  lastNightResult?: NightResult | null;
  convertedOrigins?: Record<string, RoleType>;
  winCondition?: string | null;
};

export const SESSION_STORAGE_KEY = "mafia-helper-session";
export const SESSION_SCHEMA_VERSION = 2;

export function createRoleAssignments(roleTypes: RoleType[]): RoleAssignments {
  const initial = {} as RoleAssignments;
  for (const role of roleTypes) initial[role] = [];
  return initial;
}

export function createNightActions(roleTypes: RoleType[]): NightActionState {
  const initial = {} as NightActionState;
  for (const role of roleTypes) initial[role] = { targetIds: [] };
  return initial;
}

export function createRoleCounts(roleTypes: RoleType[]): Record<RoleType, number> {
  const initial = {} as Record<RoleType, number>;
  for (const role of roleTypes) initial[role] = 0;
  return initial;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function migrateSession(raw: unknown): SessionState | null {
  if (!isRecord(raw)) return null;
  const migrated: Record<string, unknown> = { ...raw };
  const version = typeof raw.schemaVersion === "number" ? raw.schemaVersion : 0;

  // v0 -> v1: add explicit schema version to legacy saved sessions.
  if (version < 1) {
    migrated.schemaVersion = SESSION_SCHEMA_VERSION;
  }
  // v1 -> v2: initialize bounded history/timeline containers.
  if (version < 2) {
    migrated.historySnapshots = Array.isArray(migrated.historySnapshots) ? migrated.historySnapshots : [];
    migrated.timeline = Array.isArray(migrated.timeline) ? migrated.timeline : [];
    migrated.schemaVersion = SESSION_SCHEMA_VERSION;
  }

  if (
    !Array.isArray(migrated.players) ||
    !isRecord(migrated.roleCounts) ||
    typeof migrated.nightNumber !== "number" ||
    typeof migrated.nightInProgress !== "boolean" ||
    typeof migrated.wakeIndex !== "number" ||
    typeof migrated.sessionActive !== "boolean" ||
    !isRecord(migrated.roleAssignments) ||
    !isRecord(migrated.nightActions)
  ) {
    return null;
  }

  return migrated as SessionState;
}

export function loadSession(): SessionState | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(SESSION_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    const migrated = migrateSession(parsed);
    if (!migrated) {
      localStorage.removeItem(SESSION_STORAGE_KEY);
      return null;
    }
    return migrated;
  } catch {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    return null;
  }
}

export function saveSession(state: SessionState) {
  if (typeof window === "undefined") return;
  localStorage.setItem(
    SESSION_STORAGE_KEY,
    JSON.stringify({ ...state, schemaVersion: SESSION_SCHEMA_VERSION } satisfies SessionState)
  );
}

export function clearSession() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(SESSION_STORAGE_KEY);
}
