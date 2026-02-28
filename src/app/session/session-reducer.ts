import { evaluateWinCondition, type ResolveNightOutput } from "@/domain/engine";
import { ROLE_TYPES } from "@/domain/roles";
import { getInitialRoleStates } from "@/domain/rules";
import type { NightResult, RoleStateMap, RoleType } from "@/domain/types";
import {
  createNightActions,
  createRoleAssignments,
  createRoleCounts,
  type NightHistorySnapshot,
  type NightActionState,
  type PlayerEntry,
  type PublicStoryEvent,
  type SessionState,
  type TimelineEntry,
} from "@/lib/session";

type PreviousNightSnapshot = NightHistorySnapshot;
const MAX_HISTORY_SNAPSHOTS = 10;
const MAX_TIMELINE_ENTRIES = 50;
const MAX_PUBLIC_STORY_ENTRIES = 120;

export type SessionReducerState = {
  sessionActive: boolean;
  players: PlayerEntry[];
  roleCounts: Record<RoleType, number>;
  nightNumber: number;
  dayNumber: number;
  nightInProgress: boolean;
  dayInProgress: boolean;
  dayEliminationDone: boolean;
  wakeIndex: number;
  deadPlayerIds: string[];
  roleAssignments: Record<RoleType, string[]>;
  nightActions: NightActionState;
  roleStates: RoleStateMap;
  loverPairs: [string, string][];
  convertedOrigins: Record<string, RoleType>;
  previousNightSnapshot: PreviousNightSnapshot | null;
  historySnapshots: PreviousNightSnapshot[];
  timeline: TimelineEntry[];
  publicStoryLog: PublicStoryEvent[];
  lastNightResult: NightResult | null;
  winCondition: string | null;
};

type FieldUpdater<K extends keyof SessionReducerState> =
  | SessionReducerState[K]
  | ((current: SessionReducerState[K]) => SessionReducerState[K]);

export type SessionReducerAction =
  | { type: "hydrate"; payload: SessionState }
  | { type: "set-field"; field: keyof SessionReducerState; value: unknown }
  | { type: "start-night" }
  | {
      type: "complete-night";
      payload: {
        output: ResolveNightOutput;
        snapshot: PreviousNightSnapshot;
      };
    }
  | { type: "begin-day" }
  | {
      type: "resolve-day-elimination";
      payload: {
        nextDeadPlayerIds?: string[];
        markPostmanDeliveryUsed?: boolean;
        timelineDetail?: string;
        dayNumber?: number;
      };
    }
  | { type: "skip-day-hang"; payload?: { dayNumber?: number } }
  | { type: "rollback-night" }
  | { type: "restore-previous-night"; payload: SessionReducerState }
  | { type: "end-session" };

export function createInitialSessionReducerState(): SessionReducerState {
  return {
    sessionActive: false,
    players: [],
    roleCounts: createRoleCounts(ROLE_TYPES),
    nightNumber: 1,
    dayNumber: 0,
    nightInProgress: false,
    dayInProgress: false,
    dayEliminationDone: false,
    wakeIndex: 0,
    deadPlayerIds: [],
    roleAssignments: createRoleAssignments(ROLE_TYPES),
    nightActions: createNightActions(ROLE_TYPES),
    roleStates: getInitialRoleStates(),
    loverPairs: [],
    convertedOrigins: {},
    previousNightSnapshot: null,
    historySnapshots: [],
    timeline: [],
    publicStoryLog: [],
    lastNightResult: null,
    winCondition: null,
  };
}

function cloneRoleAssignments(assignments: Record<RoleType, string[]>): Record<RoleType, string[]> {
  const next = {} as Record<RoleType, string[]>;
  for (const role of ROLE_TYPES) next[role] = [...(assignments[role] ?? [])];
  return next;
}

function cloneNightActions(actions: NightActionState): NightActionState {
  const next = {} as NightActionState;
  for (const role of ROLE_TYPES) {
    const action = actions[role] ?? { targetIds: [] };
    next[role] = {
      targetIds: [...(action.targetIds ?? [])],
      metadata: action.metadata ? { ...action.metadata } : undefined,
    };
  }
  return next;
}

