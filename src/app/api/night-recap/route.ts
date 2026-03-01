import { NextResponse } from "next/server";

type RecapRequest = {
  tone?: "standard" | "rated_m" | "rated_m_suggestive_lovers";
  summary: {
    nightNumber: number;
    dayNumber: number;
    deaths: Array<{ name: string; role: string; causes: string[] }>;
    saves: string[];
    saveRoleByName?: Record<string, string>;
    storyContext?: string[];
  };
};

type StructuredRecap = {
  headline: string;
  events: Array<{ title: string; text: string }>;
  coda?: string;
};

type RecapTone = "standard" | "rated_m" | "rated_m_suggestive_lovers";

type ToneProfile = {
  systemPrompt: string;
  toneRules: string[];
};

type RecapMeta = {
  source: "model" | "fallback";
  reasons: string[];
};

function logRecapDebug(stage: string, details: Record<string, unknown>) {
  const timestamp = new Date().toISOString();
  console.log(`[night-recap][${timestamp}][${stage}]`, details);
}

function truncateForLog(value: string, max = 700): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max)}...<truncated>`;
}

const FORBIDDEN_PUBLIC_LEAK_PATTERN =
  /\b(blocked?|investigat(?:ion|ed)|convert(?:ed|s|ion)?|recruit(?:ed|ment)?|swap(?:ped)?|daytime defense|system note|vanishing act|escape trick|home defense|last laugh|strong drink|route swap)\b/i;

const ABILITY_LABEL_PATTERN = /\b(vanishing act|escape trick|home defense|last laugh|strong drink|route swap)\b/gi;
const FORBIDDEN_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bblocked?\b/gi, "stopped"],
  [/\binvestigat(?:ion|ed)\b/gi, "look-into"],
  [/\bconvert(?:ed|s|ion)?\b/gi, "turned"],
  [/\brecruit(?:ed|ment)?\b/gi, "pulled in"],
  [/\bswap(?:ped)?\b/gi, "crossed paths"],
  [/\bdaytime defense\b/gi, "protection"],
  [/\bsystem note\b/gi, "record"],
  [/\bthis game\b/gi, "this town"],
  [/\bthe game\b/gi, "the town"],
  [/\bmatch\b/gi, "night"],
  [/\bround\b/gi, "night"],
  [/\bmeta\b/gi, "story"],
];
const META_LANGUAGE_PATTERN = /\b(this game|the game|game\b|match\b|round\b|table talk|meta)\b/i;
const EXPLICIT_SEXUAL_PATTERN =
  /\b(sex|sexual|nude|naked|orgasm|intercourse|penetrat(?:e|ion)|explicit|erotic|moan(?:ed|ing)?|thrust(?:ed|ing)?|bed(?:ded|ding)?)\b/i;
const EXCESSIVE_GORE_PATTERN =
  /\b(dismember(?:ed|ment)?|decapitat(?:ed|ion)|entrails?|guts|gore|mutilat(?:ed|ion)|eviscerat(?:ed|ion))\b/i;
const RATED_M_SIGNAL_PATTERN =
  /\b(grim|brutal|blood|carnage|merciless|fatal|gallows|darkly|cold-blooded|butcher(?:ed|y)?|shaken|dread)\b/i;
const SAVE_LANGUAGE_PATTERN =
  /\b(surviv(?:e|ed|or)|saved|rescued|close call|walked away|escaped death|lived to see dawn|still breathing|kept .* alive)\b/i;

function normalizeTone(tone: RecapRequest["tone"]): RecapTone {
  if (tone === "standard" || tone === "rated_m" || tone === "rated_m_suggestive_lovers") return tone;
  return "rated_m_suggestive_lovers";
}

function getToneProfile(tone: RecapTone): ToneProfile {
  if (tone === "standard") {
    return {
      systemPrompt: "You are a concise Mafia moderator narrator.",
      toneRules: [
        "- Keep tone dramatic but measured and suitable for general audiences.",
        "- Avoid crude language, gore-heavy imagery, and sexualized framing.",
      ],
    };
  }

  if (tone === "rated_m") {
    return {
      systemPrompt: "You are a sharp, cinematic Mafia moderator narrator with dark humor.",
      toneRules: [
        "- Target a Rated M tone: grim, punchy, and cinematic.",
        "- Use dark humor sparingly: at most one dry or gallows-humor beat per event.",
        "- Violence can be vivid but should avoid explicit gore detail.",
        "- Do not include sexual content.",
      ],
    };
  }

  return {
    systemPrompt: "You are a sharp, cinematic Mafia moderator narrator with dark humor and mature noir flavor.",
    toneRules: [
      "- Target a Rated M tone: grim, punchy, and cinematic.",
      "- Use dark humor sparingly: at most one dry or gallows-humor beat per event.",
      "- Violence can be vivid but should avoid explicit gore detail.",
      "- Suggestive implication is allowed only as brief flavor, especially for Lovers/Cupid story threads.",
      "- Suggestive flavor must stay implied and non-explicit; no explicit sexual detail.",
    ],
  };
}

function parseStructuredRecap(raw: string): StructuredRecap | null {
  const trimmed = raw.trim();
  const unwrapped = trimmed.startsWith("```")
    ? trimmed.replace(/^```(?:json)?\s*/i, "").replace(/```$/, "").trim()
    : trimmed;
  try {
    const parsed: unknown = JSON.parse(unwrapped);
    if (!parsed || typeof parsed !== "object") return null;

    const candidate = parsed as {
      headline?: unknown;
      events?: Array<{ title?: unknown; text?: unknown }>;
      coda?: unknown;
    };

    if (typeof candidate.headline !== "string" || !Array.isArray(candidate.events)) return null;
    if (candidate.events.some((event) => !event || typeof event.title !== "string" || typeof event.text !== "string")) return null;

    return {
      headline: candidate.headline,
      events: candidate.events.map((event) => ({
        title: event.title as string,
        text: event.text as string,
      })),
      coda: typeof candidate.coda === "string" ? candidate.coda : undefined,
    };
  } catch {
    return null;
  }
}

