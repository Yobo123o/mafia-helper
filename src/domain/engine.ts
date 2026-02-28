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
    RivalGodfather: { ...states.RivalGodfather },
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

function getRivalMafiaSacrifice(
  assignments: Record<RoleType, string[]>,
  deadSet: Set<string>
): string | null {
  const rivalGodfather = (assignments.RivalGodfather ?? []).filter((id) => id && !deadSet.has(id));
  const rivalMafia = (assignments.RivalMafia ?? []).filter((id) => id && !deadSet.has(id));
  if (rivalMafia.length > 0) return rivalMafia[0];
  if (rivalGodfather.length > 0) return rivalGodfather[0];
  return null;
}

type NightResolutionContext = {
  deadSet: Set<string>;
  nextAssignments: Record<RoleType, string[]>;
  nextRoleStates: RoleStateMap;
  playerRoles: Record<string, RoleType>;
  notes: string[];
  blockedRoles: Set<RoleType>;
  protectedAtNight: Set<string>;
  dayImmunities: Set<string>;
  deaths: Set<string>;
  deathCauses: Map<string, Set<string>>;
  saves: Set<string>;
  investigations: NightResult["investigations"];
  recruits: string[];
  recruitDetails: NonNullable<NightResult["recruitDetails"]>;
  nextLoverPairs: Pair[];
  roleTargets: Partial<Record<RoleType, string[]>>;
  swapA: string | null;
  swapB: string | null;
  convertedRoleThisNight: RoleType | null;
  detectiveConvertedThisNight: boolean;
  addDeathWithCause: (id: string | null, cause: string) => void;
};

function createResolutionContext(input: ResolveNightInput): NightResolutionContext {
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
  const recruitDetails: NonNullable<NightResult["recruitDetails"]> = [];
  const nextLoverPairs = [...input.loverPairs];
  const roleTargets: Partial<Record<RoleType, string[]>> = {};
  const addDeathWithCause = (id: string | null, cause: string) => {
    if (!id) return;
    deaths.add(id);
    const existing = deathCauses.get(id) ?? new Set<string>();
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

function applyTargetModifiersPhase(input: ResolveNightInput, ctx: NightResolutionContext) {
  const busTargets = input.nightActions.BusDriver?.targetIds ?? [];
  ctx.swapA = isActionableTarget(busTargets[0]) ? busTargets[0] : null;
  ctx.swapB = isActionableTarget(busTargets[1]) ? busTargets[1] : null;

  for (const role of Object.keys(input.nightActions) as RoleType[]) {
    const action = input.nightActions[role];
    ctx.roleTargets[role] = (action?.targetIds ?? []).map((id) =>
      isActionableTarget(id) ? redirectTarget(id, ctx.swapA, ctx.swapB) : id
    );
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

function applyAbilityBlocksPhase(ctx: NightResolutionContext) {
  const bartenderTarget = ctx.roleTargets.Bartender?.[0];
  if (!isActionableTarget(bartenderTarget)) return;
  const blockedRole = ctx.playerRoles[bartenderTarget];
  if (!blockedRole) return;
  ctx.blockedRoles.add(blockedRole);
  ctx.notes.push(`${blockedRole} was blocked by Bartender.`);
}

function applyProtectionPhase(input: ResolveNightInput, ctx: NightResolutionContext) {
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

function applyKillPhase(input: ResolveNightInput, ctx: NightResolutionContext) {
  const killerRoles: RoleType[] = ["Mafia", "RivalMafia", "SerialKiller", "Vigilante"];
  for (const role of killerRoles) {
    if (ctx.blockedRoles.has(role)) continue;
    const target = ctx.roleTargets[role]?.[0];
    if (!isActionableTarget(target)) continue;
    if (ctx.deadSet.has(target)) continue;

    if (role === "Vigilante") {
      if (input.nightNumber === 1 || input.roleStates.Vigilante.lockedOut || input.roleStates.Vigilante.usedShot) {
        ctx.notes.push("Vigilante action was ignored due to role restrictions.");
        continue;
      }
      ctx.nextRoleStates.Vigilante.usedShot = true;
    }

    const cause =
      role === "Mafia"
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

function applyPassiveEffectsPhase(input: ResolveNightInput, ctx: NightResolutionContext) {
  const grandmaId = firstAliveForRole("Grandma", ctx.nextAssignments, ctx.deadSet);
  // Grandma's retaliation is based on being alive at the start of the night.
  // A same-night kill should not suppress Home Defense retaliation.
  if (grandmaId) {
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
      if (ctx.blockedRoles.has(role)) continue;
      const roleTargetIds = ctx.roleTargets[role] ?? [];
      const visitedGrandma = roleTargetIds.some((id) => isActionableTarget(id) && id === grandmaId);
      if (!visitedGrandma) continue;

      if (role === "Mafia") {
        const mafiaDeath = getMafiaSacrifice(ctx.nextAssignments, ctx.deadSet);
        ctx.addDeathWithCause(mafiaDeath, "Visited Grandma and died to Home Defense retaliation.");
        if (mafiaDeath) ctx.notes.push("Grandma retaliated against the Mafia visit.");
        continue;
      }

      if (role === "RivalMafia") {
        const rivalDeath = getRivalMafiaSacrifice(ctx.nextAssignments, ctx.deadSet);
        ctx.addDeathWithCause(rivalDeath, "Visited Grandma and died to Home Defense retaliation.");
        if (rivalDeath) ctx.notes.push("Grandma retaliated against the Rival Mafia visit.");
        continue;
      }

      const actor = firstAliveForRole(role, ctx.nextAssignments, ctx.deadSet);
      ctx.addDeathWithCause(actor, `Visited Grandma as ${formatRoleName(role)} and died to Home Defense.`);
      if (actor) ctx.notes.push(`${role} died while visiting Grandma.`);
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

function applyInvestigationsPhase(input: ResolveNightInput, ctx: NightResolutionContext) {
  if (!ctx.blockedRoles.has("Detective") && !ctx.detectiveConvertedThisNight) {
    const detectiveTarget = ctx.roleTargets.Detective?.[0];
    if (isActionableTarget(detectiveTarget)) {
      const targetRole = ctx.playerRoles[detectiveTarget];
      if (targetRole) {
        const result = getDetectiveResultForRole(targetRole);
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

      // Apply Shared Fate immediately after pair creation so Night 1 deaths
      // still trigger lover-chain deaths in the same resolution.
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
  }
}

function applyPostInvestigationStateChanges(input: ResolveNightInput, ctx: NightResolutionContext) {
  if (!ctx.blockedRoles.has("MadeMan") && !input.roleStates.MadeMan.usedRecruit) {
    const recruitTarget = ctx.roleTargets.MadeMan?.[0];
    if (isActionableTarget(recruitTarget) && !ctx.deadSet.has(recruitTarget)) {
      const currentRole = ctx.playerRoles[recruitTarget];
      if (
        currentRole &&
        currentRole !== "Mafia" &&
        currentRole !== "Godfather" &&
        currentRole !== "RivalGodfather" &&
        currentRole !== "MadeMan" &&
        currentRole !== "UndercoverCop"
      ) {
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
      if (role && getRoleAlignment(role) === "Town") {
        ctx.nextRoleStates.Vigilante.pendingLockout = true;
        ctx.notes.push("Vigilante killed a Town player and will be locked out next night.");
      }
    }
  }
}

export function resolveNight(input: ResolveNightInput): ResolveNightOutput {
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
      blocked: unique(Array.from(ctx.blockedRoles)) as RoleType[],
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
