"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.KILL_ROLES = exports.RESOLUTION_ORDER = void 0;
exports.resolveNight = resolveNight;
exports.evaluateWinCondition = evaluateWinCondition;
const roles_1 = require("./roles");
exports.RESOLUTION_ORDER = [
    "TargetModifiers",
    "AbilityBlocks",
    "Protection",
    "Kills",
    "PassiveEffects",
    "Investigations",
];
exports.KILL_ROLES = [
    "Mafia",
    "RivalMafia",
    "Vigilante",
    "SerialKiller",
    "Magician",
];
const NO_ACTION = "__no_action__";
function isActionableTarget(id) {
    return Boolean(id && id.trim().length > 0 && id !== NO_ACTION);
}
function cloneRoleAssignments(assignments) {
    const next = {};
    for (const key of Object.keys(assignments)) {
        next[key] = [...(assignments[key] ?? [])];
    }
    return next;
}
function cloneRoleStates(states) {
    return {
        Civilian: { ...states.Civilian },
        Detective: { ...states.Detective },
        Doctor: { ...states.Doctor },
        Miller: { ...states.Miller },
        Cupid: { ...states.Cupid },
        BusDriver: { ...states.BusDriver },
        UndercoverCop: { ...states.UndercoverCop },
        Grandma: { ...states.Grandma },
        Magician: { ...states.Magician },
        Postman: { ...states.Postman },
        Vigilante: { ...states.Vigilante },
        Mafia: { ...states.Mafia },
        Godfather: { ...states.Godfather },
        Lawyer: { ...states.Lawyer },
        MadeMan: { ...states.MadeMan },
        Bartender: { ...states.Bartender },
        SerialKiller: { ...states.SerialKiller },
        RivalMafia: { ...states.RivalMafia },
    };
}
function buildPlayerRoleMap(assignments, players) {
    const map = {};
    if (players) {
        for (const player of players) {
            map[player.id] = "Civilian";
        }
    }
    for (const role of Object.keys(assignments)) {
        for (const playerId of assignments[role] ?? []) {
            if (!playerId)
                continue;
            map[playerId] = role;
        }
    }
    return map;
}
function firstAliveForRole(role, assignments, deadSet) {
    const list = assignments[role] ?? [];
    return list.find((id) => id && !deadSet.has(id)) ?? null;
}
function redirectTarget(targetId, swapA, swapB) {
    if (!swapA || !swapB)
        return targetId;
    if (targetId === swapA)
        return swapB;
    if (targetId === swapB)
        return swapA;
    return targetId;
}
function alivePlayerIds(players, deadSet) {
    return players.map((p) => p.id).filter((id) => !deadSet.has(id));
}
function unique(ids) {
    return Array.from(new Set(ids));
}
function formatRoleName(role) {
    return role.replace(/([a-z])([A-Z])/g, "$1 $2");
}
function getMafiaSacrifice(assignments, deadSet) {
    const madeMan = (assignments.MadeMan ?? []).filter((id) => id && !deadSet.has(id));
    const mafia = (assignments.Mafia ?? []).filter((id) => id && !deadSet.has(id));
    const godfather = (assignments.Godfather ?? []).filter((id) => id && !deadSet.has(id));
    const pool = [...madeMan, ...mafia];
    if (pool.length > 0)
        return pool[0];
    if (godfather.length > 0)
        return godfather[0];
    return null;
}
function createResolutionContext(input) {
    const deadSet = new Set(input.deadPlayerIds);
    const nextAssignments = cloneRoleAssignments(input.roleAssignments);
    const nextRoleStates = cloneRoleStates(input.roleStates);
    const playerRoles = buildPlayerRoleMap(nextAssignments, input.players);
    const notes = [];
    const blockedRoles = new Set();
    const protectedAtNight = new Set();
    const dayImmunities = new Set();
    const deaths = new Set();
    const deathCauses = new Map();
    const saves = new Set();
    const investigations = [];
    const recruits = [];
    const recruitDetails = [];
    const nextLoverPairs = [...input.loverPairs];
    const roleTargets = {};
    const addDeathWithCause = (id, cause) => {
        if (!id)
            return;
        deaths.add(id);
        const existing = deathCauses.get(id) ?? new Set();
        existing.add(cause);
        deathCauses.set(id, existing);
    };
    return {
        deadSet,
        nextAssignments,
        nextRoleStates,
        playerRoles,
        notes,
        blockedRoles,
        protectedAtNight,
        dayImmunities,
        deaths,
        deathCauses,
        saves,
        investigations,
        recruits,
        recruitDetails,
        nextLoverPairs,
        roleTargets,
        swapA: null,
        swapB: null,
        convertedRoleThisNight: null,
        detectiveConvertedThisNight: false,
        addDeathWithCause,
    };
}
function applyTargetModifiersPhase(input, ctx) {
    const busTargets = input.nightActions.BusDriver?.targetIds ?? [];
    ctx.swapA = isActionableTarget(busTargets[0]) ? busTargets[0] : null;
    ctx.swapB = isActionableTarget(busTargets[1]) ? busTargets[1] : null;
    for (const role of Object.keys(input.nightActions)) {
        const action = input.nightActions[role];
        const targets = (action?.targetIds ?? []).map((id) => isActionableTarget(id) ? redirectTarget(id, ctx.swapA, ctx.swapB) : id);
        ctx.roleTargets[role] = targets;
    }
    if (ctx.swapA && ctx.swapB) {
        ctx.notes.push("Bus Driver swap was applied.");
    }
    const recruitTarget = ctx.roleTargets.MadeMan?.[0];
    ctx.convertedRoleThisNight =
        !input.roleStates.MadeMan.usedRecruit && isActionableTarget(recruitTarget)
            ? ctx.playerRoles[recruitTarget]
            : null;
    ctx.detectiveConvertedThisNight = ctx.convertedRoleThisNight === "Detective";
}
function applyAbilityBlocksPhase(ctx) {
    const bartenderTarget = ctx.roleTargets.Bartender?.[0];
    if (!isActionableTarget(bartenderTarget))
        return;
    const blockedRole = ctx.playerRoles[bartenderTarget];
    if (!blockedRole)
        return;
    ctx.blockedRoles.add(blockedRole);
    ctx.notes.push(`${blockedRole} was blocked by Bartender.`);
}
function applyProtectionPhase(input, ctx) {
    if (!ctx.blockedRoles.has("Doctor")) {
        const doctorTarget = ctx.roleTargets.Doctor?.[0];
        if (isActionableTarget(doctorTarget) && !ctx.deadSet.has(doctorTarget)) {
            ctx.protectedAtNight.add(doctorTarget);
            ctx.nextRoleStates.Doctor.lastSavedPlayerId = doctorTarget;
        }
    }
    if (!ctx.blockedRoles.has("Lawyer")) {
        const lawyerTarget = ctx.roleTargets.Lawyer?.[0];
        if (isActionableTarget(lawyerTarget) && !ctx.deadSet.has(lawyerTarget)) {
            ctx.dayImmunities.add(lawyerTarget);
            ctx.nextRoleStates.Lawyer.lastDefendedPlayerId = lawyerTarget;
        }
    }
    if (!ctx.blockedRoles.has("Magician")) {
        const magicianTarget = ctx.roleTargets.Magician?.[0];
        const magicianChoice = input.nightActions.Magician?.metadata?.choice;
        if (magicianChoice === "save" && isActionableTarget(magicianTarget) && !ctx.deadSet.has(magicianTarget)) {
            ctx.protectedAtNight.add(magicianTarget);
            ctx.nextRoleStates.Magician.usedSave = true;
        }
        if (magicianChoice === "kill" && isActionableTarget(magicianTarget) && !ctx.deadSet.has(magicianTarget)) {
            ctx.addDeathWithCause(magicianTarget, "Killed by Magician (Vanishing Act).");
            ctx.nextRoleStates.Magician.usedKill = true;
        }
    }
}
function applyKillPhase(input, ctx) {
    const killerRoles = ["Mafia", "RivalMafia", "SerialKiller", "Vigilante"];
    for (const role of killerRoles) {
        if (ctx.blockedRoles.has(role))
            continue;
        const target = ctx.roleTargets[role]?.[0];
        if (!isActionableTarget(target))
            continue;
        if (ctx.deadSet.has(target))
            continue;
        if (role === "Vigilante") {
            if (input.nightNumber === 1 || input.roleStates.Vigilante.lockedOut || input.roleStates.Vigilante.usedShot) {
                ctx.notes.push("Vigilante action was ignored due to role restrictions.");
                continue;
            }
            ctx.nextRoleStates.Vigilante.usedShot = true;
        }
        const cause = role === "Mafia"
            ? "Killed by Mafia (Mafia Kill)."
            : role === "RivalMafia"
                ? "Killed by Rival Mafia (Rival Kill)."
                : role === "SerialKiller"
                    ? "Killed by Serial Killer (Night Kill)."
                    : "Killed by Vigilante (Single Shot).";
        ctx.addDeathWithCause(target, cause);
    }
    for (const target of Array.from(ctx.deaths)) {
        if (ctx.protectedAtNight.has(target)) {
            ctx.deaths.delete(target);
            ctx.saves.add(target);
        }
    }
}
function applyPassiveEffectsPhase(input, ctx) {
    const grandmaId = firstAliveForRole("Grandma", ctx.nextAssignments, ctx.deadSet);
    // Grandma's retaliation is based on being alive at the start of the night.
    // A same-night kill should not suppress Home Defense retaliation.
    if (grandmaId) {
        const visitingRoles = [
            "Mafia",
            "RivalMafia",
            "SerialKiller",
            "Vigilante",
            "Detective",
            "Doctor",
            "Lawyer",
            "Bartender",
            "Magician",
            "MadeMan",
            "Cupid",
            "BusDriver",
        ];
        for (const role of visitingRoles) {
            if (ctx.blockedRoles.has(role))
                continue;
            const roleTargetIds = ctx.roleTargets[role] ?? [];
            const visitedGrandma = roleTargetIds.some((id) => isActionableTarget(id) && id === grandmaId);
            if (!visitedGrandma)
                continue;
            if (role === "Mafia") {
                const mafiaDeath = getMafiaSacrifice(ctx.nextAssignments, ctx.deadSet);
                ctx.addDeathWithCause(mafiaDeath, "Visited Grandma and died to Home Defense retaliation.");
                if (mafiaDeath)
                    ctx.notes.push("Grandma retaliated against the Mafia visit.");
                continue;
            }
            const actor = firstAliveForRole(role, ctx.nextAssignments, ctx.deadSet);
            ctx.addDeathWithCause(actor, `Visited Grandma as ${formatRoleName(role)} and died to Home Defense.`);
            if (actor)
                ctx.notes.push(`${role} died while visiting Grandma.`);
        }
    }
    let loverDeathAdded = true;
    while (loverDeathAdded) {
        loverDeathAdded = false;
        for (const [a, b] of ctx.nextLoverPairs) {
            const aDead = ctx.deaths.has(a) || ctx.deadSet.has(a);
            const bDead = ctx.deaths.has(b) || ctx.deadSet.has(b);
            if (aDead && !bDead) {
                ctx.addDeathWithCause(b, "Died from Shared Fate (Lover chain).");
                ctx.notes.push("Lover chain death occurred.");
                loverDeathAdded = true;
            }
            if (bDead && !aDead) {
                ctx.addDeathWithCause(a, "Died from Shared Fate (Lover chain).");
                ctx.notes.push("Lover chain death occurred.");
                loverDeathAdded = true;
            }
        }
    }
}
function applyInvestigationsPhase(input, ctx) {
    if (!ctx.blockedRoles.has("Detective") && !ctx.detectiveConvertedThisNight) {
        const detectiveTarget = ctx.roleTargets.Detective?.[0];
        if (isActionableTarget(detectiveTarget)) {
            const targetRole = ctx.playerRoles[detectiveTarget];
            if (targetRole) {
                const result = (0, roles_1.getDetectiveResultForRole)(targetRole);
                ctx.investigations.push({ actorRole: "Detective", targetId: detectiveTarget, result });
            }
        }
    }
    if (ctx.detectiveConvertedThisNight) {
        ctx.notes.push("Detective was converted before investigation resolved.");
    }
    if (!ctx.blockedRoles.has("Cupid") && input.nightNumber === 1 && !ctx.nextRoleStates.Cupid.used) {
        const cupidTargets = ctx.roleTargets.Cupid ?? [];
        const loverA = cupidTargets[0];
        const loverB = cupidTargets[1];
        if (isActionableTarget(loverA) && isActionableTarget(loverB) && loverA !== loverB) {
            ctx.nextLoverPairs.push([loverA, loverB]);
            ctx.nextRoleStates.Cupid.used = true;
            ctx.nextRoleStates.Cupid.loverPairId = `${loverA}|${loverB}`;
            ctx.notes.push("Cupid created a lover pair.");
        }
    }
}
function applyPostInvestigationStateChanges(input, ctx) {
    if (!ctx.blockedRoles.has("MadeMan") && !input.roleStates.MadeMan.usedRecruit) {
        const recruitTarget = ctx.roleTargets.MadeMan?.[0];
        if (isActionableTarget(recruitTarget) && !ctx.deadSet.has(recruitTarget)) {
            const currentRole = ctx.playerRoles[recruitTarget];
            if (currentRole &&
                currentRole !== "Mafia" &&
                currentRole !== "Godfather" &&
                currentRole !== "MadeMan" &&
                currentRole !== "UndercoverCop") {
                ctx.nextAssignments[currentRole] = (ctx.nextAssignments[currentRole] ?? []).filter((id) => id !== recruitTarget);
                ctx.nextAssignments.Mafia = [...(ctx.nextAssignments.Mafia ?? []), recruitTarget];
                ctx.recruits.push(recruitTarget);
                ctx.recruitDetails.push({ playerId: recruitTarget, fromRole: currentRole });
                ctx.nextRoleStates.MadeMan.usedRecruit = true;
                ctx.notes.push("Made Man recruited a player to Mafia.");
            }
        }
    }
    if (ctx.nextRoleStates.Vigilante.usedShot) {
        const vigilanteTarget = ctx.roleTargets.Vigilante?.[0];
        if (isActionableTarget(vigilanteTarget) && ctx.deaths.has(vigilanteTarget)) {
            const role = ctx.playerRoles[vigilanteTarget];
            if (role && (0, roles_1.getRoleAlignment)(role) === "Town") {
                ctx.nextRoleStates.Vigilante.pendingLockout = true;
                ctx.notes.push("Vigilante killed a Town player and will be locked out next night.");
            }
        }
    }
}
function resolveNight(input) {
    const ctx = createResolutionContext(input);
    applyTargetModifiersPhase(input, ctx);
    applyAbilityBlocksPhase(ctx);
    applyProtectionPhase(input, ctx);
    applyKillPhase(input, ctx);
    applyPassiveEffectsPhase(input, ctx);
    applyInvestigationsPhase(input, ctx);
    applyPostInvestigationStateChanges(input, ctx);
    const nightDeaths = unique(Array.from(ctx.deaths).filter((id) => !ctx.deadSet.has(id)));
    const nextDead = unique([...input.deadPlayerIds, ...nightDeaths]);
    const deathDetails = nightDeaths.map((id) => ({
        playerId: id,
        causes: Array.from(ctx.deathCauses.get(id) ?? []),
    }));
    return {
        nextDeadPlayerIds: nextDead,
        nextRoleAssignments: ctx.nextAssignments,
        nextRoleStates: ctx.nextRoleStates,
        nextLoverPairs: ctx.nextLoverPairs,
        result: {
            deaths: nightDeaths,
            deathDetails,
            saves: unique(Array.from(ctx.saves)),
            blocked: unique(Array.from(ctx.blockedRoles)),
            investigations: ctx.investigations,
            busSwaps: ctx.swapA && ctx.swapB ? [{ a: ctx.swapA, b: ctx.swapB }] : [],
            dayImmunities: unique(Array.from(ctx.dayImmunities)),
            recruits: unique(ctx.recruits),
            recruitDetails: ctx.recruitDetails,
            loverPairsCreated: ctx.nextLoverPairs.map(([a, b]) => `${a}|${b}`),
            notes: ctx.notes,
        },
    };
}
function evaluateWinCondition(players, deadPlayerIds, roleAssignments) {
    const deadSet = new Set(deadPlayerIds);
    const alive = alivePlayerIds(players, deadSet);
    const roleByPlayer = buildPlayerRoleMap(roleAssignments, players);
    const aliveByAlignment = {
        Town: 0,
        Mafia: 0,
        RivalMafia: 0,
        Neutral: 0,
    };
    let serialKillerAlive = 0;
    for (const id of alive) {
        const role = roleByPlayer[id];
        if (!role)
            continue;
        const alignment = (0, roles_1.getRoleAlignment)(role);
        aliveByAlignment[alignment] += 1;
        if (role === "SerialKiller")
            serialKillerAlive += 1;
    }
    if (alive.length > 0 && serialKillerAlive === alive.length) {
        return "Serial Killer wins";
    }
    if (aliveByAlignment.Mafia === 0 && aliveByAlignment.RivalMafia === 0 && serialKillerAlive === 0) {
        return "Town wins";
    }
    if (aliveByAlignment.Mafia > 0 &&
        aliveByAlignment.Mafia >= aliveByAlignment.Town + aliveByAlignment.Neutral &&
        aliveByAlignment.RivalMafia === 0 &&
        serialKillerAlive === 0) {
        return "Mafia wins";
    }
    if (aliveByAlignment.RivalMafia > 0 &&
        aliveByAlignment.RivalMafia >= aliveByAlignment.Town + aliveByAlignment.Neutral &&
        aliveByAlignment.Mafia === 0 &&
        serialKillerAlive === 0) {
        return "Rival Mafia wins";
    }
    return null;
}
