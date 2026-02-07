# Mafia Moderator Helper

A moderator companion app for **Apostrophe Games Mafia**.

Project status snapshot: `docs/project-status.md`

Goals:
- Reduce moderator memory load
- Track complex role interactions
- Prevent rule mistakes
- Provide a clean night/day flow
- Serve as a rule reference for humans and AI agents

---

# Table of Contents

- Game Overview
- Alignments
- Win Conditions
- Night Flow
- Night Resolution Logic
- Roles
- Gameplay Rules
- Implementation Notes
- Project Scope
- Rule Interpretation Notes
- Future Ideas
- Source

---

# Game Overview

Mafia is a social deduction game where players are secretly assigned roles and alignments.

Game loop:
- Night Phase -> special roles act secretly
- Day Phase -> players debate and vote to eliminate someone

The game continues until a win condition is met.

---

# Alignments

- Town
- Mafia
- Rival Mafia
- Neutral (has its own win condition)

---

# Win Conditions

Town Win
- All Mafia, Rival Mafia, and Serial Killer are eliminated.

Mafia Win
- Mafia tie or outnumber Town, and all Rival Mafia and Serial Killer are eliminated.

Rival Mafia Win
- Rival Mafia functions the same as Mafia: they win by tying or outnumbering Town, and all original Mafia and Serial Killer are eliminated.

Neutral Win
- Neutrals have their own win condition as defined on their role card.
- Examples: Serial Killer must be last alive, Postman wins if voted out during the day.

---

# Night Flow (Moderator Wake Order)

Recommended wake order for moderation. Roles are skipped if the role is dead or not in play.

Night 1 only
1. Cupid selects Lovers

Every night
1. Mafia Team (includes Godfather, Made Man, Undercover Cop)
2. Rival Mafia (if in play)
3. Serial Killer (if in play)
4. Bartender
5. Lawyer
6. Vigilante
7. Detective
8. Doctor
9. Magician
10. Bus Driver

---

# Night Resolution Logic (Engine Order, Game Logic Only)

This order is for the engine's internal resolution after all actions are collected.
It does not describe who wakes up when. Use the moderator wake order above for that.

1. Target Modifiers
- Bus Driver swaps targets

2. Ability Blocks
- Bartender cancels abilities

3. Protection
- Doctor protection
- Lawyer protection

4. Kill Resolution
- Mafia kills
- Vigilante kills
- Serial Killer kills
- Magician kill

5. Passive Effects
- Lover chain deaths
- Grandma retaliation
- Postman revenge kill (only if voted out during the day)

6. Investigation Results
- Miller false positive
- Godfather false negative

---

# Roles

Town

Civilian (16)
- Bystanders with no special ability.

Detective / Cop
- Can investigate one player each night.
- Moderator reveals whether the player is Mafia aligned.

Doctor
- Can protect one player each night.
- If the protected player is attacked, they survive.
- Doctor can protect themselves.
- Doctor cannot protect the same player two nights in a row.

Miller
- Is a Town player.
- Appears as Mafia when investigated by Detective.

Cupid
- Acts only at the start of the game (Night 1).
- Selects two players to become Lovers.
- If one Lover dies, the other dies immediately.

Bus Driver
- Each night selects two players.
- All actions targeting Player A instead affect Player B.
- All actions targeting Player B instead affect Player A.

Undercover Cop
- Wakes up with the Mafia.
- Is not a Detective.
- Secretly works for the Civilians by steering Mafia away from key targets.
- Cannot reveal their identity.

Grandma With a Gun
- Wins with Town.
- If ANY player visits Grandma at night -> that player dies instantly.
- If Mafia targets Grandma -> one Mafia member dies at random.
- Exception: if Godfather is in play, Godfather is excluded from random selection unless they are the last Mafia standing.

Magician
- One kill per game at night.
- One save per game at night.

Vigilante
- Cannot shoot on Night 1 (loading).
- May kill one player (one use only).
- If they kill a Town member, they lose their remaining shot (cannot shoot again).

---

Mafia

Mafia (4)
- Choose one player each night to kill.
- Mafia know each other.

Godfather
- Leads Mafia.
- Appears innocent when investigated.
- Mafia lose if the Godfather dies.

Lawyer
- Selects one player each night to defend.
- That player cannot be eliminated the next day.

Made Man
- Acts with Mafia.
- Once per game can recruit one player to join Mafia.

Bartender
- Does NOT know who Mafia are.
- Each night selects one player.
- That player's ability is cancelled for that night.

---

Rival Mafia

Rival Mafia (2)
- Separate Mafia faction.
- Chooses nightly kill target.
- Wins by eliminating original Mafia and matching or exceeding remaining players.

---

Neutral

Serial Killer
- Kills one player each night.
- Wins only if they are last alive.

Postman
- If Postman is voted out during the day, they select one player to die with them.
- Postman wins if voted out during the day.

---

Moderator
- Runs the game.
- Collects night actions.
- Narrates results.
- Ensures fairness and secrecy.

---

# Day Phase

1. Moderator announces deaths
2. Players debate
3. Players nominate suspects
4. Players vote
5. Player with most votes is eliminated
6. Eliminated player reveals role
7. Repeat Night Phase

---

# Gameplay Rules

