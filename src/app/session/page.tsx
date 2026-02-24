"use client";

import { useEffect, useMemo, useReducer, useState } from "react";
import { useRouter } from "next/navigation";
import { resolveNight } from "@/domain/engine";
import { getDetectiveResultForRole, ROLE_DEFINITIONS, ROLE_TYPES, type RoleAbility } from "@/domain/roles";
import { ROLE_ICONS as BASE_ROLE_ICONS, roleLabel, type RoleIconComponent } from "@/domain/role-presentation";
import { buildWakeOrder, validateAction } from "@/domain/rules";
import type { RoleType } from "@/domain/types";
import type { LucideIcon } from "lucide-react";
import {
  BanIcon,
  HeartIcon,
  PlusIcon,
  SearchIcon,
  ShieldIcon,
  ShuffleIcon,
  SkullIcon,
  UserPlusIcon,
  WandSparklesIcon,
} from "lucide-react";
import {
  GiTwoCoins,
} from "react-icons/gi";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  createInitialSessionReducerState,
  sessionReducer,
  setSessionField,
  toPersistedSession,
  type SessionReducerState,
} from "./session-reducer";
import {
  clearSession,
  createNightActions,
  createRoleAssignments,
  saveSession,
  type NightActionState,
} from "@/lib/session";
import { useAutosaveSession, useSavedSession } from "@/hooks/use-session-persistence";
import { useThemePreference } from "@/hooks/use-theme-preference";
import {
  AssignmentSlotCard,
  CurrentNightStepPanel,
  CurrentNightStepStatusCard,
  DayPhasePanel,
  type DetectivePreview,
  MafiaTeamRosterPanel,
  NoActiveSessionView,
  NightSummaryPanel,
  PlayerPickerDialog,
  RivalMafiaRosterPanel,
  RoleAssignmentGrid,
  SessionPageHeader,
  SessionPageShell,
  SessionSettingsDialog,
  TargetCardsPanel,
} from "./session-ui";

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

