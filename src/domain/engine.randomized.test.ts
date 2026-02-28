import { describe, expect, it } from "vitest";
import { evaluateWinCondition, resolveNight } from "./engine";
import { ROLE_DEFINITIONS, ROLE_TYPES, type RoleDefinition } from "./roles";
import { getInitialRoleStates } from "./rules";
import type { NightAction, RoleStateMap, RoleType } from "./types";

const NO_ACTION = "__no_action__";
const UNIQUE_ROLES = new Set<RoleType>([
  "Civilian",
  "Detective",
  "Doctor",
  "Miller",
  "Cupid",
  "BusDriver",
  "UndercoverCop",
  "Grandma",
  "Magician",
  "Postman",
  "Vigilante",
  "Godfather",
  "RivalGodfather",
  "Lawyer",
  "MadeMan",
  "Bartender",
  "SerialKiller",
]);

type Player = { id: string; name: string };

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let x = Math.imul(t ^ (t >>> 15), t | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function randomInt(rand: () => number, min: number, max: number): number {
  return Math.floor(rand() * (max - min + 1)) + min;
}

function shuffle<T>(items: T[], rand: () => number): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function makePlayers(count: number): Player[] {
  return Array.from({ length: count }).map((_, index) => ({
    id: `p-${index + 1}`,
    name: `Player ${index + 1}`,
  }));
}

function emptyAssignments(): Record<RoleType, string[]> {
  const out = {} as Record<RoleType, string[]>;
  for (const role of ROLE_TYPES) out[role] = [];
  return out;
}

function emptyNightActions(): Record<RoleType, { targetIds: string[]; metadata?: { choice?: "kill" | "save" | "none" } }> {
  const out = {} as Record<RoleType, { targetIds: string[]; metadata?: { choice?: "kill" | "save" | "none" } }>;
  for (const role of ROLE_TYPES) out[role] = { targetIds: [] };
  return out;
}

function assignRoles(players: Player[], rand: () => number): Record<RoleType, string[]> {
  const assignments = emptyAssignments();
  let available = shuffle(
    players.map((p) => p.id),
    rand
  );

  for (const role of ROLE_TYPES) {
    if (role === "Civilian") continue;
    const roleDef = ROLE_DEFINITIONS[role];
    const canAct = Boolean(roleDef.action && roleDef.action.targetCount > 0);
    const includeRole = canAct ? rand() < 0.7 : rand() < 0.45;
    if (!includeRole || available.length === 0) continue;

    const maxCount = UNIQUE_ROLES.has(role) ? 1 : Math.min(3, available.length);
    const count = randomInt(rand, 1, maxCount);
    assignments[role] = available.slice(0, count);
    available = available.slice(count);
  }

  return assignments;
}

function maybeDead(players: Player[], rand: () => number): string[] {
  return players.filter(() => rand() < 0.18).map((p) => p.id);
}

function randomTargetId(pool: string[], rand: () => number): string {
  if (pool.length === 0) return "";
  const roll = rand();
  if (roll < 0.12) return "";
  if (roll < 0.2) return NO_ACTION;
  return pool[randomInt(rand, 0, pool.length - 1)];
}

function randomNightActions(
  players: Player[],
  roleStates: RoleStateMap,
  nightNumber: number,
  rand: () => number
): Record<RoleType, { targetIds: string[]; metadata?: { choice?: "kill" | "save" | "none" } }> {
  const ids = players.map((p) => p.id);
  const actions = emptyNightActions();

  for (const role of ROLE_TYPES) {
    const def: RoleDefinition = ROLE_DEFINITIONS[role];
    const count = def.action?.targetCount ?? 0;
    const targetIds = Array.from({ length: count }).map(() => randomTargetId(ids, rand));

    const base: NightAction = { role, targetIds };
    if (role === "Magician") {
      const choices: Array<"kill" | "save" | "none"> = [];
      if (!roleStates.Magician.usedKill) choices.push("kill");
      if (!roleStates.Magician.usedSave) choices.push("save");
      choices.push("none");
      base.metadata = { choice: choices[randomInt(rand, 0, choices.length - 1)] };
      if (base.metadata.choice === "none") base.targetIds = [];
    }
    if (role === "Vigilante" && nightNumber === 1) {
      base.targetIds = [];
    }

    actions[role] = { targetIds: base.targetIds, metadata: base.metadata };
  }

  return actions;
}

function assertUniqueAssignments(assignments: Record<RoleType, string[]>) {
  const seen = new Set<string>();
  for (const role of ROLE_TYPES) {
    for (const id of assignments[role] ?? []) {
      if (!id) continue;
      expect(seen.has(id), `duplicate role assignment for ${id}`).toBe(false);
      seen.add(id);
    }
  }
}

describe("randomized night simulations", () => {
  it("should preserve core invariants over many random nights", () => {
    const seeds = Array.from({ length: 60 }).map((_, index) => 9000 + index);

    for (const seed of seeds) {
      const rand = mulberry32(seed);
      const playerCount = randomInt(rand, 8, 18);
      const players = makePlayers(playerCount);
      const playerIds = new Set(players.map((p) => p.id));

      let roleAssignments = assignRoles(players, rand);
      let roleStates = getInitialRoleStates();
      let deadPlayerIds = maybeDead(players, rand);
      let loverPairs: [string, string][] = [];
      let nightNumber = 1;

      assertUniqueAssignments(roleAssignments);
      deadPlayerIds.forEach((id) => expect(playerIds.has(id)).toBe(true));

      for (let step = 0; step < 6; step++) {
        const nightActions = randomNightActions(players, roleStates, nightNumber, rand);

        const output = resolveNight({
          nightNumber,
          players,
          deadPlayerIds,
          roleAssignments,
          nightActions,
          roleStates,
          loverPairs,
        });

        output.nextDeadPlayerIds.forEach((id) => expect(playerIds.has(id)).toBe(true));
        deadPlayerIds.forEach((id) => expect(output.nextDeadPlayerIds).toContain(id));
        expect(new Set(output.nextDeadPlayerIds).size).toBe(output.nextDeadPlayerIds.length);

        assertUniqueAssignments(output.nextRoleAssignments);

        expect(output.result.deaths.every((id) => output.nextDeadPlayerIds.includes(id))).toBe(true);
        expect(new Set(output.result.deaths).size).toBe(output.result.deaths.length);
        expect(output.result.deathDetails?.map((d) => d.playerId).sort() ?? []).toEqual(
          [...output.result.deaths].sort()
        );
        output.result.investigations.forEach((investigation) => {
          expect(playerIds.has(investigation.targetId)).toBe(true);
          expect(["Innocent", "Guilty"]).toContain(investigation.result);
        });

        (output.result.recruits ?? []).forEach((id) => {
          expect(output.nextRoleAssignments.Mafia).toContain(id);
        });

        expect(["Town wins", "Mafia wins", "Rival Mafia wins", "Serial Killer wins", null]).toContain(
          evaluateWinCondition(players, output.nextDeadPlayerIds, output.nextRoleAssignments)
        );

        roleAssignments = output.nextRoleAssignments;
        roleStates = output.nextRoleStates;
        deadPlayerIds = output.nextDeadPlayerIds;
        loverPairs = output.nextLoverPairs;
        nightNumber += 1;
      }
    }
  });
});
