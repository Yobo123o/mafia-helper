import assert from "node:assert/strict";
import { evaluateWinCondition, resolveNight } from "../src/domain/engine";
import { ROLE_DEFINITIONS, ROLE_TYPES } from "../src/domain/roles";
import { getInitialRoleStates } from "../src/domain/rules";
import type { RoleStateMap, RoleType } from "../src/domain/types";

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
    const count = ROLE_DEFINITIONS[role].action?.targetCount ?? 0;
    const targetIds = Array.from({ length: count }).map(() => randomTargetId(ids, rand));
    const metadata: { choice?: "kill" | "save" | "none" } = {};

    if (role === "Magician") {
      const choices: Array<"kill" | "save" | "none"> = [];
      if (!roleStates.Magician.usedKill) choices.push("kill");
      if (!roleStates.Magician.usedSave) choices.push("save");
      choices.push("none");
      metadata.choice = choices[randomInt(rand, 0, choices.length - 1)];
    }

    if (role === "Vigilante" && nightNumber === 1) {
      actions[role] = { targetIds: [] };
      continue;
    }

    if (role === "Magician" && metadata.choice === "none") {
      actions[role] = { targetIds: [], metadata };
      continue;
    }

    actions[role] = role === "Magician" ? { targetIds, metadata } : { targetIds };
  }

  return actions;
}

function assertUniqueAssignments(assignments: Record<RoleType, string[]>) {
  const seen = new Set<string>();
  for (const role of ROLE_TYPES) {
    for (const id of assignments[role] ?? []) {
      if (!id) continue;
      assert(!seen.has(id), `duplicate role assignment for ${id}`);
      seen.add(id);
    }
  }
}

function main() {
  const seeds = Array.from({ length: 60 }).map((_, index) => 12000 + index);
  let checks = 0;

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
    deadPlayerIds.forEach((id) => assert(playerIds.has(id)));

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

      output.nextDeadPlayerIds.forEach((id) => assert(playerIds.has(id)));
      deadPlayerIds.forEach((id) => assert(output.nextDeadPlayerIds.includes(id)));
      assert(new Set(output.nextDeadPlayerIds).size === output.nextDeadPlayerIds.length);

      assertUniqueAssignments(output.nextRoleAssignments);
      assert(output.result.deaths.every((id) => output.nextDeadPlayerIds.includes(id)));
      assert(new Set(output.result.deaths).size === output.result.deaths.length);

      const deathDetailIds = (output.result.deathDetails ?? []).map((detail) => detail.playerId).sort();
      assert.deepEqual(deathDetailIds, [...output.result.deaths].sort());

      output.result.investigations.forEach((investigation) => {
        assert(playerIds.has(investigation.targetId));
        assert(investigation.result === "Innocent" || investigation.result === "Guilty");
      });

      (output.result.recruits ?? []).forEach((id) => {
        assert(output.nextRoleAssignments.Mafia.includes(id));
      });

      const winner = evaluateWinCondition(players, output.nextDeadPlayerIds, output.nextRoleAssignments);
      assert(
        winner === null ||
          winner === "Town wins" ||
          winner === "Mafia wins" ||
          winner === "Rival Mafia wins" ||
          winner === "Serial Killer wins"
      );

      roleAssignments = output.nextRoleAssignments;
      roleStates = output.nextRoleStates;
      deadPlayerIds = output.nextDeadPlayerIds;
      loverPairs = output.nextLoverPairs;
      nightNumber += 1;
      checks += 1;
    }
  }

  console.log(`Random simulation checks passed: ${checks}`);
}

main();