type DeathSummary = RecapRequest["summary"]["deaths"][number];

function hasCause(death: DeathSummary, pattern: RegExp): boolean {
  return (death.causes ?? []).some((cause) => pattern.test(cause));
}

function normalizeSummaryForNarration(summary: RecapRequest["summary"]): RecapRequest["summary"] {
  const saveRoleByName = summary.saveRoleByName ?? {};
  const doctorDiedVisitingGrandma = (summary.deaths ?? []).some((death) =>
    hasCause(death, /visited grandma as doctor|visited grandma .*doctor/i)
  );
  if (!doctorDiedVisitingGrandma) return summary;

  const filteredSaves = (summary.saves ?? []).filter((name) => {
    const role = saveRoleByName[name] ?? "";
    return role.toLowerCase() !== "grandma";
  });
  return { ...summary, saves: filteredSaves };
}

function buildNarrativeLinkHints(summary: RecapRequest["summary"]): string[] {
  const hints: string[] = [];
  const deaths = summary.deaths ?? [];
  if (deaths.length === 0) return hints;

  const sharedFateDeaths = deaths.filter((death) => hasCause(death, /shared fate|lover chain/i));
  const directDeaths = deaths.filter((death) => !hasCause(death, /shared fate|lover chain/i));

  if (sharedFateDeaths.length > 0 && directDeaths.length > 0) {
    const sharedNames = sharedFateDeaths.map((death) => death.name).join(", ");
    const triggerNames = directDeaths.map((death) => death.name).join(", ");
    hints.push(
      `Shared Fate link: ${sharedNames} died as a consequence of deaths involving ${triggerNames}. Consider one combined tragic event.`
    );
  }

  const crossfireDeaths = deaths.filter(
    (death) =>
      hasCause(death, /mafia/i) &&
      hasCause(death, /rival mafia/i)
  );
  if (crossfireDeaths.length > 0) {
    hints.push(
      `Crossfire link: ${crossfireDeaths.map((death) => death.name).join(", ")} were hit by overlapping Mafia and Rival Mafia actions.`
    );
  }

  const grandmaDeaths = deaths.filter((death) => hasCause(death, /visited grandma|home defense/i));
  if (grandmaDeaths.length > 1) {
    hints.push(
      `Grandma link: ${grandmaDeaths.map((death) => death.name).join(", ")} were part of the same Grandma-home retaliation chain. Group this into one event block.`
    );
    hints.push(
      "Grandma lore angle: add connective, speculative motivation for convergence (for example, rumors, private tip-offs, routine check-ins, or suspicious movement) without adding new outcomes."
    );
  }

  return hints;
}

