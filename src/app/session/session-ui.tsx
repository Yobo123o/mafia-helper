"use client";

import type { ReactNode } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { ROLE_ICONS, roleLabel } from "@/domain/role-presentation";
import type { DeathDetail, NightResult, RoleType } from "@/domain/types";
import type { PlayerEntry } from "@/lib/session";
import { SettingsIcon, SkullIcon } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { RoleAbility } from "@/domain/roles";
export { EventTimelinePanel } from "./ui/timeline-panel";

function normalizeCauseForReadAloud(cause: string): string {
  let text = cause.trim();
  if (!text) return "Cause of death was not recorded.";
  if (/^Killed by /i.test(text)) {
    text = text.replace(/^Killed by /i, "They were killed by ");
  } else if (/^Visited Grandma .* died to Home Defense\.?$/i.test(text)) {
    text = "They died while visiting Grandma and were killed by Home Defense.";
  } else if (!/^They /i.test(text)) {
    text = `They ${text.charAt(0).toLowerCase()}${text.slice(1)}`;
  }
  if (!/[.!?]$/.test(text)) text += ".";
  return text;
}

export function SessionBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0">
      <div className="absolute -left-28 top-8 h-72 w-72 rounded-full bg-cyan-500/10 blur-3xl" />
      <div className="absolute right-0 top-1/3 h-80 w-80 rounded-full bg-amber-500/10 blur-3xl" />
      <div className="absolute bottom-0 left-1/3 h-64 w-64 rounded-full bg-red-500/10 blur-3xl" />
    </div>
  );
}

export function NoActiveSessionView({ onBack }: { onBack: () => void }) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="relative mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-10 md:px-8">
        <Card className="border-border/60 bg-card/70 backdrop-blur">
          <CardHeader>
            <CardTitle>No Active Session</CardTitle>
            <CardDescription>Return to setup to start a new game session.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={onBack}>Back to Setup</Button>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

