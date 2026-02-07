import type { Alignment, RoleType } from "./types";

export type RoleActionSchema = {
  targetCount: number;
  allowSelf?: boolean;
  optional?: boolean;
  notes?: string;
};

export type RoleAbility = {
  name: string;
  description: string;
  activation: {
    phase: "Night" | "Night 1" | "Day" | "Any";
    type: "Active" | "Passive" | "Triggered";
  };
};

export type RoleDefinition = {
  type: RoleType;
  alignment: Alignment;
  wakeOrder: number | null;
  nightOnly?: "night1";
  action?: RoleActionSchema;
  notes: string;
  abilities: RoleAbility[];
};

// Wake order for nightly prompts (excluding Cupid which is night 1 only).
export const WAKE_ORDER: RoleType[] = [
  "Mafia",
  "RivalMafia",
  "SerialKiller",
  "Bartender",
  "Lawyer",
  "Vigilante",
  "Detective",
  "Doctor",
  "Magician",
  "BusDriver",
];

export const ROLE_DEFINITIONS: Record<RoleType, RoleDefinition> = {
  Civilian: {
    type: "Civilian",
    alignment: "Town",
    wakeOrder: null,
    notes: "A `[Common Citizen]` with no special abilities.",
    abilities: [
      {
        name: "Common Citizen",
        description: "No night ability. Wins with the Town by eliminating hostile factions.",
        activation: { phase: "Any", type: "Passive" },
      },
    ],
  },
  Detective: {
    type: "Detective",
    alignment: "Town",
    wakeOrder: WAKE_ORDER.indexOf("Detective"),
    action: { targetCount: 1 },
    notes: "A determined investigator who relies on `[Investigation]` to uncover the truth.",
    abilities: [
      {
        name: "Investigation",
        description: "Choose one player to learn whether they are aligned with the Mafia.",
        activation: { phase: "Night", type: "Active" },
      },
    ],
  },
  Doctor: {
    type: "Doctor",
    alignment: "Town",
    wakeOrder: WAKE_ORDER.indexOf("Doctor"),
    action: { targetCount: 1, allowSelf: true },
    notes: "A medical professional who protects others using `[Medical Protection]`.",
    abilities: [
      {
        name: "Medical Protection",
        description: "Choose one player to protect from night kills.",
        activation: { phase: "Night", type: "Active" },
      },
      {
        name: "Limited Resources",
        description: "Cannot protect the same player on consecutive nights.",
        activation: { phase: "Any", type: "Passive" },
      },
    ],
  },
  Miller: {
    type: "Miller",
    alignment: "Town",
    wakeOrder: null,
    notes: "An innocent citizen burdened by `[False Suspicion]`, often mistaken for a criminal.",
    abilities: [
      {
        name: "False Suspicion",
        description: "Appears as Mafia when investigated.",
        activation: { phase: "Any", type: "Passive" },
      },
    ],
  },
  Cupid: {
    type: "Cupid",
    alignment: "Town",
    wakeOrder: -1,
    nightOnly: "night1",
    action: { targetCount: 2 },
    notes: "A matchmaker who creates powerful connections through `[Loverâ€™s Bond]`.",
    abilities: [
      {
        name: "Loverâ€™s Bond",
        description: "Choose two players to become Lovers.",
        activation: { phase: "Night 1", type: "Active" },
      },
      {
        name: "Shared Fate",
        description: "If one Lover dies, the other dies immediately.",
        activation: { phase: "Any", type: "Passive" },
      },
    ],
  },
  BusDriver: {
    type: "BusDriver",
    alignment: "Town",
    wakeOrder: WAKE_ORDER.indexOf("BusDriver"),
    action: { targetCount: 2 },
    notes: "A night driver who causes confusion using `[Route Swap]`.",
    abilities: [
      {
        name: "Route Swap",
        description: "Choose two players. All actions targeting one are redirected to the other.",
        activation: { phase: "Night", type: "Active" },
      },
    ],
  },
  UndercoverCop: {
    type: "UndercoverCop",
    alignment: "Town",
    wakeOrder: null,
    notes: "An investigator secretly embedded within the Mafia using `[Deep Cover]`.",
    abilities: [
      {
        name: "Deep Cover",
        description: "Wakes with the Mafia while remaining aligned with the Town.",
        activation: { phase: "Any", type: "Passive" },
      },
      {
        name: "Maintain Cover",
        description: "Cannot publicly reveal identity.",
        activation: { phase: "Any", type: "Passive" },
      },
    ],
  },
  Grandma: {
    type: "Grandma",
    alignment: "Town",
    wakeOrder: null,
    notes: "A protective homeowner who defends her property through `[Home Defense]`.",
    abilities: [
      {
        name: "Home Defense",
        description: "Any player who visits Grandma at night risks being killed in retaliation.",
        activation: { phase: "Any", type: "Passive" },
      },
      {
        name: "Stand Your Ground",
        description: "If targeted by the Mafia, a Mafia member dies instead.",
        activation: { phase: "Any", type: "Passive" },
      },
    ],
  },
  Magician: {
    type: "Magician",
    alignment: "Town",
    wakeOrder: WAKE_ORDER.indexOf("Magician"),
    action: { targetCount: 1, notes: "One kill and one save per game, at night." },
    notes: "A mysterious performer capable of manipulating outcomes through `[Vanishing Act]` and `[Escape Trick]`.",
    abilities: [
      {
        name: "Vanishing Act",
        description: "Choose one player to kill.",
        activation: { phase: "Night", type: "Active" },
      },
      {
        name: "Escape Trick",
        description: "Choose one player to save from a night kill.",
        activation: { phase: "Night", type: "Active" },
      },
    ],
  },
  Postman: {
    type: "Postman",
    alignment: "Neutral",
    wakeOrder: null,
    notes: "A messenger who ensures one final delivery through `[Final Delivery]`.",
    abilities: [
      {
        name: "Final Delivery",
        description: "When the Postman dies, choose one player to die with them.",
        activation: { phase: "Any", type: "Triggered" },
      },
    ],
  },
  Vigilante: {
    type: "Vigilante",
    alignment: "Town",
    wakeOrder: WAKE_ORDER.indexOf("Vigilante"),
    action: { targetCount: 1 },
    notes: "A lone enforcer who delivers justice using `[Single Shot]`.",
    abilities: [
      {
        name: "Single Shot",
        description: "Choose one player to kill.",
        activation: { phase: "Night", type: "Active" },
      },
      {
        name: "Preparation Time",
        description: "Cannot use their ability on Night 1.",
        activation: { phase: "Any", type: "Passive" },
      },
    ],
  },
  Mafia: {
    type: "Mafia",
    alignment: "Mafia",
    wakeOrder: WAKE_ORDER.indexOf("Mafia"),
    action: { targetCount: 1 },
    notes: "A coordinated criminal group that removes threats using `[Mafia Kill]`.",
    abilities: [
      {
        name: "Mafia Kill",
        description: "The Mafia collectively choose one player to kill.",
        activation: { phase: "Night", type: "Active" },
      },
    ],
  },
  Godfather: {
    type: "Godfather",
    alignment: "Mafia",
    wakeOrder: null,
    notes: "The Mafiaâ€™s leader who avoids suspicion through `[Untouchable Reputation]`.",
    abilities: [
      {
        name: "Untouchable Reputation",
        description: "Appears innocent when investigated.",
        activation: { phase: "Any", type: "Passive" },
      },
    ],
  },
  Lawyer: {
    type: "Lawyer",
    alignment: "Mafia",
    wakeOrder: WAKE_ORDER.indexOf("Lawyer"),
    action: { targetCount: 1 },
    notes: "A skilled defender who shields allies using `[Legal Defense]`.",
    abilities: [
      {
        name: "Legal Defense",
        description: "Choose one player to protect from being voted out the next day.",
        activation: { phase: "Night", type: "Active" },
      },
    ],
  },
  MadeMan: {
    type: "MadeMan",
    alignment: "Mafia",
    wakeOrder: null,
    action: { targetCount: 1, notes: "Recruit once per game." },
    notes: "A trusted Mafia member who expands their ranks through `[Recruitment]`.",
    abilities: [
      {
        name: "Recruitment",
        description: "Choose one player to join the Mafia.",
        activation: { phase: "Night", type: "Active" },
      },
    ],
  },
  Bartender: {
    type: "Bartender",
    alignment: "Mafia",
    wakeOrder: WAKE_ORDER.indexOf("Bartender"),
    action: { targetCount: 1 },
    notes: "A manipulative drink server who disrupts others using `[Strong Drink]`.",
    abilities: [
      {
        name: "Strong Drink",
        description: "Choose one player. Their active ability is cancelled for that night.",
        activation: { phase: "Night", type: "Active" },
      },
    ],
  },
  SerialKiller: {
    type: "SerialKiller",
    alignment: "Neutral",
    wakeOrder: WAKE_ORDER.indexOf("SerialKiller"),
    action: { targetCount: 1 },
    notes: "A dangerous individual who hunts alone using `[Night Kill]`.",
    abilities: [
      {
        name: "Night Kill",
        description: "Choose one player to kill.",
        activation: { phase: "Night", type: "Active" },
      },
      {
        name: "Lone Survivor",
        description: "Wins only if they are the last player alive.",
        activation: { phase: "Any", type: "Passive" },
      },
    ],
  },
  RivalMafia: {
    type: "RivalMafia",
    alignment: "RivalMafia",
    wakeOrder: WAKE_ORDER.indexOf("RivalMafia"),
    action: { targetCount: 1 },
    notes: "A competing criminal faction that attacks using `[Rival Kill]`.",
    abilities: [
      {
        name: "Rival Kill",
        description: "Rival Mafia collectively choose one player to kill.",
        activation: { phase: "Night", type: "Active" },
      },
    ],
  },
};

