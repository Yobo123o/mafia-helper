"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { buildWakeOrder } from "@/domain/rules";
import { ROLE_DEFINITIONS, ROLE_TYPES, getRoleAlignment } from "@/domain/roles";
import type { RoleType } from "@/domain/types";
import type { IconType } from "react-icons";
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
  GiPerson,
  GiPoliceOfficerHead,
  GiPotionOfMadness,
  GiScales,
  GiShield,
  GiSkullCrossedBones,
  GiSpy,
  GiTie,
} from "react-icons/gi";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  clearSession,
  createNightActions,
  createRoleAssignments,
  createRoleCounts,
  loadSession,
  saveSession,
  type PlayerEntry,
} from "@/lib/session";

function roleLabel(role: RoleType): string {
  return role.replace(/([a-z])([A-Z])/g, "$1 $2");
}

const NO_ACTION = "__no_action__";

const ROLE_ICONS: Record<RoleType, IconType> = {
  Civilian: GiPerson,
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

export default function SessionPage() {
  const router = useRouter();
  const [sessionActive, setSessionActive] = useState(false);
  const [players, setPlayers] = useState<PlayerEntry[]>([]);
  const [roleCounts, setRoleCounts] = useState<Record<RoleType, number>>(() => {
    return createRoleCounts(ROLE_TYPES);
  });
  const [nightNumber, setNightNumber] = useState(1);
  const [nightInProgress, setNightInProgress] = useState(false);
  const [wakeIndex, setWakeIndex] = useState(0);
  const [undercoverIdentified, setUndercoverIdentified] = useState(false);
  const [deadPlayerIds, setDeadPlayerIds] = useState<string[]>([]);
  const [roleAssignments, setRoleAssignments] = useState<Record<RoleType, string[]>>(() => {
    return createRoleAssignments(ROLE_TYPES);
  });
  const [nightActions, setNightActions] = useState(() => createNightActions(ROLE_TYPES));

  useEffect(() => {
    const saved = loadSession();
    if (!saved || !saved.sessionActive) return;
    setSessionActive(true);
    setPlayers(saved.players ?? []);
    setRoleCounts(saved.roleCounts ?? createRoleCounts(ROLE_TYPES));
    setNightNumber(saved.nightNumber ?? 1);
    setNightInProgress(saved.nightInProgress ?? false);
    setWakeIndex(saved.wakeIndex ?? 0);
    setUndercoverIdentified(saved.undercoverIdentified ?? false);
    setRoleAssignments(saved.roleAssignments ?? createRoleAssignments(ROLE_TYPES));
    setNightActions(saved.nightActions ?? createNightActions(ROLE_TYPES));
    setDeadPlayerIds(saved.deadPlayerIds ?? []);
  }, []);

  useEffect(() => {
    if (!sessionActive) return;
    saveSession({
      players,
      roleCounts,
      nightNumber,
      nightInProgress,
      wakeIndex,
      undercoverIdentified,
      sessionActive,
      roleAssignments,
      nightActions,
      deadPlayerIds,
    });
  }, [
    players,
    roleCounts,
    nightNumber,
    nightInProgress,
    wakeIndex,
    undercoverIdentified,
    sessionActive,
    roleAssignments,
    nightActions,
    deadPlayerIds,
  ]);

  const selectedRoles = useMemo(
    () => ROLE_TYPES.filter((role) => (roleCounts[role] ?? 0) > 0),
    [roleCounts]
  );

  const wakeOrder = useMemo(
    () => buildWakeOrder(selectedRoles, { nightNumber }),
    [selectedRoles, nightNumber]
  );

  const assignedByPlayer = useMemo(() => {
    const map: Record<string, RoleType> = {};
    for (const role of ROLE_TYPES) {
      for (const playerId of roleAssignments[role] ?? []) {
        if (playerId) map[playerId] = role;
      }
    }
    return map;
  }, [roleAssignments]);

  const currentRole = wakeOrder[wakeIndex];
  const currentDefinition = currentRole ? ROLE_DEFINITIONS[currentRole] : null;
  const currentActionCount = currentDefinition?.action?.targetCount ?? 0;
  const isNight1 = nightNumber === 1;
  const loverIds = new Set(nightActions.Cupid?.targetIds ?? []);
  const swappedIds = new Set(nightActions.BusDriver?.targetIds ?? []);
  const mafiaTargets = new Set(nightActions.Mafia?.targetIds ?? []);

  const playerRoles = useMemo(() => {
    const map: Record<string, RoleType | null> = {};
    for (const role of ROLE_TYPES) {
      for (const playerId of roleAssignments[role] ?? []) {
        if (playerId) map[playerId] = role;
      }
    }
    return map;
  }, [roleAssignments]);

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
    const definition = ROLE_DEFINITIONS[role];
    const action = definition.action;
    if (!action || action.targetCount === 0) return true;
    if (role === "Magician") {
      const choice = nightActions.Magician?.metadata?.choice;
      if (!choice) return false;
    }
    const targets = nightActions[role]?.targetIds ?? [];
    return targets.filter((id) => id && id.trim().length > 0).length >= action.targetCount;
  }

  function isStepComplete(role: RoleType): boolean {
    const assignmentComplete =
      isNight1 && role === "Mafia" ? isMafiaAssignmentComplete() : isNight1 ? isRoleAssignmentComplete(role) : true;
    return assignmentComplete && isActionComplete(role);
  }

  const currentStepComplete = currentRole ? isStepComplete(currentRole) : false;
  const allStepsComplete = wakeOrder.length > 0 && wakeOrder.every((role) => isStepComplete(role));

  function setRoleAssignment(role: RoleType, index: number, playerId: string) {
    setRoleAssignments((current) => {
      const next = { ...current };
      if (playerId) {
        for (const roleKey of ROLE_TYPES) {
          const cleaned = (next[roleKey] ?? []).filter((id) => id !== playerId);
          next[roleKey] = cleaned;
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
      next[role] = { ...action, metadata: { ...(action.metadata ?? {}), choice } };
      return next;
    });
  }

  function getInvestigationResult(targetId: string) {
    const targetRole = playerRoles[targetId];
    if (!targetRole) return { result: "Unknown", note: "Role not assigned yet." };
    if (targetRole === "Godfather") {
      return { result: "Innocent", note: "Godfather appears innocent." };
    }
    if (targetRole === "Miller") {
      return { result: "Mafia", note: "Miller appears Mafia." };
    }
    const alignment = getRoleAlignment(targetRole);
    return { result: alignment === "Mafia" || alignment === "RivalMafia" ? "Mafia" : "Innocent", note: null };
  }

  function startNight() {
    setNightActions(createNightActions(ROLE_TYPES));
    setWakeIndex(0);
    setUndercoverIdentified(false);
    setNightInProgress(true);
  }

  function completeNight() {
    setNightInProgress(false);
    setWakeIndex(0);
    setUndercoverIdentified(false);
    setNightNumber((current) => current + 1);
  }

  function nextStep() {
    if (wakeOrder.length === 0) return;
    setWakeIndex((current) => Math.min(wakeOrder.length - 1, current + 1));
  }

  function previousStep() {
    setWakeIndex((current) => Math.max(0, current - 1));
  }

  function endSession() {
    setSessionActive(false);
    clearSession();
    router.push("/");
  }

  function toggleDead(playerId: string) {
    setDeadPlayerIds((current) =>
      current.includes(playerId) ? current.filter((id) => id !== playerId) : [...current, playerId]
    );
  }

  function renderAssignmentSelect(role: RoleType, index: number) {
    const assigned = roleAssignments[role]?.[index] ?? "";
    return (
      <select
        key={`${role}-${index}`}
        value={assigned}
        onChange={(event) => setRoleAssignment(role, index, event.target.value)}
        className="h-9 w-full rounded-md border border-border/70 bg-background px-2 text-sm"
      >
        <option value="">Select player</option>
        {players.map((player) => {
          const assignedRole = assignedByPlayer[player.id];
          const isAssignedElsewhere = assignedRole && player.id !== assigned;
          if (isAssignedElsewhere) return null;
          const label = player.name.trim() || "Unnamed";
          return (
            <option key={player.id} value={player.id}>
              {label}
            </option>
          );
        })}
      </select>
    );
  }

  function renderActionSelect(role: RoleType, index: number) {
    const selected = nightActions[role]?.targetIds?.[index] ?? "";
    return (
      <select
        key={`${role}-target-${index}`}
        value={selected}
        onChange={(event) => updateNightTarget(role, index, event.target.value)}
        className="h-9 w-full rounded-md border border-border/70 bg-background px-2 text-sm"
      >
        <option value="">Select target</option>
        <option value={NO_ACTION}>No action</option>
        {players.map((player) => (
          <option key={player.id} value={player.id}>
            {player.name.trim() || "Unnamed"}
          </option>
        ))}
      </select>
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

  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-28 top-8 h-72 w-72 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="absolute right-0 top-1/3 h-80 w-80 rounded-full bg-amber-500/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-64 w-64 rounded-full bg-red-500/10 blur-3xl" />
      </div>

      <div className="relative mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 md:px-8 md:py-10">
        <header className="rounded-2xl border border-border/60 bg-card/60 p-4 backdrop-blur md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-2">
              <Badge className="rounded-full bg-primary/10 text-primary hover:bg-primary/10">Game Session</Badge>
              <h1 className="text-2xl font-semibold tracking-tight md:text-4xl">Night {nightNumber} Moderator Flow</h1>
              <p className="max-w-2xl text-sm text-muted-foreground md:text-base">
                Step through each wake call, record actions, and keep night resolution consistent.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" onClick={() => router.push("/")}>
                Back to Setup
              </Button>
              <Button variant="destructive" onClick={endSession}>
                End Session
              </Button>
            </div>
          </div>
        </header>

        <section className="space-y-6">
          <Card className="border-border/60 bg-card/70 backdrop-blur">
            <CardHeader>
              <CardTitle>Players</CardTitle>
              <CardDescription>Live roster with role and status metadata.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {players.map((player) => {
                  const role = playerRoles[player.id] ?? null;
                  const isDead = deadPlayerIds.includes(player.id);
                  const isLover = loverIds.has(player.id);
                  const isSwapped = swappedIds.has(player.id);
                  const targetedByMafia = mafiaTargets.has(player.id);
                  return (
                    <div
                      key={player.id}
                      className={cn(
                        "rounded-xl border border-border/70 bg-background/50 p-3",
                        isDead ? "opacity-70" : ""
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-3">
                          <div className="grid size-10 shrink-0 place-items-center rounded-lg border border-border/70 bg-background/60">
                            {role ? (
                              (() => {
                                const RoleIcon = ROLE_ICONS[role];
                                return <RoleIcon className="h-5 w-5 text-muted-foreground" />;
                              })()
                            ) : (
                              <GiPerson className="h-5 w-5 text-muted-foreground" />
                            )}
                          </div>
                          <div>
                            <p className="font-semibold">{player.name.trim() || "Unnamed"}</p>
                            <p className="text-xs text-muted-foreground">
                              {role ? roleLabel(role) : "Role unassigned"}
                            </p>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant={isDead ? "secondary" : "outline"}
                          onClick={() => toggleDead(player.id)}
                        >
                          {isDead ? "Dead" : "Alive"}
                        </Button>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-1.5 text-[10px] uppercase tracking-wide">
                        {isLover && (
                          <Badge variant="outline" className="border-pink-400/50 text-pink-200">
                            Lovers
                          </Badge>
                        )}
                        {isSwapped && (
                          <Badge variant="outline" className="border-cyan-400/50 text-cyan-200">
                            Swapped
                          </Badge>
                        )}
                        {targetedByMafia && (
                          <Badge variant="outline" className="border-red-400/50 text-red-200">
                            Mafia Target
                          </Badge>
                        )}
                        {!isLover && !isSwapped && !targetedByMafia && (
                          <Badge variant="outline" className="text-muted-foreground">
                            No status
                          </Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-card/70 backdrop-blur">
            <CardHeader>
              <CardTitle>Night Stepper</CardTitle>
              <CardDescription>{nightInProgress ? "In progress" : "Ready to begin"}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {!nightInProgress && (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">Start the next night to begin the wake sequence.</p>
                  <Button onClick={startNight}>Start Night {nightNumber}</Button>
                </div>
              )}

              {nightInProgress && currentRole && (
                <div className="space-y-5">
                  <div className="rounded-xl border border-border/70 bg-background/50 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div className="grid size-11 shrink-0 place-items-center rounded-lg border border-border/70 bg-background/60">
                          {currentRole && (() => {
                            const RoleIcon = ROLE_ICONS[currentRole];
                            return <RoleIcon className="h-5 w-5 text-muted-foreground" />;
                          })()}
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">
                            Wake Step {wakeIndex + 1} of {wakeOrder.length}
                          </p>
                          <p className="text-lg font-semibold">{roleLabel(currentRole)}</p>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                        Night {nightNumber}
                      </Badge>
                    </div>
                  </div>

                  {isNight1 && currentRole === "Mafia" && (
                    <div className="space-y-4">
                      <p className="text-sm font-semibold">Assign Mafia Team Roles</p>
                      {(["Godfather", "Mafia", "MadeMan", "UndercoverCop"] as RoleType[])
                        .filter((role) => (roleCounts[role] ?? 0) > 0)
                        .map((role) => (
                          <div key={role} className="space-y-2">
                            <p className="text-xs uppercase tracking-wide text-muted-foreground">
                              {roleLabel(role)}
                            </p>
                            {Array.from({ length: roleCounts[role] ?? 0 }).map((_, index) => (
                              <div
                                key={`${role}-${index}`}
                                className="grid gap-2 md:grid-cols-[80px_1fr] md:items-center"
                              >
                                <Badge variant="secondary" className="justify-center">
                                  Slot {index + 1}
                                </Badge>
                                {renderAssignmentSelect(role, index)}
                              </div>
                            ))}
                          </div>
                        ))}
                      {(roleCounts.UndercoverCop ?? 0) > 0 && (
                        <div className="flex items-center justify-between rounded-md border border-border/60 bg-background/40 p-3 text-sm">
                          <span>Undercover Cop identified for moderator</span>
                          <Switch checked={undercoverIdentified} onCheckedChange={setUndercoverIdentified} />
                        </div>
                      )}
                    </div>
                  )}

                  {isNight1 && currentRole !== "Mafia" && (roleCounts[currentRole] ?? 0) > 0 && (
                    <div className="space-y-3">
                      <p className="text-sm font-semibold">Assign {roleLabel(currentRole)}</p>
                      {Array.from({ length: roleCounts[currentRole] ?? 0 }).map((_, index) => (
                        <div
                          key={`${currentRole}-${index}`}
                          className="grid gap-2 md:grid-cols-[80px_1fr] md:items-center"
                        >
                          <Badge variant="secondary" className="justify-center">
                            Slot {index + 1}
                          </Badge>
                          {renderAssignmentSelect(currentRole, index)}
                        </div>
                      ))}
                    </div>
                  )}

                  {currentActionCount > 0 && (
                    <div className="space-y-3">
                      <p className="text-sm font-semibold">Night Action</p>
                      {currentRole === "Magician" && (
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            size="sm"
                            variant={nightActions.Magician?.metadata?.choice === "kill" ? "default" : "outline"}
                            onClick={() => updateNightChoice("Magician", "kill")}
                          >
                            Kill
                          </Button>
                          <Button
                            size="sm"
                            variant={nightActions.Magician?.metadata?.choice === "save" ? "default" : "outline"}
                            onClick={() => updateNightChoice("Magician", "save")}
                          >
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant={nightActions.Magician?.metadata?.choice === "none" ? "default" : "outline"}
                            onClick={() => updateNightChoice("Magician", "none")}
                          >
                            No Action
                          </Button>
                        </div>
                      )}
                      {Array.from({ length: currentActionCount }).map((_, index) => (
                        <div
                          key={`${currentRole}-target-${index}`}
                          className="grid gap-2 md:grid-cols-[80px_1fr] md:items-center"
                        >
                          <Badge variant="secondary" className="justify-center">
                            Target {index + 1}
                          </Badge>
                          {renderActionSelect(currentRole, index)}
                        </div>
                      ))}
                      {currentRole === "Detective" && (
                        <div className="rounded-md border border-border/60 bg-background/40 p-3 text-sm">
                          {(() => {
                            const targetId = nightActions.Detective?.targetIds?.[0];
                            if (!targetId || targetId === NO_ACTION) {
                              return <span className="text-muted-foreground">Select a target to reveal result.</span>;
                            }
                            const result = getInvestigationResult(targetId);
                            return (
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <span>
                                  Investigation result:{" "}
                                  <span className="font-semibold">{result.result}</span>
                                </span>
                                {result.note && <span className="text-xs text-muted-foreground">{result.note}</span>}
                              </div>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={previousStep} disabled={wakeIndex === 0}>
                        Previous
                      </Button>
                      <Button
                        onClick={nextStep}
                        disabled={wakeIndex >= wakeOrder.length - 1 || !currentStepComplete}
                      >
                        Next
                      </Button>
                    </div>
                    {wakeIndex >= wakeOrder.length - 1 && allStepsComplete && (
                      <Button variant="secondary" onClick={completeNight}>
                        Complete Night
                      </Button>
                    )}
                  </div>
                </div>
              )}

            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}
