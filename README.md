# Mafia Moderator Helper

A moderator companion app for running Mafia with a guided setup wizard, structured night/day moderation flow, and a rules engine for resolving complex interactions.

This project is designed for an in-person moderator (GM), not as a player-facing app.

## Current Status

- Setup wizard for players, roles, and launch review
- Rich role cards (teaching/reference during setup)
- Full session moderation flow (night -> summary -> day -> next night)
- Engine-driven night resolution (redirects, blocks, protection, kills, passives, investigations, recruit)
- Day elimination flow with Jester (`Postman`) `Last Laugh`
- Bounded rollback history and night rollback support
- Night summary focused on moderator-readable death breakdown + player status readout
- Targeted engine tests + randomized simulation checks

Project status notes may also exist in `docs/project-status.md`, but the source of truth for implemented roles/mechanics is the code in `src/domain/*`.

## Tech Stack

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS
- Radix UI / shadcn-style primitives
- Vitest (unit tests)
- Playwright (E2E smoke tests)

## Scripts

- `npm run dev` - Start local dev server
- `npm run build` - Production build
- `npm run start` - Run production build
- `npm run lint` - ESLint
- `npm run test` - Alias for random simulation checks
- `npm run test:random` - TypeScript compile + randomized engine simulation
- `npx vitest run` - Run targeted engine tests
- `npm run test:e2e` - Playwright E2E tests

## Game Flow (App)

### Setup Wizard

1. `Players`
- Add/remove seats
- Name players
- Quick test fill
- Setup state is remembered between sessions (players + selected roles)

2. `Roles`
- Select role pool with rich role cards and ability explanations
- Role count must match player count
- Includes `Clear Roles` shortcut

3. `Review`
- Launch readiness blockers
- Role summary
- Wake order preview
- Start / Resume / End session

### Session Flow

1. Start Night
2. Walk the wake order step-by-step
3. Enter role targets / assignments
4. Resolve night (engine)
5. Read Night Summary (read-aloud death breakdown + player status readout)
6. Run Day elimination
7. Start next Night

## Moderator UX Notes (Implemented)

- Detective preview supports Bus Driver redirection messaging
- Detective preview explicitly warns when Bartender blocks Detective (`No result (Drunk)`)
- Daytime Defense (`Lawyer`) blocks:
  - the main day hang on the defended target
  - Jester `Last Laugh` if the selected extra target has Daytime Defense
- Jester day trigger requires moderator confirmation + target selection

## Rules / Resolution Model (Implemented)

### Night Wake Order (moderator prompt order)

Night 1 additionally includes Cupid. Some roles are Night 1 assignment/setup-only in the wake sequence.

Typical order:
1. Cupid (Night 1 only)
2. Bus Driver
3. Mafia Team
4. Rival Mafia Team
5. Bartender
6. Lawyer
7. Vigilante
8. Doctor
9. Magician
10. Jester (`Postman`, Night 1 wake slot for assignment)
11. Grandma (Night 1 wake slot for assignment)
12. Detective

### Engine Resolution Order (internal logic)

1. Target modifiers (Bus Driver)
2. Ability blocks (Bartender)
3. Protection (Doctor / Lawyer day defense)
4. Kill resolution
5. Passive effects (Grandma, lovers, etc.)
6. Investigations (Detective results)
7. Post-investigation state changes (recruit/flags)

## Win Conditions (Implemented)

- `Town wins`
  - When Mafia, Rival Mafia, and Serial Killer are eliminated
- `Mafia wins`
  - Mafia alive, Rival Mafia eliminated, Serial Killer eliminated, and Mafia ties/outnumbers Town + Neutral
- `Rival Mafia wins`
  - Rival Mafia alive, Mafia eliminated, Serial Killer eliminated, and Rival Mafia ties/outnumbers Town + Neutral
- `Serial Killer wins`
  - Serial Killer is the last player alive

Note: Jester (`Postman`) currently has a day-triggered death ability (`Last Laugh`) but does **not** have a separate implemented win condition message in the engine.

## Roles in the Game (Current)

The app uses internal role keys for logic, but some are presented with table-friendly names in the UI:
- `Miller` is shown as **Outcast**
- `Postman` is shown as **Jester**

### Town