function sanitizeCauseForPrompt(cause: string): string {
  let text = cause.trim();
  if (!text) return "";
  if (/^Visited Grandma .* died to Home Defense\.?$/i.test(text)) {
    return "Died after visiting Grandma's home.";
  }
  text = text.replace(/\(([^)]*)\)/g, "");
  text = text.replace(ABILITY_LABEL_PATTERN, "");
  text = text.replace(/\s{2,}/g, " ").trim();
  if (!/[.!?]$/.test(text)) text += ".";
  return text;
}

function sanitizeCauseForInlineList(cause: string): string {
  return sanitizeCauseForPrompt(cause).replace(/[.!?]+$/g, "").trim();
}

function buildFallbackRecap(summary: RecapRequest["summary"], tone: RecapTone): StructuredRecap {
  const events: Array<{ title: string; text: string }> = [];
  const sharedFateDeaths = summary.deaths.filter((death) => hasCause(death, /shared fate|lover chain/i));
  const directDeaths = summary.deaths.filter((death) => !hasCause(death, /shared fate|lover chain/i));
  const mergedDeathNames = new Set<string>();
  const mature = tone !== "standard";
  const suggestiveLovers = tone === "rated_m_suggestive_lovers";

  if (sharedFateDeaths.length > 0 && directDeaths.length > 0) {
    const trigger = directDeaths[0];
    const chained = sharedFateDeaths.map((death) => `${death.name} (${death.role})`).join(", ");
    events.push({
      title: "Forbidden Lovers",
      text: suggestiveLovers
        ? `Night ${summary.nightNumber} broke a dangerous bond when ${trigger.name} (${trigger.role}) fell, and the linked fallout dragged down ${chained}. By dawn, whispers of stolen glances and bad timing turned into a brutal shared obituary.`
        : mature
          ? `Night ${summary.nightNumber} snapped a dangerous bond when ${trigger.name} (${trigger.role}) fell, and the linked fallout dragged down ${chained}. By dawn, the town faced intertwined losses from one merciless chain.`
          : `Night ${summary.nightNumber} turned tragic when ${trigger.name} (${trigger.role}) fell, and a linked chain pulled down ${chained} as well. By dawn, the town faced intertwined losses from a single event.`,
    });
    mergedDeathNames.add(trigger.name);
    for (const death of sharedFateDeaths) mergedDeathNames.add(death.name);
  }

  for (const death of summary.deaths) {
    if (mergedDeathNames.has(death.name)) continue;
    events.push({
      title: `${death.name} Falls`,
      text: mature
        ? `${death.name} did not make it through Night ${summary.nightNumber}. Dawn revealed they were the ${death.role}, another name added to the night's casualty list.`
        : `${death.name} died during Night ${summary.nightNumber}. They were the ${death.role}.`,
    });
  }

  for (const saved of summary.saves) {
    events.push({
      title: `${saved} Survives`,
      text: `${saved} survived Night ${summary.nightNumber} and was confirmed alive at dawn.`,
    });
  }

  if (events.length === 0) {
    events.push({
      title: "Quiet Night",
      text: mature
        ? `Night ${summary.nightNumber} ended with no public casualties, though dawn still felt tense enough to cut with a knife.`
        : `No public casualties were reported during Night ${summary.nightNumber}.`,
    });
  }

  return {
    headline: `Night ${summary.nightNumber} Summary`,
    events,
  };
}

function recapHasForbiddenContent(recap: StructuredRecap): boolean {
  const allText = [recap.headline, recap.coda ?? "", ...recap.events.flatMap((event) => [event.title, event.text])].join(" ");
  return FORBIDDEN_PUBLIC_LEAK_PATTERN.test(allText);
}

function recapHasWrongNightNumber(recap: StructuredRecap, expectedNightNumber: number): boolean {
  const allText = [recap.headline, recap.coda ?? "", ...recap.events.flatMap((event) => [event.title, event.text])].join(" ");
  const matches = allText.matchAll(/\bnight\s+(\d+)\b/gi);
  for (const match of matches) {
    const value = Number(match[1]);
    if (Number.isFinite(value) && value !== expectedNightNumber) return true;
  }
  return false;
}

