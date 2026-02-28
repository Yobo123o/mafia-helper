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
  "BusDriver",
  "Mafia",
  "RivalMafia",
  "Bartender",
  "Lawyer",
  "Vigilante",
  "Doctor",
  "Magician",
  "Postman",
  "Grandma",
  "Detective",
];

export const ROLE_DEFINITIONS: Record<RoleType, RoleDefinition> = {
  Civilian: {
    type: "Civilian",
    alignment: "Town",
    wakeOrder: null,
    notes: "An ordinary townsperson with no special night action, relying on discussion and deduction to survive.",
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
    notes: "A sharp-eyed investigator who works the night for clues and quietly tests who can be trusted.",
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
    notes: "A field medic who can keep someone alive through the night, but cannot guard the same person twice in a row.",
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
    notes: "A loyal town member with a suspicious reputation, often read the wrong way by investigators.",
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
    notes: "A matchmaker who ties two players together on the first night, binding their fates for the rest of the game.",
    abilities: [
      {
        name: "Lover's Bond",
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
    notes: "A chaos agent behind the wheel who can reroute the night by swapping where actions land.",
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
    notes: "A town operative embedded with both criminal factions who wakes with them while secretly feeding the Town information.",
    abilities: [
      {
        name: "Deep Cover",
        description: "Undercover Cop wakes with both Mafia teams while remaining aligned with the Town.",
        activation: { phase: "Any", type: "Passive" },
      },
      {
        name: "Maintain Cover",
        description: "Undercover Cop cannot publicly reveal their identity.",
        activation: { phase: "Any", type: "Passive" },
      },
    ],
  },
  Grandma: {
    type: "Grandma",
    alignment: "Town",
    wakeOrder: WAKE_ORDER.indexOf("Grandma"),
    notes: "A dangerous homeowner whose late-night visitors may not make it back out.",
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
    notes: "A stage magician with two one-time tricks: one to make someone disappear, and one to pull someone out of danger.",
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
    wakeOrder: WAKE_ORDER.indexOf("Postman"),
    notes: "A chaotic wildcard who can turn a public execution into one final act of revenge.",
    abilities: [
      {
        name: "Last Laugh",
        description: "If the Jester is hung during the day, choose one player to die with them.",
        activation: { phase: "Day", type: "Triggered" },
      },
    ],
  },
  Vigilante: {
    type: "Vigilante",
    alignment: "Town",
    wakeOrder: WAKE_ORDER.indexOf("Vigilante"),
    action: { targetCount: 1 },
    notes: "A lone gun who can act outside the law, but must live with the consequences of a bad shot.",
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
    notes: "The main Mafia crew, coordinating in the dark to remove one target each night.",
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
    notes: "The head of the Mafia, polished enough to look clean even under investigation.",
    abilities: [
      {
        name: "Untouchable Reputation",
        description: "Appears innocent when investigated.",
        activation: { phase: "Any", type: "Passive" },
      },
    ],
  },
  RivalGodfather: {
    type: "RivalGodfather",
    alignment: "RivalMafia",
    wakeOrder: null,
    notes: "The rival syndicate boss, calm under pressure and hard to expose through investigation.",
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
    notes: "A silver-tongued defender who can keep one player from being eliminated during the next day.",
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
    notes: "A trusted Mafia lieutenant who can pressure one player into joining the family once per game.",
    abilities: [
      {
        name: "Recruitment",
        description: "Made Man blackmails one player to join the Mafia once per game.",
        activation: { phase: "Night", type: "Active" },
      },
    ],
  },
  Bartender: {
    type: "Bartender",
    alignment: "Mafia",
    wakeOrder: WAKE_ORDER.indexOf("Bartender"),
    action: { targetCount: 1 },
    notes: "A smooth bartender who can shut down another player's active ability for the night.",
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
    wakeOrder: null,
    action: { targetCount: 1 },
    notes: "A lone predator stalking the table, with no allies and no victory except being the last one standing.",
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
    notes: "A rival syndicate competing with the Mafia and the Town, striking their own target each night.",
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

export function getDetectiveResultForRole(role: RoleType): "Innocent" | "Guilty" {
  if (role === "Godfather" || role === "RivalGodfather") return "Innocent";
  if (role === "Miller") return "Guilty";
  if (role === "SerialKiller") return "Guilty";
  const alignment = getRoleAlignment(role);
  return alignment === "Mafia" || alignment === "RivalMafia" ? "Guilty" : "Innocent";
}

const BRACKET_REFERENCE_PATTERN = /[[]([^]]+)[]]/g;

function extractBracketedReferences(text: string): string[] {
  const matches = text.matchAll(BRACKET_REFERENCE_PATTERN);
  return Array.from(matches, (match) => match[1].trim());
}

function validateRoleDefinitions() {
  const issues: string[] = [];
  const wakeOrderSet = new Set<RoleType>();

  for (const role of WAKE_ORDER) {
    if (wakeOrderSet.has(role)) {
      issues.push(`WAKE_ORDER: duplicate role ${role}.`);
      continue;
    }
    wakeOrderSet.add(role);
    if (!ROLE_DEFINITIONS[role]) {
      issues.push(`WAKE_ORDER: unknown role ${role}.`);
    }
  }

  for (const role of ROLE_TYPES) {
    const definition = ROLE_DEFINITIONS[role];

    if (definition.type !== role) {
      issues.push(`${role}: definition.type must match object key.`);
    }

    const expectedWakeIndex = WAKE_ORDER.indexOf(role);
    if (role === "Cupid") {
      if (definition.wakeOrder !== -1) {
        issues.push("Cupid: wakeOrder must be -1 (special Night 1 setup slot).");
      }
      if (definition.nightOnly !== "night1") {
        issues.push("Cupid: nightOnly must be 'night1'.");
      }
    } else if (expectedWakeIndex >= 0) {
      if (definition.wakeOrder !== expectedWakeIndex) {
        issues.push(`${role}: wakeOrder should equal WAKE_ORDER index ${expectedWakeIndex}.`);
      }
    } else if (definition.wakeOrder !== null) {
      issues.push(`${role}: wakeOrder must be null when role is not in WAKE_ORDER.`);
    }

    if (definition.action) {
      const { targetCount } = definition.action;
      if (!Number.isInteger(targetCount) || targetCount < 1) {
        issues.push(`${role}: action.targetCount must be a positive integer.`);
      }
    }

    if (definition.abilities.length === 0) {
      issues.push(`${role}: at least one ability entry is required.`);
    }

    for (const ability of definition.abilities) {
      if (!ability.name.trim()) issues.push(`${role}: ability name cannot be empty.`);
      if (!ability.description.trim()) issues.push(`${role}: ability '${ability.name}' description cannot be empty.`);
      if (ability.activation.phase === "Night 1" && ability.activation.type === "Passive") {
        issues.push(`${role}: ability '${ability.name}' should not be marked 'Night 1' + Passive.`);
      }
    }
  }

  if (issues.length > 0) {
    throw new Error(`Role definition validation failed:\n${issues.join("\n")}`);
  }
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

validateRoleDefinitions();
validateRoleCopy();