export function SessionPageHeader({
  title,
  onOpenSettings,
}: {
  title: string;
  onOpenSettings: () => void;
}) {
  return (
    <header className="rounded-2xl border border-border/60 bg-card/60 p-4 backdrop-blur md:p-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight md:text-4xl">{title}</h1>
        <Button variant="outline" size="icon" onClick={onOpenSettings} aria-label="Open settings">
          <SettingsIcon className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}

type PickerStateLike = {
  open: boolean;
  mode: "assignment" | "target";
  role: RoleType;
  index: number;
  title: string;
  description: string;
  excludePlayerIds?: string[];
  allowNoAction?: boolean;
};

export function PlayerPickerDialog({
  picker,
  onOpenChange,
  selectablePlayers,
  effectiveRoleByPlayer,
  deadSet,
  onSelect,
  noActionValue,
}: {
  picker: PickerStateLike;
  onOpenChange: (open: boolean) => void;
  selectablePlayers: PlayerEntry[];
  effectiveRoleByPlayer: Record<string, RoleType>;
  deadSet: Set<string>;
  onSelect: (playerId: string) => void;
  noActionValue: string;
}) {
  return (
    <Dialog open={picker.open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{picker.title}</DialogTitle>
          <DialogDescription>{picker.description}</DialogDescription>
        </DialogHeader>

        <div className="grid max-h-[52vh] gap-2 overflow-y-auto sm:grid-cols-2">
          {selectablePlayers.map((player) => {
            const role = effectiveRoleByPlayer[player.id] ?? "Civilian";
            const isDead = deadSet.has(player.id);
            const excluded = (picker.excludePlayerIds ?? []).includes(player.id);
            return (
              <button
                key={player.id}
                type="button"
                onClick={() => onSelect(player.id)}
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
            <Button variant="outline" onClick={() => onSelect(noActionValue)}>
              Set No Action
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function SessionSettingsDialog({
  open,
  onOpenChange,
  confirmEndSession,
  onConfirmStateChange,
  darkMode,
  onDarkModeChange,
  onEndSession,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  confirmEndSession: boolean;
  onConfirmStateChange: (value: boolean) => void;
  darkMode: boolean;
  onDarkModeChange: (value: boolean) => void;
  onEndSession: () => void;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen);
        if (!nextOpen) onConfirmStateChange(false);
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
            <Switch id="session-theme" checked={darkMode} onCheckedChange={onDarkModeChange} />
          </div>

          {confirmEndSession ? (
            <div className="space-y-2 rounded-lg border border-red-500/50 bg-red-500/10 p-3">
              <p className="text-sm font-semibold text-red-100">Confirm End Session</p>
              <p className="text-xs text-red-100/90">This will end the current game session and return to setup.</p>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => onConfirmStateChange(false)}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    onOpenChange(false);
                    onConfirmStateChange(false);
                    onEndSession();
                  }}
                >
                  Confirm End Session
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex justify-end">
              <Button variant="destructive" onClick={() => onConfirmStateChange(true)}>
                End Session
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function NightSummaryPanel({
  lastNightResult,
  getPlayerName,
  summaryDeathDetails,
  busSwapDetailText,
  players,
  effectiveRoleByPlayer,
  deadSet,
  loverPairs,
  winCondition,
  displayDayNumber,
  onBackToPreviousNight,
  onBeginDay,
}: {
  lastNightResult: NightResult;
  getPlayerName: (playerId: string) => string;
  summaryDeathDetails: DeathDetail[];
  busSwapDetailText: string;
  players: PlayerEntry[];
  effectiveRoleByPlayer: Record<string, RoleType>;
  deadSet: Set<string>;
  loverPairs: [string, string][];
  winCondition: string | null;
  displayDayNumber: number;
  onBackToPreviousNight: () => void;
  onBeginDay: () => void;
}) {
  const readAloudDeathLines =
    summaryDeathDetails.length > 0
      ? summaryDeathDetails.map((detail) => {
          const role = effectiveRoleByPlayer[detail.playerId] ?? "Civilian";
          const causes = (detail.causes ?? []).filter(Boolean);
          const causeText =
            causes.length > 0
              ? causes.map((cause) => normalizeCauseForReadAloud(cause)).join(" ")
              : "Cause of death was not recorded.";
          return `${getPlayerName(detail.playerId)} died last night. ${causeText} They were the ${roleLabel(role)}.`;
        })
      : [];

  return (
    <div className="space-y-4 rounded-xl border border-border/70 bg-background/40 p-4">
      <div className="space-y-2 rounded-md border border-border/60 bg-background/50 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Read Aloud Breakdown</p>
        {readAloudDeathLines.length > 0 ? (
          <div className="space-y-2">
            {readAloudDeathLines.map((line, index) => (
              <p key={`read-aloud-${index}`} className="text-sm leading-relaxed">
                {line}
              </p>
            ))}
          </div>
        ) : (
          <p className="text-sm leading-relaxed">No one died last night.</p>
        )}
      </div>
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
                      className={cn("text-sm", isDead ? "border-red-400/60 text-red-200" : "border-emerald-400/60 text-emerald-200")}
                    >
                      {isDead ? "Dead" : "Alive"}
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    <div className="mx-auto grid size-12 place-items-center rounded-full border border-border/60 bg-background/70">
                      {isDead ? <SkullIcon className="h-6 w-6 text-red-300" /> : <RoleIcon className="h-6 w-6 text-muted-foreground" />}
                    </div>
                    <p className="text-lg font-semibold leading-tight">{roleLabel(role)}</p>
                  </div>
                  <div className="flex min-h-10 flex-wrap items-center justify-center gap-1">
                    {loverPartnerId && <Badge variant="outline" className="border-pink-400/60 text-xs text-pink-200">Lover</Badge>}
                    {wasConverted && <Badge variant="outline" className="border-amber-400/60 text-xs text-amber-200">Converted</Badge>}
                    {hasDayImmunity && <Badge variant="outline" className="border-cyan-400/60 text-xs text-cyan-200">Daytime Defense</Badge>}
                    {wasSaved && <Badge variant="outline" className="border-emerald-400/60 text-xs text-emerald-200">Saved</Badge>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <details className="rounded-md border border-border/60 bg-background/50 p-3">
        <summary className="cursor-pointer list-none text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Advanced Details
        </summary>
        <div className="mt-3 space-y-4">
          <div className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <span className="text-muted-foreground">Deaths:</span>{" "}
              <span className="font-semibold">
                {lastNightResult.deaths.length > 0 ? lastNightResult.deaths.map((id) => getPlayerName(id)).join(", ") : "None"}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Saves:</span>{" "}
              <span className="font-semibold">
                {lastNightResult.saves.length > 0 ? lastNightResult.saves.map((id) => getPlayerName(id)).join(", ") : "None"}
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
                    ? lastNightResult.investigations.map((item) => `${getPlayerName(item.targetId)} = ${item.result}`).join("; ")
                    : "None"}
                </p>
              </div>
              <div>
                <p className="font-semibold text-muted-foreground">Conversions</p>
                <p>{(lastNightResult.recruits ?? []).length > 0 ? (lastNightResult.recruits ?? []).map((id) => getPlayerName(id)).join(", ") : "None"}</p>
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
        </div>
      </details>
      <div className="flex items-center justify-between gap-2">
        <Button variant="outline" onClick={onBackToPreviousNight}>
          Back to Previous Night
        </Button>
        <div>
          <Button onClick={onBeginDay} disabled={Boolean(winCondition)}>
            Proceed to Day {displayDayNumber}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function DayPhasePanel({
  displayDayNumber,
  alivePlayers,
  effectiveRoleByPlayer,
  dayImmunitySet,
  dayNomineeId,
  onSelectNominee,
  dayPostmanHung,
  dayPostmanTargets,
  postmanDeliveryTargetId,
  onSelectPostmanDeliveryTarget,
  getPlayerName,
  dayError,
  dayInfo,
  onSkipHang,
  onConfirmElimination,
  onStartNight,
  dayEliminationDone,
  winCondition,
  nightNumber,
}: {
  displayDayNumber: number;
  alivePlayers: PlayerEntry[];
  effectiveRoleByPlayer: Record<string, RoleType>;
  dayImmunitySet: Set<string>;
  dayNomineeId: string;
  onSelectNominee: (playerId: string) => void;
  dayPostmanHung: boolean;
  dayPostmanTargets: string[];
  postmanDeliveryTargetId: string;
  onSelectPostmanDeliveryTarget: (playerId: string) => void;
  getPlayerName: (playerId: string) => string;
  dayError: string | null;
  dayInfo: string | null;
  onSkipHang: () => void;
  onConfirmElimination: () => void;
  onStartNight: () => void;
  dayEliminationDone: boolean;
  winCondition: string | null;
  nightNumber: number;
}) {
  return (
    <div className="space-y-4 rounded-xl border border-border/70 bg-background/40 p-4">
      <div>
        <p className="text-base font-semibold">Day {displayDayNumber} - Town Vote</p>
        <p className="text-xs text-muted-foreground">Select a player to eliminate in the town square.</p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {alivePlayers.map((player) => {
          const role = effectiveRoleByPlayer[player.id] ?? "Civilian";
          const immune = dayImmunitySet.has(player.id);
          return (
            <button
              key={`day-vote-${player.id}`}
              type="button"
              onClick={() => onSelectNominee(player.id)}
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
          <p className="text-sm font-semibold">Jester Last Laugh</p>
          <p className="text-xs text-muted-foreground">Jester is being hung. Choose one additional target.</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {dayPostmanTargets.map((id) => (
              <button
                key={`postman-chain-${id}`}
                type="button"
                onClick={() => onSelectPostmanDeliveryTarget(id)}
                className={cn(
                  "rounded-lg border p-3 text-left",
                  postmanDeliveryTargetId === id ? "border-primary bg-primary/10" : "border-border/70 bg-background/50"
                )}
              >
                <p className="font-semibold">{getPlayerName(id)}</p>
                <p className="text-xs text-muted-foreground">{roleLabel(effectiveRoleByPlayer[id] ?? "Civilian")}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {dayError && <div className="rounded-md border border-red-500/50 bg-red-500/10 p-3 text-sm text-red-100">{dayError}</div>}
      {dayInfo && <div className="rounded-md border border-cyan-500/50 bg-cyan-500/10 p-3 text-sm text-cyan-100">{dayInfo}</div>}

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onSkipHang} disabled={dayEliminationDone || Boolean(winCondition)}>
          Skip Hang
        </Button>
        <Button onClick={onConfirmElimination} disabled={dayEliminationDone || Boolean(winCondition)}>
          {dayEliminationDone ? "Elimination Resolved" : "Confirm Elimination"}
        </Button>
        <Button variant="secondary" onClick={onStartNight} disabled={!dayEliminationDone || Boolean(winCondition)}>
          Start Night {nightNumber}
        </Button>
      </div>
    </div>
  );
}

export type DetectivePreview = {
  result: "Innocent" | "Guilty" | null;
  selectedName: string | null;
  resolvedName: string | null;
  resolvedRole: string | null;
  swapAName: string | null;
  swapBName: string | null;
  redirected: boolean;
  blockedByBartender?: boolean;
} | null;

export function AssignmentSlotCard({
  role,
  assignedId,
  assignedName,
  isAssignedDead,
  readOnly,
  emptyLabel,
  onClick,
  converted,
  convertedFromRole,
}: {
  role: RoleType;
  assignedId: string;
  assignedName: string;
  isAssignedDead: boolean;
  readOnly: boolean;
  emptyLabel: string;
  onClick: () => void;
  converted?: boolean;
  convertedFromRole?: RoleType;
}) {
  const RoleIcon = ROLE_ICONS[role];
  return (
    <button
      type="button"
      onClick={onClick}
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
          <span className="text-muted-foreground">+</span>
        )}
      </div>
      {!assignedId && <p className="mt-3 text-sm text-muted-foreground">{readOnly ? "Unassigned" : emptyLabel}</p>}
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

export function RoleAssignmentGrid({
  role,
  count,
  showRoleHeading,
  gridClassName,
  renderSlot,
}: {
  role: RoleType;
  count: number;
  showRoleHeading: boolean;
  gridClassName: string;
  renderSlot: (index: number) => ReactNode;
}) {
  if (count === 0) return null;
  return (
    <div className="space-y-3">
      {showRoleHeading && <p className="text-sm font-semibold">{roleLabel(role)}</p>}
      <div className={gridClassName}>
        {Array.from({ length: count }).map((_, index) => (
          <div key={`${role}-${index}`}>{renderSlot(index)}</div>
        ))}
      </div>
    </div>
  );
}

export function MafiaTeamRosterPanel({
  activeUniqueRoles,
  mafiaCount,
  compactGridForUnique,
  compactGridForMafia,
  renderUniqueRoleCard,
  renderMafiaCard,
}: {
  activeUniqueRoles: RoleType[];
  mafiaCount: number;
  compactGridForUnique: string;
  compactGridForMafia: string;
  renderUniqueRoleCard: (role: RoleType) => ReactNode;
  renderMafiaCard: (index: number) => ReactNode;
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className={compactGridForUnique}>
          {activeUniqueRoles.map((role) => (
            <div key={`${role}-core`} className="space-y-2 rounded-lg border border-border/60 bg-background/50 p-3">
              <p className="text-sm font-semibold">{roleLabel(role)}</p>
              {renderUniqueRoleCard(role)}
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-2 rounded-lg border border-border/60 bg-background/50 p-3">
        <p className="text-sm font-semibold">Mafia Members</p>
        {mafiaCount > 0 ? (
          <div className={compactGridForMafia}>
            {Array.from({ length: mafiaCount }).map((_, index) => (
              <div key={`mafia-${index}`}>{renderMafiaCard(index)}</div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No Mafia members configured.</p>
        )}
      </div>
    </div>
  );
}

export function RivalMafiaRosterPanel({
  rivalCount,
  compactGridClass,
  renderRivalCard,
}: {
  rivalCount: number;
  compactGridClass: string;
  renderRivalCard: (index: number) => ReactNode;
}) {
  return (
    <div className="space-y-4">
      <div className="w-full md:w-fit space-y-2 rounded-lg border border-border/60 bg-background/50 p-3">
        <p className="text-sm font-semibold">Rival Mafia Members</p>
        {rivalCount > 0 ? (
          <div className={compactGridClass}>
            {Array.from({ length: rivalCount }).map((_, index) => (
              <div key={`rival-mafia-${index}`}>{renderRivalCard(index)}</div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No Rival Mafia members configured.</p>
        )}
      </div>
    </div>
  );
}

export function TargetCardsPanel({
  role,
  actionCount,
  activeAbility,
  sectionTitle,
  targetIcon: TargetIcon,
  abilityRoleIcon: AbilityRoleIcon,
  targetGridClass,
  getSlotLabel,
  getDisplayNameForSlot,
  isSlotSelected,
  isSlotDisabled,
  onOpenTargetSlot,
  detectivePreview,
}: {
  role: RoleType;
  actionCount: number;
  activeAbility: RoleAbility | null;
  sectionTitle: string;
  targetIcon: LucideIcon;
  abilityRoleIcon: (props: { className?: string }) => ReactNode;
  targetGridClass: string;
  getSlotLabel: (index: number) => string;
  getDisplayNameForSlot: (index: number) => string | null;
  isSlotSelected: (index: number) => boolean;
  isSlotDisabled: (index: number) => boolean;
  onOpenTargetSlot: (index: number) => void;
  detectivePreview: DetectivePreview;
}) {
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
                <p className="text-sm font-semibold">{activeAbility?.name ?? sectionTitle}</p>
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
          const slotLabel = getSlotLabel(index);
          const targetName = getDisplayNameForSlot(index);
          const disabled = isSlotDisabled(index);
          const selected = isSlotSelected(index);
          return (
            <button
              key={`${role}-target-${index}`}
              type="button"
              onClick={() => {
                if (!disabled) onOpenTargetSlot(index);
              }}
              disabled={disabled}
              className={cn(
                "flex h-40 w-24 sm:h-52 sm:w-36 flex-col items-center justify-center rounded-xl border p-2.5 sm:p-4 text-center transition",
                disabled ? "cursor-not-allowed border-border/60 bg-background/30 opacity-55" : "",
                selected
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
                targetName && <p className="mt-1 w-full break-words text-sm font-semibold leading-tight">{targetName}</p>
              )}
            </button>
          );
        })}
      </div>
      {detectivePreview && (
        <div className="rounded-xl border border-border/70 bg-background/40 p-3">
          {detectivePreview.blockedByBartender ? (
            <>
              <p className="text-sm font-semibold">Result: No result (Drunk)</p>
              <p className="text-xs text-muted-foreground">
                Detective was served by Bartender and gets no investigation result tonight.
                {detectivePreview.redirected && detectivePreview.selectedName && detectivePreview.resolvedName
                  ? ` You selected ${detectivePreview.selectedName}, but Bus Driver redirected the investigation to ${detectivePreview.resolvedName}. Ignore the result because Detective is drunk.`
                  : ""}
              </p>
            </>
          ) : detectivePreview.result ? (
            <>
              <p className="text-sm font-semibold">Result: {detectivePreview.result}</p>
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

export function CurrentNightStepPanel({
  currentRole,
  isTeamStep,
  currentActionCount,
  currentAssignmentCount,
  isNight1,
  getAssignmentPrompt,
  getTeamStepColumnsClass,
  getStepperColumnsClass,
  renderMafiaTeamRoster,
  renderRivalMafiaTeamRoster,
  renderTargetCards,
  renderRoleAssignmentCards,
  roleCounts,
  mafiaRecruitAvailable,
  mafiaRecruitUsed,
  teamOtherAbilities,
  currentOtherAbilities,
  abilityMeta,
  magicianOutOfActions,
  magicianChoice,
  magicianUsedKill,
  magicianUsedSave,
  onMagicianChoiceChange,
  wakeIndex,
  stepOrderLength,
  onPreviousStep,
  onNextStep,
  onCompleteNight,
  currentStepComplete,
  allStepsComplete,
  nightNumber,
}: {
  currentRole: RoleType;
  isTeamStep: boolean;
  currentActionCount: number;
  currentAssignmentCount: number;
  isNight1: boolean;
  getAssignmentPrompt: (role: RoleType) => string;
  getTeamStepColumnsClass: (role: RoleType, assignmentCount: number) => string;
  getStepperColumnsClass: (actionCount: number, assignmentCount: number) => string;
  renderMafiaTeamRoster: (readOnly?: boolean) => ReactNode;
  renderRivalMafiaTeamRoster: (readOnly?: boolean) => ReactNode;
  renderTargetCards: (role: RoleType) => ReactNode;
  renderRoleAssignmentCards: (role: RoleType, options?: { showRoleHeading?: boolean; readOnly?: boolean }) => ReactNode;
  roleCounts: Record<RoleType, number>;
  mafiaRecruitAvailable: boolean;
  mafiaRecruitUsed: boolean;
  teamOtherAbilities: Array<{ sourceRole: RoleType; ability: RoleAbility }>;
  currentOtherAbilities: RoleAbility[];
  abilityMeta: (phase: "Night" | "Night 1" | "Day" | "Any", type: "Active" | "Passive" | "Triggered") => string;
  magicianOutOfActions: boolean;
  magicianChoice?: "kill" | "save" | "none";
  magicianUsedKill: boolean;
  magicianUsedSave: boolean;
  onMagicianChoiceChange: (choice: "kill" | "save" | "none") => void;
  wakeIndex: number;
  stepOrderLength: number;
  onPreviousStep: () => void;
  onNextStep: () => void;
  onCompleteNight: () => void;
  currentStepComplete: boolean;
  allStepsComplete: boolean;
  nightNumber: number;
}) {
  return (
    <div className="space-y-5">
      {isTeamStep ? (
        <div className={getTeamStepColumnsClass(currentRole, currentAssignmentCount)}>
          <div className="min-w-0 w-full md:w-fit space-y-4">
            <div>
              <p className="text-base font-semibold">Role Assignment</p>
              {isNight1 && <p className="text-xs text-muted-foreground">{getAssignmentPrompt(currentRole)}</p>}
              {!isNight1 && <p className="text-xs text-muted-foreground">Assignments are locked after Night 1.</p>}
            </div>
            <div className="space-y-5">
              {currentRole === "Mafia" ? renderMafiaTeamRoster(!isNight1) : renderRivalMafiaTeamRoster(!isNight1)}
            </div>
          </div>

          <div className="min-w-0 space-y-3">
            <div>
              <p className="text-base font-semibold">Abilities</p>
              <p className="text-xs text-muted-foreground">
                {currentRole === "Mafia" ? "Mafia team abilities and passives." : "Rival Mafia team abilities and passives."}
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

            {teamOtherAbilities.map(({ sourceRole, ability }) => {
              const AbilityRoleIcon = ROLE_ICONS[sourceRole];
              return (
                <div key={`${sourceRole}-${ability.name}`} className="space-y-1 rounded-xl border border-border/70 bg-background/40 p-4">
                  <div className="flex items-start gap-2">
                    <span className="grid size-5 shrink-0 place-items-center rounded border border-border/60 bg-background/60">
                      <AbilityRoleIcon className="h-3.5 w-3.5 text-muted-foreground" />
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
              );
            })}
          </div>
        </div>
      ) : (
        <div className={getStepperColumnsClass(currentActionCount, currentAssignmentCount)}>
          <div className="min-w-0 space-y-4 rounded-xl border border-border/70 bg-background/40 p-4">
            <div>
              <p className="text-base font-semibold">Role Assignment</p>
              {isNight1 && <p className="text-xs text-muted-foreground">{getAssignmentPrompt(currentRole)}</p>}
              {!isNight1 && <p className="text-xs text-muted-foreground">Assignments are locked after Night 1.</p>}
            </div>

            {(roleCounts[currentRole] ?? 0) > 0 ? (
              <div>{renderRoleAssignmentCards(currentRole, { readOnly: !isNight1 })}</div>
            ) : (
              <p className="text-sm text-muted-foreground">No players configured for this role.</p>
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
                      <p className="text-xs text-muted-foreground">Vanishing Act and Escape Trick have both been used.</p>
                    </div>
                  ) : (
                    <select
                      value={magicianChoice ?? ""}
                      onChange={(event) => onMagicianChoiceChange(event.target.value as "kill" | "save" | "none")}
                      className="h-11 w-full rounded-xl border border-border/70 bg-background px-3 text-sm font-medium outline-none shadow-sm transition-colors focus-visible:ring-2 focus-visible:ring-ring/40"
                    >
                      <option value="" disabled>
                        Select ability
                      </option>
                      {!magicianUsedKill && <option value="kill">Vanishing Act</option>}
                      {!magicianUsedSave && <option value="save">Escape Trick</option>}
                      <option value="none">No Action</option>
                    </select>
                  )}
                </div>
              )}

              {currentActionCount > 0 ? (
                renderTargetCards(currentRole)
              ) : currentRole === "Magician" && magicianOutOfActions ? null : (
                <p className="text-sm text-muted-foreground">No target selection for this role.</p>
              )}
            </div>

            {currentOtherAbilities.map((ability) => (
              <div key={ability.name} className="space-y-1 rounded-xl border border-border/70 bg-background/40 p-4">
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

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>{wakeIndex > 0 && <Button variant="outline" onClick={onPreviousStep}>Previous</Button>}</div>
        <div>
          {wakeIndex >= stepOrderLength - 1 ? (
            <Button variant="secondary" onClick={onCompleteNight} disabled={!allStepsComplete}>
              End Night {nightNumber}
            </Button>
          ) : (
            <Button onClick={onNextStep} disabled={!currentStepComplete}>
              Next
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export function CurrentNightStepStatusCard({
  currentRole,
  currentStepValidation,
  isRoleSuppressedByRecruit,
  vigilanteLockedOut,
  currentStepComplete,
}: {
  currentRole: RoleType;
  currentStepValidation: { valid: boolean; reason?: string; reasons?: string[] };
  isRoleSuppressedByRecruit: boolean;
  vigilanteLockedOut: boolean;
  currentStepComplete: boolean;
}) {
  return (
    <Card
      className={cn(
        "gap-0 py-0",
        currentStepValidation.valid ? "border-emerald-500/30 bg-emerald-500/5" : "border-red-500/40 bg-red-500/10"
      )}
    >
      <CardContent className="px-3 py-2">
        {(() => {
          const invalidReasons =
            !currentStepValidation.valid
              ? (currentStepValidation.reasons?.filter(Boolean) ?? []).length > 0
                ? (currentStepValidation.reasons?.filter(Boolean) ?? [])
                : [currentStepValidation.reason ?? "This step has invalid selections."]
              : [];
          const statusMessage = currentStepValidation.valid
            ? isRoleSuppressedByRecruit
              ? "This action is intentionally ignored because the role was converted this night."
              : currentRole === "Vigilante" && vigilanteLockedOut
                ? "Vigilante is locked out and cannot act tonight."
                : currentStepComplete
                  ? null
                  : "Ready to continue."
            : invalidReasons.length <= 1
              ? invalidReasons[0]
              : null;

          return (
            <>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Step Status</p>
          <Badge
            variant="outline"
            className={cn(
              "h-6 rounded-md px-2 text-[10px] uppercase tracking-wide",
              currentStepValidation.valid
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                : "border-red-500/50 bg-red-500/10 text-red-300"
            )}
          >
            {currentStepValidation.valid ? (currentStepComplete ? "Complete" : "Valid") : "Action required"}
          </Badge>
        </div>
        {statusMessage && <p className="mt-0.5 text-sm leading-snug text-foreground/90">{statusMessage}</p>}
        {!currentStepValidation.valid && invalidReasons.length > 1 && (
          <ul className="mt-1 space-y-0.5 text-sm leading-snug text-foreground/90">
            {invalidReasons.map((reason) => (
              <li key={reason} className="flex items-start gap-1.5">
                <span className="mt-[0.35rem] h-1 w-1 shrink-0 rounded-full bg-current/70" />
                <span>{reason}</span>
              </li>
            ))}
          </ul>
        )}
        {(isRoleSuppressedByRecruit || (currentRole === "Vigilante" && vigilanteLockedOut)) && (
          <div className="mt-1.5 rounded-md border border-amber-500/40 bg-amber-500/10 px-2.5 py-1.5 text-xs leading-snug text-amber-100">
            {isRoleSuppressedByRecruit
              ? "For secrecy, still wake the role and collect a target, but this action will be ignored."
              : "Vigilante is locked out after killing a Town player. No action can be taken."}
          </div>
        )}
            </>
          );
        })()}
      </CardContent>
    </Card>
  );
}

export function SessionPageShell({
  maxWidthRem,
  header,
  children,
}: {
  maxWidthRem: number | null;
  header: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <SessionBackdrop />
      <div
        className="relative mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 md:px-8 md:py-10"
        style={maxWidthRem ? { maxWidth: `${maxWidthRem}rem` } : undefined}
      >
        {header}
        {children}
      </div>
    </main>
  );
}