function recapHasExplicitSexualContent(recap: StructuredRecap): boolean {
  const allText = [recap.headline, recap.coda ?? "", ...recap.events.flatMap((event) => [event.title, event.text])].join(" ");
  return EXPLICIT_SEXUAL_PATTERN.test(allText);
}

function recapHasExcessiveGore(recap: StructuredRecap): boolean {
  const allText = [recap.headline, recap.coda ?? "", ...recap.events.flatMap((event) => [event.title, event.text])].join(" ");
  return EXCESSIVE_GORE_PATTERN.test(allText);
}

function recapHasMetaLanguage(recap: StructuredRecap): boolean {
  const allText = [recap.headline, recap.coda ?? "", ...recap.events.flatMap((event) => [event.title, event.text])].join(" ");
  return META_LANGUAGE_PATTERN.test(allText);
}

function recapLacksRatedMTone(recap: StructuredRecap, summary: RecapRequest["summary"], tone: RecapTone): boolean {
  if (tone === "standard") return false;
  if ((summary.deaths?.length ?? 0) === 0) return false;
  const allText = [recap.headline, recap.coda ?? "", ...recap.events.flatMap((event) => [event.title, event.text])].join(" ");
  return !RATED_M_SIGNAL_PATTERN.test(allText);
}

function getDeathThreadKey(death: DeathSummary): string {
  if (hasCause(death, /shared fate|lover chain/i)) return "shared_fate";
  if (hasCause(death, /visited grandma|home defense/i)) return "grandma_chain";
  const hasMafia = hasCause(death, /mafia/i);
  const hasRival = hasCause(death, /rival mafia/i);
  if (hasMafia && hasRival) return "crossfire";
  if (hasMafia) return "mafia";
  if (hasRival) return "rival_mafia";
  if (hasCause(death, /serial killer/i)) return "serial_killer";
  if (hasCause(death, /vigilante/i)) return "vigilante";
  if (hasCause(death, /magician/i)) return "magician";
  return "other";
}

function recapIsOverMerged(recap: StructuredRecap, summary: RecapRequest["summary"]): boolean {
  const deaths = summary.deaths ?? [];
  if (recap.events.length !== 1) return false;
  if (deaths.length < 3) return false;
  const distinctThreads = new Set(deaths.map((death) => getDeathThreadKey(death)));
  return distinctThreads.size >= 2;
}

function normalizeEventCount(recap: StructuredRecap): StructuredRecap {
  const events = (recap.events ?? [])
    .map((event) => ({
      title: String(event.title ?? "").trim(),
      text: String(event.text ?? "").trim(),
    }))
    .filter((event) => event.title.length > 0 && event.text.length > 0)
    .slice(0, 4);
  if (events.length > 0) return { ...recap, events };
  return {
    ...recap,
    events: [{ title: "Night Event", text: "No public events were reported." }],
  };
}

function eventLooksLikeSave(event: { title: string; text: string }): boolean {
  return SAVE_LANGUAGE_PATTERN.test(`${event.title} ${event.text}`);
}

function recapMentionsUnauthorizedSaves(recap: StructuredRecap, summary: RecapRequest["summary"]): boolean {
  const saveNames = new Set((summary.saves ?? []).map((name) => name.toLowerCase().trim()).filter(Boolean));
  for (const event of recap.events) {
    const combined = `${event.title} ${event.text}`;
    if (!SAVE_LANGUAGE_PATTERN.test(combined)) continue;
    if (saveNames.size === 0) return true;
    const lowered = combined.toLowerCase();
    const referencesKnownSavedName = Array.from(saveNames).some((name) => lowered.includes(name));
    if (!referencesKnownSavedName) return true;
  }
  return false;
}

function stripUnauthorizedSaveEvents(recap: StructuredRecap, summary: RecapRequest["summary"]): StructuredRecap {
  const saveNames = new Set((summary.saves ?? []).map((name) => name.toLowerCase().trim()).filter(Boolean));
  if (saveNames.size > 0) {
    const events = recap.events.filter((event) => {
      if (!eventLooksLikeSave(event)) return true;
      const lowered = `${event.title} ${event.text}`.toLowerCase();
      return Array.from(saveNames).some((name) => lowered.includes(name));
    });
    return { ...recap, events };
  }
  return {
    ...recap,
    events: recap.events.filter((event) => !eventLooksLikeSave(event)),
  };
}