function clonePreviousNightSnapshot(snapshot: PreviousNightSnapshot | null): PreviousNightSnapshot | null {
  if (!snapshot) return null;
  return {
    nightNumber: snapshot.nightNumber,
    deadPlayerIds: [...snapshot.deadPlayerIds],
    roleAssignments: cloneRoleAssignments(snapshot.roleAssignments),
    nightActions: cloneNightActions(snapshot.nightActions),
    roleStates: structuredClone(snapshot.roleStates),
    loverPairs: snapshot.loverPairs.map((pair) => [pair[0], pair[1]] as [string, string]),
    convertedOrigins: snapshot.convertedOrigins ? { ...snapshot.convertedOrigins } : undefined,
  };
}

function cloneHistorySnapshots(snapshots: PreviousNightSnapshot[] | undefined): PreviousNightSnapshot[] {
  return (snapshots ?? []).map((snapshot) => clonePreviousNightSnapshot(snapshot)).filter(Boolean) as PreviousNightSnapshot[];
}

function appendBounded<T>(items: T[], item: T, max: number): T[] {
  const next = [...items, item];
  return next.length > max ? next.slice(next.length - max) : next;
}

function appendManyBounded<T>(items: T[], newItems: T[], max: number): T[] {
  if (newItems.length === 0) return items;
  const next = [...items, ...newItems];
  return next.length > max ? next.slice(next.length - max) : next;
}

function makeTimelineEntry(entry: Omit<TimelineEntry, "id">): TimelineEntry {
  return {
    ...entry,
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  };
}

function makePublicStoryEntry(entry: Omit<PublicStoryEvent, "id">): PublicStoryEvent {
  return {
    ...entry,
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  };
}

function buildPlayerRoleMap(assignments: Record<RoleType, string[]>): Record<string, RoleType> {
  const byPlayer: Record<string, RoleType> = {};
  for (const role of ROLE_TYPES) {
    for (const id of assignments[role] ?? []) {
      if (!id) continue;
      byPlayer[id] = role;
    }
  }
  return byPlayer;
}

function buildNightPublicStoryEvents(
  state: SessionReducerState,
  output: ResolveNightOutput
): PublicStoryEvent[] {
  const roleByPlayer = buildPlayerRoleMap(output.nextRoleAssignments);
  const events: PublicStoryEvent[] = [];
  const nightNumber = state.nightNumber;
  const getPlayerName = (id: string) => state.players.find((player) => player.id === id)?.name.trim() || "Unnamed";

  for (const playerId of output.result.deaths ?? []) {
    const role = roleByPlayer[playerId] ?? "Civilian";
    events.push(
      makePublicStoryEntry({
        phase: "night",
        category: "death",
        nightNumber,
        text: `Night ${nightNumber}: ${getPlayerName(playerId)} died. They were the ${role.replace(/([a-z])([A-Z])/g, "$1 $2")}.`,
      })
    );
  }

  for (const playerId of output.result.saves ?? []) {
    events.push(
      makePublicStoryEntry({
        phase: "night",
        category: "save",
        nightNumber,
        text: `Night ${nightNumber}: ${getPlayerName(playerId)} survived the night.`,
      })
    );
  }

  if ((output.result.deaths?.length ?? 0) === 0 && (output.result.saves?.length ?? 0) === 0) {
    events.push(
      makePublicStoryEntry({
        phase: "night",
        category: "no_casualties",
        nightNumber,
        text: `Night ${nightNumber}: No public casualties were reported.`,
      })
    );
  }

  return events;
}

function summarizeNightResult(output: ResolveNightOutput): string {
  const parts: string[] = [];
  if (output.result.deaths.length > 0) parts.push(`${output.result.deaths.length} death${output.result.deaths.length === 1 ? "" : "s"}`);
  if (output.result.saves.length > 0) parts.push(`${output.result.saves.length} save${output.result.saves.length === 1 ? "" : "s"}`);
  if ((output.result.recruits ?? []).length > 0) parts.push(`${(output.result.recruits ?? []).length} recruit${(output.result.recruits ?? []).length === 1 ? "" : "s"}`);
  if (output.result.blocked.length > 0) parts.push(`${output.result.blocked.length} blocked`);
  return parts.length > 0 ? parts.join(" · ") : "No major effects recorded";
}

