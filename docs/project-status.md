# Project Status Snapshot

Last updated: 2026-02-07

## Current State

The project has completed the copy and role-card UX pass. Gameplay engine logic updates are intentionally separated and still pending.

## Completed

1. Canonical role copy sync
- `src/domain/roles.ts` mirrors README role-card copy for summaries and abilities.
- Legacy conflicting role phrasing was removed from role data.

2. Role data structure cleanup
- Role data is normalized around `notes` and `abilities`.
- Bracket references in summaries are validated against same-role ability names.

3. Card rendering consistency
- Role card hierarchy is consistent (name, alignment, icon, summary, separator, abilities).
- Summary highlighting is ability-name focused (no generic keyword tokenization).

4. Tooltip/token noise control
- Only summary ability references are interactive.
- Ability pills are non-interactive labels.
- Generic terms like kill/day/night are not tokenized as pills.

5. Copy QA and parity pass
- Ability names and summary references are aligned across README, role data, and UI render paths.
- Backtick artifacts in summary rendering were removed.

6. Roles UX improvements
- Ability rows include activation metadata pills (phase/type).
- Passive abilities display `Passive` (without `Any`).
- Cupid `Lover’s Bond` shows `Night 1 · Active`.
- Role icon moved to top-right of card header row.
- Unique badge moved next to alignment badge.
- Roles accordion defaults to collapsed.
- Added `Expand All` / `Collapse All` controls.
- Roles list scrolls inside Game Setup card to keep right-side status cards visible.
- No default role counts are prefilled.
- Session Status now shows per-alignment role breakdown with counts.

## Completed Artifacts

- `src/domain/roles.ts`
- `src/app/page.tsx`
- `docs/rules-consistency-deltas.md`

## Pending (Next Session)

1. Manual responsive/UI verification pass
- Confirm desktop + mobile behavior after latest layout changes.
- Validate no clipping/overflow regressions across all role cards.

2. Engine logic phase (separate pass)
- Implement night resolution execution pipeline.
- Add passive/triggered effect handling.
- Add investigation spoof resolution and win-condition evaluation.
- Add targeted tests before enabling full behavior in session flow.

## Quick Resume Checklist

1. Run `npm run lint`.
2. Start app with `npm run dev`.
3. Verify Roles tab:
- collapse/expand controls
- internal scroll behavior
- ability activation pills and card control accessibility
4. Continue from `docs/rules-consistency-deltas.md` for engine work.