function sanitizePublicRecapText(value: string): string {
  let text = value;
  for (const [pattern, replacement] of FORBIDDEN_REPLACEMENTS) {
    text = text.replace(pattern, replacement);
  }
  text = text.replace(ABILITY_LABEL_PATTERN, "retaliation");
  text = text.replace(/\s{2,}/g, " ").trim();
  return text;
}

function sanitizeRecapForPublic(recap: StructuredRecap): StructuredRecap {
  return {
    ...recap,
    headline: sanitizePublicRecapText(recap.headline),
    events: recap.events.map((event) => ({
      title: sanitizePublicRecapText(event.title),
      text: sanitizePublicRecapText(event.text),
    })),
    coda: recap.coda ? sanitizePublicRecapText(recap.coda) : undefined,
  };
}

function injectRatedMFlavor(recap: StructuredRecap, summary: RecapRequest["summary"], tone: RecapTone): StructuredRecap {
  if (tone === "standard") return recap;
  if ((summary.deaths?.length ?? 0) === 0) return recap;
  if (recap.events.length === 0) return recap;
  if (!recapLacksRatedMTone(recap, summary, tone)) return recap;

  const nextEvents = [...recap.events];
  nextEvents[0] = {
    ...nextEvents[0],
    text: `${nextEvents[0].text} By dawn, the town was shaken and the air still felt heavy with dread.`,
  };
  return { ...recap, events: nextEvents };
}

function enforceOutcomeCoverage(summary: RecapRequest["summary"], recap: StructuredRecap, tone: RecapTone): StructuredRecap {
  const mature = tone !== "standard";
  const combinedText = recap.events.map((event) => `${event.title} ${event.text}`.toLowerCase()).join(" ");
  const missingDeaths = (summary.deaths ?? []).filter((death) => !combinedText.includes(death.name.toLowerCase()));
  const missingSaves = (summary.saves ?? []).filter((name) => !combinedText.includes(name.toLowerCase()));

  const injected: Array<{ title: string; text: string }> = [];

  if (missingDeaths.length > 0) {
    const grandmaMissing = missingDeaths.filter((death) => hasCause(death, /visited grandma|home defense/i));
    const nonGrandmaMissing = missingDeaths.filter((death) => !hasCause(death, /visited grandma|home defense/i));

    if (grandmaMissing.length > 0) {
      const list = grandmaMissing.map((death) => `${death.name} (${death.role})`).join(", ");
      injected.push({
        title: "Grandma's House Turned Deadly",
        text: mature
          ? `Additional confirmed deaths at Grandma's home from Night ${summary.nightNumber}: ${list}. The town tied these losses to one connected and brutal chain.`
          : `Additional confirmed deaths at Grandma's home from Night ${summary.nightNumber}: ${list}.`,
      });
    }

    if (nonGrandmaMissing.length > 0) {
      const list = nonGrandmaMissing
        .map((death) => {
          const cause = (death.causes ?? []).map((value) => sanitizeCauseForInlineList(value)).find(Boolean);
          if (!cause) return `${death.name} (${death.role})`;
          return `${death.name} (${death.role}) - ${cause}`;
        })
        .join("; ");
      injected.push({
        title: "Additional Confirmed Deaths",
        text: mature
          ? `The night also claimed ${list}. Dawn left no doubt these deaths were part of the same blood-soaked tally.`
          : `The night also claimed ${list}.`,
      });
    }
  }

  if (missingSaves.length > 0) {
    injected.push({
      title: missingSaves.length === 1 ? `${missingSaves[0]} Survives` : "Additional Confirmed Survivors",
      text:
        missingSaves.length === 1
          ? `${missingSaves[0]} survived Night ${summary.nightNumber} and was confirmed alive at dawn.`
          : `${missingSaves.join(", ")} survived Night ${summary.nightNumber} and were confirmed alive at dawn.`,
    });
  }

  if (injected.length === 0) return recap;
  return { ...recap, events: [...injected, ...recap.events] };
}