export const ROLE_TYPES = Object.keys(ROLE_DEFINITIONS) as RoleType[];

export function getRoleAlignment(role: RoleType): Alignment {
  return ROLE_DEFINITIONS[role].alignment;
}

const BRACKET_REFERENCE_PATTERN = /[[]([^]]+)[]]/g;

function extractBracketedReferences(text: string): string[] {
  const matches = text.matchAll(BRACKET_REFERENCE_PATTERN);
  return Array.from(matches, (match) => match[1].trim());
}

function validateRoleCopy() {
  const issues: string[] = [];

  for (const role of ROLE_TYPES) {
    const definition = ROLE_DEFINITIONS[role];
    const abilityNames = definition.abilities.map((ability) => ability.name);
    const uniqueAbilityNames = new Set(abilityNames);

    if (abilityNames.length !== uniqueAbilityNames.size) {
      issues.push(`${role}: duplicate ability names detected.`);
    }

    for (const reference of extractBracketedReferences(definition.notes)) {
      if (!uniqueAbilityNames.has(reference)) {
        issues.push(`${role}: summary reference [${reference}] does not match an ability on the same role.`);
      }
    }
  }

  if (issues.length > 0) {
    throw new Error(`Role copy validation failed:\n${issues.join("\n")}`);
  }
}

validateRoleCopy();