function normalizeFromSaved(saved: SessionState): SessionReducerState {
  return {
    sessionActive: saved.sessionActive ?? false,
    players: saved.players ?? [],
    roleCounts: saved.roleCounts ?? createRoleCounts(ROLE_TYPES),
    nightNumber: saved.nightNumber ?? 1,
    dayNumber: saved.dayNumber ?? 0,
    nightInProgress: saved.nightInProgress ?? false,
    dayInProgress: saved.dayInProgress ?? false,
    dayEliminationDone: saved.dayEliminationDone ?? false,
    wakeIndex: saved.wakeIndex ?? 0,
    deadPlayerIds: saved.deadPlayerIds ?? [],
    roleAssignments: saved.roleAssignments ?? createRoleAssignments(ROLE_TYPES),
    nightActions: saved.nightActions ?? createNightActions(ROLE_TYPES),
    roleStates: saved.roleStates ?? getInitialRoleStates(),
    loverPairs: saved.loverPairs ?? [],
    convertedOrigins: saved.convertedOrigins ?? {},
    previousNightSnapshot: clonePreviousNightSnapshot(saved.previousNightSnapshot ?? null),
    historySnapshots: cloneHistorySnapshots(saved.historySnapshots as PreviousNightSnapshot[] | undefined),
    timeline: Array.isArray(saved.timeline) ? (saved.timeline as TimelineEntry[]) : [],
    publicStoryLog: Array.isArray(saved.publicStoryLog) ? (saved.publicStoryLog as PublicStoryEvent[]) : [],
    lastNightResult: saved.lastNightResult ?? null,
    winCondition: saved.winCondition ?? null,
  };
}

export function setSessionField<K extends keyof SessionReducerState>(
  field: K,
  value: FieldUpdater<K>
): SessionReducerAction {
  return { type: "set-field", field, value };
}

export function toPersistedSession(state: SessionReducerState): SessionState {
  return state;
}

