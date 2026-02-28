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
  | "RivalGodfather"
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
  Postman: { usedDelivery: boolean };
  Vigilante: { usedShot: boolean; lockedOut: boolean; pendingLockout?: boolean };
  Mafia: EmptyState;
  Godfather: EmptyState;
  RivalGodfather: EmptyState;
  Lawyer: { lastDefendedPlayerId?: string };
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
    choice?: "kill" | "save" | "none";
  };
};

export type InvestigationResult = {
  actorRole: RoleType;
  targetId: string;
  result: "Innocent" | "Guilty";
};

export type DeathDetail = {
  playerId: string;
  causes: string[];
};

export type RecruitDetail = {
  playerId: string;
  fromRole: RoleType;
};

export type NightResult = {
  deaths: string[];
  deathDetails?: DeathDetail[];
  saves: string[];
  blocked: RoleType[];
  investigations: InvestigationResult[];
  busSwaps?: Array<{ a: string; b: string }>;
  dayImmunities?: string[];
  recruits?: string[];
  recruitDetails?: RecruitDetail[];
  loverPairsCreated?: string[];
  notes: string[];
};
