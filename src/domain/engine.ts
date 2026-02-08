import { getDetectiveResultForRole, getRoleAlignment } from "./roles";
import type { NightResult, RoleStateMap, RoleType } from "./types";

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
  "RivalMafia",
  "Vigilante",
  "SerialKiller",
  "Magician",
];

export type Pair = [string, string];

export type ResolveNightInput = {
  nightNumber: number;
  players: { id: string; name: string }[];
  deadPlayerIds: string[];
  roleAssignments: Record<RoleType, string[]>;
  nightActions: Record<RoleType, { targetIds: string[]; metadata?: { choice?: "kill" | "save" | "none" } }>;
  roleStates: RoleStateMap;
  loverPairs: Pair[];
};

export type ResolveNightOutput = {
  nextDeadPlayerIds: string[];
  nextRoleAssignments: Record<RoleType, string[]>;
  nextRoleStates: RoleStateMap;
  nextLoverPairs: Pair[];
  result: NightResult;
};

const NO_ACTION = "__no_action__";

function isActionableTarget(id: string | undefined): id is string {
  return Boolean(id && id.trim().length > 0 && id !== NO_ACTION);
}

function cloneRoleAssignments(assignments: Record<RoleType, string[]>): Record<RoleType, string[]> {
  const next = {} as Record<RoleType, string[]>;
  for (const key of Object.keys(assignments) as RoleType[]) {
    next[key] = [...(assignments[key] ?? [])];
  }
  return next;
}