function mergeEventsForNames(
  recap: StructuredRecap,
  names: string[],
  mergedEvent: { title: string; text: string },
  options?: { allDeathNames?: string[]; strictOnlyLinked?: boolean }
): StructuredRecap {
  const loweredNames = names.map((name) => name.toLowerCase());
  const allDeathsLowered = (options?.allDeathNames ?? []).map((name) => name.toLowerCase());
  const indices: number[] = [];
  for (let i = 0; i < recap.events.length; i += 1) {
    const event = recap.events[i];
    const combined = `${event.title} ${event.text}`.toLowerCase();
    if (!loweredNames.some((name) => combined.includes(name))) continue;
    if (options?.strictOnlyLinked) {
      const mentionedOtherDeath = allDeathsLowered.some(
        (deathName) => !loweredNames.includes(deathName) && combined.includes(deathName)
      );
      if (mentionedOtherDeath) continue;
    }
    indices.push(i);
  }
  if (indices.length <= 1) return recap;

  const first = indices[0];
  const skip = new Set(indices);
  const nextEvents: Array<{ title: string; text: string }> = [];
  for (let i = 0; i < recap.events.length; i += 1) {
    if (i === first) {
      nextEvents.push(mergedEvent);
      continue;
    }
    if (skip.has(i)) continue;
    nextEvents.push(recap.events[i]);
  }
  return { ...recap, events: nextEvents, coda: undefined };
}

function consolidateLinkedEvents(summary: RecapRequest["summary"], recap: StructuredRecap, tone: RecapTone): StructuredRecap {
  let next = recap;
  const mature = tone !== "standard";
  const suggestiveLovers = tone === "rated_m_suggestive_lovers";
  const allDeathNames = (summary.deaths ?? []).map((death) => death.name);

  const sharedFateDeaths = summary.deaths.filter((death) => hasCause(death, /shared fate|lover chain/i));
  const directDeaths = summary.deaths.filter((death) => !hasCause(death, /shared fate|lover chain/i));
  if (sharedFateDeaths.length > 0 && directDeaths.length > 0) {
    const primary = directDeaths[0];
    const chained = sharedFateDeaths.map((death) => `${death.name} (${death.role})`).join(", ");
    next = mergeEventsForNames(
      next,
      [primary.name, ...sharedFateDeaths.map((death) => death.name)],
      {
        title: "Forbidden Lovers",
        text: suggestiveLovers
          ? `Night ${summary.nightNumber} broke a dangerous bond when ${primary.name} (${primary.role}) fell, and the linked fallout dragged down ${chained}. By dawn, whispers of secret sparks and fatal timing hardened into a brutal shared tragedy.`
          : mature
            ? `Night ${summary.nightNumber} broke a dangerous bond when ${primary.name} (${primary.role}) fell, and the linked fallout dragged down ${chained}. By dawn, the town faced intertwined losses from one deadly chain.`
            : `Night ${summary.nightNumber} turned tragic when ${primary.name} (${primary.role}) fell, and a linked chain pulled down ${chained} as well. By dawn, the town faced intertwined losses from one connected event.`,
      },
      { allDeathNames, strictOnlyLinked: true }
    );
  }

  const grandmaDeaths = summary.deaths.filter((death) => hasCause(death, /visited grandma|home defense/i));
  if (grandmaDeaths.length > 1) {
    const list = grandmaDeaths.map((death) => `${death.name} (${death.role})`).join(", ");
    next = mergeEventsForNames(next, grandmaDeaths.map((death) => death.name), {
      title: "Grandma's House Turned Deadly",
      text: mature
        ? `Several visitors died in the same chain at Grandma's home during Night ${summary.nightNumber}: ${list}. By dawn, rumors said each came for a different reason, but they converged on the same doorstep and paid in blood. The town quickly understood those losses were one connected disaster.`
        : `Several visitors died in the same chain at Grandma's home during Night ${summary.nightNumber}: ${list}. Whispers by dawn suggested they arrived for different reasons, but all converged on the same doorstep. The town understood those losses were part of one connected event.`,
    }, { allDeathNames, strictOnlyLinked: true });
  }

  return next;
}