const ROLE_ICONS: Record<RoleType, RoleIconComponent> = {
  ...BASE_ROLE_ICONS,
  Civilian: GiTwoCoins,
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
  const { darkMode, setDarkMode } = useThemePreference();

  const [sessionState, dispatch] = useReducer(sessionReducer, undefined, createInitialSessionReducerState);
  const {
    sessionActive,
    players,
    roleCounts,
    nightNumber,
    dayNumber,
    nightInProgress,
    dayInProgress,
    dayEliminationDone,
    wakeIndex,
    deadPlayerIds,
    roleAssignments,
    nightActions,
    roleStates,
    loverPairs,
    convertedOrigins,
    lastNightResult,
    winCondition,
  } = sessionState;
  const [dayNomineeId, setDayNomineeId] = useState<string>("");
  const [postmanDeliveryTargetId, setPostmanDeliveryTargetId] = useState<string>("");
  const [awaitingPostmanDelivery, setAwaitingPostmanDelivery] = useState(false);
  const [dayError, setDayError] = useState<string | null>(null);
  const [dayInfo, setDayInfo] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [confirmEndSession, setConfirmEndSession] = useState(false);
  const [picker, setPicker] = useState<PickerState>(DEFAULT_PICKER);
  const savedSession = useSavedSession();

  function setSessionValue<K extends keyof SessionReducerState>(
    field: K,
    value: SessionReducerState[K] | ((current: SessionReducerState[K]) => SessionReducerState[K])
  ) {
    dispatch(setSessionField(field, value));
  }

  const setSessionActive = (value: boolean | ((current: boolean) => boolean)) =>
    setSessionValue("sessionActive", value);
  const setDayInProgress = (value: boolean | ((current: boolean) => boolean)) =>
    setSessionValue("dayInProgress", value);
  const setDayEliminationDone = (value: boolean | ((current: boolean) => boolean)) =>
    setSessionValue("dayEliminationDone", value);
  const setWakeIndex = (value: number | ((current: number) => number)) => setSessionValue("wakeIndex", value);
  const setRoleAssignments = (
    value:
      | Record<RoleType, string[]>
      | ((current: Record<RoleType, string[]>) => Record<RoleType, string[]>)
  ) => setSessionValue("roleAssignments", value);
  const setNightActions = (value: NightActionState | ((current: NightActionState) => NightActionState)) =>
    setSessionValue("nightActions", value);

  useEffect(() => {
    const saved = savedSession;
    if (!saved || !saved.sessionActive) return;
    dispatch({ type: "hydrate", payload: saved });
  }, [savedSession]);

  useAutosaveSession(sessionActive ? toPersistedSession(sessionState) : null);

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
      map.Mafia = ["Mafia", "Godfather", "MadeMan"].some((r) => {
        const role = r as RoleType;
        return (roleAssignments[role] ?? []).some((id) => id && !deadSet.has(id));
      });
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
      dispatch(setSessionField("nightInProgress", false));
      dispatch(setSessionField("wakeIndex", 0));
      return;
    }
    if (wakeIndex >= stepOrder.length) {
      dispatch(setSessionField("wakeIndex", 0));
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
  const currentStepIssues = useMemo(() => {
    if (!currentRole) return [] as string[];
    const issues: string[] = [];
    const addIssue = (message?: string) => {
      if (!message) return;
      if (!issues.includes(message)) issues.push(message);
    };

    if (isNight1) {
      const isRoleAssignedInMemo = (role: RoleType): boolean => {
        const count = roleCounts[role] ?? 0;
        if (count === 0) return true;
        const assigned = roleAssignments[role] ?? [];
        return assigned.filter((id) => id && id.trim().length > 0).length >= count;
      };
      const assignmentsComplete =
        currentRole === "Mafia"
          ? (["Godfather", "Mafia", "MadeMan", "UndercoverCop"] as const).every((role) => isRoleAssignedInMemo(role))
          : isRoleAssignedInMemo(currentRole);
      if (!assignmentsComplete) {
        addIssue(
          currentRole === "Mafia"
            ? "Assign all Mafia team roles before continuing."
            : "Assign all players for this role before continuing."
        );
      }
    }

    if (isRoleSuppressedByRecruit) return issues;
    if (currentRole === "Vigilante" && nightNumber === 1) return issues;
    if (currentRole === "Vigilante" && roleStates.Vigilante.lockedOut) return issues;

    if (currentRole === "Mafia") {
      const mafiaTargets = (nightActions.Mafia?.targetIds ?? []).slice(0, ROLE_DEFINITIONS.Mafia.action?.targetCount ?? 1);
      const mafiaValidation = validateAction("Mafia", mafiaTargets, { nightNumber, roleStates }, nightActions.Mafia?.metadata);
      if (!mafiaValidation.valid) addIssue(mafiaValidation.reason);

      const recruitAvailable = (roleCounts.MadeMan ?? 0) > 0 && !roleStates.MadeMan.usedRecruit;
      if (!recruitAvailable) return issues;
      const recruitTarget = nightActions.MadeMan?.targetIds?.[0];
      if (!recruitTarget || recruitTarget === NO_ACTION) return issues;

      const recruitValidation = validateAction(
        "MadeMan",
        [recruitTarget],
        { nightNumber, roleStates },
        nightActions.MadeMan?.metadata
      );
      if (!recruitValidation.valid) addIssue(recruitValidation.reason);

      const effectiveTarget = effectiveRecruitTargetId;
      if (!effectiveTarget) return issues;
      const effectiveRole = effectiveRoleByPlayer[effectiveTarget] ?? "Civilian";
      if (isMadeManRecruitBlockedRole(effectiveRole)) {
        addIssue("Made Man cannot recruit Mafia, Godfather, Made Man, or Undercover Cop.");
      }
      return issues;
    }

    if (currentActionCount <= 0) return issues;

    if (currentRole === "Magician" && !magicianOutOfActions) {
      const choice = nightActions.Magician?.metadata?.choice;
      if (!choice) {
        addIssue("Select an ability before continuing.");
        return issues;
      }
      if (choice === "none") return issues;
    }

    const actionValidation = validateAction(
      currentRole,
      (nightActions[currentRole]?.targetIds ?? []).slice(0, currentActionCount),
      { nightNumber, roleStates },
      nightActions[currentRole]?.metadata
    );
    if (!actionValidation.valid) addIssue(actionValidation.reason);

    return issues;
  }, [
    currentActionCount,
    currentRole,
    effectiveRecruitTargetId,
    effectiveRoleByPlayer,
    isNight1,
    isRoleSuppressedByRecruit,
    magicianOutOfActions,
    nightActions,
    nightNumber,
    roleAssignments,
    roleCounts,
    roleStates,
  ]);
  const currentStepValidation = useMemo(
    () => ({
      valid: currentStepIssues.length === 0,
      reason: currentStepIssues[0],
      reasons: currentStepIssues,
    }),
    [currentStepIssues]
  );

  function startNight() {
    dispatch({ type: "start-night" });
    setDayNomineeId("");
    setPostmanDeliveryTargetId("");
    setAwaitingPostmanDelivery(false);
    setDayError(null);
    setDayInfo(null);
  }

  function completeNight() {
    const snapshot: NonNullable<SessionReducerState["previousNightSnapshot"]> = {
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
    };

    const output = resolveNight({
      nightNumber,
      players,
      deadPlayerIds,
      roleAssignments,
      nightActions,
      roleStates,
      loverPairs,
    });
    dispatch({ type: "complete-night", payload: { output, snapshot } });
    setDayNomineeId("");
    setPostmanDeliveryTargetId("");
    setAwaitingPostmanDelivery(false);
    setDayError(null);
    setDayInfo(null);
  }

  function beginDay() {
    dispatch({ type: "begin-day" });
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
      const info = `${getPlayerName(dayNomineeId)} had Daytime Defense. The hang attempt was wasted.`;
      dispatch({
        type: "resolve-day-elimination",
        payload: {
          timelineDetail: info,
          dayNumber: displayDayNumber,
        },
      });
      setDayInfo(info);
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
        setDayInfo("Jester hang confirmed. Choose a Last Laugh target, then confirm again.");
        return;
      }
      const availableTargets = alivePlayers.map((player) => player.id).filter((id) => id !== postmanId);
      if (availableTargets.length > 0 && !postmanDeliveryTargetId) {
        setDayError("Choose a Last Laugh target before confirming.");
        return;
      }
      if (postmanDeliveryTargetId && dayImmunitySet.has(postmanDeliveryTargetId)) {
        // Legal Defense blocks Jester's day-triggered kill as well.
      } else if (postmanDeliveryTargetId && !deaths.has(postmanDeliveryTargetId)) {
        deaths.add(postmanDeliveryTargetId);
        const expanded = applyLoverChainDay(deaths);
        deaths.clear();
        for (const id of expanded) deaths.add(id);
      }
    }

    const deadThisDay = Array.from(deaths).filter((id) => !deadSet.has(id));
    const collateral = deadThisDay.filter((id) => id !== dayNomineeId && id !== postmanDeliveryTargetId);
    const lastLaughBlockedByDefense =
      Boolean(postmanHung && postmanDeliveryTargetId) && dayImmunitySet.has(postmanDeliveryTargetId);
    let dayResolution = `${getPlayerName(dayNomineeId)} was successfully hung.`;
    if (postmanHung && postmanDeliveryTargetId) {
      dayResolution += lastLaughBlockedByDefense
        ? ` Jester's Last Laugh failed because ${getPlayerName(postmanDeliveryTargetId)} had Daytime Defense.`
        : ` Jester's Last Laugh killed ${getPlayerName(postmanDeliveryTargetId)}.`;
    }
    if (collateral.length > 0) {
      dayResolution += ` Lover chain also killed ${collateral.map((id) => getPlayerName(id)).join(", ")}.`;
    }

    const nextDead = new Set(deadPlayerIds);
    for (const id of deaths) nextDead.add(id);
    const nextDeadIds = Array.from(nextDead);
    dispatch({
      type: "resolve-day-elimination",
      payload: {
        nextDeadPlayerIds: nextDeadIds,
        markPostmanDeliveryUsed: postmanHung,
        timelineDetail: dayResolution,
        dayNumber: displayDayNumber,
      },
    });
    setDayInfo(dayResolution);
    setDayNomineeId("");
    setPostmanDeliveryTargetId("");
    setAwaitingPostmanDelivery(false);
  }

  function skipDayHang() {
    setDayError(null);
    setDayInfo("Town skipped the daytime hang.");
    dispatch({ type: "skip-day-hang", payload: { dayNumber: displayDayNumber } });
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
    dispatch({ type: "rollback-night" });
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
    saveSession({
      players,
      roleCounts,
      nightNumber: 1,
      nightInProgress: false,
      wakeIndex: 0,
      sessionActive: false,
      roleAssignments: createRoleAssignments(ROLE_TYPES),
      nightActions: createNightActions(ROLE_TYPES),
      deadPlayerIds: [],
    });
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
      <RoleAssignmentGrid
        role={role}
        count={count}
        showRoleHeading={showRoleHeading}
        gridClassName={getAssignmentGridClass(count)}
        renderSlot={(index) => {
          const assignedId = roleAssignments[role]?.[index] ?? "";
          const assignedName = getPlayerName(assignedId);
          const isAssignedDead = Boolean(assignedId && deadSet.has(assignedId));
          const slotLabel = count > 1 ? `${roleLabel(role)} ${index + 1}` : "Assign Player";
          return (
            <AssignmentSlotCard
              role={role}
              assignedId={assignedId}
              assignedName={assignedName}
              isAssignedDead={isAssignedDead}
              readOnly={readOnly}
              emptyLabel={slotLabel}
              onClick={() => {
                if (!readOnly) openAssignmentPicker(role, index);
              }}
            />
          );
        }}
      />
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
    const unassignedLabel = options?.unassignedLabel ?? `Assign ${roleLabel(role)}`;
    const readOnly = options?.readOnly ?? false;
    const converted = options?.converted ?? false;
    const convertedFromRole = options?.convertedFromRole;

    return (
      <AssignmentSlotCard
        role={role}
        assignedId={assignedId}
        assignedName={assignedName}
        isAssignedDead={isAssignedDead}
        readOnly={readOnly}
        emptyLabel={unassignedLabel}
        onClick={() => {
          if (!readOnly) openAssignmentPicker(role, index);
        }}
        converted={converted}
        convertedFromRole={convertedFromRole}
      />
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
      <MafiaTeamRosterPanel
        activeUniqueRoles={activeUniqueRoles}
        mafiaCount={mafiaCount}
        compactGridForUnique={getCompactGridColsClass(activeUniqueRoles.length, 3)}
        compactGridForMafia={getCompactGridColsClass(mafiaCount, 3)}
        renderUniqueRoleCard={(role) => renderAssignmentCard(role, 0, { unassignedLabel: "Assign Player", readOnly })}
        renderMafiaCard={(index) => {
          const isConvertedSlot = index >= (roleCounts.Mafia ?? 0);
          const assignedId = roleAssignments.Mafia?.[index] ?? "";
          return renderAssignmentCard("Mafia", index, {
            unassignedLabel: `Mafia ${index + 1}`,
            readOnly,
            converted: isConvertedSlot,
            convertedFromRole: isConvertedSlot ? convertedOrigins[assignedId] : undefined,
          });
        }}
      />
    );
  }

  function renderRivalMafiaTeamRoster(readOnly = false) {
    const rivalCount = roleCounts.RivalMafia ?? 0;

    return (
      <RivalMafiaRosterPanel
        rivalCount={rivalCount}
        compactGridClass={getCompactGridColsClass(rivalCount, 3)}
        renderRivalCard={(index) =>
          renderAssignmentCard("RivalMafia", index, { unassignedLabel: `Rival Mafia ${index + 1}`, readOnly })
        }
      />
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
    const detectivePreview: DetectivePreview =
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
                blockedByBartender: false,
              };
            }
            const rawTarget = nightActions.Detective?.targetIds?.[0];
            if (!rawTarget || rawTarget === NO_ACTION) return null;

            const swapA = nightActions.BusDriver?.targetIds?.[0];
            const swapB = nightActions.BusDriver?.targetIds?.[1];
            const resolveBusSwap = (targetId: string | undefined) => {
              if (!targetId || targetId === NO_ACTION) return targetId ?? "";
              if (swapA && swapB) {
                if (targetId === swapA) return swapB;
                if (targetId === swapB) return swapA;
              }
              return targetId;
            };
            const resolvedTarget = resolveBusSwap(rawTarget);

            const detectivePlayerId = roleAssignments.Detective?.[0] ?? "";
            const bartenderTargetRaw = nightActions.Bartender?.targetIds?.[0];
            const bartenderResolvedTarget = resolveBusSwap(bartenderTargetRaw);
            const blockedByBartender = Boolean(detectivePlayerId && bartenderResolvedTarget === detectivePlayerId);

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
              blockedByBartender,
            };
          })()
        : null;

    return (
      <TargetCardsPanel
        role={role}
        actionCount={actionCount}
        activeAbility={activeAbility}
        sectionTitle={getTargetSectionTitle(role)}
        targetIcon={TargetIcon}
        abilityRoleIcon={AbilityRoleIcon}
        targetGridClass={targetGridClass}
        getSlotLabel={(index) => getTargetSlotLabel(role, index, magicianChoice)}
        getDisplayNameForSlot={(index) => {
          const targetId = nightActions[role]?.targetIds?.[index] ?? "";
          const hasTarget = Boolean(targetId && targetId !== NO_ACTION);
          if (vigilanteLockedNight1) return null;
          if (hasTarget) return getPlayerName(targetId);
          if (targetId === NO_ACTION) return "No action";
          return null;
        }}
        isSlotSelected={(index) => {
          const targetId = nightActions[role]?.targetIds?.[index] ?? "";
          return Boolean(targetId && (targetId === NO_ACTION || targetId !== ""));
        }}
        isSlotDisabled={() => vigilanteLockedNight1}
        onOpenTargetSlot={(index) => openTargetPicker(role, index)}
        detectivePreview={detectivePreview}
      />
    );
  }

  if (!sessionActive) {
    return <NoActiveSessionView onBack={() => router.push("/")} />;
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
    <SessionPageShell
      maxWidthRem={activePageMaxWidthRem}
      header={
        <SessionPageHeader
          title={
            dayInProgress
              ? `Day ${displayDayNumber}`
              : showingNightSummary
                ? `Night ${summaryNightNumber} Summary`
                : `Night ${nightNumber}`
          }
          onOpenSettings={() => setSettingsOpen(true)}
        />
      }
    >
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
                <CurrentNightStepPanel
                  currentRole={currentRole}
                  isTeamStep={isTeamStep}
                  currentActionCount={currentActionCount}
                  currentAssignmentCount={currentAssignmentCount}
                  isNight1={isNight1}
                  getAssignmentPrompt={getAssignmentPrompt}
                  getTeamStepColumnsClass={getTeamStepColumnsClass}
                  getStepperColumnsClass={getStepperColumnsClass}
                  renderMafiaTeamRoster={renderMafiaTeamRoster}
                  renderRivalMafiaTeamRoster={renderRivalMafiaTeamRoster}
                  renderTargetCards={renderTargetCards}
                  renderRoleAssignmentCards={renderRoleAssignmentCards}
                  roleCounts={roleCounts}
                  mafiaRecruitAvailable={mafiaRecruitAvailable}
                  mafiaRecruitUsed={mafiaRecruitUsed}
                  teamOtherAbilities={teamOtherAbilities}
                  currentOtherAbilities={currentOtherAbilities}
                  abilityMeta={abilityMeta}
                  magicianOutOfActions={magicianOutOfActions}
                  magicianChoice={nightActions.Magician?.metadata?.choice}
                  magicianUsedKill={roleStates.Magician.usedKill}
                  magicianUsedSave={roleStates.Magician.usedSave}
                  onMagicianChoiceChange={(choice) => updateNightChoice("Magician", choice)}
                  wakeIndex={wakeIndex}
                  stepOrderLength={stepOrder.length}
                  onPreviousStep={previousStep}
                  onNextStep={nextStep}
                  onCompleteNight={completeNight}
                  currentStepComplete={currentStepComplete}
                  allStepsComplete={allStepsComplete}
                  nightNumber={nightNumber}
                />
              )}

              {lastNightResult && !nightInProgress && !dayInProgress && (
                <NightSummaryPanel
                  lastNightResult={lastNightResult}
                  getPlayerName={getPlayerName}
                  summaryDeathDetails={summaryDeathDetails}
                  busSwapDetailText={busSwapDetailText}
                  players={players}
                  effectiveRoleByPlayer={effectiveRoleByPlayer}
                  deadSet={deadSet}
                  loverPairs={loverPairs}
                  winCondition={winCondition}
                  displayDayNumber={displayDayNumber}
                  onBackToPreviousNight={backToPreviousNight}
                  onBeginDay={beginDay}
                />
              )}

              {dayInProgress && !nightInProgress && (
                <DayPhasePanel
                  displayDayNumber={displayDayNumber}
                  alivePlayers={alivePlayers}
                  effectiveRoleByPlayer={effectiveRoleByPlayer}
                  dayImmunitySet={dayImmunitySet}
                  dayNomineeId={dayNomineeId}
                  onSelectNominee={(playerId) => {
                    setDayNomineeId(playerId);
                    setPostmanDeliveryTargetId("");
                    setAwaitingPostmanDelivery(false);
                    setDayError(null);
                    setDayInfo(null);
                  }}
                  dayPostmanHung={dayPostmanHung}
                  dayPostmanTargets={dayPostmanTargets}
                  postmanDeliveryTargetId={postmanDeliveryTargetId}
                  onSelectPostmanDeliveryTarget={setPostmanDeliveryTargetId}
                  getPlayerName={getPlayerName}
                  dayError={dayError}
                  dayInfo={dayInfo}
                  onSkipHang={skipDayHang}
                  onConfirmElimination={confirmDayElimination}
                  onStartNight={startNextNightFromDay}
                  dayEliminationDone={dayEliminationDone}
                  winCondition={winCondition}
                  nightNumber={nightNumber}
                />
              )}
            </CardContent>
          </Card>

          {nightInProgress && currentRole && (
            <CurrentNightStepStatusCard
              currentRole={currentRole}
              currentStepValidation={currentStepValidation}
              isRoleSuppressedByRecruit={isRoleSuppressedByRecruit}
              vigilanteLockedOut={roleStates.Vigilante.lockedOut}
              currentStepComplete={currentStepComplete}
            />
          )}
        </section>
      <PlayerPickerDialog
        picker={picker}
        onOpenChange={(open) => setPicker((current) => ({ ...current, open }))}
        selectablePlayers={getSelectablePlayers(picker.role, picker.index, picker.mode)}
        effectiveRoleByPlayer={effectiveRoleByPlayer}
        deadSet={deadSet}
        onSelect={applyPickerSelection}
        noActionValue={NO_ACTION}
      />

      <SessionSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        confirmEndSession={confirmEndSession}
        onConfirmStateChange={setConfirmEndSession}
        darkMode={darkMode}
        onDarkModeChange={setDarkMode}
        onEndSession={endSession}
      />
    </SessionPageShell>
  );
}
