import { NextResponse } from "next/server";

type RecapRequest = {
  summary: {
    nightNumber: number;
    dayNumber: number;
    deaths: Array<{ name: string; role: string; causes: string[] }>;
    saves: string[];
    storyContext?: string[];
  };
};

type StructuredRecap = {
  headline: string;
  events: Array<{ title: string; text: string }>;
  coda?: string;
};

const FORBIDDEN_PUBLIC_LEAK_PATTERN =
  /\b(blocked?|investigat(?:ion|ed)|convert(?:ed|s|ion)?|recruit(?:ed|ment)?|swap(?:ped)?|daytime defense|system note)\b/i;

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

  return hints;
}

function buildFallbackRecap(summary: RecapRequest["summary"]): StructuredRecap {
  const events: Array<{ title: string; text: string }> = [];
  const sharedFateDeaths = summary.deaths.filter((death) => hasCause(death, /shared fate|lover chain/i));
  const directDeaths = summary.deaths.filter((death) => !hasCause(death, /shared fate|lover chain/i));
  const mergedDeathNames = new Set<string>();

  if (sharedFateDeaths.length > 0 && directDeaths.length > 0) {
    const trigger = directDeaths[0];
    const chained = sharedFateDeaths.map((death) => `${death.name} (${death.role})`).join(", ");
    events.push({
      title: "Forbidden Lovers",
      text: `Night ${summary.nightNumber} turned tragic when ${trigger.name} (${trigger.role}) fell, and Shared Fate pulled ${chained} down as well. By dawn, the town faced intertwined losses from a single deadly chain.`,
    });
    mergedDeathNames.add(trigger.name);
    for (const death of sharedFateDeaths) mergedDeathNames.add(death.name);
  }

  for (const death of summary.deaths) {
    if (mergedDeathNames.has(death.name)) continue;
    events.push({
      title: `${death.name} Falls`,
      text: `${death.name} died during Night ${summary.nightNumber}. They were the ${death.role}.`,
    });
  }

  for (const saved of summary.saves) {
    events.push({
      title: `${saved} Survives`,
      text: `${saved} survived Night ${summary.nightNumber}.`,
    });
  }

  if (events.length === 0) {
    events.push({
      title: "Quiet Night",
      text: `No public casualties were reported during Night ${summary.nightNumber}.`,
    });
  }

  return {
    headline: `Night ${summary.nightNumber} Summary`,
    events: events.slice(0, 1),
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

function consolidateLinkedEvents(summary: RecapRequest["summary"], recap: StructuredRecap): StructuredRecap {
  const sharedFateDeaths = summary.deaths.filter((death) => hasCause(death, /shared fate|lover chain/i));
  const directDeaths = summary.deaths.filter((death) => !hasCause(death, /shared fate|lover chain/i));
  if (sharedFateDeaths.length === 0 || directDeaths.length === 0) return recap;

  const linkedNames = new Set<string>([
    ...sharedFateDeaths.map((death) => death.name.toLowerCase()),
    ...directDeaths.map((death) => death.name.toLowerCase()),
  ]);

  const mentionsLinkedName = (value: string): boolean => {
    const normalized = value.toLowerCase();
    for (const name of linkedNames) {
      if (normalized.includes(name)) return true;
    }
    return false;
  };

  const linkedEvents = recap.events.filter((event) => mentionsLinkedName(event.title) || mentionsLinkedName(event.text));
  if (linkedEvents.length <= 1) return recap;

  const primary = directDeaths[0];
  const chained = sharedFateDeaths.map((death) => `${death.name} (${death.role})`).join(", ");
  const mergedEvent = {
    title: "Forbidden Lovers",
    text: `Night ${summary.nightNumber} turned tragic when ${primary.name} (${primary.role}) fell, and Shared Fate pulled ${chained} down as well. By dawn, the town faced intertwined losses from a single deadly chain.`,
  };

  const events = [mergedEvent, ...recap.events.filter((event) => !(mentionsLinkedName(event.title) || mentionsLinkedName(event.text)))];
  return { ...recap, events: events.slice(0, 1), coda: undefined };
}

function normalizeToSingleEvent(recap: StructuredRecap): StructuredRecap {
  const primary = recap.events[0] ?? { title: "Night Recap", text: "No public events were reported." };
  return {
    headline: recap.headline,
    events: [primary],
    coda: undefined,
  };
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
    const summary = body?.summary;
    if (!summary) {
      return NextResponse.json({ error: "Missing summary payload." }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "OPENAI_API_KEY is not configured." }, { status: 500 });
    }

    const model = process.env.OPENAI_RECAP_MODEL ?? "gpt-4.1-mini";
    const narrativeLinkHints = buildNarrativeLinkHints(summary);
    const prompt = [
      "You are a dramatic but clear Mafia game narrator speaking to players.",
      "Return ONLY valid JSON with this shape:",
      '{ "headline": string, "events": [{ "title": string, "text": string }] }',
      "Rules:",
      "- Generate exactly 1 event card.",
      "- Use this style: headline as 'Night N:' and one event with a strong title plus a 3-5 sentence story paragraph.",
      "- If events overlap thematically (e.g., same victim or chain outcome), combine into one stronger event.",
      "- Keep facts accurate and concise; do not invent anything.",
      "- You may ONLY mention these public categories: deaths and saves.",
      "- Do NOT mention blocks, investigations, conversions, swaps, defenses, or system notes.",
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
      `Deaths: ${summary.deaths.length > 0 ? JSON.stringify(summary.deaths) : "None"}`,
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
            content: "You are a concise Mafia moderator narrator.",
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
      return NextResponse.json({ error: `OpenAI request failed: ${err}` }, { status: 502 });
    }

    const data = await upstream.json();
    const recapRaw = data?.choices?.[0]?.message?.content?.trim();
    if (!recapRaw) {
      return NextResponse.json({ error: "Model returned an empty recap." }, { status: 502 });
    }
    const recapParsed = parseStructuredRecap(recapRaw);
    const recapBase =
      recapParsed &&
      !recapHasForbiddenContent(recapParsed) &&
      !recapHasWrongNightNumber(recapParsed, summary.nightNumber)
        ? recapParsed
        : buildFallbackRecap(summary);
    const recap = normalizeHeadline(normalizeToSingleEvent(consolidateLinkedEvents(summary, recapBase)), summary.nightNumber);

    return NextResponse.json({ recap, model });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
