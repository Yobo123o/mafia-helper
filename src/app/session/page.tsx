"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { evaluateWinCondition, resolveNight } from "@/domain/engine";
import { getDetectiveResultForRole, ROLE_DEFINITIONS, ROLE_TYPES, type RoleAbility } from "@/domain/roles";
import { buildWakeOrder, getInitialRoleStates, validateAction } from "@/domain/rules";
import type { NightResult, RoleStateMap, RoleType } from "@/domain/types";
import type { IconType } from "react-icons";
import type { LucideIcon } from "lucide-react";
import {
  BanIcon,
  HeartIcon,
  PlusIcon,
  SearchIcon,
  SettingsIcon,
  ShieldIcon,
  ShuffleIcon,
  SkullIcon,
  UserPlusIcon,
  WandSparklesIcon,
} from "lucide-react";
import {
  GiAssassinPocket,
  GiBus,
  GiCigar,
  GiCupidonArrow,
  GiFedora,
  GiHospitalCross,
  GiKingJuMask,
  GiMagicHat,
  GiMailbox,
  GiPistolGun,
  GiPoliceOfficerHead,
  GiPotionOfMadness,
  GiScales,
  GiShield,
  GiSkullCrossedBones,
  GiSpy,
  GiTie,
  GiTwoCoins,
} from "react-icons/gi";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  clearSession,
  createNightActions,
  createRoleAssignments,
  createRoleCounts,
  loadSession,
  saveSession,
  type NightActionState,
  type PlayerEntry,
} from "@/lib/session";

function roleLabel(role: RoleType): string {
  return role.replace(/([a-z])([A-Z])/g, "$1 $2");
}

const MAGICIAN_CHOICE_LABELS: Record<"kill" | "save" | "none", string> = {
  kill: "Vanishing Act",
  save: "Escape Trick",
  none: "No Action",
};

function getMagicianAbilityByChoice(choice?: "kill" | "save" | "none"): RoleAbility | null {
  if (!choice || choice === "none") return null;
  const abilities = ROLE_DEFINITIONS.Magician.abilities.filter((ability) => ability.activation.type === "Active");
  if (choice === "kill") {
    return abilities.find((ability) => ability.name === "Vanishing Act") ?? abilities[0] ?? null;
  }
  return abilities.find((ability) => ability.name === "Escape Trick") ?? abilities[1] ?? abilities[0] ?? null;
}

function getTargetSectionTitle(role: RoleType): string {
  switch (role) {
    case "Cupid":
      return "Pick Lovers";
    case "BusDriver":
      return "Swap Pair";
    case "Detective":
      return "Investigation";
    case "Doctor":
      return "Protection";
    case "Mafia":
    case "RivalMafia":
      return "Elimination";
    case "Vigilante":
      return "Shot";
    case "Lawyer":
      return "Defense";
    case "Bartender":
      return "Block";
    case "SerialKiller":
      return "Kill";
    case "MadeMan":
      return "Recruitment";
    case "Magician":
      return "Magic Action";
    default:
      return "Action";
  }
}

function getAssignmentPrompt(role: RoleType): string {
  if (role === "Mafia") return "Choose players for each Mafia team role.";
  if (role === "RivalMafia") return "Choose players for the Rival Mafia team.";
  return `Choose a player to become ${roleLabel(role)}.`;
}

function getTargetSlotLabel(role: RoleType, index: number, magicianChoice?: "kill" | "save" | "none"): string {
  switch (role) {
    case "Cupid":
      return index === 0 ? "Lover 1" : "Lover 2";
    case "BusDriver":
      return index === 0 ? "Swap A" : "Swap B";
    case "Detective":
      return "Investigate";
    case "Doctor":
      return "Protect";
    case "Mafia":
    case "RivalMafia":
    case "SerialKiller":
      return "Victim";
    case "Vigilante":
      return "Shoot";
    case "Lawyer":
      return "Defend";
    case "Bartender":
      return "Block";
    case "MadeMan":
      return "Recruit";
    case "Magician":
      if (magicianChoice === "save") return `${MAGICIAN_CHOICE_LABELS.save} Target`;
      return `${MAGICIAN_CHOICE_LABELS.kill} Target`;
    default:
      return `Target ${index + 1}`;
  }
}

function abilityMeta(phase: "Night" | "Night 1" | "Day" | "Any", type: "Active" | "Passive" | "Triggered"): string {
  if (phase === "Any" && type === "Passive") return "Passive";
  return `${phase} - ${type}`;
}

function normalizeValidationForInProgressInput<T extends { valid: boolean; reason?: string }>(validation: T): T {
  if (!validation.valid && validation.reason === "Invalid target count.") {
    return { ...validation, valid: true, reason: undefined };
  }
  return validation;
}

function isMadeManRecruitBlockedRole(role: RoleType): boolean {
  return role === "Mafia" || role === "Godfather" || role === "MadeMan" || role === "UndercoverCop";
}

function getTargetSlotIcon(role: RoleType): LucideIcon {
  switch (role) {
    case "Cupid":
      return HeartIcon;
    case "BusDriver":
      return ShuffleIcon;
    case "Detective":
      return SearchIcon;
    case "Doctor":
    case "Lawyer":
      return ShieldIcon;
    case "MadeMan":
      return UserPlusIcon;
    case "Bartender":
      return BanIcon;
    case "Magician":
      return WandSparklesIcon;
    case "Mafia":
    case "RivalMafia":
    case "SerialKiller":
    case "Vigilante":
      return SkullIcon;
    default:
      return PlusIcon;
  }
}

function getActiveAbilityForStep(
  role: RoleType,
  nightNumber: number,
  magicianChoice?: "kill" | "save" | "none"
): RoleAbility | null {
  const abilities = ROLE_DEFINITIONS[role].abilities.filter((ability) => ability.activation.type === "Active");
  if (abilities.length === 0) return null;

  if (role === "Magician") {
    return getMagicianAbilityByChoice(magicianChoice);
  }

  const phaseFiltered = abilities.filter((ability) => {
    if (ability.activation.phase === "Night") return true;
    if (ability.activation.phase === "Night 1") return nightNumber === 1;
    return false;
  });

  return phaseFiltered[0] ?? abilities[0] ?? null;
}

function getAssignmentGridClass(count: number): string {
  if (count <= 1) return "mx-auto grid w-full justify-items-center grid-cols-1 sm:w-fit gap-3";
  if (count <= 4) return "mx-auto grid w-full justify-items-center grid-cols-2 sm:w-fit gap-3";
  if (count <= 8) return "mx-auto grid w-full justify-items-center grid-cols-2 sm:w-fit sm:grid-cols-3 gap-3";
  return "mx-auto grid w-full justify-items-center grid-cols-2 sm:w-fit sm:grid-cols-3 lg:grid-cols-4 gap-3";
}

function getCompactGridColsClass(count: number, maxCols = 3): string {
  const cols = Math.max(1, Math.min(count, maxCols));
  if (cols === 1) return "grid w-full justify-items-center grid-cols-1 sm:w-fit gap-2 sm:gap-3";
  if (cols === 2) return "grid w-full justify-items-center grid-cols-2 sm:w-fit gap-2 sm:gap-3";
  return "grid w-full justify-items-center grid-cols-3 sm:w-fit gap-2 sm:gap-3";
}

function getLeftColumnWidthRem(assignmentCount: number): number {
  if (assignmentCount <= 1) return 14;
  if (assignmentCount <= 4) return 23;
  if (assignmentCount <= 8) return 33;
  return 43;
}

function getRightColumnWidthRem(actionCount: number): number {
  return actionCount >= 2 ? 23 : 14;
}

function getStepperColumnsClass(actionCount: number, assignmentCount: number): string {
  const left = getLeftColumnWidthRem(assignmentCount);
  const right = getRightColumnWidthRem(actionCount);
  if (left === 14 && right === 14) return "grid items-start gap-4 lg:justify-start lg:grid-cols-[14rem_14rem]";
  if (left === 14 && right === 23) return "grid items-start gap-4 lg:justify-start lg:grid-cols-[14rem_23rem]";
  if (left === 23 && right === 14) return "grid items-start gap-4 lg:justify-start lg:grid-cols-[23rem_14rem]";
  if (left === 23 && right === 23) return "grid items-start gap-4 lg:justify-start lg:grid-cols-[23rem_23rem]";
  if (left === 33 && right === 14) return "grid items-start gap-4 lg:justify-start lg:grid-cols-[33rem_14rem]";
  if (left === 33 && right === 23) return "grid items-start gap-4 lg:justify-start lg:grid-cols-[33rem_23rem]";
  if (left === 43 && right === 14) return "grid items-start gap-4 lg:justify-start lg:grid-cols-[43rem_14rem]";
  return "grid items-start gap-4 lg:justify-start lg:grid-cols-[43rem_23rem]";
}

function getPageMaxWidthRem(actionCount: number, assignmentCount: number): number {
  const left = getLeftColumnWidthRem(assignmentCount);
  const right = getRightColumnWidthRem(actionCount);
  return left + right + 8; // columns + gap + panel/card breathing room
}

function getTeamRightColumnWidthRem(): number {
  return 14;
}

function getTeamLeftColumnWidthRem(role: RoleType, assignmentCount: number): number {
  const base = getLeftColumnWidthRem(assignmentCount);
  if (role === "Mafia") return Math.max(base, 33);
  return base;
}

function getTeamStepColumnsClass(role: RoleType, assignmentCount: number): string {
  const left = getTeamLeftColumnWidthRem(role, assignmentCount);
  const right = getTeamRightColumnWidthRem();
  if (left === 14 && right === 14) return "grid items-start gap-4 md:justify-start md:grid-cols-[14rem_14rem]";
  if (left === 23 && right === 14) return "grid items-start gap-4 md:justify-start md:grid-cols-[23rem_14rem]";
  if (left === 33 && right === 14) return "grid items-start gap-4 md:justify-start md:grid-cols-[33rem_14rem]";
  return "grid items-start gap-4 md:justify-start md:grid-cols-[43rem_14rem]";
}

