# Rules Consistency Deltas

Date: 2026-02-07
Scope: Gameplay rules parity review only. No engine logic changed in this pass.

## Implemented or Partially Implemented

- Wake order scaffold exists and includes `Cupid` on Night 1 plus the core nightly order list.
- Action validation exists for:
  - `Vigilante` Night 1 lockout and one-shot usage.
  - `Doctor` consecutive-target restriction.
  - `Magician` one-time kill/save choice validation.
  - `Cupid` Night 1 only + one-time usage.
  - `MadeMan` one-time recruit usage.
- Resolution phase order constants exist:
  - `TargetModifiers`, `AbilityBlocks`, `Protection`, `Kills`, `PassiveEffects`, `Investigations`.

## Rule Deltas (README vs Current Engine)

1. Resolution behavior is not implemented yet.
- Current `src/domain/engine.ts` defines only order constants and kill-role constants.
- Missing actual resolution execution for target swapping, blocks, protections, kills, passives, and investigations.

2. Target modifiers are declared but not executed.
- README expects Bus Driver swap effects in resolution.
- No current logic applies Bus Driver redirection to incoming actions.

3. Ability block behavior is missing.
- README expects Bartender to cancel target ability for that night.
- No state/effect pipeline currently marks and enforces blocked actions.

4. Protection behavior is missing beyond validation metadata.
- Doctor/Lawyer effects are described in README.
- No resolution logic currently applies saved targets or day-vote immunity windows.

5. Passive effects are missing.
- Lover chain deaths are not resolved.
- Grandma retaliation and Mafia-random retaliation logic (with Godfather exception) is not implemented.
- Postman revenge kill condition ("only if voted out during day") is not implemented in day/elimination flow.

6. Investigation spoofing is missing.
- Miller/Godfather investigation overrides are documented.
- No investigation resolver currently computes spoofed outcomes.

7. Win-condition logic is missing.
- README defines Town/Mafia/Rival Mafia/Neutral win checks.
- No win-condition evaluator currently enforces those rules (including Godfather death loss condition).

8. Mafia-team wake semantics are incomplete.
- README wake step says "Mafia Team (includes Godfather, Made Man, Undercover Cop)".
- Current wake-order output contains role-type steps only and does not model grouped team wake semantics.

9. Day-phase enforcement hooks are missing.
- Rules like "dead players cannot speak/influence" and day-elimination side effects are not represented in engine logic.

## Recommended Follow-Up (Separate Logic Pass)

1. Implement a real `resolveNightActions` pipeline matching `RESOLUTION_ORDER`.
2. Add role-state/event structures for:
- blocked actions
- protected players
- lover links and chain deaths
- visit tracking for Grandma retaliation
- day-only triggers (Lawyer/Postman)
3. Add investigation resolver with Miller/Godfather spoof rules.
4. Add `evaluateWinConditions` with explicit faction checks.
5. Add tests for each rule delta before enabling behavior in UI flows.