export function sessionReducer(
  state: SessionReducerState,
  action: SessionReducerAction
): SessionReducerState {
  switch (action.type) {
    case "hydrate":
      return normalizeFromSaved(action.payload);
    case "set-field": {
      const current = state[action.field];
      const nextValue =
        typeof action.value === "function"
          ? (action.value as (value: typeof current) => typeof current)(current)
          : action.value;
      return { ...state, [action.field]: nextValue } as SessionReducerState;
    }
    case "start-night": {
      const nextRoleStates = state.roleStates.Vigilante.pendingLockout
        ? {
            ...state.roleStates,
            Vigilante: {
              ...state.roleStates.Vigilante,
              lockedOut: true,
              pendingLockout: false,
            },
          }
        : state.roleStates;
      return {
        ...state,
        timeline: appendBounded(
          state.timeline,
          makeTimelineEntry({
            kind: "system",
            title: `Night ${state.nightNumber} Started`,
            nightNumber: state.nightNumber,
          }),
          MAX_TIMELINE_ENTRIES
        ),
        roleStates: nextRoleStates,
        nightActions: createNightActions(ROLE_TYPES),
        wakeIndex: 0,
        lastNightResult: null,
        dayInProgress: false,
        dayEliminationDone: false,
        nightInProgress: true,
      };
    }
    case "complete-night": {
      const { output, snapshot } = action.payload;
      const nextConvertedOrigins = { ...state.convertedOrigins };
      for (const detail of output.result.recruitDetails ?? []) {
        nextConvertedOrigins[detail.playerId] = detail.fromRole;
      }
      const nightPublicEvents = buildNightPublicStoryEvents(state, output);
      return {
        ...state,
        previousNightSnapshot: clonePreviousNightSnapshot(snapshot),
        historySnapshots: appendBounded(
          state.historySnapshots,
          clonePreviousNightSnapshot(snapshot) as PreviousNightSnapshot,
          MAX_HISTORY_SNAPSHOTS
        ),
        timeline: appendBounded(
          state.timeline,
          makeTimelineEntry({
            kind: "night",
            title: `Night ${state.nightNumber} Resolved`,
            detail: summarizeNightResult(output),
            nightNumber: state.nightNumber,
            dayNumber: state.nightNumber + 1,
          }),
          MAX_TIMELINE_ENTRIES
        ),
        publicStoryLog: appendManyBounded(state.publicStoryLog, nightPublicEvents, MAX_PUBLIC_STORY_ENTRIES),
        deadPlayerIds: output.nextDeadPlayerIds,
        roleAssignments: output.nextRoleAssignments,
        roleStates: output.nextRoleStates,
        loverPairs: output.nextLoverPairs,
        lastNightResult: output.result,
        convertedOrigins: nextConvertedOrigins,
        winCondition: evaluateWinCondition(state.players, output.nextDeadPlayerIds, output.nextRoleAssignments),
        nightInProgress: false,
        wakeIndex: 0,
        dayNumber: state.nightNumber + 1,
        dayInProgress: false,
        dayEliminationDone: false,
        nightNumber: state.nightNumber + 1,
      };
    }
    case "begin-day":
      return {
        ...state,
        timeline: appendBounded(
          state.timeline,
          makeTimelineEntry({
            kind: "day",
            title: `Day ${(state.dayNumber || state.nightNumber)} Started`,
            dayNumber: state.dayNumber || state.nightNumber,
            nightNumber: Math.max(1, (state.dayNumber || state.nightNumber) - 1),
          }),
          MAX_TIMELINE_ENTRIES
        ),
        dayInProgress: true,
        dayEliminationDone: false,
      };
    case "resolve-day-elimination": {
      const nextDeadPlayerIds = action.payload.nextDeadPlayerIds ?? state.deadPlayerIds;
      const nextRoleStates = action.payload.markPostmanDeliveryUsed
        ? {
            ...state.roleStates,
            Postman: {
              ...state.roleStates.Postman,
              usedDelivery: true,
            },
          }
        : state.roleStates;
      const nextWinCondition = action.payload.nextDeadPlayerIds
        ? evaluateWinCondition(state.players, nextDeadPlayerIds, state.roleAssignments)
        : state.winCondition;
      const dayNumber = (action.payload.dayNumber ?? state.dayNumber) || state.nightNumber;
      const roleByPlayer = buildPlayerRoleMap(state.roleAssignments);
      const getPlayerName = (id: string) => state.players.find((player) => player.id === id)?.name.trim() || "Unnamed";
      const newDeaths = nextDeadPlayerIds.filter((id) => !state.deadPlayerIds.includes(id));
      const dayPublicEvents =
        newDeaths.length > 0
          ? newDeaths.map((playerId) =>
              makePublicStoryEntry({
                phase: "day",
                category: "day_elimination",
                dayNumber,
                nightNumber: Math.max(1, dayNumber - 1),
                text: `Day ${dayNumber}: ${getPlayerName(playerId)} was eliminated. They were the ${(roleByPlayer[playerId] ?? "Civilian").replace(/([a-z])([A-Z])/g, "$1 $2")}.`,
              })
            )
          : [
              makePublicStoryEntry({
                phase: "day",
                category: "day_no_elimination",
                dayNumber,
                nightNumber: Math.max(1, dayNumber - 1),
                text: `Day ${dayNumber}: No public elimination occurred.`,
              }),
            ];
      return {
        ...state,
        timeline: appendBounded(
          state.timeline,
          makeTimelineEntry({
            kind: "day",
            title: `Day ${(action.payload.dayNumber ?? state.dayNumber) || state.nightNumber} Resolution`,
            detail: action.payload.timelineDetail,
            dayNumber: (action.payload.dayNumber ?? state.dayNumber) || state.nightNumber,
            nightNumber: Math.max(1, (((action.payload.dayNumber ?? state.dayNumber) || state.nightNumber) - 1)),
          }),
          MAX_TIMELINE_ENTRIES
        ),
        publicStoryLog: appendManyBounded(state.publicStoryLog, dayPublicEvents, MAX_PUBLIC_STORY_ENTRIES),
        deadPlayerIds: nextDeadPlayerIds,
        roleStates: nextRoleStates,
        winCondition: nextWinCondition,
        dayEliminationDone: true,
      };
    }
    case "skip-day-hang":
      return {
        ...state,
        timeline: appendBounded(
          state.timeline,
          makeTimelineEntry({
            kind: "day",
            title: `Day ${(action.payload?.dayNumber ?? state.dayNumber) || state.nightNumber} Resolution`,
            detail: "Town skipped the daytime hang.",
            dayNumber: (action.payload?.dayNumber ?? state.dayNumber) || state.nightNumber,
            nightNumber: Math.max(1, (((action.payload?.dayNumber ?? state.dayNumber) || state.nightNumber) - 1)),
          }),
          MAX_TIMELINE_ENTRIES
        ),
        publicStoryLog: appendBounded(
          state.publicStoryLog,
          makePublicStoryEntry({
            phase: "day",
            category: "day_no_elimination",
            dayNumber: (action.payload?.dayNumber ?? state.dayNumber) || state.nightNumber,
            nightNumber: Math.max(1, (((action.payload?.dayNumber ?? state.dayNumber) || state.nightNumber) - 1)),
            text: `Day ${(action.payload?.dayNumber ?? state.dayNumber) || state.nightNumber}: Town skipped the elimination vote.`,
          }),
          MAX_PUBLIC_STORY_ENTRIES
        ),
        dayEliminationDone: true,
      };
    case "rollback-night": {
      const historySnapshot = state.historySnapshots[state.historySnapshots.length - 1] ?? state.previousNightSnapshot;
      if (historySnapshot) {
        const nextHistorySnapshots = state.historySnapshots.slice(0, -1);
        return {
          ...state,
          previousNightSnapshot: nextHistorySnapshots[nextHistorySnapshots.length - 1] ?? null,
          historySnapshots: nextHistorySnapshots,
          timeline: appendBounded(
            state.timeline,
            makeTimelineEntry({
              kind: "system",
              title: `Rolled Back to Night ${historySnapshot.nightNumber}`,
              nightNumber: historySnapshot.nightNumber,
            }),
            MAX_TIMELINE_ENTRIES
          ),
          nightNumber: historySnapshot.nightNumber,
          deadPlayerIds: [...historySnapshot.deadPlayerIds],
          roleAssignments: cloneRoleAssignments(historySnapshot.roleAssignments),
          nightActions: cloneNightActions(historySnapshot.nightActions),
          roleStates: structuredClone(historySnapshot.roleStates),
          loverPairs: historySnapshot.loverPairs.map((pair) => [pair[0], pair[1]] as [string, string]),
          convertedOrigins: { ...(historySnapshot.convertedOrigins ?? {}) },
          winCondition: null,
          dayNumber: 0,
          dayInProgress: false,
          dayEliminationDone: false,
          nightInProgress: true,
          wakeIndex: 0,
          lastNightResult: null,
          publicStoryLog: state.publicStoryLog.filter((entry) => (entry.nightNumber ?? 0) < historySnapshot.nightNumber),
        };
      }

      const targetNight = Math.max(1, state.nightNumber - 1);
      const rolledBackDeaths = new Set(state.lastNightResult?.deaths ?? []);
      const rolledBackRecruits = new Set(state.lastNightResult?.recruits ?? []);

      const nextDeadPlayerIds = state.deadPlayerIds.filter((id) => !rolledBackDeaths.has(id));
      let nextConvertedOrigins = state.convertedOrigins;
      if (rolledBackRecruits.size > 0) {
        nextConvertedOrigins = Object.fromEntries(
          Object.entries(state.convertedOrigins).filter(([playerId]) => !rolledBackRecruits.has(playerId))
        );
      }

      let nextRoleStates = state.roleStates;
      let nextLoverPairs = state.loverPairs;
      if (targetNight === 1) {
        nextRoleStates = getInitialRoleStates();
        nextLoverPairs = [];
      }

      return {
        ...state,
        timeline: appendBounded(
          state.timeline,
          makeTimelineEntry({
            kind: "system",
            title: `Rolled Back to Night ${targetNight}`,
            nightNumber: targetNight,
          }),
          MAX_TIMELINE_ENTRIES
        ),
        nightNumber: targetNight,
        deadPlayerIds: nextDeadPlayerIds,
        convertedOrigins: nextConvertedOrigins,
        roleStates: nextRoleStates,
        loverPairs: nextLoverPairs,
        nightActions: createNightActions(ROLE_TYPES),
        publicStoryLog: state.publicStoryLog.filter((entry) => (entry.nightNumber ?? 0) < targetNight),
        winCondition: null,
        dayNumber: 0,
        dayInProgress: false,
        dayEliminationDone: false,
        nightInProgress: true,
        wakeIndex: 0,
        lastNightResult: null,
      };
    }
    case "restore-previous-night":
      return action.payload;
    case "end-session":
      return {
        ...state,
        sessionActive: false,
        timeline: appendBounded(
          state.timeline,
          makeTimelineEntry({ kind: "system", title: "Session Ended" }),
          MAX_TIMELINE_ENTRIES
        ),
      };
    default:
      return state;
  }
}