- **Civilian**
  - `Common Citizen` (Passive): No night ability

- **Detective**
  - `Investigation` (Active, Night): Learn if a target appears `Innocent` or `Guilty`

- **Doctor**
  - `Medical Protection` (Active, Night): Protect one player from night kills
  - `Limited Resources` (Passive): Cannot protect the same player on consecutive nights

- **Outcast** (internal: `Miller`)
  - `False Suspicion` (Passive): Appears `Guilty` to Detective

- **Cupid**
  - `Lover's Bond` (Active, Night 1): Link two players as Lovers
  - `Shared Fate` (Passive): If one Lover dies, the other dies

- **Bus Driver**
  - `Route Swap` (Active, Night): Swap two players as targets for all actions

- **Undercover Cop**
  - `Deep Cover` (Passive): Wakes with Mafia but is Town-aligned
  - `Maintain Cover` (Passive): Cannot publicly reveal identity

- **Grandma**
  - `Home Defense` (Passive): Visitors can die when visiting Grandma
  - `Stand Your Ground` (Passive): Mafia targeting Grandma causes a Mafia death (with Godfather handling logic)

- **Magician**
  - `Vanishing Act` (Active, Night): One-time kill
  - `Escape Trick` (Active, Night): One-time save

- **Vigilante**
  - `Single Shot` (Active, Night): One-shot kill
  - `Preparation Time` (Passive): Cannot shoot Night 1
  - Engine behavior: if Vigilante kills Town, they are locked out

### Mafia

- **Mafia**
  - `Mafia Kill` (Active, Night): Team kill target

- **Godfather**
  - `Untouchable Reputation` (Passive): Appears `Innocent` to Detective

- **Lawyer**
  - `Legal Defense` (Active, Night): Protect one player from next day elimination

- **Made Man**
  - `Recruitment` (Active, Night): One-time Mafia recruit

- **Bartender**
  - `Strong Drink` (Active, Night): Cancels a target's active ability for the night

### Rival Mafia

- **Rival Mafia**
  - `Rival Kill` (Active, Night): Team kill target

### Neutral

- **Serial Killer**
  - `Night Kill` (Active, Night): Kill one player
  - `Lone Survivor` (Passive): Wins only if last alive

- **Jester** (internal: `Postman`)
  - `Last Laugh` (Triggered, Day): If hung, choose one player to die with them

## Important Interaction Notes (Current Behavior)

- **Bus Driver redirect applies before Bartender block**
  - Bartender may end up blocking a different role than originally targeted after a swap
- **Bus Driver + Detective**
  - Detective result preview reflects redirected target
- **Bus Driver + Grandma**
  - Grandma retaliation is based on who actually ends up visiting Grandma after redirects
- **Bartender + Detective**
  - Detective can be blocked; session UI warns moderator to provide no result
- **Made Man recruit + Detective**
  - Detective investigation is suppressed if Detective is recruited that same night
- **Lawyer Daytime Defense**
  - Stops a day hang on the defended player
  - Also stops Jester `Last Laugh` if Jester selects the defended player

## Project Structure

- `src/app/page.tsx` - Setup wizard (players / roles / review)
- `src/app/session/page.tsx` - Session orchestration (night/day flow)
- `src/app/session/session-ui.tsx` - Shared session UI components
- `src/app/session/session-reducer.ts` - Session state transitions
- `src/domain/roles.ts` - Role definitions, ability copy, validation
- `src/domain/rules.ts` - Wake order + action validation
- `src/domain/engine.ts` - Night resolution engine + win condition evaluation
- `src/domain/engine.test.ts` - Targeted engine regression tests
- `src/lib/session.ts` - Local storage session persistence + migration
- `scripts/random-sim.ts` - Randomized simulation checks

## Persistence

- Session/draft state is stored in local storage (`schemaVersion` migrations supported)
- Ending a session preserves the current setup (player names + selected role counts) for the next new game

## Scope / Non-Goals (Current)

- Not a multiplayer synced moderator tool
- Not a player companion app
- No custom role editor/runtime custom-role engine yet

## Source / Rules Interpretation

This project is based on Apostrophe Games Mafia plus house-rule interpretation choices implemented in code. Some ambiguous interactions are resolved explicitly for consistency and may differ from other tables.
