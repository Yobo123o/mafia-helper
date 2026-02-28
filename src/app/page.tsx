"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { buildWakeOrder } from "@/domain/rules";
import { ROLE_DEFINITIONS, ROLE_TYPES, type RoleAbility } from "@/domain/roles";
import {
  ALIGNMENTS,
  ALIGNMENT_LABELS,
  ALIGNMENT_STYLES,
  ROLE_ICONS,
  UNIQUE_ROLES,
  roleLabel,
} from "@/domain/role-presentation";
import type { RoleType } from "@/domain/types";
import {
  clearSession,
  createNightActions,
  createRoleAssignments,
  saveSession,
  type PlayerEntry,
  type SessionState,
} from "@/lib/session";
import { useAutosaveSession, useSavedSession } from "@/hooks/use-session-persistence";
import { useThemePreference } from "@/hooks/use-theme-preference";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

type TooltipMeta = {
  label: string;
  badge: string;
  tone: string;
  description: string;
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function KeywordToken({ text, meta }: { text: string; meta: TooltipMeta }) {
  const tokenRef = useRef<HTMLSpanElement | null>(null);
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  function placeTooltip() {
    const rect = tokenRef.current?.getBoundingClientRect();
    if (!rect) return;
    const left = Math.min(window.innerWidth - 140, Math.max(140, rect.left + rect.width / 2));
    const top = Math.max(8, rect.top - 10);
    setCoords({ top, left });
  }

  function show() {
    placeTooltip();
    setOpen(true);
  }

  function hide() {
    setOpen(false);
  }

  return (
    <>
      <span
        ref={tokenRef}
        className="inline-flex align-baseline"
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
      >
        <Badge
          variant="outline"
          className={cn("h-6 cursor-help rounded-md px-2 text-sm leading-none", meta.badge)}
          tabIndex={0}
        >
          {text}
        </Badge>
      </span>
      {open &&
        createPortal(
          <div
            className={cn(
              "pointer-events-none fixed z-[120] w-72 -translate-x-1/2 -translate-y-full overflow-hidden rounded-lg border bg-popover/95 shadow-xl backdrop-blur-md",
              "animate-in fade-in zoom-in-95 slide-in-from-bottom-1",
              meta.tone
            )}
            style={{ left: coords.left, top: coords.top }}
            role="tooltip"
          >
            <div className="bg-gradient-to-br p-3">
              <div className="mb-1 flex items-center gap-2">
                <Badge variant="outline" className={cn("h-6 rounded-md px-2 text-sm leading-none", meta.badge)}>
                  {meta.label}
                </Badge>
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Reference</span>
              </div>
              <p className="text-sm leading-relaxed text-popover-foreground">{meta.description}</p>
            </div>
            <div className="absolute left-1/2 top-full h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rotate-45 border-b border-r border-border bg-popover/95" />
          </div>,
          document.body
        )}
    </>
  );
}

function RoleReferenceList({ abilities }: { abilities: RoleAbility[] }) {
  if (abilities.length === 0) return null;

  return (
    <div className="mt-1 space-y-2.5">
      {abilities.map((ability) => {
        const activationLabel =
          ability.activation.type === "Passive"
            ? "Passive"
            : `${ability.activation.phase} · ${ability.activation.type}`;
        return (
          <div key={ability.name} className="space-y-1.5 rounded-md border border-border/60 bg-background/30 p-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge
                variant="outline"
                className="h-6 w-fit rounded-md border-amber-500/40 bg-amber-500/15 px-2 text-sm leading-none text-amber-200"
              >
                {ability.name}
              </Badge>
              <Badge
                variant="outline"
                className="h-6 w-fit rounded-md border-border/70 bg-muted/40 px-2 text-sm leading-none text-muted-foreground"
              >
                {activationLabel}
              </Badge>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">{ability.description}</p>
          </div>
        );
      })}
    </div>
  );
}

function RoleDescription({ text, abilities }: { text: string; abilities: RoleAbility[] }) {
  const normalizedText = text.replace(/`[[]([^]]+)[]]`/g, "[$1]");
  const abilityLookup = new Map(
    abilities.map((ability) => [ability.name.toLowerCase(), ability] as const)
  );

  const abilityNames = abilities.map((ability) => ability.name);
  const abilityPattern = abilityNames.length
    ? new RegExp(
        `(?<![A-Za-z0-9])(${abilityNames
          .sort((a, b) => b.length - a.length)
          .map((name) => escapeRegExp(name))
          .join("|")})(?![A-Za-z0-9])`,
        "gi"
      )
    : null;

  function toAbilityMeta(ability: RoleAbility): TooltipMeta {
    return {
      label: ability.name,
      description: ability.description,
      badge: "bg-amber-500/15 text-amber-200 border-amber-500/40",
      tone: "from-amber-500/20 via-amber-500/10 to-transparent border-amber-400/40",
    };
  }

  function renderAbilityMatches(segment: string, keyPrefix: string) {
    if (!abilityPattern) return [<span key={`${keyPrefix}-plain`}>{segment}</span>];

    const parts = segment.split(abilityPattern);
    return parts.map((part, index) => {
      const matchedAbility = abilityLookup.get(part.toLowerCase());
      if (!matchedAbility) {
        return <span key={`${keyPrefix}-${index}`}>{part}</span>;
      }

      return (
        <span key={`${keyPrefix}-${index}`} className="mx-0.5 inline-flex align-baseline">
          <KeywordToken text={matchedAbility.name} meta={toAbilityMeta(matchedAbility)} />
        </span>
      );
    });
  }

  const nodes: ReactNode[] = [];
  const bracketPattern = /[[]([^]]+)[]]/g;
  let cursor = 0;
  let bracketIndex = 0;
  let match = bracketPattern.exec(normalizedText);

  while (match) {
    const [fullMatch, refNameRaw] = match;
    const start = match.index;

    if (start > cursor) {
      nodes.push(...renderAbilityMatches(normalizedText.slice(cursor, start), `segment-${bracketIndex}`));
    }

    const refName = refNameRaw.trim();
    const matchedAbility = abilityLookup.get(refName.toLowerCase());
    if (matchedAbility) {
      nodes.push(
        <span key={`ref-${bracketIndex}`} className="mx-0.5 inline-flex align-baseline">
          <KeywordToken text={matchedAbility.name} meta={toAbilityMeta(matchedAbility)} />
        </span>
      );
    } else {
      nodes.push(<span key={`ref-${bracketIndex}`}>{fullMatch}</span>);
    }

    cursor = start + fullMatch.length;
    bracketIndex += 1;
    match = bracketPattern.exec(normalizedText);
  }

  if (cursor < normalizedText.length) {
    nodes.push(...renderAbilityMatches(normalizedText.slice(cursor), `segment-end`));
  }

  return <p className="text-sm leading-relaxed text-muted-foreground">{nodes}</p>;
}

