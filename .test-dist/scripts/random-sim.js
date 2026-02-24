"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const engine_1 = require("../src/domain/engine");
const roles_1 = require("../src/domain/roles");
const rules_1 = require("../src/domain/rules");
const NO_ACTION = "__no_action__";
const UNIQUE_ROLES = new Set([
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
function mulberry32(seed) {
    let t = seed >>> 0;
    return () => {
        t += 0x6d2b79f5;
        let x = Math.imul(t ^ (t >>> 15), t | 1);
        x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
        return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
}
function randomInt(rand, min, max) {
    return Math.floor(rand() * (max - min + 1)) + min;
}
function shuffle(items, rand) {
    const arr = [...items];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}
function makePlayers(count) {
    return Array.from({ length: count }).map((_, index) => ({
        id: `p-${index + 1}`,
        name: `Player ${index + 1}`,
    }));
}
function emptyAssignments() {
    const out = {};
    for (const role of roles_1.ROLE_TYPES)
        out[role] = [];
    return out;
}
function emptyNightActions() {
    const out = {};
    for (const role of roles_1.ROLE_TYPES)
        out[role] = { targetIds: [] };
    return out;
}
function assignRoles(players, rand) {
    const assignments = emptyAssignments();
    let available = shuffle(players.map((p) => p.id), rand);
    for (const role of roles_1.ROLE_TYPES) {
        if (role === "Civilian")
            continue;
        const roleDef = roles_1.ROLE_DEFINITIONS[role];
        const canAct = Boolean(roleDef.action && roleDef.action.targetCount > 0);
        const includeRole = canAct ? rand() < 0.7 : rand() < 0.45;
        if (!includeRole || available.length === 0)
            continue;
        const maxCount = UNIQUE_ROLES.has(role) ? 1 : Math.min(3, available.length);
        const count = randomInt(rand, 1, maxCount);
        assignments[role] = available.slice(0, count);
        available = available.slice(count);
    }
    return assignments;
}
function maybeDead(players, rand) {
    return players.filter(() => rand() < 0.18).map((p) => p.id);
}
function randomTargetId(pool, rand) {
    if (pool.length === 0)
        return "";
    const roll = rand();
    if (roll < 0.12)
        return "";
    if (roll < 0.2)
        return NO_ACTION;
    return pool[randomInt(rand, 0, pool.length - 1)];
}
function randomNightActions(players, roleStates, nightNumber, rand) {
    const ids = players.map((p) => p.id);
    const actions = emptyNightActions();
    for (const role of roles_1.ROLE_TYPES) {
        const count = roles_1.ROLE_DEFINITIONS[role].action?.targetCount ?? 0;
        const targetIds = Array.from({ length: count }).map(() => randomTargetId(ids, rand));
        const metadata = {};
        if (role === "Magician") {
            const choices = [];
            if (!roleStates.Magician.usedKill)
                choices.push("kill");
            if (!roleStates.Magician.usedSave)
                choices.push("save");
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
function assertUniqueAssignments(assignments) {
    const seen = new Set();
    for (const role of roles_1.ROLE_TYPES) {
        for (const id of assignments[role] ?? []) {
            if (!id)
                continue;
            (0, strict_1.default)(!seen.has(id), `duplicate role assignment for ${id}`);
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
        let roleStates = (0, rules_1.getInitialRoleStates)();
        let deadPlayerIds = maybeDead(players, rand);
        let loverPairs = [];
        let nightNumber = 1;
        assertUniqueAssignments(roleAssignments);
        deadPlayerIds.forEach((id) => (0, strict_1.default)(playerIds.has(id)));
        for (let step = 0; step < 6; step++) {
            const nightActions = randomNightActions(players, roleStates, nightNumber, rand);
            const output = (0, engine_1.resolveNight)({
                nightNumber,
                players,
                deadPlayerIds,
                roleAssignments,
                nightActions,
                roleStates,
                loverPairs,
            });
            output.nextDeadPlayerIds.forEach((id) => (0, strict_1.default)(playerIds.has(id)));
            deadPlayerIds.forEach((id) => (0, strict_1.default)(output.nextDeadPlayerIds.includes(id)));
            (0, strict_1.default)(new Set(output.nextDeadPlayerIds).size === output.nextDeadPlayerIds.length);
            assertUniqueAssignments(output.nextRoleAssignments);
            (0, strict_1.default)(output.result.deaths.every((id) => output.nextDeadPlayerIds.includes(id)));
            (0, strict_1.default)(new Set(output.result.deaths).size === output.result.deaths.length);
            const deathDetailIds = (output.result.deathDetails ?? []).map((detail) => detail.playerId).sort();
            strict_1.default.deepEqual(deathDetailIds, [...output.result.deaths].sort());
            output.result.investigations.forEach((investigation) => {
                (0, strict_1.default)(playerIds.has(investigation.targetId));
                (0, strict_1.default)(investigation.result === "Innocent" || investigation.result === "Guilty");
            });
            (output.result.recruits ?? []).forEach((id) => {
                (0, strict_1.default)(output.nextRoleAssignments.Mafia.includes(id));
            });
            const winner = (0, engine_1.evaluateWinCondition)(players, output.nextDeadPlayerIds, output.nextRoleAssignments);
            (0, strict_1.default)(winner === null ||
                winner === "Town wins" ||
                winner === "Mafia wins" ||
                winner === "Rival Mafia wins" ||
                winner === "Serial Killer wins");
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
