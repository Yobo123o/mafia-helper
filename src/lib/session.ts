import type { NightResult, RoleStateMap, RoleType } from "@/domain/types";

export type PlayerEntry = { id: string; name: string };

export type NightActionState = Record<
  RoleType,
  { targetIds: string[]; metadata?: { choice?: "kill" | "save" | "none" } }
>;

export type RoleAssignments = Record<RoleType, string[]>;

export type SessionState = {
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
  previousNightSnapshot?: {
    nightNumber: number;
    deadPlayerIds: string[];
    roleAssignments: RoleAssignments;
    nightActions: NightActionState;
    roleStates: RoleStateMap;
    loverPairs: [string, string][];
    convertedOrigins?: Record<string, RoleType>;
  } | null;
  lastNightResult?: NightResult | null;
  convertedOrigins?: Record<string, RoleType>;
  winCondition?: string | null;
};

export const SESSION_STORAGE_KEY = "mafia-helper-session";

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

export function loadSession(): SessionState | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(SESSION_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SessionState;
  } catch {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    return null;
  }
}

export function saveSession(state: SessionState) {
  if (typeof window === "undefined") return;
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(state));
}

export function clearSession() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(SESSION_STORAGE_KEY);
}