- Dead players cannot speak or influence game.
- Roles remain secret until death.
- Moderator rulings are final.

---

# Implementation Notes (For Future Dev Work)

Role mechanics include:
- Target manipulation
- Ability blocking
- Passive triggers
- Alignment spoofing
- Recruitment mechanics
- Multi-faction tracking

Engine support required:
- Configurable wake order
- Configurable resolution order
- Event logging
- Role metadata driven logic

---

# Project Scope

This project is:
- A moderator helper
- Not a full player app
- Designed primarily for in-person games

---

# Rule Interpretation Notes

Some roles have ambiguous behavior in printed rules.
This project uses consistent internal interpretations where necessary.
These interpretations may evolve.

---

# Future Ideas

- Role configuration editor
- Multi-device moderator sync
- Printable player cards
- Game log playback

---

# Role Card Copy (Source of Truth)

The following copy is the canonical role card text for the app UI.

Copy rules:
- Bracketed text like `[Ability Name]` is a direct reference to an ability listed on the same role card.
- Bracket references should remain intact.
- Keep summaries flavorful but concise and party-game readable.
- Avoid fantasy-heavy or overly theatrical language.
- Ability names must match exactly.

---

Civilian

Summary:
- A `[Common Citizen]` with no special abilities.

Abilities:
1. Common Citizen (Passive): No night ability. Wins with the Town by eliminating hostile factions.

---

Detective

Summary:
- A determined investigator who relies on `[Investigation]` to uncover the truth.

Abilities:
1. Investigation (Night): Choose one player to learn whether they are aligned with the Mafia.

---

Doctor

Summary:
- A medical professional who protects others using `[Medical Protection]`.

Abilities:
1. Medical Protection (Night): Choose one player to protect from night kills.
2. Limited Resources (Passive): Cannot protect the same player on consecutive nights.

---

Miller

Summary:
- An innocent citizen burdened by `[False Suspicion]`, often mistaken for a criminal.

Abilities:
1. False Suspicion (Passive): Appears as Mafia when investigated.

---

Cupid

Summary:
- A matchmaker who creates powerful connections through `[Lover’s Bond]`.

Abilities:
1. Lover’s Bond (Night 1): Choose two players to become Lovers.
2. Shared Fate (Passive): If one Lover dies, the other dies immediately.

---

Bus Driver

Summary:
- A night driver who causes confusion using `[Route Swap]`.

Abilities:
1. Route Swap (Night): Choose two players. All actions targeting one are redirected to the other.

---

Undercover Cop

Summary:
- An investigator secretly embedded within the Mafia using `[Deep Cover]`.

Abilities:
1. Deep Cover (Passive): Wakes with the Mafia while remaining aligned with the Town.
2. Maintain Cover (Passive): Cannot publicly reveal identity.

---

Grandma With a Gun

Summary:
- A protective homeowner who defends her property through `[Home Defense]`.

Abilities:
1. Home Defense (Passive): Any player who visits Grandma at night risks being killed in retaliation.
2. Stand Your Ground (Passive): If targeted by the Mafia, a Mafia member dies instead.

---

Magician

Summary:
- A mysterious performer capable of manipulating outcomes through `[Vanishing Act]` and `[Escape Trick]`.

Abilities:
1. Vanishing Act (Night, One-Time): Choose one player to kill.
2. Escape Trick (Night, One-Time): Choose one player to save from a night kill.

---

Postman

Summary:
- A messenger who ensures one final delivery through `[Final Delivery]`.

Abilities:
1. Final Delivery (Triggered): When the Postman dies, choose one player to die with them.

---

Vigilante

Summary:
- A lone enforcer who delivers justice using `[Single Shot]`.

Abilities:
1. Single Shot (Night, One-Time): Choose one player to kill.
2. Preparation Time (Passive): Cannot use their ability on Night 1.

---

Mafia

Summary:
- A coordinated criminal group that removes threats using `[Mafia Kill]`.

Abilities:
1. Mafia Kill (Night): The Mafia collectively choose one player to kill.

---

Godfather

Summary:
- The Mafia’s leader who avoids suspicion through `[Untouchable Reputation]`.

Abilities:
1. Untouchable Reputation (Passive): Appears innocent when investigated.

---

Lawyer

Summary:
- A skilled defender who shields allies using `[Legal Defense]`.

Abilities:
1. Legal Defense (Night): Choose one player to protect from being voted out the next day.

---

Made Man

Summary:
- A trusted Mafia member who expands their ranks through `[Recruitment]`.

Abilities:
1. Recruitment (Night, One-Time): Choose one player to join the Mafia.

---

Bartender

Summary:
- A manipulative drink server who disrupts others using `[Strong Drink]`.

Abilities:
1. Strong Drink (Night): Choose one player. Their active ability is cancelled for that night.

---

Serial Killer

Summary:
- A dangerous individual who hunts alone using `[Night Kill]`.

Abilities:
1. Night Kill (Night): Choose one player to kill.
2. Lone Survivor (Passive): Wins only if they are the last player alive.

---

Rival Mafia

Summary:
- A competing criminal faction that attacks using `[Rival Kill]`.

Abilities:
1. Rival Kill (Night): Rival Mafia collectively choose one player to kill.

---

# Source

Based on Apostrophe Games Mafia Party Game rules sheet and personal gameplay interpretation.