export default function Home() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("players");
  const [expandedAlignments, setExpandedAlignments] = useState<string[]>([...ALIGNMENTS]);
  const { darkMode, setDarkMode } = useThemePreference();
  const [players, setPlayers] = useState<PlayerEntry[]>([
    { id: crypto.randomUUID(), name: "Player 1" },
    { id: crypto.randomUUID(), name: "Player 2" },
    { id: crypto.randomUUID(), name: "Player 3" },
    { id: crypto.randomUUID(), name: "Player 4" },
    { id: crypto.randomUUID(), name: "Player 5" },
  ]);
  const [sessionActive, setSessionActive] = useState(false);

  const [roleCounts, setRoleCounts] = useState<Record<RoleType, number>>(() => {
    const initial = {} as Record<RoleType, number>;
    for (const role of ROLE_TYPES) initial[role] = 0;
    return initial;
  });

  const savedSession = useSavedSession();

  useEffect(() => {
    const saved = savedSession;
    if (!saved) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (saved.players) setPlayers(saved.players);
    if (saved.roleCounts) setRoleCounts(saved.roleCounts);
    setSessionActive(saved.sessionActive);
  }, [savedSession]);

  const draftSession = useMemo<SessionState | null>(() => {
    if (sessionActive) return null;
    return {
      players,
      roleCounts,
      nightNumber: 1,
      nightInProgress: false,
      wakeIndex: 0,
      sessionActive: false,
      roleAssignments: createRoleAssignments(ROLE_TYPES),
      nightActions: createNightActions(ROLE_TYPES),
      deadPlayerIds: [],
    };
  }, [players, roleCounts, sessionActive]);

  useAutosaveSession(draftSession);

  const totalPlayers = players.length;
  const namedPlayers = players.filter((player) => player.name.trim().length > 0).length;
  const playersReady = totalPlayers > 0 && namedPlayers === totalPlayers;

  const selectedRoles = useMemo(
    () => ROLE_TYPES.filter((role) => roleCounts[role] > 0),
    [roleCounts]
  );

  const totalRoles = useMemo(
    () => ROLE_TYPES.reduce((total, role) => total + roleCounts[role], 0),
    [roleCounts]
  );

  const rolesReady = totalRoles === totalPlayers && totalRoles > 0;
  const roleSlotsDelta = totalPlayers - totalRoles;
  const setupProgress = useMemo(() => {
    let score = 0;
    if (playersReady) score += 50;
    if (rolesReady) score += 50;
    return score;
  }, [playersReady, rolesReady]);

  const wakeOrder = useMemo(
    () => buildWakeOrder(selectedRoles, { nightNumber: 1 }),
    [selectedRoles]
  );
  const reviewBlockers = useMemo(() => {
    const blockers: string[] = [];
    if (!playersReady) blockers.push("Name all player seats.");
    if (!rolesReady) {
      if (roleSlotsDelta > 0) blockers.push(`Add ${roleSlotsDelta} more role slot${roleSlotsDelta === 1 ? "" : "s"}.`);
      if (roleSlotsDelta < 0) blockers.push(`Remove ${Math.abs(roleSlotsDelta)} role slot${Math.abs(roleSlotsDelta) === 1 ? "" : "s"}.`);
      if (roleSlotsDelta === 0 && totalPlayers === 0) blockers.push("Add players and roles before starting.");
    }
    return blockers;
  }, [playersReady, roleSlotsDelta, rolesReady, totalPlayers]);

  function updatePlayerName(id: string, name: string) {
    setPlayers((current) => current.map((player) => (player.id === id ? { ...player, name } : player)));
  }

  function addPlayer() {
    setPlayers((current) => [
      ...current,
      { id: crypto.randomUUID(), name: `Player ${current.length + 1}` },
    ]);
  }

  function applyQuickTestSetup() {
    setPlayers(
      ROLE_TYPES.map((_, index) => ({
        id: crypto.randomUUID(),
        name: `Test Player ${index + 1}`,
      }))
    );
    setRoleCounts(() => {
      const next = {} as Record<RoleType, number>;
      for (const role of ROLE_TYPES) next[role] = 1;
      return next;
    });
  }

  function removePlayer(id: string) {
    setPlayers((current) => current.filter((player) => player.id !== id));
  }

  function updateRoleCount(role: RoleType, delta: number) {
    setRoleCounts((current) => {
      const roleLimit = UNIQUE_ROLES.has(role) ? 1 : 99;
      const currentTotal = ROLE_TYPES.reduce((sum, key) => sum + current[key], 0);
      const totalWithoutRole = currentTotal - current[role];
      const maxForRole = Math.min(roleLimit, Math.max(0, totalPlayers - totalWithoutRole));
      const next = Math.max(0, Math.min(maxForRole, (current[role] ?? 0) + delta));
      return { ...current, [role]: next };
    });
  }

  function setRoleCount(role: RoleType, value: number) {
    setRoleCounts((current) => {
      const roleLimit = UNIQUE_ROLES.has(role) ? 1 : 99;
      const currentTotal = ROLE_TYPES.reduce((sum, key) => sum + current[key], 0);
      const totalWithoutRole = currentTotal - current[role];
      const maxForRole = Math.min(roleLimit, Math.max(0, totalPlayers - totalWithoutRole));
      const next = Math.max(0, Math.min(maxForRole, value));
      return { ...current, [role]: next };
    });
  }

  function clearAllRoles() {
    setRoleCounts((current) => {
      const next = { ...current };
      for (const role of ROLE_TYPES) next[role] = 0;
      return next;
    });
  }

  function startSession() {
    const state: SessionState = {
      players,
      roleCounts,
      nightNumber: 1,
      nightInProgress: false,
      wakeIndex: 0,
      sessionActive: true,
      roleAssignments: createRoleAssignments(ROLE_TYPES),
      nightActions: createNightActions(ROLE_TYPES),
      deadPlayerIds: [],
    };
    saveSession(state);
    setSessionActive(true);
    router.push("/session");
  }

  function resumeSession() {
    router.push("/session");
  }

  function endSession() {
    setSessionActive(false);
    clearSession();
    const draft: SessionState = {
      players,
      roleCounts,
      nightNumber: 1,
      nightInProgress: false,
      wakeIndex: 0,
      sessionActive: false,
      roleAssignments: createRoleAssignments(ROLE_TYPES),
      nightActions: createNightActions(ROLE_TYPES),
      deadPlayerIds: [],
    };
    saveSession(draft);
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-28 top-8 h-72 w-72 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="absolute right-0 top-1/3 h-80 w-80 rounded-full bg-amber-500/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-64 w-64 rounded-full bg-red-500/10 blur-3xl" />
      </div>

      <div className="relative mx-auto flex w-full max-w-[1700px] flex-col gap-6 px-4 py-6 md:px-8 md:py-10">
        <header className="rounded-2xl border border-border/60 bg-card/60 p-4 backdrop-blur md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1.5">
              <h1 className="text-2xl font-semibold tracking-tight md:text-4xl">Mafia Moderator Setup</h1>
              <p className="max-w-2xl text-sm text-muted-foreground md:text-base">
                Configure players and roles, then launch the session.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 rounded-full border border-border bg-muted/40 px-3 py-2">
                <Label htmlFor="theme" className="text-xs text-muted-foreground">
                  Theme
                </Label>
                <Badge variant="outline" className="rounded-full text-[10px] uppercase tracking-wide">
                  {darkMode ? "Dark" : "Light"}
                </Badge>
                <Switch
                  id="theme"
                  checked={darkMode}
                  onCheckedChange={setDarkMode}
                />
              </div>

              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="secondary">Rules</Button>
                </SheetTrigger>
                <SheetContent className="w-full sm:max-w-xl">
                  <SheetHeader>
                    <SheetTitle>Moderator Quick Rules</SheetTitle>
                    <SheetDescription>Condensed reference for night facilitation.</SheetDescription>
                  </SheetHeader>
                  <ScrollArea className="mt-6 h-[75vh] pr-4">
                    <div className="space-y-5 text-sm">
                      <div>
                        <p className="font-semibold">Night wake order</p>
                        <p className="text-muted-foreground">
                          Night 1 starts with Cupid, then: Bus Driver, Mafia Team, Rival Mafia Team, Bartender, Lawyer, Vigilante, Doctor, Magician, Jester, Grandma, Detective.
                        </p>
                      </div>
                      <div>
                        <p className="font-semibold">Engine resolution order</p>
                        <p className="text-muted-foreground">
                          Target modifiers, ability blocks, protection, kills, passive effects, investigations.
                        </p>
                      </div>
                      <div>
                        <p className="font-semibold">Critical role constraints</p>
                        <p className="text-muted-foreground">
                          Doctor cannot save the same target on consecutive nights. Vigilante cannot shoot Night 1.
                          Cupid only acts on Night 1.
                        </p>
                      </div>
                    </div>
                  </ScrollArea>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,4fr)_minmax(260px,1fr)] xl:grid-cols-[minmax(0,5fr)_300px]">
          <Card className="border-border/60 bg-card/70 backdrop-blur">
            <CardHeader>
              <CardTitle>Game Setup</CardTitle>
              <CardDescription>Players, roles, and launch check.</CardDescription>
              <Progress value={setupProgress} className="mt-4" />
            </CardHeader>
            <CardContent>
              <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-5">
                <TabsList className="grid h-auto w-full grid-cols-3 gap-2 bg-muted/50 p-1">
                  <TabsTrigger value="players">1. Players</TabsTrigger>
                  <TabsTrigger value="roles">2. Roles</TabsTrigger>
                  <TabsTrigger value="review">3. Review</TabsTrigger>
                </TabsList>

                <TabsContent value="players" className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm text-muted-foreground">Name each seat.</p>
                    <Badge variant={playersReady ? "default" : "secondary"}>
                      {namedPlayers}/{totalPlayers} ready
                    </Badge>
                  </div>
                  {!playersReady && (
                    <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
                      All seats need names before continuing.
                    </div>
                  )}

                  <div className="grid gap-3">
                    {players.map((player, index) => (
                      <div
                        key={player.id}
                        className="grid gap-2 rounded-xl border border-border/70 bg-background/50 p-3 md:grid-cols-[90px_1fr_auto] md:items-center"
                      >
                        <Badge variant="outline" className="justify-center">
                          Seat {index + 1}
                        </Badge>
                        <Input
                          value={player.name}
                          onChange={(event) => updatePlayerName(player.id, event.target.value)}
                          placeholder="Enter player name"
                        />
                        <Button
                          variant="destructive"
                          onClick={() => removePlayer(player.id)}
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button onClick={addPlayer}>Add Player</Button>
                    <Button variant="outline" onClick={applyQuickTestSetup}>
                      Quick Test Fill
                    </Button>
                  </div>
                </TabsContent>

                <TabsContent value="roles" className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm text-muted-foreground">
                      Total selected roles must match player count.
                    </p>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" onClick={clearAllRoles} disabled={totalRoles === 0}>
                        Clear Roles
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setExpandedAlignments([...ALIGNMENTS])}>
                        Expand All
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setExpandedAlignments([])}>
                        Collapse All
                      </Button>
                      <Badge variant={rolesReady ? "default" : "secondary"}>
                        {totalRoles}/{totalPlayers} assigned
                      </Badge>
                    </div>
                  </div>
                  {!rolesReady && totalPlayers > 0 && (
                    <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
                      {roleSlotsDelta > 0
                        ? `Add ${roleSlotsDelta} more role slot${roleSlotsDelta === 1 ? "" : "s"}.`
                        : roleSlotsDelta < 0
                          ? `Remove ${Math.abs(roleSlotsDelta)} role slot${Math.abs(roleSlotsDelta) === 1 ? "" : "s"}.`
                          : "Role total must match player count."}
                    </div>
                  )}

                  <Accordion
                    type="multiple"
                    value={expandedAlignments}
                    onValueChange={(value) => setExpandedAlignments(value)}
                    className="space-y-4 pb-1"
                  >
                    {ALIGNMENTS.map((alignment) => (
                      <AccordionItem
                        key={alignment}
                        value={alignment}
                        className="border-0"
                      >
                        <section
                          className={cn(
                            "rounded-xl border bg-background/50 p-4",
                            ALIGNMENT_STYLES[alignment].border
                          )}
                        >
                          <AccordionTrigger className="py-0 hover:no-underline">
                            <div className="mb-3 flex w-full items-center justify-between pr-2">
                              <div className="flex items-center gap-2">
                                <span
                                  className={cn(
                                    "h-2 w-2 rounded-full",
                                    ALIGNMENT_STYLES[alignment].glow
                                  )}
                                />
                                <span className="text-sm font-semibold tracking-wide">
                                  {ALIGNMENT_LABELS[alignment]}
                                </span>
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {
                                  ROLE_TYPES.filter(
                                    (role) => ROLE_DEFINITIONS[role].alignment === alignment
                                  ).reduce((sum, role) => sum + roleCounts[role], 0)
                                }{" "}
                                selected
                              </span>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent>
                            <div className="grid gap-2.5 pb-1 md:grid-cols-2 xl:grid-cols-3 xl:auto-rows-fr">
                            {ROLE_TYPES.filter((role) => ROLE_DEFINITIONS[role].alignment === alignment).map((role) => {
                                const count = roleCounts[role];
                                const unique = UNIQUE_ROLES.has(role);
                                const usedByOthers = totalRoles - count;
                                const availableForRole = Math.max(0, totalPlayers - usedByOthers);
                                const maxForRole = Math.min(unique ? 1 : 99, availableForRole);
                                const roleNotes = ROLE_DEFINITIONS[role].notes;
                                const RoleIcon = ROLE_ICONS[role];

                                return (
                                  <div
                                    key={role}
                                    className={cn(
                                      "group relative h-full w-full min-w-0 overflow-hidden rounded-2xl border-2 bg-gradient-to-b p-1 shadow-md transition-colors md:min-h-[440px] xl:min-h-[490px]",
                                      ALIGNMENT_STYLES[alignment].border
                                    )}
                                  >
                                    <div className="flex h-full flex-col rounded-[14px] border border-border/70 bg-card/85 p-2.5">
                                      <div className="rounded-md border border-border/70 bg-background/70 px-2.5 py-2">
                                        <div className="flex items-start justify-between gap-2">
                                          <p className="text-base font-semibold leading-tight">{roleLabel(role)}</p>
                                          <div className="flex items-center gap-1.5">
                                            <Badge
                                              variant="outline"
                                              className={cn("h-6 px-2 text-sm leading-none", ALIGNMENT_STYLES[alignment].badge)}
                                            >
                                              {ALIGNMENT_LABELS[alignment]}
                                            </Badge>
                                            {unique && (
                                              <Badge variant="secondary" className="h-6 px-2 text-sm leading-none">
                                                Unique
                                              </Badge>
                                            )}
                                          </div>
                                        </div>
                                      </div>

                                      <div
                                        className={cn(
                                          "mt-2 rounded-md border bg-gradient-to-b from-background/70 to-muted/30 p-2",
                                          ALIGNMENT_STYLES[alignment].border
                                        )}
                                      >
                                        <div className="grid min-h-[92px] place-items-center rounded border border-border/50 bg-background/40">
                                          <RoleIcon
                                            className={cn("block h-11 w-11 shrink-0", ALIGNMENT_STYLES[alignment].text)}
                                          />
                                        </div>
                                      </div>

                                      <div className="mt-2 flex-1 rounded-md border border-border/60 bg-background/55 p-2.5">
                                        <div className="space-y-2">
                                          <RoleDescription text={roleNotes} abilities={ROLE_DEFINITIONS[role].abilities} />
                                        </div>

                                        <Separator className="my-2" />

                                        <div className="min-h-[96px] space-y-2">
                                          <div className="flex items-center justify-between">
                                            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Abilities</p>
                                          </div>
                                          {ROLE_DEFINITIONS[role].abilities.length > 0 ? (
                                            <RoleReferenceList abilities={ROLE_DEFINITIONS[role].abilities} />
                                          ) : (
                                            <p className="text-sm text-muted-foreground">No special abilities.</p>
                                          )}
                                        </div>
                                      </div>

                                      <div className="mt-2 flex shrink-0 items-center justify-end gap-2 rounded-md border border-border/60 bg-background/70 px-2 py-2">
                                        {!unique && (
                                          <Button size="icon" variant="outline" onClick={() => updateRoleCount(role, -1)}>
                                            -
                                          </Button>
                                        )}
                                        {!unique && (
                                          <Input
                                            type="number"
                                            min={0}
                                            max={maxForRole}
                                            className="w-14 text-center"
                                            value={count}
                                            onChange={(event) => setRoleCount(role, Number(event.target.value) || 0)}
                                          />
                                        )}
                                        {!unique && (
                                          <Button
                                            size="icon"
                                            variant="outline"
                                            disabled={count >= maxForRole}
                                            onClick={() => updateRoleCount(role, 1)}
                                          >
                                            +
                                          </Button>
                                        )}
                                        {unique && (
                                          <Button
                                            variant={count === 1 ? "default" : "outline"}
                                            disabled={count === 0 && maxForRole === 0}
                                            onClick={() => setRoleCount(role, count === 1 ? 0 : 1)}
                                          >
                                            {count === 1 ? "Included" : "Include"}
                                          </Button>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </AccordionContent>
                        </section>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </TabsContent>

                <TabsContent value="review" className="space-y-4">
                  <Card className="bg-background/50">
                    <CardHeader>
                      <CardTitle className="text-base">{reviewBlockers.length === 0 ? "Ready to Launch" : "Before You Start"}</CardTitle>
                      <CardDescription>
                        {reviewBlockers.length === 0
                          ? "Setup is complete. You can launch the moderator session."
                          : "Resolve these items before starting the game."}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      {reviewBlockers.length === 0 ? (
                        <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-emerald-100">
                          Ready to start.
                        </div>
                      ) : (
                        <ul className="space-y-1">
                          {reviewBlockers.map((blocker) => (
                            <li key={blocker} className="flex items-start gap-2">
                              <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-current/70" />
                              <span>{blocker}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                      <div className="rounded-md border border-border/60 bg-background/40 px-3 py-2">
                        First wake call: <span className="font-semibold">{wakeOrder[0] ? roleLabel(wakeOrder[0]) : "N/A"}</span>
                      </div>
                    </CardContent>
                  </Card>

                  <div className="grid gap-4 md:grid-cols-2">
                    <Card className="bg-background/50">
                      <CardHeader>
                        <CardTitle className="text-base">Players</CardTitle>
                        <CardDescription>{totalPlayers} seats</CardDescription>
                      </CardHeader>
                      <CardContent className="flex flex-wrap gap-2">
                        {players.map((player) => (
                          <Badge key={player.id} variant="secondary">
                            {player.name.trim() || "Unnamed"}
                          </Badge>
                        ))}
                      </CardContent>
                    </Card>

                    <Card className="bg-background/50">
                      <CardHeader>
                        <CardTitle className="text-base">Roles In Play</CardTitle>
                        <CardDescription>{totalRoles} total role cards</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {selectedRoles.length === 0 && (
                          <p className="text-sm text-muted-foreground">No roles selected yet.</p>
                        )}
                        {selectedRoles.map((role) => (
                          <div key={role} className="flex items-center justify-between text-sm">
                            <span>{roleLabel(role)}</span>
                            <span className="font-semibold">x{roleCounts[role]}</span>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  </div>

                  <div className="grid gap-2 md:grid-cols-2">
                    <Button
                      className="w-full"
                      disabled={!playersReady || !rolesReady}
                      onClick={sessionActive ? resumeSession : startSession}
                    >
                      {sessionActive ? "Resume Session" : "Start Game Session"}
                    </Button>
                    <Button
                      className="w-full"
                      variant="outline"
                      disabled={!sessionActive}
                      onClick={endSession}
                    >
                      End Session
                    </Button>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="border-border/60 bg-card/70 backdrop-blur">
              <CardHeader>
                <CardTitle>Step Guide</CardTitle>
                <CardDescription>
                  {activeTab === "players"
                    ? "Seat the table before choosing roles."
                    : activeTab === "roles"
                      ? "Build the role pool and explain roles as needed."
                      : "Confirm the setup and launch the moderator session."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="rounded-md border border-border/60 bg-background/40 px-3 py-2">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    {activeTab === "players" ? "Step 1" : activeTab === "roles" ? "Step 2" : "Step 3"}
                  </p>
                  <p className="mt-1 font-medium">
                    {activeTab === "players"
                      ? "Add and name each player seat."
                      : activeTab === "roles"
                        ? "Select roles until totals match the player count."
                        : "Review and launch the game session."}
                  </p>
                </div>
                <div className="space-y-2">
                  {activeTab === "players" && (
                    <div className="flex items-center justify-between rounded-md border border-border/60 bg-background/40 px-3 py-2">
                      <span className="text-muted-foreground">Seats named</span>
                      <Badge variant={playersReady ? "default" : "secondary"}>{namedPlayers}/{totalPlayers}</Badge>
                    </div>
                  )}
                  {activeTab === "roles" && (
                    <div className="flex items-center justify-between rounded-md border border-border/60 bg-background/40 px-3 py-2">
                      <span className="text-muted-foreground">Role slots</span>
                      <Badge variant={rolesReady ? "default" : "secondary"}>{totalRoles}/{totalPlayers}</Badge>
                    </div>
                  )}
                  {activeTab === "review" && (
                    <div className="flex items-center justify-between rounded-md border border-border/60 bg-background/40 px-3 py-2">
                      <span className="text-muted-foreground">Launch status</span>
                      <Badge variant={reviewBlockers.length === 0 ? "default" : "secondary"}>
                        {reviewBlockers.length === 0 ? "Ready" : `${reviewBlockers.length} blocker${reviewBlockers.length === 1 ? "" : "s"}`}
                      </Badge>
                    </div>
                  )}
                </div>
                <Separator />
                <div className="space-y-1.5 text-sm text-muted-foreground">
                  {activeTab === "players" && <p>Next: choose the roles for this game.</p>}
                  {activeTab === "roles" && <p>Use the role cards to explain abilities before the game starts.</p>}
                  {activeTab === "review" && (
                    <p>{reviewBlockers.length === 0 ? "Session can be launched now." : "Fix blockers, then start the session."}</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {(activeTab === "roles" || activeTab === "review") && (
            <Card className="border-border/60 bg-card/70 backdrop-blur">
              <CardHeader>
                <CardTitle>Wake Order</CardTitle>
                <CardDescription>
                  {activeTab === "roles" ? "Preview for Night 1 based on the current role pool." : "Final Night 1 wake sequence."}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-60 pr-3">
                  <div className="space-y-2">
                    {wakeOrder.length === 0 && (
                      <p className="text-sm text-muted-foreground">Add roles to preview the wake order.</p>
                    )}
                    {wakeOrder.map((role, index) => (
                      <div
                        key={`${role}-${index}`}
                        className="flex items-center justify-between rounded-md border border-border/70 bg-background/50 px-3 py-2 text-sm"
                      >
                        <span>{index + 1}</span>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{roleLabel(role)}</span>
                          {role === "Cupid" && (
                            <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                              Night 1 Only
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
