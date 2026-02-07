export type Alignment = "Town" | "Mafia" | "RivalMafia" | "Neutral";

export type RoleType =
  | "Civilian"
  | "Detective"
  | "Doctor"
  | "Miller"
  | "Cupid"
  | "BusDriver"
  | "UndercoverCop"
  | "Grandma"
  | "Magician"
  | "Postman"
  | "Vigilante"
  | "Mafia"
  | "Godfather"
  | "Lawyer"
  | "MadeMan"
  | "Bartender"
  | "SerialKiller"
  | "RivalMafia";

export type Phase = "setup" | "night" | "day" | "ended";

export type Player = {
  id: string;
  name: string;
  alive: boolean;
  role?: RoleType;
  tags?: {
    loverPairId?: string;
  };
};

type EmptyState = Record<string, never>;

export type RoleStateMap = {
  Civilian: EmptyState;
  Detective: EmptyState;
  Doctor: { lastSavedPlayerId?: string };
  Miller: EmptyState;
  Cupid: { used: boolean; loverPairId?: string };
  BusDriver: EmptyState;
  UndercoverCop: EmptyState;
  Grandma: EmptyState;
  Magician: { usedKill: boolean; usedSave: boolean };
  Postman: EmptyState;
  Vigilante: { usedShot: boolean; lockedOut: boolean };
  Mafia: EmptyState;
  Godfather: EmptyState;
  Lawyer: EmptyState;
  MadeMan: { usedRecruit: boolean };
  Bartender: EmptyState;
  SerialKiller: EmptyState;
  RivalMafia: EmptyState;
};

export type RoleState = RoleStateMap[RoleType];

export type GameConfig = {
  players: Player[];
  rolesInPlay: RoleType[];
};

export type GameState = {
  phase: Phase;
  nightNumber: number;
  dayNumber: number;
  roleStates: RoleStateMap;
};

export type NightAction = {
  role: RoleType;
  actorId?: string;
  targetIds: string[];
  metadata?: {
    choice?: "kill" | "save";
  };
};

export type InvestigationResult = {
  actorRole: RoleType;
  targetId: string;
  result: "Innocent" | "Mafia";
};

export type NightResult = {
  deaths: string[];
  saves: string[];
  blocked: RoleType[];
  investigations: InvestigationResult[];
  notes: string[];
};