function getTeamPageMaxWidthRem(role: RoleType, maxActionTargets: number, assignmentCount: number): number {
  const left = getTeamLeftColumnWidthRem(role, assignmentCount);
  const right = getTeamRightColumnWidthRem();
  return left + right + 8;
}

const NO_ACTION = "__no_action__";

const ROLE_ICONS: Record<RoleType, IconType> = {
  Civilian: GiTwoCoins,
  Detective: GiPoliceOfficerHead,
  Doctor: GiHospitalCross,
  Miller: GiTie,
  Cupid: GiCupidonArrow,
  BusDriver: GiBus,
  UndercoverCop: GiSpy,
  Grandma: GiShield,
  Magician: GiMagicHat,
  Postman: GiMailbox,
  Vigilante: GiPistolGun,
  Mafia: GiFedora,
  Godfather: GiCigar,
  Lawyer: GiScales,
  MadeMan: GiAssassinPocket,
  Bartender: GiPotionOfMadness,
  SerialKiller: GiSkullCrossedBones,
  RivalMafia: GiKingJuMask,
};

type PickerState = {
  open: boolean;
  mode: "assignment" | "target";
  role: RoleType;
  index: number;
  title: string;
  description: string;
  excludePlayerIds?: string[];
  allowNoAction?: boolean;
};

const DEFAULT_PICKER: PickerState = {
  open: false,
  mode: "assignment",
  role: "Mafia",
  index: 0,
  title: "",
  description: "",
};

