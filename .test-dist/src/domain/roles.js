"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ROLE_TYPES = exports.ROLE_DEFINITIONS = exports.WAKE_ORDER = void 0;
exports.getRoleAlignment = getRoleAlignment;
exports.getDetectiveResultForRole = getDetectiveResultForRole;
// Wake order for nightly prompts (excluding Cupid which is night 1 only).
exports.WAKE_ORDER = [
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
exports.ROLE_DEFINITIONS = {
    Civilian: {
        type: "Civilian",
        alignment: "Town",
        wakeOrder: null,
        notes: "A Common Citizen with no special abilities.",
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
        wakeOrder: exports.WAKE_ORDER.indexOf("Detective"),
        action: { targetCount: 1 },
        notes: "A determined investigator who relies on Investigation to uncover the truth.",
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
        wakeOrder: exports.WAKE_ORDER.indexOf("Doctor"),
        action: { targetCount: 1, allowSelf: true },
        notes: "A medical professional who protects others using Medical Protection.",
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
        notes: "An innocent citizen burdened by False Suspicion, often mistaken for a criminal.",
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
        notes: "A matchmaker who creates powerful connections through Lover's Bond.",
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
        wakeOrder: exports.WAKE_ORDER.indexOf("BusDriver"),
        action: { targetCount: 2 },
        notes: "A night driver who causes confusion using Route Swap.",
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
        notes: "An investigator secretly embedded within the Mafia using Deep Cover.",
        abilities: [
            {
                name: "Deep Cover",
                description: "Undercover Cop wakes with the Mafia while remaining aligned with the Town.",
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
        wakeOrder: exports.WAKE_ORDER.indexOf("Grandma"),
        notes: "A protective homeowner who defends her property through Home Defense.",
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
        wakeOrder: exports.WAKE_ORDER.indexOf("Magician"),
        action: { targetCount: 1, notes: "One kill and one save per game, at night." },
        notes: "A mysterious performer capable of manipulating outcomes through Vanishing Act and Escape Trick.",
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
        wakeOrder: exports.WAKE_ORDER.indexOf("Postman"),
        notes: "A messenger who ensures one final delivery through Final Delivery.",
        abilities: [
            {
                name: "Final Delivery",
                description: "If the Postman is hung during the day, choose one player to die with them.",
                activation: { phase: "Day", type: "Triggered" },
            },
        ],
    },
    Vigilante: {
        type: "Vigilante",
        alignment: "Town",
        wakeOrder: exports.WAKE_ORDER.indexOf("Vigilante"),
        action: { targetCount: 1 },
        notes: "A lone enforcer who delivers justice using Single Shot.",
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
        wakeOrder: exports.WAKE_ORDER.indexOf("Mafia"),
        action: { targetCount: 1 },
        notes: "A coordinated criminal group that removes threats using Mafia Kill.",
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
        notes: "The Mafia's leader who avoids suspicion through Untouchable Reputation.",
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
        wakeOrder: exports.WAKE_ORDER.indexOf("Lawyer"),
        action: { targetCount: 1 },
        notes: "A skilled defender who shields allies using Legal Defense.",
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
        notes: "A trusted Mafia member who expands their ranks through Recruitment.",
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
        wakeOrder: exports.WAKE_ORDER.indexOf("Bartender"),
        action: { targetCount: 1 },
        notes: "A manipulative drink server who disrupts others using Strong Drink.",
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
        notes: "A dangerous individual who hunts alone using Night Kill.",
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
        wakeOrder: exports.WAKE_ORDER.indexOf("RivalMafia"),
        action: { targetCount: 1 },
        notes: "A competing criminal faction that attacks using Rival Kill.",
        abilities: [
            {
                name: "Rival Kill",
                description: "Rival Mafia collectively choose one player to kill.",
                activation: { phase: "Night", type: "Active" },
            },
        ],
    },
};
exports.ROLE_TYPES = Object.keys(exports.ROLE_DEFINITIONS);
function getRoleAlignment(role) {
    return exports.ROLE_DEFINITIONS[role].alignment;
}
function getDetectiveResultForRole(role) {
    if (role === "Godfather")
        return "Innocent";
    if (role === "Miller")
        return "Guilty";
    if (role === "SerialKiller")
        return "Guilty";
    const alignment = getRoleAlignment(role);
    return alignment === "Mafia" || alignment === "RivalMafia" ? "Guilty" : "Innocent";
}
const BRACKET_REFERENCE_PATTERN = /[[]([^]]+)[]]/g;
function extractBracketedReferences(text) {
    const matches = text.matchAll(BRACKET_REFERENCE_PATTERN);
    return Array.from(matches, (match) => match[1].trim());
}
function validateRoleCopy() {
    const issues = [];
    for (const role of exports.ROLE_TYPES) {
        const definition = exports.ROLE_DEFINITIONS[role];
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