function cloneRoleStates(states: RoleStateMap): RoleStateMap {
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

function buildPlayerRoleMap(
  assignments: Record<RoleType, string[]>,
  players?: { id: string }[]
): Record<string, RoleType> {
  const map: Record<string, RoleType> = {};
  if (players) {
    for (const player of players) {
      map[player.id] = "Civilian";
    }
  }
  for (const role of Object.keys(assignments) as RoleType[]) {
    for (const playerId of assignments[role] ?? []) {
      if (!playerId) continue;
      map[playerId] = role;
    }
  }
  return map;
}

function firstAliveForRole(role: RoleType, assignments: Record<RoleType, string[]>, deadSet: Set<string>): string | null {
  const list = assignments[role] ?? [];
  return list.find((id) => id && !deadSet.has(id)) ?? null;
}

function redirectTarget(targetId: string, swapA: string | null, swapB: string | null): string {
  if (!swapA || !swapB) return targetId;
  if (targetId === swapA) return swapB;
  if (targetId === swapB) return swapA;
  return targetId;
}

function alivePlayerIds(players: { id: string }[], deadSet: Set<string>): string[] {
  return players.map((p) => p.id).filter((id) => !deadSet.has(id));
}

function unique(ids: string[]): string[] {
  return Array.from(new Set(ids));
}

function formatRoleName(role: RoleType): string {
  return role.replace(/([a-z])([A-Z])/g, "$1 $2");
}

function getMafiaSacrifice(
  assignments: Record<RoleType, string[]>,
  deadSet: Set<string>
): string | null {
  const madeMan = (assignments.MadeMan ?? []).filter((id) => id && !deadSet.has(id));
  const mafia = (assignments.Mafia ?? []).filter((id) => id && !deadSet.has(id));
  const godfather = (assignments.Godfather ?? []).filter((id) => id && !deadSet.has(id));
  const pool = [...madeMan, ...mafia];
  if (pool.length > 0) return pool[0];
  if (godfather.length > 0) return godfather[0];
  return null;
}

export function resolveNight(input: ResolveNightInput): ResolveNightOutput {
  const deadSet = new Set(input.deadPlayerIds);
  const nextAssignments = cloneRoleAssignments(input.roleAssignments);
  const nextRoleStates = cloneRoleStates(input.roleStates);
  const playerRoles = buildPlayerRoleMap(nextAssignments, input.players);
  const notes: string[] = [];
  const blockedRoles = new Set<RoleType>();
  const protectedAtNight = new Set<string>();
  const dayImmunities = new Set<string>();
  const deaths = new Set<string>();
  const deathCauses = new Map<string, Set<string>>();
  const saves = new Set<string>();
  const investigations: NightResult["investigations"] = [];
  const recruits: string[] = [];
  const recruitDetails: NightResult["recruitDetails"] = [];
  const nextLoverPairs = [...input.loverPairs];
  const addDeathWithCause = (id: string | null, cause: string) => {
    if (!id) return;
    deaths.add(id);
    const existing = deathCauses.get(id) ?? new Set<string>();
    existing.add(cause);
    deathCauses.set(id, existing);
  };

  const busTargets = input.nightActions.BusDriver?.targetIds ?? [];
  const swapA = isActionableTarget(busTargets[0]) ? busTargets[0] : null;
  const swapB = isActionableTarget(busTargets[1]) ? busTargets[1] : null;

  const roleTargets: Partial<Record<RoleType, string[]>> = {};
  for (const role of Object.keys(input.nightActions) as RoleType[]) {
    const action = input.nightActions[role];
    const targets = (action?.targetIds ?? []).map((id) =>
      isActionableTarget(id) ? redirectTarget(id, swapA, swapB) : id
    );
    roleTargets[role] = targets;
  }
  if (swapA && swapB) {
    notes.push("Bus Driver swap was applied.");
  }

  const recruitTarget = roleTargets.MadeMan?.[0];
  const convertedRoleThisNight =
    !input.roleStates.MadeMan.usedRecruit && isActionableTarget(recruitTarget)
      ? playerRoles[recruitTarget]
      : null;
  const detectiveConvertedThisNight = convertedRoleThisNight === "Detective";

  const bartenderTarget = roleTargets.Bartender?.[0];
  if (isActionableTarget(bartenderTarget)) {
    const blockedRole = playerRoles[bartenderTarget];
    if (blockedRole) {
      blockedRoles.add(blockedRole);
      notes.push(`${blockedRole} was blocked by Bartender.`);
    }
  }

  if (!blockedRoles.has("Doctor")) {
    const doctorTarget = roleTargets.Doctor?.[0];
    if (isActionableTarget(doctorTarget) && !deadSet.has(doctorTarget)) {
      protectedAtNight.add(doctorTarget);
      nextRoleStates.Doctor.lastSavedPlayerId = doctorTarget;
    }
  }

  if (!blockedRoles.has("Lawyer")) {
    const lawyerTarget = roleTargets.Lawyer?.[0];
    if (isActionableTarget(lawyerTarget) && !deadSet.has(lawyerTarget)) {
      dayImmunities.add(lawyerTarget);
      nextRoleStates.Lawyer.lastDefendedPlayerId = lawyerTarget;
    }
  }

  if (!blockedRoles.has("Magician")) {
    const magicianTarget = roleTargets.Magician?.[0];
    const magicianChoice = input.nightActions.Magician?.metadata?.choice;
    if (magicianChoice === "save" && isActionableTarget(magicianTarget) && !deadSet.has(magicianTarget)) {
      protectedAtNight.add(magicianTarget);
      nextRoleStates.Magician.usedSave = true;
    }
    if (magicianChoice === "kill" && isActionableTarget(magicianTarget) && !deadSet.has(magicianTarget)) {
      addDeathWithCause(magicianTarget, "Killed by Magician (Vanishing Act).");
      nextRoleStates.Magician.usedKill = true;
    }
  }

  const killerRoles: RoleType[] = ["Mafia", "RivalMafia", "SerialKiller", "Vigilante"];
  for (const role of killerRoles) {
    if (blockedRoles.has(role)) continue;
    const target = roleTargets[role]?.[0];
    if (!isActionableTarget(target)) continue;
    if (deadSet.has(target)) continue;

    if (role === "Vigilante") {
      if (input.nightNumber === 1 || input.roleStates.Vigilante.lockedOut || input.roleStates.Vigilante.usedShot) {
        notes.push("Vigilante action was ignored due to role restrictions.");
        continue;
      }
      nextRoleStates.Vigilante.usedShot = true;
    }

    const cause =
      role === "Mafia"
        ? "Killed by Mafia (Mafia Kill)."
        : role === "RivalMafia"
          ? "Killed by Rival Mafia (Rival Kill)."
          : role === "SerialKiller"
            ? "Killed by Serial Killer (Night Kill)."
            : "Killed by Vigilante (Single Shot).";
    addDeathWithCause(target, cause);
  }

  for (const target of Array.from(deaths)) {
    if (protectedAtNight.has(target)) {
      deaths.delete(target);
      saves.add(target);
    }
  }

  const grandmaId = firstAliveForRole("Grandma", nextAssignments, deadSet);
  if (grandmaId && !deaths.has(grandmaId)) {
    const visitingRoles: RoleType[] = [
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
      if (blockedRoles.has(role)) continue;
      const roleTargetIds = roleTargets[role] ?? [];
      const visitedGrandma = roleTargetIds.some((id) => isActionableTarget(id) && id === grandmaId);
      if (!visitedGrandma) continue;

      if (role === "Mafia") {
        const mafiaDeath = getMafiaSacrifice(nextAssignments, deadSet);
        addDeathWithCause(mafiaDeath, "Visited Grandma and died to Home Defense retaliation.");
        if (mafiaDeath) notes.push("Grandma retaliated against the Mafia visit.");
        continue;
      }

      const actor = firstAliveForRole(role, nextAssignments, deadSet);
      addDeathWithCause(actor, `Visited Grandma as ${formatRoleName(role)} and died to Home Defense.`);
      if (actor) notes.push(`${role} died while visiting Grandma.`);
    }
  }

  let loverDeathAdded = true;
  while (loverDeathAdded) {
    loverDeathAdded = false;
    for (const [a, b] of nextLoverPairs) {
      const aDead = deaths.has(a) || deadSet.has(a);
      const bDead = deaths.has(b) || deadSet.has(b);
      if (aDead && !bDead) {
        addDeathWithCause(b, "Died from Shared Fate (Lover chain).");
        notes.push("Lover chain death occurred.");
        loverDeathAdded = true;
      }
      if (bDead && !aDead) {
        addDeathWithCause(a, "Died from Shared Fate (Lover chain).");
        notes.push("Lover chain death occurred.");
        loverDeathAdded = true;
      }
    }
  }

  if (!blockedRoles.has("Detective") && !detectiveConvertedThisNight) {
    const detectiveTarget = roleTargets.Detective?.[0];
    if (isActionableTarget(detectiveTarget)) {
      const targetRole = playerRoles[detectiveTarget];
      if (targetRole) {
        const result = getDetectiveResultForRole(targetRole);
        investigations.push({ actorRole: "Detective", targetId: detectiveTarget, result });
      }
    }
  }
  if (detectiveConvertedThisNight) {
    notes.push("Detective was converted before investigation resolved.");
  }

  if (!blockedRoles.has("Cupid") && input.nightNumber === 1 && !nextRoleStates.Cupid.used) {
    const cupidTargets = roleTargets.Cupid ?? [];
    const loverA = cupidTargets[0];
    const loverB = cupidTargets[1];
    if (isActionableTarget(loverA) && isActionableTarget(loverB) && loverA !== loverB) {
      nextLoverPairs.push([loverA, loverB]);
      nextRoleStates.Cupid.used = true;
      nextRoleStates.Cupid.loverPairId = `${loverA}|${loverB}`;
      notes.push("Cupid created a lover pair.");
    }
  }

  if (!blockedRoles.has("MadeMan") && !input.roleStates.MadeMan.usedRecruit) {
    const recruitTarget = roleTargets.MadeMan?.[0];
    if (isActionableTarget(recruitTarget) && !deadSet.has(recruitTarget)) {
      const currentRole = playerRoles[recruitTarget];
      if (
        currentRole &&
        currentRole !== "Mafia" &&
        currentRole !== "Godfather" &&
        currentRole !== "MadeMan" &&
        currentRole !== "UndercoverCop"
      ) {
        nextAssignments[currentRole] = (nextAssignments[currentRole] ?? []).filter((id) => id !== recruitTarget);
        nextAssignments.Mafia = [...(nextAssignments.Mafia ?? []), recruitTarget];
        recruits.push(recruitTarget);
        recruitDetails.push({ playerId: recruitTarget, fromRole: currentRole });
        nextRoleStates.MadeMan.usedRecruit = true;
        notes.push("Made Man recruited a player to Mafia.");
      }
    }
  }

  if (nextRoleStates.Vigilante.usedShot) {
    const vigilanteTarget = roleTargets.Vigilante?.[0];
    if (isActionableTarget(vigilanteTarget) && deaths.has(vigilanteTarget)) {
      const role = playerRoles[vigilanteTarget];
      if (role && getRoleAlignment(role) === "Town") {
        nextRoleStates.Vigilante.pendingLockout = true;
        notes.push("Vigilante killed a Town player and will be locked out next night.");
      }
    }
  }

  const nightDeaths = unique(Array.from(deaths).filter((id) => !deadSet.has(id)));
  const nextDead = unique([...input.deadPlayerIds, ...nightDeaths]);
  const deathDetails = nightDeaths.map((id) => ({
    playerId: id,
    causes: Array.from(deathCauses.get(id) ?? []),
  }));

  return {
    nextDeadPlayerIds: nextDead,
    nextRoleAssignments: nextAssignments,
    nextRoleStates,
    nextLoverPairs,
    result: {
      deaths: nightDeaths,
      deathDetails,
      saves: unique(Array.from(saves)),
      blocked: unique(Array.from(blockedRoles)) as RoleType[],
      investigations,
      busSwaps: swapA && swapB ? [{ a: swapA, b: swapB }] : [],
      dayImmunities: unique(Array.from(dayImmunities)),
      recruits: unique(recruits),
      recruitDetails,
      loverPairsCreated: nextLoverPairs.map(([a, b]) => `${a}|${b}`),
      notes,
    },
  };
}

export function evaluateWinCondition(
  players: { id: string }[],
  deadPlayerIds: string[],
  roleAssignments: Record<RoleType, string[]>
): string | null {
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
    if (!role) continue;
    const alignment = getRoleAlignment(role);
    aliveByAlignment[alignment] += 1;
    if (role === "SerialKiller") serialKillerAlive += 1;
  }

  if (alive.length > 0 && serialKillerAlive === alive.length) {
    return "Serial Killer wins";
  }

  if (aliveByAlignment.Mafia === 0 && aliveByAlignment.RivalMafia === 0 && serialKillerAlive === 0) {
    return "Town wins";
  }

  if (
    aliveByAlignment.Mafia > 0 &&
    aliveByAlignment.Mafia >= aliveByAlignment.Town + aliveByAlignment.Neutral &&
    aliveByAlignment.RivalMafia === 0 &&
    serialKillerAlive === 0
  ) {
    return "Mafia wins";
  }

  if (
    aliveByAlignment.RivalMafia > 0 &&
    aliveByAlignment.RivalMafia >= aliveByAlignment.Town + aliveByAlignment.Neutral &&
    aliveByAlignment.Mafia === 0 &&
    serialKillerAlive === 0
  ) {
    return "Rival Mafia wins";
  }

  return null;
}