export default function SessionPage() {
  const router = useRouter();

  const [sessionActive, setSessionActive] = useState(false);
  const [players, setPlayers] = useState<PlayerEntry[]>([]);
  const [roleCounts, setRoleCounts] = useState<Record<RoleType, number>>(() => createRoleCounts(ROLE_TYPES));
  const [nightNumber, setNightNumber] = useState(1);
  const [dayNumber, setDayNumber] = useState(0);
  const [nightInProgress, setNightInProgress] = useState(false);
  const [dayInProgress, setDayInProgress] = useState(false);
  const [dayEliminationDone, setDayEliminationDone] = useState(false);
  const [wakeIndex, setWakeIndex] = useState(0);
  const [deadPlayerIds, setDeadPlayerIds] = useState<string[]>([]);
  const [roleAssignments, setRoleAssignments] = useState<Record<RoleType, string[]>>(() =>
    createRoleAssignments(ROLE_TYPES)
  );
  const [nightActions, setNightActions] = useState<NightActionState>(() => createNightActions(ROLE_TYPES));
  const [roleStates, setRoleStates] = useState<RoleStateMap>(() => getInitialRoleStates());
  const [loverPairs, setLoverPairs] = useState<[string, string][]>([]);
  const [convertedOrigins, setConvertedOrigins] = useState<Record<string, RoleType>>({});
  const [previousNightSnapshot, setPreviousNightSnapshot] = useState<{
    nightNumber: number;
    deadPlayerIds: string[];
    roleAssignments: Record<RoleType, string[]>;
    nightActions: NightActionState;
    roleStates: RoleStateMap;
    loverPairs: [string, string][];
    convertedOrigins?: Record<string, RoleType>;
  } | null>(null);
  const [lastNightResult, setLastNightResult] = useState<NightResult | null>(null);
  const [winCondition, setWinCondition] = useState<string | null>(null);
  const [dayNomineeId, setDayNomineeId] = useState<string>("");
  const [postmanDeliveryTargetId, setPostmanDeliveryTargetId] = useState<string>("");
  const [awaitingPostmanDelivery, setAwaitingPostmanDelivery] = useState(false);
  const [dayError, setDayError] = useState<string | null>(null);
  const [dayInfo, setDayInfo] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [confirmEndSession, setConfirmEndSession] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem("theme") !== "light";
  });
  const [picker, setPicker] = useState<PickerState>(DEFAULT_PICKER);

  useEffect(() => {
    const saved = loadSession();
    if (!saved || !saved.sessionActive) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSessionActive(true);
    setPlayers(saved.players ?? []);
    setRoleCounts(saved.roleCounts ?? createRoleCounts(ROLE_TYPES));
    setNightNumber(saved.nightNumber ?? 1);
    setDayNumber(saved.dayNumber ?? 0);
    setNightInProgress(saved.nightInProgress ?? false);
    setDayInProgress(saved.dayInProgress ?? false);
    setDayEliminationDone(saved.dayEliminationDone ?? false);
    setWakeIndex(saved.wakeIndex ?? 0);
    setRoleAssignments(saved.roleAssignments ?? createRoleAssignments(ROLE_TYPES));
    setNightActions(saved.nightActions ?? createNightActions(ROLE_TYPES));
    setDeadPlayerIds(saved.deadPlayerIds ?? []);
    setRoleStates(saved.roleStates ?? getInitialRoleStates());
    setLoverPairs(saved.loverPairs ?? []);
    setConvertedOrigins(saved.convertedOrigins ?? {});
    setPreviousNightSnapshot(saved.previousNightSnapshot ?? null);
    setLastNightResult(saved.lastNightResult ?? null);
    setWinCondition(saved.winCondition ?? null);
  }, []);

  useEffect(() => {
    if (!sessionActive) return;
    saveSession({
      players,
      roleCounts,
      nightNumber,
      dayNumber,
      nightInProgress,
      dayInProgress,
      dayEliminationDone,
      wakeIndex,
      sessionActive,
      roleAssignments,
      nightActions,
      deadPlayerIds,
      roleStates,
      loverPairs,
      convertedOrigins,
      previousNightSnapshot,
      lastNightResult,
      winCondition,
    });
  }, [
    players,
    roleCounts,
    nightNumber,
    dayNumber,
    nightInProgress,
    dayInProgress,
    dayEliminationDone,
    wakeIndex,
    sessionActive,
    roleAssignments,
    nightActions,
    deadPlayerIds,
    roleStates,
    loverPairs,
    convertedOrigins,
    previousNightSnapshot,
    lastNightResult,
    winCondition,
  ]);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
      return;
    }
    document.documentElement.classList.remove("dark");
    localStorage.setItem("theme", "light");
  }, [darkMode]);

  const selectedRoles = useMemo(() => ROLE_TYPES.filter((role) => (roleCounts[role] ?? 0) > 0), [roleCounts]);

  const playerRoles = useMemo(() => {
    const map: Record<string, RoleType | null> = {};
    for (const role of ROLE_TYPES) {
      for (const playerId of roleAssignments[role] ?? []) {
        if (playerId) map[playerId] = role;
      }
    }
    return map;
  }, [roleAssignments]);
  const effectiveRoleByPlayer = useMemo(() => {
    const map: Record<string, RoleType> = {};
    for (const player of players) map[player.id] = "Civilian";
    for (const role of ROLE_TYPES) {
      for (const playerId of roleAssignments[role] ?? []) {
        if (playerId) map[playerId] = role;
      }
    }
    return map;
  }, [players, roleAssignments]);

  const assignedByPlayer = playerRoles as Record<string, RoleType>;
  const deadSet = useMemo(() => new Set(deadPlayerIds), [deadPlayerIds]);
  const alivePlayers = useMemo(() => players.filter((player) => !deadSet.has(player.id)), [deadSet, players]);
  const dayImmunitySet = useMemo(
    () => new Set(lastNightResult?.dayImmunities ?? []),
    [lastNightResult?.dayImmunities]
  );
  const postmanId = roleAssignments.Postman?.[0] ?? null;
  const isNight1 = nightNumber === 1;

  const rolesAlive = useMemo(() => {
    const map: Partial<Record<RoleType, boolean>> = {};
    for (const role of ROLE_TYPES) {
      if (isNight1) {
        map[role] = (roleCounts[role] ?? 0) > 0;
        continue;
      }
      const assigned = roleAssignments[role] ?? [];
      map[role] = assigned.some((id) => id && !deadSet.has(id));
    }
    if (!isNight1) {
      const mafiaTeamAlive = ["Mafia", "Godfather", "MadeMan"].some((r) => {
        const role = r as RoleType;
        return (roleAssignments[role] ?? []).some((id) => id && !deadSet.has(id));
      });
      map.Mafia = mafiaTeamAlive;
    }
    return map;
  }, [deadSet, isNight1, roleAssignments, roleCounts]);

  const wakeOrder = useMemo(
    () => buildWakeOrder(selectedRoles, { nightNumber, rolesAlive }),
    [selectedRoles, nightNumber, rolesAlive]
  );
  const stepOrder = useMemo(() => {
    if (!isNight1) return wakeOrder;
    const mafiaSharedRoles = new Set<RoleType>(["Godfather", "MadeMan", "UndercoverCop"]);
    const extraAssignmentRoles = selectedRoles.filter(
      (role) => role !== "Civilian" && !wakeOrder.includes(role) && !mafiaSharedRoles.has(role)
    );
    const detectiveIndex = wakeOrder.indexOf("Detective");
    if (detectiveIndex === -1) return [...wakeOrder, ...extraAssignmentRoles];
    return [...wakeOrder.slice(0, detectiveIndex), ...extraAssignmentRoles, ...wakeOrder.slice(detectiveIndex)];
  }, [isNight1, selectedRoles, wakeOrder]);

  useEffect(() => {
    if (!nightInProgress) return;
    if (stepOrder.length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setNightInProgress(false);
      setWakeIndex(0);
      return;
    }
    if (wakeIndex >= stepOrder.length) {
      setWakeIndex(0);
    }
  }, [nightInProgress, wakeIndex, stepOrder.length]);

  const currentRole = stepOrder[wakeIndex] ?? null;
  const currentDefinition = currentRole ? ROLE_DEFINITIONS[currentRole] : null;
  const magicianOutOfActions = roleStates.Magician.usedKill && roleStates.Magician.usedSave;
  const currentActionCount = useMemo(() => {
    if (!currentRole || !currentDefinition) return 0;
    if (currentRole === "Vigilante" && roleStates.Vigilante.lockedOut) return 0;
    if (currentRole === "Magician" && magicianOutOfActions) return 0;
    if (currentRole !== "Magician") return currentDefinition.action?.targetCount ?? 0;
    const choice = nightActions.Magician?.metadata?.choice;
    if (choice === "none") return 0;
    return currentDefinition.action?.targetCount ?? 0;
  }, [
    currentDefinition,
    currentRole,
    magicianOutOfActions,
    nightActions.Magician?.metadata?.choice,
    roleStates.Vigilante.lockedOut,
  ]);
  const isTeamStep = currentRole === "Mafia" || currentRole === "RivalMafia";
  const effectiveRecruitTargetId = useMemo(() => {
    if ((roleCounts.MadeMan ?? 0) <= 0 || roleStates.MadeMan.usedRecruit) return null;
    const rawRecruitTarget = nightActions.MadeMan?.targetIds?.[0];
    if (!rawRecruitTarget || rawRecruitTarget === NO_ACTION) return null;

    const swapA = nightActions.BusDriver?.targetIds?.[0];
    const swapB = nightActions.BusDriver?.targetIds?.[1];
    if (swapA && swapB) {
      if (rawRecruitTarget === swapA) return swapB;
      if (rawRecruitTarget === swapB) return swapA;
    }
    return rawRecruitTarget;
  }, [
    nightActions.BusDriver,
    nightActions.MadeMan,
    roleCounts.MadeMan,
    roleStates.MadeMan.usedRecruit,
  ]);
  const isRoleSuppressedByRecruit = useMemo(() => {
    if (!currentRole || !effectiveRecruitTargetId) return false;
    if (currentRole === "Mafia" || currentRole === "RivalMafia" || currentRole === "MadeMan") return false;
    return (roleAssignments[currentRole] ?? []).includes(effectiveRecruitTargetId);
  }, [currentRole, effectiveRecruitTargetId, roleAssignments]);
  const currentAssignmentCount = useMemo(() => {
    if (!currentRole) return 0;
    if (currentRole === "Mafia") {
      const displayedMafiaCount = Math.max(
        roleCounts.Mafia ?? 0,
        (roleAssignments.Mafia ?? []).filter((id) => Boolean(id && id.trim().length > 0)).length
      );
      return (["Godfather", "MadeMan", "UndercoverCop"] as RoleType[]).reduce((total, role) => total + (roleCounts[role] ?? 0), 0) + displayedMafiaCount;
    }
    return roleCounts[currentRole] ?? 0;
  }, [currentRole, roleAssignments.Mafia, roleCounts]);
  const teamMaxActionTargets = useMemo(() => {
    if (!isTeamStep || !currentRole) return 0;
    if (currentRole === "Mafia") {
      const mafiaTargets = ROLE_DEFINITIONS.Mafia.action?.targetCount ?? 0;
      const recruitAvailable = (roleCounts.MadeMan ?? 0) > 0 && !roleStates.MadeMan.usedRecruit;
      const recruitTargets = recruitAvailable ? ROLE_DEFINITIONS.MadeMan.action?.targetCount ?? 0 : 0;
      return Math.max(mafiaTargets, recruitTargets);
    }
    return ROLE_DEFINITIONS.RivalMafia.action?.targetCount ?? 0;
  }, [currentRole, isTeamStep, roleCounts.MadeMan, roleStates.MadeMan.usedRecruit]);
  const activePageMaxWidthRem =
    nightInProgress && currentRole
      ? isTeamStep
        ? getTeamPageMaxWidthRem(currentRole, teamMaxActionTargets, currentAssignmentCount)
        : getPageMaxWidthRem(currentActionCount, currentAssignmentCount)
      : null;

  function getPlayerName(playerId: string | undefined | null): string {
    if (!playerId || playerId === NO_ACTION) return "No action";
    const player = players.find((item) => item.id === playerId);
    return player?.name.trim() || "Unnamed";
  }

  function setRoleAssignment(role: RoleType, index: number, playerId: string) {
    setRoleAssignments((current) => {
      const next = { ...current };
      if (playerId) {
        for (const roleKey of ROLE_TYPES) {
          next[roleKey] = (next[roleKey] ?? []).filter((id) => id !== playerId);
        }
      }
      const nextList = [...(next[role] ?? [])];
      nextList[index] = playerId;
      next[role] = nextList;
      return next;
    });
  }

  function updateNightTarget(role: RoleType, index: number, playerId: string) {
    setNightActions((current) => {
      const next = { ...current };
      const action = next[role] ?? { targetIds: [] };
      const targetIds = [...(action.targetIds ?? [])];
      targetIds[index] = playerId;
      next[role] = { ...action, targetIds };
      return next;
    });
  }

  function updateNightChoice(role: RoleType, choice: "kill" | "save" | "none") {
    setNightActions((current) => {
      const next = { ...current };
      const action = next[role] ?? { targetIds: [] };
      next[role] = {
        ...action,
        targetIds: choice === "none" ? [] : action.targetIds ?? [],
        metadata: { ...(action.metadata ?? {}), choice },
      };
      return next;
    });
  }

  function isRoleAssignmentComplete(role: RoleType): boolean {
    const count = roleCounts[role] ?? 0;
    if (count === 0) return true;
    const assigned = roleAssignments[role] ?? [];
    return assigned.filter((id) => id && id.trim().length > 0).length >= count;
  }

  function isMafiaAssignmentComplete(): boolean {
    const rolesToAssign: RoleType[] = ["Godfather", "Mafia", "MadeMan", "UndercoverCop"];
    return rolesToAssign.every((role) => isRoleAssignmentComplete(role));
  }

  function isActionComplete(role: RoleType): boolean {
    if (effectiveRecruitTargetId && role !== "Mafia" && role !== "RivalMafia" && role !== "MadeMan") {
      const assigned = roleAssignments[role] ?? [];
      if (assigned.includes(effectiveRecruitTargetId)) return true;
    }

    const definition = ROLE_DEFINITIONS[role];
    const action = definition.action;
    if (!action || action.targetCount === 0) return true;
    if (role === "Vigilante" && nightNumber === 1) return true;
    if (role === "Vigilante" && roleStates.Vigilante.lockedOut) return true;
    if (role === "Magician" && roleStates.Magician.usedKill && roleStates.Magician.usedSave) return true;

    if (role === "Magician") {
      const choice = nightActions.Magician?.metadata?.choice;
      if (!choice) return false;
      if (choice === "none") return true;
    }

    const targets = [...(nightActions[role]?.targetIds ?? [])];
    while (targets.length < action.targetCount) targets.push("");

    const validation = validateAction(role, targets, { nightNumber, roleStates }, nightActions[role]?.metadata);
    if (!validation.valid) return false;

    const selectedTargets = targets.filter((id) => Boolean(id));
    return action.optional ? true : selectedTargets.length >= action.targetCount;
  }

  function isStepComplete(role: RoleType): boolean {
    if (role === "Mafia") {
      const assignmentComplete = isNight1 ? isMafiaAssignmentComplete() : true;
      if (!assignmentComplete) return false;
      if (!isActionComplete("Mafia")) return false;

      const recruitAvailable = (roleCounts.MadeMan ?? 0) > 0 && !roleStates.MadeMan.usedRecruit;
      if (!recruitAvailable) return true;
      const recruitTarget = nightActions.MadeMan?.targetIds?.[0];
      if (!recruitTarget || recruitTarget === NO_ACTION) return true;
      const recruitValidation = validateAction("MadeMan", [recruitTarget], { nightNumber, roleStates });
      if (!recruitValidation.valid) return false;
      const effectiveTarget = effectiveRecruitTargetId;
      if (!effectiveTarget) return true;
      return !isMadeManRecruitBlockedRole(effectiveRoleByPlayer[effectiveTarget] ?? "Civilian");
    }

    const assignmentComplete = isNight1 ? isRoleAssignmentComplete(role) : true;
    return assignmentComplete && isActionComplete(role);
  }

  const currentStepComplete = currentRole ? isStepComplete(currentRole) : false;
  const allStepsComplete = stepOrder.length > 0 && stepOrder.every((role) => isStepComplete(role));
  const currentStepValidation = useMemo(() => {
    if (!currentRole) return { valid: true as const };
    if (isRoleSuppressedByRecruit) return { valid: true as const };
    if (currentRole === "Vigilante" && nightNumber === 1) return { valid: true as const };
    if (currentRole === "Vigilante" && roleStates.Vigilante.lockedOut) return { valid: true as const };
    if (currentRole === "Mafia") {
      const mafiaTargets = (nightActions.Mafia?.targetIds ?? []).slice(0, ROLE_DEFINITIONS.Mafia.action?.targetCount ?? 1);
      const mafiaValidation = normalizeValidationForInProgressInput(
        validateAction("Mafia", mafiaTargets, { nightNumber, roleStates }, nightActions.Mafia?.metadata)
      );
      if (!mafiaValidation.valid) return mafiaValidation;
      const recruitAvailable = (roleCounts.MadeMan ?? 0) > 0 && !roleStates.MadeMan.usedRecruit;
      if (!recruitAvailable) return { valid: true as const };
      const recruitTarget = nightActions.MadeMan?.targetIds?.[0];
      if (!recruitTarget || recruitTarget === NO_ACTION) return { valid: true as const };
      const recruitValidation = validateAction(
        "MadeMan",
        [recruitTarget],
        { nightNumber, roleStates },
        nightActions.MadeMan?.metadata
      );
      if (!recruitValidation.valid) return recruitValidation;
      const effectiveTarget = effectiveRecruitTargetId;
      if (!effectiveTarget) return { valid: true as const };
      const effectiveRole = effectiveRoleByPlayer[effectiveTarget] ?? "Civilian";
      if (isMadeManRecruitBlockedRole(effectiveRole)) {
        return {
          valid: false as const,
          reason: "Made Man cannot recruit Mafia, Godfather, Made Man, or Undercover Cop.",
        };
      }
      return { valid: true as const };
    }
    if (currentActionCount <= 0) return { valid: true as const };
    return normalizeValidationForInProgressInput(
      validateAction(
        currentRole,
        (nightActions[currentRole]?.targetIds ?? []).slice(0, currentActionCount),
        { nightNumber, roleStates },
        nightActions[currentRole]?.metadata
      )
    );
  }, [
    currentActionCount,
    currentRole,
    effectiveRecruitTargetId,
    effectiveRoleByPlayer,
    isRoleSuppressedByRecruit,
    nightActions,
    nightNumber,
    roleCounts.MadeMan,
    roleStates,
  ]);

  function startNight() {
    setRoleStates((current) => {
      if (!current.Vigilante.pendingLockout) return current;
      return {
        ...current,
        Vigilante: {
          ...current.Vigilante,
          lockedOut: true,
          pendingLockout: false,
        },
      };
    });
    setNightActions(createNightActions(ROLE_TYPES));
    setWakeIndex(0);
    setLastNightResult(null);
    setDayInProgress(false);
    setDayEliminationDone(false);
    setDayNomineeId("");
    setPostmanDeliveryTargetId("");
    setAwaitingPostmanDelivery(false);
    setDayError(null);
    setNightInProgress(true);
  }

  function completeNight() {
    setPreviousNightSnapshot({
      nightNumber,
      deadPlayerIds: [...deadPlayerIds],
      roleAssignments: ROLE_TYPES.reduce((acc, role) => {
        acc[role] = [...(roleAssignments[role] ?? [])];
        return acc;
      }, {} as Record<RoleType, string[]>),
      nightActions: ROLE_TYPES.reduce((acc, role) => {
        const action = nightActions[role] ?? { targetIds: [] };
        acc[role] = {
          targetIds: [...(action.targetIds ?? [])],
          metadata: action.metadata ? { ...action.metadata } : undefined,
        };
        return acc;
      }, {} as NightActionState),
      roleStates: structuredClone(roleStates),
      loverPairs: loverPairs.map((pair) => [pair[0], pair[1]] as [string, string]),
      convertedOrigins: { ...convertedOrigins },
    });

    const output = resolveNight({
      nightNumber,
      players,
      deadPlayerIds,
      roleAssignments,
      nightActions,
      roleStates,
      loverPairs,
    });

    setDeadPlayerIds(output.nextDeadPlayerIds);
    setRoleAssignments(output.nextRoleAssignments);
    setRoleStates(output.nextRoleStates);
    setLoverPairs(output.nextLoverPairs);
    setLastNightResult(output.result);
    if ((output.result.recruitDetails ?? []).length > 0) {
      setConvertedOrigins((current) => {
        const next = { ...current };
        for (const detail of output.result.recruitDetails ?? []) {
          next[detail.playerId] = detail.fromRole;
        }
        return next;
      });
    }

    const winner = evaluateWinCondition(players, output.nextDeadPlayerIds, output.nextRoleAssignments);
    setWinCondition(winner);

    setNightInProgress(false);
    setWakeIndex(0);
    setDayNumber(nightNumber + 1);
    setDayInProgress(false);
    setDayEliminationDone(false);
    setDayNomineeId("");
    setPostmanDeliveryTargetId("");
    setDayError(null);
    setNightNumber((current) => current + 1);
  }

  function beginDay() {
    setDayInProgress(true);
    setDayEliminationDone(false);
    setDayNomineeId("");
    setPostmanDeliveryTargetId("");
    setAwaitingPostmanDelivery(false);
    setDayError(null);
    setDayInfo(null);
  }

  function applyLoverChainDay(baseDeaths: Set<string>): Set<string> {
    const next = new Set(baseDeaths);
    let changed = true;
    while (changed) {
      changed = false;
      for (const [a, b] of loverPairs) {
        const aDead = deadSet.has(a) || next.has(a);
        const bDead = deadSet.has(b) || next.has(b);
        if (aDead && !bDead) {
          next.add(b);
          changed = true;
        }
        if (bDead && !aDead) {
          next.add(a);
          changed = true;
        }
      }
    }
    return next;
  }

  function confirmDayElimination() {
    setDayError(null);
    setDayInfo(null);
    if (!dayNomineeId) {
      setDayError("Select a player to eliminate.");
      return;
    }
    if (deadSet.has(dayNomineeId)) {
      setDayError("Selected player is already dead.");
      return;
    }

    if (dayImmunitySet.has(dayNomineeId)) {
      setDayEliminationDone(true);
      setDayInfo(`${getPlayerName(dayNomineeId)} had Daytime Defense. The hang attempt was wasted.`);
      setDayNomineeId("");
      setPostmanDeliveryTargetId("");
      setAwaitingPostmanDelivery(false);
      return;
    }

    const deaths = applyLoverChainDay(new Set([dayNomineeId]));
    const postmanHung =
      Boolean(postmanId) && !roleStates.Postman.usedDelivery && dayNomineeId === postmanId;
    if (postmanHung) {
      if (!awaitingPostmanDelivery) {
        setAwaitingPostmanDelivery(true);
        setDayInfo("Postman hang confirmed. Choose a Final Delivery target, then confirm again.");
        return;
      }
      const availableTargets = alivePlayers.map((player) => player.id).filter((id) => id !== postmanId);
      if (availableTargets.length > 0 && !postmanDeliveryTargetId) {
        setDayError("Choose a Final Delivery target before confirming.");
        return;
      }
      if (postmanDeliveryTargetId && !deaths.has(postmanDeliveryTargetId)) {
        deaths.add(postmanDeliveryTargetId);
        const expanded = applyLoverChainDay(deaths);
        deaths.clear();
        for (const id of expanded) deaths.add(id);
      }
    }

    const deadThisDay = Array.from(deaths).filter((id) => !deadSet.has(id));
    const collateral = deadThisDay.filter((id) => id !== dayNomineeId && id !== postmanDeliveryTargetId);
    let dayResolution = `${getPlayerName(dayNomineeId)} was successfully hung.`;
    if (postmanHung && postmanDeliveryTargetId) {
      dayResolution += ` Postman Final Delivery killed ${getPlayerName(postmanDeliveryTargetId)}.`;
    }
    if (collateral.length > 0) {
      dayResolution += ` Lover chain also killed ${collateral.map((id) => getPlayerName(id)).join(", ")}.`;
    }

    const nextDead = new Set(deadPlayerIds);
    for (const id of deaths) nextDead.add(id);
    const nextDeadIds = Array.from(nextDead);
    setDeadPlayerIds(nextDeadIds);

    if (postmanHung) {
      setRoleStates((current) => ({ ...current, Postman: { ...current.Postman, usedDelivery: true } }));
    }

    const winner = evaluateWinCondition(players, nextDeadIds, roleAssignments);
    setWinCondition(winner);
    setDayEliminationDone(true);
    setDayInfo(dayResolution);
    setDayNomineeId("");
    setPostmanDeliveryTargetId("");
    setAwaitingPostmanDelivery(false);
  }

  function skipDayHang() {
    setDayError(null);
    setDayInfo("Town skipped the daytime hang.");
    setDayEliminationDone(true);
    setDayNomineeId("");
    setPostmanDeliveryTargetId("");
    setAwaitingPostmanDelivery(false);
  }

  function startNextNightFromDay() {
    setDayInProgress(false);
    setDayEliminationDone(false);
    setDayNomineeId("");
    setPostmanDeliveryTargetId("");
    setDayError(null);
    setDayInfo(null);
    startNight();
  }

  function backToPreviousNight() {
    if (previousNightSnapshot) {
      setNightNumber(previousNightSnapshot.nightNumber);
      setDeadPlayerIds([...previousNightSnapshot.deadPlayerIds]);
      setRoleAssignments(
        ROLE_TYPES.reduce((acc, role) => {
          acc[role] = [...(previousNightSnapshot.roleAssignments[role] ?? [])];
          return acc;
        }, {} as Record<RoleType, string[]>)
      );
      setNightActions(
        ROLE_TYPES.reduce((acc, role) => {
          const action = previousNightSnapshot.nightActions[role] ?? { targetIds: [] };
          acc[role] = {
            targetIds: [...(action.targetIds ?? [])],
            metadata: action.metadata ? { ...action.metadata } : undefined,
          };
          return acc;
        }, {} as NightActionState)
      );
      setRoleStates(structuredClone(previousNightSnapshot.roleStates));
      setLoverPairs(previousNightSnapshot.loverPairs.map((pair) => [pair[0], pair[1]] as [string, string]));
      setConvertedOrigins({ ...(previousNightSnapshot.convertedOrigins ?? {}) });
      setWinCondition(null);
    } else {
      const targetNight = Math.max(1, nightNumber - 1);
      setNightNumber(targetNight);
      if (lastNightResult) {
        const rolledBackDeaths = new Set(lastNightResult.deaths ?? []);
        setDeadPlayerIds((current) => current.filter((id) => !rolledBackDeaths.has(id)));
        const rolledBackRecruits = new Set(lastNightResult.recruits ?? []);
        if (rolledBackRecruits.size > 0) {
          setConvertedOrigins((current) =>
            Object.fromEntries(Object.entries(current).filter(([playerId]) => !rolledBackRecruits.has(playerId)))
          );
        }
      }
      if (targetNight === 1) {
        // Legacy fallback: if no snapshot exists, reset one-time Night 1 state
        // so Cupid and other Night 1 setup actions can be replayed.
        setRoleStates(getInitialRoleStates());
        setLoverPairs([]);
      }
      setNightActions(createNightActions(ROLE_TYPES));
      setWinCondition(null);
    }
    setDayNumber(0);
    setDayInProgress(false);
    setDayEliminationDone(false);
    setNightInProgress(true);
    setWakeIndex(0);
    setLastNightResult(null);
    setDayNomineeId("");
    setPostmanDeliveryTargetId("");
    setAwaitingPostmanDelivery(false);
    setDayError(null);
    setPicker(DEFAULT_PICKER);
  }

  function getProjectedDayDeaths(nomineeId: string): Set<string> {
    if (!nomineeId) return new Set<string>();
    if (deadSet.has(nomineeId)) return new Set<string>();
    return applyLoverChainDay(new Set([nomineeId]));
  }

  function nextStep() {
    if (stepOrder.length === 0) return;
    setWakeIndex((current) => Math.min(stepOrder.length - 1, current + 1));
  }

  function previousStep() {
    setWakeIndex((current) => Math.max(0, current - 1));
  }

  function endSession() {
    setSessionActive(false);
    clearSession();
    router.push("/");
  }

  function getSelectablePlayers(role: RoleType, index: number, mode: "assignment" | "target") {
    if (mode === "target") {
      const alive = players.filter((player) => !deadSet.has(player.id));
      if (role !== "MadeMan") return alive;
      return alive.filter((player) => !isMadeManRecruitBlockedRole(effectiveRoleByPlayer[player.id] ?? "Civilian"));
    }
    const assignedInSlot = roleAssignments[role]?.[index] ?? "";
    return players.filter((player) => {
      const assignedRole = assignedByPlayer[player.id];
      if (!assignedRole) return true;
      return player.id === assignedInSlot;
    });
  }

  function openAssignmentPicker(role: RoleType, index: number) {
    setPicker({
      open: true,
      mode: "assignment",
      role,
      index,
      title: `Assign ${roleLabel(role)}`,
      description: "Choose a player card to fill this role slot.",
    });
  }

  function openTargetPicker(role: RoleType, index: number) {
    const selected = (nightActions[role]?.targetIds ?? []).filter((id) => id && id !== NO_ACTION);
    const magicianChoice = nightActions.Magician?.metadata?.choice;
    const slotLabel = getTargetSlotLabel(role, index, magicianChoice);
    setPicker({
      open: true,
      mode: "target",
      role,
      index,
      title: `${roleLabel(role)} - ${slotLabel}`,
      description: `Choose a player for ${getTargetSectionTitle(role).toLowerCase()}.`,
      excludePlayerIds: selected.filter((_, i) => i !== index),
      allowNoAction: true,
    });
  }

  function applyPickerSelection(playerId: string) {
    if (picker.mode === "assignment") {
      setRoleAssignment(picker.role, picker.index, playerId);
    } else {
      updateNightTarget(picker.role, picker.index, playerId);
    }
    setPicker(DEFAULT_PICKER);
  }

  function renderRoleAssignmentCards(role: RoleType, options?: { showRoleHeading?: boolean; readOnly?: boolean }) {
    const count = roleCounts[role] ?? 0;
    if (count === 0) return null;
    const showRoleHeading = options?.showRoleHeading ?? false;
    const readOnly = options?.readOnly ?? false;

    return (
      <div className="space-y-3">
        {showRoleHeading && <p className="text-sm font-semibold">{roleLabel(role)}</p>}
        <div className={getAssignmentGridClass(count)}>
          {Array.from({ length: count }).map((_, index) => {
            const assignedId = roleAssignments[role]?.[index] ?? "";
            const assignedName = getPlayerName(assignedId);
            const isAssignedDead = Boolean(assignedId && deadSet.has(assignedId));
            const slotLabel = count > 1 ? `${roleLabel(role)} ${index + 1}` : "Assign Player";
            const RoleIcon = ROLE_ICONS[role];

            return (
              <button
                key={`${role}-${index}`}
                type="button"
                onClick={() => {
                  if (!readOnly) openAssignmentPicker(role, index);
                }}
                disabled={readOnly}
                className={cn(
                  "flex h-40 w-24 sm:h-52 sm:w-36 flex-col items-center justify-center rounded-xl border p-2.5 sm:p-4 text-center transition",
                  readOnly ? "cursor-default" : "",
                  isAssignedDead ? "border-border/50 bg-muted/30 text-muted-foreground grayscale-[0.35] opacity-75" : "",
                  assignedId
                    ? "border-border/70 bg-background/60"
                    : "border-dashed border-border/80 bg-background/30 hover:bg-background/50"
                )}
              >
                <div className="grid size-16 place-items-center">
                  {assignedId || readOnly ? (
                    isAssignedDead ? (
                      <SkullIcon className="h-12 w-12 text-red-300" />
                    ) : (
                      <RoleIcon className="h-12 w-12 text-muted-foreground" />
                    )
                  ) : (
                    <PlusIcon className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                {!assignedId && <p className="mt-3 text-sm text-muted-foreground">{readOnly ? "Unassigned" : slotLabel}</p>}
                {assignedId && <p className="mt-1 w-full break-words text-sm font-semibold leading-tight">{assignedName}</p>}
                {isAssignedDead && (
                  <Badge variant="outline" className="mt-1 border-red-400/60 text-[10px] text-red-200">
                    Dead
                  </Badge>
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  function renderAssignmentCard(
    role: RoleType,
    index: number,
    options?: { unassignedLabel?: string; readOnly?: boolean; converted?: boolean; convertedFromRole?: RoleType }
  ) {
    const assignedId = roleAssignments[role]?.[index] ?? "";
    const assignedName = getPlayerName(assignedId);
    const isAssignedDead = Boolean(assignedId && deadSet.has(assignedId));
    const RoleIcon = ROLE_ICONS[role];
    const unassignedLabel = options?.unassignedLabel ?? `Assign ${roleLabel(role)}`;
    const readOnly = options?.readOnly ?? false;
    const converted = options?.converted ?? false;
    const convertedFromRole = options?.convertedFromRole;

    return (
      <button
        key={`${role}-${index}`}
        type="button"
        onClick={() => {
          if (!readOnly) openAssignmentPicker(role, index);
        }}
        disabled={readOnly}
        className={cn(
          "flex h-40 w-24 sm:h-52 sm:w-36 flex-col items-center justify-center rounded-xl border p-2.5 sm:p-4 text-center transition",
          readOnly ? "cursor-default" : "",
          isAssignedDead ? "border-border/50 bg-muted/30 text-muted-foreground grayscale-[0.35] opacity-75" : "",
          assignedId
            ? "border-border/70 bg-background/60"
            : "border-dashed border-border/80 bg-background/30 hover:bg-background/50"
        )}
      >
        <div className="grid size-16 place-items-center">
          {assignedId || readOnly ? (
            isAssignedDead ? (
              <SkullIcon className="h-12 w-12 text-red-300" />
            ) : (
              <RoleIcon className="h-12 w-12 text-muted-foreground" />
            )
          ) : (
            <PlusIcon className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
        {!assignedId && <p className="mt-3 text-sm text-muted-foreground">{readOnly ? "Unassigned" : unassignedLabel}</p>}
        {assignedId && <p className="mt-1 w-full break-words text-sm font-semibold leading-tight">{assignedName}</p>}
        {assignedId && converted && (
          <Badge variant="outline" className="mt-1 border-amber-400/60 text-[10px] text-amber-200">
            {convertedFromRole ? `Converted from ${roleLabel(convertedFromRole)}` : "Converted"}
          </Badge>
        )}
        {isAssignedDead && (
          <Badge variant="outline" className="mt-1 border-red-400/60 text-[10px] text-red-200">
            Dead
          </Badge>
        )}
      </button>
    );
  }

  function renderMafiaTeamRoster(readOnly = false) {
    const uniqueRoles: RoleType[] = ["Godfather", "MadeMan", "UndercoverCop"];
    const mafiaCount = Math.max(
      roleCounts.Mafia ?? 0,
      (roleAssignments.Mafia ?? []).filter((id) => Boolean(id && id.trim().length > 0)).length
    );
    const activeUniqueRoles = uniqueRoles.filter((role) => (roleCounts[role] ?? 0) > 0);

    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <div className={getCompactGridColsClass(activeUniqueRoles.length, 3)}>
            {activeUniqueRoles.map((role) => (
              <div key={`${role}-core`} className="space-y-2 rounded-lg border border-border/60 bg-background/50 p-3">
                <p className="text-sm font-semibold">{roleLabel(role)}</p>
                {renderAssignmentCard(role, 0, { unassignedLabel: "Assign Player", readOnly })}
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-2 rounded-lg border border-border/60 bg-background/50 p-3">
          <p className="text-sm font-semibold">Mafia Members</p>
          {mafiaCount > 0 ? (
            <div className={getCompactGridColsClass(mafiaCount, 3)}>
              {Array.from({ length: mafiaCount }).map((_, index) => {
                const isConvertedSlot = index >= (roleCounts.Mafia ?? 0);
                const assignedId = roleAssignments.Mafia?.[index] ?? "";
                return renderAssignmentCard("Mafia", index, {
                  unassignedLabel: `Mafia ${index + 1}`,
                  readOnly,
                  converted: isConvertedSlot,
                  convertedFromRole: isConvertedSlot ? convertedOrigins[assignedId] : undefined,
                });
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No Mafia members configured.</p>
          )}
        </div>
      </div>
    );
  }

  function renderRivalMafiaTeamRoster(readOnly = false) {
    const rivalCount = roleCounts.RivalMafia ?? 0;

    return (
      <div className="space-y-4">
        <div className="w-full md:w-fit space-y-2 rounded-lg border border-border/60 bg-background/50 p-3">
          <p className="text-sm font-semibold">Rival Mafia Members</p>
          {rivalCount > 0 ? (
            <div className={getCompactGridColsClass(rivalCount, 3)}>
              {Array.from({ length: rivalCount }).map((_, index) =>
                renderAssignmentCard("RivalMafia", index, { unassignedLabel: `Rival Mafia ${index + 1}`, readOnly })
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No Rival Mafia members configured.</p>
          )}
        </div>
      </div>
    );
  }

  function renderTargetCards(role: RoleType) {
    const actionCount = ROLE_DEFINITIONS[role].action?.targetCount ?? 0;
    if (actionCount === 0) return null;
    const magicianChoice = nightActions.Magician?.metadata?.choice;
    const activeAbility = getActiveAbilityForStep(role, nightNumber, magicianChoice);
    const TargetIcon = getTargetSlotIcon(role);
    const AbilityRoleIcon = ROLE_ICONS[role];
    const vigilanteLockedNight1 = role === "Vigilante" && nightNumber === 1;
    const targetGridClass =
      actionCount >= 2
        ? "mx-auto grid w-full justify-items-center grid-cols-2 sm:w-fit gap-3"
        : "mx-auto grid w-full justify-items-center grid-cols-1 sm:w-fit gap-3";
    const detectivePreview =
      role === "Detective"
        ? (() => {
            if (isRoleSuppressedByRecruit) {
              return {
                result: null as "Innocent" | "Guilty" | null,
                selectedName: null as string | null,
                resolvedName: null as string | null,
                resolvedRole: null as string | null,
                swapAName: null as string | null,
                swapBName: null as string | null,
                redirected: false,
              };
            }
            const rawTarget = nightActions.Detective?.targetIds?.[0];
            if (!rawTarget || rawTarget === NO_ACTION) return null;

            const swapA = nightActions.BusDriver?.targetIds?.[0];
            const swapB = nightActions.BusDriver?.targetIds?.[1];
            let resolvedTarget = rawTarget;
            if (swapA && swapB) {
              if (rawTarget === swapA) resolvedTarget = swapB;
              else if (rawTarget === swapB) resolvedTarget = swapA;
            }

            const targetRole = assignedByPlayer[resolvedTarget] ?? "Civilian";
            const result = getDetectiveResultForRole(targetRole);

            return {
              result,
              selectedName: getPlayerName(rawTarget),
              resolvedName: getPlayerName(resolvedTarget),
              resolvedRole: roleLabel(targetRole),
              swapAName: swapA ? getPlayerName(swapA) : null,
              swapBName: swapB ? getPlayerName(swapB) : null,
              redirected: rawTarget !== resolvedTarget,
            };
          })()
        : null;

    return (
      <div className="space-y-3">
        <div>
          <div>
            <div className="flex items-start gap-2">
              <span className="grid size-5 shrink-0 place-items-center rounded border border-border/60 bg-background/60">
                <AbilityRoleIcon className="h-3.5 w-3.5 text-muted-foreground" />
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold">{activeAbility?.name ?? getTargetSectionTitle(role)}</p>
                  {activeAbility && (
                    <Badge variant="outline" className="shrink-0 text-[10px]">
                      Active
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            {activeAbility && <p className="text-xs text-muted-foreground">{activeAbility.description}</p>}
          </div>
        </div>
        <div className={targetGridClass}>
          {Array.from({ length: actionCount }).map((_, index) => {
            const targetId = nightActions[role]?.targetIds?.[index] ?? "";
            const hasTarget = Boolean(targetId && targetId !== NO_ACTION);
            const slotLabel = getTargetSlotLabel(role, index, magicianChoice);
            const targetName = hasTarget
              ? getPlayerName(targetId)
              : targetId === NO_ACTION
                ? "No action"
                : slotLabel;
            const showSelectedTarget = hasTarget || targetId === NO_ACTION;
            const disabled = vigilanteLockedNight1;

            return (
              <button
                key={`${role}-target-${index}`}
                type="button"
                onClick={() => {
                  if (!disabled) openTargetPicker(role, index);
                }}
                disabled={disabled}
                className={cn(
                  "flex h-40 w-24 sm:h-52 sm:w-36 flex-col items-center justify-center rounded-xl border p-2.5 sm:p-4 text-center transition",
                  disabled ? "cursor-not-allowed border-border/60 bg-background/30 opacity-55" : "",
                  hasTarget || targetId === NO_ACTION
                    ? "border-border/70 bg-background/60"
                    : "border-dashed border-border/80 bg-background/30 hover:bg-background/50"
                )}
              >
                <div className="grid size-16 place-items-center">
                  <TargetIcon className="h-12 w-12 text-muted-foreground" />
                </div>
                <p className="mt-3 text-sm text-muted-foreground">{slotLabel}</p>
                {disabled ? (
                  <p className="mt-1 text-sm font-semibold leading-tight">Unavailable Night 1</p>
                ) : (
                  showSelectedTarget && <p className="mt-1 w-full break-words text-sm font-semibold leading-tight">{targetName}</p>
                )}
              </button>
            );
          })}
        </div>
        {detectivePreview && (
          <div className="rounded-xl border border-border/70 bg-background/40 p-3">
            {detectivePreview.result ? (
              <>
                <p className="text-sm font-semibold">
                  Result: {detectivePreview.result}
                </p>
                <p className="text-xs text-muted-foreground">
                  {detectivePreview.redirected
                    ? `You selected ${detectivePreview.selectedName}. Bus Driver swapped ${detectivePreview.swapAName} and ${detectivePreview.swapBName}, so the investigation resolved to ${detectivePreview.resolvedName}. ${detectivePreview.resolvedName} is ${detectivePreview.resolvedRole} and appears ${detectivePreview.result}.`
                    : `${detectivePreview.resolvedName} is ${detectivePreview.resolvedRole}.`}
                </p>
              </>
            ) : (
              <>
                <p className="text-sm font-semibold">Result: None</p>
                <p className="text-xs text-muted-foreground">
                  Detective was converted by Mafia recruitment this night. Wake the role as normal for secrecy, but this action is ignored.
                </p>
              </>
            )}
          </div>
        )}
      </div>
    );
  }

  if (!sessionActive) {
    return (
      <main className="relative min-h-screen overflow-hidden bg-background text-foreground">
        <div className="relative mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-10 md:px-8">
          <Card className="border-border/60 bg-card/70 backdrop-blur">
            <CardHeader>
              <CardTitle>No Active Session</CardTitle>
              <CardDescription>Return to setup to start a new game session.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => router.push("/")}>Back to Setup</Button>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  const currentOtherAbilities =
    currentRole ? ROLE_DEFINITIONS[currentRole].abilities.filter((ability) => ability.activation.type !== "Active") : [];
  const teamOtherAbilities = (() => {
    if (!currentRole) return [] as Array<{ sourceRole: RoleType; ability: RoleAbility }>;
    const base = currentOtherAbilities.map((ability) => ({ sourceRole: currentRole, ability }));
    if (currentRole === "Mafia" && (roleCounts.UndercoverCop ?? 0) > 0) {
      const undercoverPassives = ROLE_DEFINITIONS.UndercoverCop.abilities.filter(
        (ability) => ability.activation.type === "Passive"
      );
      return [...base, ...undercoverPassives.map((ability) => ({ sourceRole: "UndercoverCop" as RoleType, ability }))];
    }
    return base;
  })();
  const mafiaRecruitAvailable =
    currentRole === "Mafia" && (roleCounts.MadeMan ?? 0) > 0 && !roleStates.MadeMan.usedRecruit;
  const mafiaRecruitUsed = currentRole === "Mafia" && (roleCounts.MadeMan ?? 0) > 0 && roleStates.MadeMan.usedRecruit;
  const displayDayNumber = dayNumber > 0 ? dayNumber : nightNumber;
  const summaryNightNumber = Math.max(1, displayDayNumber - 1);
  const showingNightSummary = !nightInProgress && !dayInProgress && Boolean(lastNightResult);
  const projectedDayDeaths = getProjectedDayDeaths(dayNomineeId);
  const dayPostmanHung =
    awaitingPostmanDelivery && Boolean(postmanId) && !roleStates.Postman.usedDelivery && dayNomineeId === postmanId;
  const dayPostmanTargets = alivePlayers
    .map((player) => player.id)
    .filter((id) => !projectedDayDeaths.has(id) && (!postmanId || id !== postmanId));
  const busSwapDetailText = lastNightResult
    ? (lastNightResult.busSwaps ?? []).length > 0
      ? (lastNightResult.busSwaps ?? [])
          .map((swap) => `${getPlayerName(swap.a)} <-> ${getPlayerName(swap.b)}`)
          .join("; ")
      : (lastNightResult.notes ?? []).some((note) => note.includes("Bus Driver swap was applied"))
        ? "Applied (details unavailable for this saved result)."
        : "None"
    : "None";
  const summaryDeathDetails = lastNightResult
    ? (lastNightResult.deathDetails ?? []).length > 0
      ? lastNightResult.deathDetails ?? []
      : lastNightResult.deaths.map((playerId) => ({
          playerId,
          causes: ["Cause details unavailable for this saved result."],
        }))
    : [];

  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-28 top-8 h-72 w-72 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="absolute right-0 top-1/3 h-80 w-80 rounded-full bg-amber-500/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-64 w-64 rounded-full bg-red-500/10 blur-3xl" />
      </div>

      <div
        className="relative mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 md:px-8 md:py-10"
        style={activePageMaxWidthRem ? { maxWidth: `${activePageMaxWidthRem}rem` } : undefined}
      >
        <header className="rounded-2xl border border-border/60 bg-card/60 p-4 backdrop-blur md:p-6">
          <div className="flex items-center justify-between gap-4">
            <h1 className="text-2xl font-semibold tracking-tight md:text-4xl">
              {dayInProgress
                ? `Day ${displayDayNumber}`
                : showingNightSummary
                  ? `Night ${summaryNightNumber} Summary`
                  : `Night ${nightNumber}`}
            </h1>
            <Button variant="outline" size="icon" onClick={() => setSettingsOpen(true)} aria-label="Open settings">
              <SettingsIcon className="h-4 w-4" />
            </Button>
          </div>
        </header>

        {winCondition && (
          <Card className="border-green-500/40 bg-green-500/10">
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <CardTitle>Game Over</CardTitle>
                <Button variant="outline" onClick={endSession}>
                  Back to Setup
                </Button>
              </div>
              <CardDescription>{winCondition}</CardDescription>
            </CardHeader>
          </Card>
        )}

        <section className="space-y-6">
          <Card className="border-border/60 bg-card/70 backdrop-blur">
            <CardHeader>
              {nightInProgress && currentRole ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="grid size-10 place-items-center rounded-lg border border-border/70 bg-background/70">
                      {(() => {
                        const RoleIcon = ROLE_ICONS[currentRole];
                        return <RoleIcon className="h-5 w-5 text-muted-foreground" />;
                      })()}
                    </div>
                    <CardTitle>{roleLabel(currentRole)}</CardTitle>
                  </div>
                  <CardDescription>{ROLE_DEFINITIONS[currentRole].notes}</CardDescription>
                </div>
              ) : (
                <>
                  <CardTitle>
                    {dayInProgress
                      ? `Day ${displayDayNumber}`
                      : showingNightSummary
                        ? `Night ${summaryNightNumber} Summary`
                        : `Night ${nightNumber}`}
                  </CardTitle>
                  <CardDescription>
                    {dayInProgress ? "Moderator daytime flow" : showingNightSummary ? "Night recap" : "Ready to begin"}
                  </CardDescription>
                </>
              )}
            </CardHeader>
            <CardContent className="space-y-6 overflow-x-hidden">
              {!nightInProgress && !dayInProgress && !lastNightResult && (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">Start the next night to begin the wake sequence.</p>
                  <Button onClick={startNight} disabled={Boolean(winCondition)}>
                    Start Night {nightNumber}
                  </Button>
                </div>
              )}

              {nightInProgress && currentRole && (
                <div className="space-y-5">
                  {isTeamStep ? (
                    <div className={getTeamStepColumnsClass(currentRole, currentAssignmentCount)}>
                      <div className="min-w-0 w-full md:w-fit space-y-4">
                        <div>
                          <p className="text-base font-semibold">Role Assignment</p>
                          {isNight1 && <p className="text-xs text-muted-foreground">{getAssignmentPrompt(currentRole)}</p>}
                          {!isNight1 && (
                            <p className="text-xs text-muted-foreground">Assignments are locked after Night 1.</p>
                          )}
                        </div>
                        <div className="space-y-5">
                          {currentRole === "Mafia" ? (
                            renderMafiaTeamRoster(!isNight1)
                          ) : (
                            renderRivalMafiaTeamRoster(!isNight1)
                          )}
                        </div>
                      </div>

                      <div className="min-w-0 space-y-3">
                        <div>
                          <p className="text-base font-semibold">Abilities</p>
                          <p className="text-xs text-muted-foreground">
                            {currentRole === "Mafia"
                              ? "Mafia team abilities and passives."
                              : "Rival Mafia team abilities and passives."}
                          </p>
                        </div>
                        <div className="space-y-4 rounded-xl border border-border/70 bg-background/40 p-4">
                          {currentRole === "Mafia" ? renderTargetCards("Mafia") : renderTargetCards("RivalMafia")}
                        </div>

                        {currentRole === "Mafia" && (roleCounts.MadeMan ?? 0) > 0 && (
                          <div className="space-y-4 rounded-xl border border-border/70 bg-background/40 p-4">
                            {mafiaRecruitAvailable ? (
                              renderTargetCards("MadeMan")
                            ) : (
                              <p className="text-sm text-muted-foreground">
                                {mafiaRecruitUsed ? "Recruitment has already been used." : "Recruitment unavailable."}
                              </p>
                            )}
                          </div>
                        )}

                        {teamOtherAbilities.map(({ sourceRole, ability }) => (
                          <div
                            key={`${sourceRole}-${ability.name}`}
                            className="space-y-1 rounded-xl border border-border/70 bg-background/40 p-4"
                          >
                            <div className="flex items-start gap-2">
                              <span className="grid size-5 shrink-0 place-items-center rounded border border-border/60 bg-background/60">
                                {(() => {
                                  const AbilityRoleIcon = ROLE_ICONS[sourceRole];
                                  return <AbilityRoleIcon className="h-3.5 w-3.5 text-muted-foreground" />;
                                })()}
                              </span>
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="text-sm font-semibold">{ability.name}</p>
                                  <Badge variant="outline" className="shrink-0 text-[10px]">
                                    {abilityMeta(ability.activation.phase, ability.activation.type)}
                                  </Badge>
                                </div>
                              </div>
                            </div>
                            <p className="text-xs text-muted-foreground">{ability.description}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className={getStepperColumnsClass(currentActionCount, currentAssignmentCount)}>
                      <div className="min-w-0 space-y-4 rounded-xl border border-border/70 bg-background/40 p-4">
                        <div>
                          <p className="text-base font-semibold">Role Assignment</p>
                          {isNight1 && <p className="text-xs text-muted-foreground">{getAssignmentPrompt(currentRole)}</p>}
                          {!isNight1 && (
                            <p className="text-xs text-muted-foreground">Assignments are locked after Night 1.</p>
                          )}
                        </div>

                        {(roleCounts[currentRole] ?? 0) > 0 ? (
                          <div>{renderRoleAssignmentCards(currentRole, { readOnly: !isNight1 })}</div>
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            No players configured for this role.
                          </p>
                        )}
                      </div>

                      <div className="min-w-0 space-y-3">
                        <div className="space-y-4 rounded-xl border border-border/70 bg-background/40 p-4">
                          {currentRole === "Magician" && (
                            <div className="space-y-2">
                              <p className="text-sm font-semibold">Choose Ability</p>
                              {magicianOutOfActions ? (
                                <div className="rounded-lg border border-border/70 bg-background/50 p-3">
                                  <p className="text-sm font-medium">No actions remaining.</p>
                                  <p className="text-xs text-muted-foreground">
                                    Vanishing Act and Escape Trick have both been used.
                                  </p>
                                </div>
                              ) : (
                                <select
                                  value={nightActions.Magician?.metadata?.choice ?? ""}
                                  onChange={(event) =>
                                    updateNightChoice("Magician", event.target.value as "kill" | "save" | "none")
                                  }
                                  className="h-11 w-full rounded-xl border border-border/70 bg-background px-3 text-sm font-medium outline-none shadow-sm transition-colors focus-visible:ring-2 focus-visible:ring-ring/40"
                                >
                                  <option value="" disabled>
                                    Select ability
                                  </option>
                                  {!roleStates.Magician.usedKill && (
                                    <option value="kill">{MAGICIAN_CHOICE_LABELS.kill}</option>
                                  )}
                                  {!roleStates.Magician.usedSave && (
                                    <option value="save">{MAGICIAN_CHOICE_LABELS.save}</option>
                                  )}
                                  <option value="none">No Action</option>
                                </select>
                              )}
                            </div>
                          )}

                          {currentActionCount > 0 ? (
                            renderTargetCards(currentRole)
                          ) : currentRole === "Magician" && magicianOutOfActions ? null : (
                            <p className="text-sm text-muted-foreground">
                              No target selection for this role.
                            </p>
                          )}
                        </div>

                        {currentOtherAbilities.map((ability) => (
                          <div
                            key={ability.name}
                            className="space-y-1 rounded-xl border border-border/70 bg-background/40 p-4"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-semibold">{ability.name}</p>
                              <Badge variant="outline" className="shrink-0 text-[10px]">
                                {abilityMeta(ability.activation.phase, ability.activation.type)}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">{ability.description}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {!currentStepValidation.valid && (
                    <div className="rounded-md border border-red-500/50 bg-red-500/10 p-3 text-sm text-red-100">
                      {currentStepValidation.reason ??
                        "This step has invalid selections. Update assignments or targets to continue."}
                    </div>
                  )}

                  {isRoleSuppressedByRecruit && (
                    <div className="rounded-md border border-amber-500/50 bg-amber-500/10 p-3 text-sm text-amber-100">
                      This role was converted by Mafia recruitment this night. For secrecy, still wake the role and
                      collect a target, but the action will be ignored.
                    </div>
                  )}

                  {currentRole === "Vigilante" && roleStates.Vigilante.lockedOut && (
                    <div className="rounded-md border border-amber-500/50 bg-amber-500/10 p-3 text-sm text-amber-100">
                      Vigilante is locked out after killing a Town player. No action can be taken.
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>{wakeIndex > 0 && <Button variant="outline" onClick={previousStep}>Previous</Button>}</div>
                    <div>
                      {wakeIndex >= stepOrder.length - 1 ? (
                        <Button variant="secondary" onClick={completeNight} disabled={!allStepsComplete}>
                          End Night {nightNumber}
                        </Button>
                      ) : (
                        <Button onClick={nextStep} disabled={!currentStepComplete}>
                          Next
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {lastNightResult && !nightInProgress && !dayInProgress && (
                <div className="space-y-4 rounded-xl border border-border/70 bg-background/40 p-4">
                  <p className="text-sm font-semibold">Night {summaryNightNumber} Summary</p>
                  <div className="grid gap-2 text-sm sm:grid-cols-2">
                    <div>
                      <span className="text-muted-foreground">Deaths:</span>{" "}
                      <span className="font-semibold">
                        {lastNightResult.deaths.length > 0
                          ? lastNightResult.deaths.map((id) => getPlayerName(id)).join(", ")
                          : "None"}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Saves:</span>{" "}
                      <span className="font-semibold">
                        {lastNightResult.saves.length > 0
                          ? lastNightResult.saves.map((id) => getPlayerName(id)).join(", ")
                          : "None"}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-2 rounded-md border border-border/60 bg-background/50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Death Details</p>
                    {summaryDeathDetails.length > 0 ? (
                      <div className="space-y-2">
                        {summaryDeathDetails.map((detail) => (
                          <div key={`death-${detail.playerId}`} className="text-sm">
                            <p className="font-semibold">{getPlayerName(detail.playerId)}</p>
                            <ul className="mt-1 list-disc pl-5 text-xs text-muted-foreground">
                              {(detail.causes ?? []).length > 0 ? (
                                detail.causes.map((cause, index) => <li key={`cause-${detail.playerId}-${index}`}>{cause}</li>)
                              ) : (
                                <li>Cause not recorded.</li>
                              )}
                            </ul>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">No deaths occurred.</p>
                    )}
                  </div>
                  <div className="space-y-2 rounded-md border border-border/60 bg-background/50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Action Details</p>
                    <div className="grid gap-2 text-xs sm:grid-cols-2">
                      <div>
                        <p className="font-semibold text-muted-foreground">Lover Pairs Created</p>
                        <p>
                          {(lastNightResult.loverPairsCreated ?? []).length > 0
                            ? (lastNightResult.loverPairsCreated ?? [])
                                .map((pair) => {
                                  const [a, b] = pair.split("|");
                                  return `${getPlayerName(a)} + ${getPlayerName(b)}`;
                                })
                                .join("; ")
                            : "None"}
                        </p>
                      </div>
                      <div>
                        <p className="font-semibold text-muted-foreground">Bus Driver Swap</p>
                        <p>{busSwapDetailText}</p>
                      </div>
                      <div>
                        <p className="font-semibold text-muted-foreground">Blocked Roles</p>
                        <p>{lastNightResult.blocked.length > 0 ? lastNightResult.blocked.map(roleLabel).join(", ") : "None"}</p>
                      </div>
                      <div>
                        <p className="font-semibold text-muted-foreground">Detective Findings</p>
                        <p>
                          {lastNightResult.investigations.length > 0
                            ? lastNightResult.investigations
                                .map((item) => `${getPlayerName(item.targetId)} = ${item.result}`)
                                .join("; ")
                            : "None"}
                        </p>
                      </div>
                      <div>
                        <p className="font-semibold text-muted-foreground">Conversions</p>
                        <p>
                          {(lastNightResult.recruits ?? []).length > 0
                            ? (lastNightResult.recruits ?? []).map((id) => getPlayerName(id)).join(", ")
                            : "None"}
                        </p>
                      </div>
                      <div>
                        <p className="font-semibold text-muted-foreground">Daytime Defense</p>
                        <p>
                          {(lastNightResult.dayImmunities ?? []).length > 0
                            ? (lastNightResult.dayImmunities ?? []).map((id) => getPlayerName(id)).join(", ")
                            : "None"}
                        </p>
                      </div>
                    </div>
                  </div>
                  {(lastNightResult.notes ?? []).length > 0 && (
                    <div className="space-y-2 rounded-md border border-border/60 bg-background/50 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">System Notes</p>
                      <div className="flex flex-wrap gap-1">
                        {(lastNightResult.notes ?? []).map((note, index) => (
                          <Badge key={`note-${index}`} variant="outline" className="text-[10px]">
                            {note}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="space-y-2 rounded-md border border-border/60 bg-background/50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Player Readout</p>
                    <div className="flex flex-wrap gap-2">
                      {players.map((player) => {
                        const role = effectiveRoleByPlayer[player.id] ?? "Civilian";
                        const RoleIcon = ROLE_ICONS[role];
                        const isDead = deadSet.has(player.id);
                        const wasSaved = (lastNightResult.saves ?? []).includes(player.id);
                        const wasConverted = (lastNightResult.recruits ?? []).includes(player.id);
                        const hasDayImmunity = (lastNightResult.dayImmunities ?? []).includes(player.id);
                        const loverPair = loverPairs.find(([a, b]) => a === player.id || b === player.id);
                        const loverPartnerId = loverPair ? (loverPair[0] === player.id ? loverPair[1] : loverPair[0]) : null;

                        return (
                          <div
                            key={`summary-player-${player.id}`}
                            className={cn(
                              "relative h-64 w-44 rounded-2xl border border-border/70 bg-gradient-to-b from-background/95 to-background/60 p-4 shadow-sm",
                              isDead ? "border-border/40 bg-muted/30 text-muted-foreground grayscale-[0.35] opacity-70" : ""
                            )}
                          >
                            <div className="mt-2 flex h-full flex-col items-center justify-between text-center">
                              <div className="space-y-1">
                                <p className="line-clamp-2 text-base font-semibold leading-tight">{player.name.trim() || "Unnamed"}</p>
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "text-sm",
                                    isDead ? "border-red-400/60 text-red-200" : "border-emerald-400/60 text-emerald-200"
                                  )}
                                >
                                  {isDead ? "Dead" : "Alive"}
                                </Badge>
                              </div>
                              <div className="space-y-1">
                                <div className="mx-auto grid size-12 place-items-center rounded-full border border-border/60 bg-background/70">
                                  {isDead ? (
                                    <SkullIcon className="h-6 w-6 text-red-300" />
                                  ) : (
                                    <RoleIcon className="h-6 w-6 text-muted-foreground" />
                                  )}
                                </div>
                                <p className="text-lg font-semibold leading-tight">{roleLabel(role)}</p>
                              </div>
                              <div className="flex min-h-10 flex-wrap items-center justify-center gap-1">
                                {loverPartnerId && (
                                  <Badge variant="outline" className="border-pink-400/60 text-xs text-pink-200">
                                    Lover
                                  </Badge>
                                )}
                                {wasConverted && (
                                  <Badge variant="outline" className="border-amber-400/60 text-xs text-amber-200">
                                    Converted
                                  </Badge>
                                )}
                                {hasDayImmunity && (
                                  <Badge variant="outline" className="border-cyan-400/60 text-xs text-cyan-200">
                                    Daytime Defense
                                  </Badge>
                                )}
                                {wasSaved && (
                                  <Badge variant="outline" className="border-emerald-400/60 text-xs text-emerald-200">
                                    Saved
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  {!dayInProgress && (
                    <div className="flex items-center justify-between gap-2">
                      <Button variant="outline" onClick={backToPreviousNight}>
                        Back to Previous Night
                      </Button>
                      <div>
                        <Button onClick={beginDay} disabled={Boolean(winCondition)}>
                          Proceed to Day {displayDayNumber}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {dayInProgress && !nightInProgress && (
                <div className="space-y-4 rounded-xl border border-border/70 bg-background/40 p-4">
                  <div>
                    <p className="text-base font-semibold">Day {displayDayNumber} - Town Vote</p>
                    <p className="text-xs text-muted-foreground">
                      Select a player to eliminate in the town square.
                    </p>
                  </div>

                  <>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {alivePlayers.map((player) => {
                          const role = effectiveRoleByPlayer[player.id] ?? "Civilian";
                          const immune = dayImmunitySet.has(player.id);
                          return (
                            <button
                              key={`day-vote-${player.id}`}
                              type="button"
                              onClick={() => {
                                setDayNomineeId(player.id);
                                setPostmanDeliveryTargetId("");
                                setAwaitingPostmanDelivery(false);
                                setDayError(null);
                                setDayInfo(null);
                              }}
                              className={cn(
                                "rounded-lg border p-3 text-left transition",
                                dayNomineeId === player.id
                                  ? "border-primary bg-primary/10"
                                  : "border-border/70 bg-background/50 hover:bg-background/80",
                                immune ? "border-cyan-500/50" : ""
                              )}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <p className="font-semibold">{player.name.trim() || "Unnamed"}</p>
                                <div className="flex gap-1">
                                  {immune && <Badge variant="outline">Daytime Defense</Badge>}
                                  <Badge variant="secondary">{roleLabel(role)}</Badge>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      {dayPostmanHung && (
                        <div className="space-y-2 rounded-lg border border-border/70 bg-background/50 p-3">
                          <p className="text-sm font-semibold">Postman Final Delivery</p>
                          <p className="text-xs text-muted-foreground">
                            Postman is being hung. Choose one additional target.
                          </p>
                          <div className="grid gap-2 sm:grid-cols-2">
                            {dayPostmanTargets.map((id) => (
                              <button
                                key={`postman-chain-${id}`}
                                type="button"
                                onClick={() => setPostmanDeliveryTargetId(id)}
                                className={cn(
                                  "rounded-lg border p-3 text-left",
                                  postmanDeliveryTargetId === id
                                    ? "border-primary bg-primary/10"
                                    : "border-border/70 bg-background/50"
                                )}
                              >
                                <p className="font-semibold">{getPlayerName(id)}</p>
                                <p className="text-xs text-muted-foreground">
                                  {roleLabel(effectiveRoleByPlayer[id] ?? "Civilian")}
                                </p>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {dayError && (
                        <div className="rounded-md border border-red-500/50 bg-red-500/10 p-3 text-sm text-red-100">
                          {dayError}
                        </div>
                      )}
                      {dayInfo && (
                        <div className="rounded-md border border-cyan-500/50 bg-cyan-500/10 p-3 text-sm text-cyan-100">
                          {dayInfo}
                        </div>
                      )}

                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          onClick={skipDayHang}
                          disabled={dayEliminationDone || Boolean(winCondition)}
                        >
                          Skip Hang
                        </Button>
                        <Button onClick={confirmDayElimination} disabled={dayEliminationDone || Boolean(winCondition)}>
                          {dayEliminationDone ? "Elimination Resolved" : "Confirm Elimination"}
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={startNextNightFromDay}
                          disabled={!dayEliminationDone || Boolean(winCondition)}
                        >
                          Start Night {nightNumber}
                        </Button>
                      </div>
                    </>
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      </div>

      <Dialog open={picker.open} onOpenChange={(open) => setPicker((current) => ({ ...current, open }))}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{picker.title}</DialogTitle>
            <DialogDescription>{picker.description}</DialogDescription>
          </DialogHeader>

          <div className="grid max-h-[52vh] gap-2 overflow-y-auto sm:grid-cols-2">
            {getSelectablePlayers(picker.role, picker.index, picker.mode).map((player) => {
              const role = effectiveRoleByPlayer[player.id] ?? "Civilian";
              const isDead = deadSet.has(player.id);
              const excluded = (picker.excludePlayerIds ?? []).includes(player.id);
              return (
                <button
                  key={player.id}
                  type="button"
                  onClick={() => applyPickerSelection(player.id)}
                  disabled={excluded}
                  className={cn(
                    "rounded-lg border border-border/70 bg-background/50 p-3 text-left transition",
                    excluded ? "cursor-not-allowed opacity-50" : "hover:bg-background/80"
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold">{player.name.trim() || "Unnamed"}</p>
                    <div className="flex gap-1">
                      {isDead && <Badge variant="outline">Dead</Badge>}
                      <Badge variant="secondary">{roleLabel(role)}</Badge>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <DialogFooter showCloseButton>
            {picker.allowNoAction && picker.mode === "target" && (
              <Button variant="outline" onClick={() => applyPickerSelection(NO_ACTION)}>
                Set No Action
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={settingsOpen}
        onOpenChange={(open) => {
          setSettingsOpen(open);
          if (!open) setConfirmEndSession(false);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Session Settings</DialogTitle>
            <DialogDescription>Manage moderator session controls.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border border-border/60 bg-background/50 p-3">
              <Label htmlFor="session-theme" className="text-sm font-medium">
                Dark Mode
              </Label>
              <Switch id="session-theme" checked={darkMode} onCheckedChange={setDarkMode} />
            </div>

            {confirmEndSession ? (
              <div className="space-y-2 rounded-lg border border-red-500/50 bg-red-500/10 p-3">
                <p className="text-sm font-semibold text-red-100">Confirm End Session</p>
                <p className="text-xs text-red-100/90">
                  This will end the current game session and return to setup.
                </p>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setConfirmEndSession(false)}>
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => {
                      setSettingsOpen(false);
                      setConfirmEndSession(false);
                      endSession();
                    }}
                  >
                    Confirm End Session
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex justify-end">
                <Button variant="destructive" onClick={() => setConfirmEndSession(true)}>
                  End Session
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}