function normalizeHeadline(recap: StructuredRecap, nightNumber: number): StructuredRecap {
  return {
    ...recap,
    headline: `Night ${nightNumber}:`,
  };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RecapRequest;
    const rawSummary = body?.summary;
    const tone = normalizeTone(body?.tone);
    const toneProfile = getToneProfile(tone);
    if (!rawSummary) {
      logRecapDebug("bad_request", { reason: "missing_summary" });
      return NextResponse.json({ error: "Missing summary payload." }, { status: 400 });
    }
    const summary = normalizeSummaryForNarration(rawSummary);
    logRecapDebug("request_received", {
      tone,
      nightNumber: summary.nightNumber,
      dayNumber: summary.dayNumber,
      deathCount: summary.deaths?.length ?? 0,
      saveCount: summary.saves?.length ?? 0,
      storyContextCount: summary.storyContext?.length ?? 0,
    });

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      logRecapDebug("config_error", { reason: "missing_api_key" });
      return NextResponse.json({ error: "OPENAI_API_KEY is not configured." }, { status: 500 });
    }

    const model = process.env.OPENAI_RECAP_MODEL ?? "gpt-4.1-mini";
    const narrativeLinkHints = buildNarrativeLinkHints(summary);
    const prompt = [
      "You are a dramatic but clear Mafia game narrator speaking to players.",
      "Return ONLY valid JSON with this shape:",
      '{ "headline": string, "events": [{ "title": string, "text": string }] }',
      "Rules:",
      "- Generate 1 to 4 event cards based on distinct public story threads.",
      "- Use this style: headline as 'Night N:' and each event card has a strong title plus a 2-4 sentence story paragraph.",
      "- If events overlap thematically (e.g., same victim, same location chain, or same cause family), combine into one stronger event block.",
      "- Keep facts accurate and concise; do not invent anything.",
      "- Keep narration fully in-world (no meta references to the game, match, rounds, or table talk).",
      "- You may ONLY mention these public categories: deaths and saves.",
      "- For saves, state only the confirmed public fact that the player survived the night.",
      "- Do NOT infer or imply who/what attempted the kill, why the save happened, or what stopped it.",
      "- Do NOT mention any save/survival beat unless that player's name appears in the Saves list.",
      "- Do NOT mention blocks, investigations, conversions, swaps, defenses, or system notes.",
      "- Do NOT mention ability names or ability labels.",
      "- You may add connective backstory flavor for motivation (why people converged), but it must be clearly atmospheric or speculative and must not introduce new outcomes.",
      "- Good style for connective backstory: \"rumors said...\", \"some believe...\", \"it seemed...\", \"perhaps...\".",
      ...toneProfile.toneRules,
      "- This recap must clearly refer to the correct night number provided below.",
      "- Use prior context only as background continuity; do not add new factual events beyond current-night deaths/saves.",
      "- If public events are causally linked, prefer one stronger merged event over fragmented repetition.",
      "- You may add atmospheric scene flavor (e.g., streets, square, tavern, fog, lantern light) and cinematic connective phrasing.",
      "- Atmospheric details must never introduce new mechanics, actors, actions, or outcomes.",
      "- Mention deaths with role reveals where available.",
      "- If no deaths and no saves occurred, the single event must explicitly say the night had no public casualties.",
      "",
      `Night Number: ${summary.nightNumber}`,
      `Day: ${summary.dayNumber}`,
      `Tone Mode: ${tone}`,
      `Deaths: ${
        summary.deaths.length > 0
          ? JSON.stringify(
              summary.deaths.map((death) => ({
                name: death.name,
                role: death.role,
                causes: (death.causes ?? []).map((cause) => sanitizeCauseForPrompt(cause)).filter(Boolean),
              }))
            )
          : "None"
      }`,
      `Saves: ${summary.saves.length > 0 ? summary.saves.join(", ") : "None"}`,
      `Prior Public Story Context: ${(summary.storyContext ?? []).length > 0 ? (summary.storyContext ?? []).join(" | ") : "None"}`,
      `Narrative Link Hints: ${narrativeLinkHints.length > 0 ? narrativeLinkHints.join(" | ") : "None"}`,
    ].join("\n");

    const upstream = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.9,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: toneProfile.systemPrompt,
          },
          {
            role: "user",
            content: prompt,
          },
        ],
      }),
    });

    if (!upstream.ok) {
      const err = await upstream.text();
      logRecapDebug("upstream_error", {
        status: upstream.status,
        body: truncateForLog(err, 1200),
      });
      return NextResponse.json({ error: `OpenAI request failed: ${err}` }, { status: 502 });
    }

    const data = await upstream.json();
    const recapRaw = data?.choices?.[0]?.message?.content?.trim();
    if (!recapRaw) {
      logRecapDebug("upstream_empty", {
        status: upstream.status,
        responseShape: Object.keys(data ?? {}),
      });
      return NextResponse.json({ error: "Model returned an empty recap." }, { status: 502 });
    }
    logRecapDebug("upstream_response", {
      model,
      tone,
      rawLength: recapRaw.length,
      rawPreview: truncateForLog(recapRaw),
    });
    const recapParsed = parseStructuredRecap(recapRaw);
    const recapCandidate = recapParsed ? normalizeEventCount(recapParsed) : null;
    const reasons: string[] = [];
    if (!recapCandidate) reasons.push("invalid_or_unparseable_json");
    if (recapCandidate && recapHasForbiddenContent(recapCandidate)) reasons.push("forbidden_mechanics_or_ability_leak");
    if (recapCandidate && recapHasWrongNightNumber(recapCandidate, summary.nightNumber)) reasons.push("wrong_night_number");
    if (recapCandidate && recapHasExplicitSexualContent(recapCandidate)) reasons.push("explicit_sexual_content");
    if (recapCandidate && recapHasExcessiveGore(recapCandidate)) reasons.push("excessive_gore");
    if (recapCandidate && recapHasMetaLanguage(recapCandidate)) reasons.push("meta_language_warning");
    if (recapCandidate && recapMentionsUnauthorizedSaves(recapCandidate, summary)) reasons.push("unauthorized_save_reference");
    if (recapCandidate && recapIsOverMerged(recapCandidate, summary)) reasons.push("over_merged_model_output");

    let candidate = recapCandidate;
    if (candidate && reasons.length === 1 && reasons[0] === "forbidden_mechanics_or_ability_leak") {
      const sanitized = sanitizeRecapForPublic(candidate);
      if (!recapHasForbiddenContent(sanitized)) {
        candidate = sanitized;
        reasons.push("sanitized_for_public_readout");
      }
    }
    if (candidate && reasons.includes("meta_language_warning")) {
      const sanitized = sanitizeRecapForPublic(candidate);
      if (!recapHasMetaLanguage(sanitized)) {
        candidate = sanitized;
        reasons.push("sanitized_meta_language");
      }
    }
    if (candidate && reasons.includes("unauthorized_save_reference")) {
      const sanitized = stripUnauthorizedSaveEvents(candidate, summary);
      if (!recapMentionsUnauthorizedSaves(sanitized, summary) && sanitized.events.length > 0) {
        candidate = sanitized;
        reasons.push("stripped_unauthorized_save_events");
      }
    }

    const hardFailure =
      !candidate ||
      recapHasForbiddenContent(candidate) ||
      recapHasWrongNightNumber(candidate, summary.nightNumber) ||
      recapHasExplicitSexualContent(candidate) ||
      recapHasExcessiveGore(candidate) ||
      recapMentionsUnauthorizedSaves(candidate, summary) ||
      recapIsOverMerged(candidate, summary);

    const baseRecap: StructuredRecap = hardFailure || !candidate ? buildFallbackRecap(summary, tone) : candidate;
    const withTone = injectRatedMFlavor(baseRecap, summary, tone);
    const recap = normalizeHeadline(
      normalizeEventCount(enforceOutcomeCoverage(summary, consolidateLinkedEvents(summary, normalizeEventCount(withTone), tone), tone)),
      summary.nightNumber
    );
    const meta: RecapMeta = { source: hardFailure ? "fallback" : "model", reasons };
    logRecapDebug("recap_result", {
      model,
      tone,
      source: meta.source,
      reasons: meta.reasons,
      eventCount: recap.events.length,
      titles: recap.events.map((event) => event.title),
    });

    return NextResponse.json({ recap, model, tone, meta });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logRecapDebug("handler_exception", { message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
