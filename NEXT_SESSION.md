# NEXT SESSION — T16: Bosses #2 & #3 + Soldier→Knight + rival introduction

> Kickoff notes for the next session. Read `MEMORY.md` + `memory/v1-slice-status.md` first
> for full status. Delete/replace this file when T16 is underway.

## Where things stand (as of 2026-06-06)

Done & verified live: T1–T13 (slice + AI layer), **T11b** (Turnstile spend-gate), **T14 + T14.5**
(Purity/Corruption axis), and now **T15** (Fame/Unmasking visibility axis — public-win gains,
corruption-as-conspicuous, danger-bar HUD, escalating low/mid/high events, `lie low` +
`misdirection` lowering methods). Settings menu + themes + Ko-fi also shipped. Everything committed.

T15 DEFERRED (a clean follow-up when you want it, see `docs/TASKS.md` T15):
- relocate-hub (2 days / all slots) + **memory cloud** (Pure) / **memory wipe** (Corrupt) abilities.
- the high-tier "choose to reveal yourself to save someone" branching crisis (today: a lock + warning).
- Unmasking gains in the forest (intentionally witness-free right now).
- `gainSaveCivilian` — unwired; no civilian-rescue action exists in the slice yet.

## What's next: T16 — tiers 3–5 story arc (DESIGN.md, TASKS.md T16)

- Bosses **#2 and #3** (new dungeons / encounters beyond the Moonlit Forest boss).
- Transformation **Soldier → Knight** tier-up (mirrors the T9 Novice→Soldier + alliance reveal;
  see `state.ui.justDefeatedBoss` hook in `combat.js` endCombat victory, reacted to in update/T9 code).
- **Rival introduction** — the rival arc begins. `model.rivals` already seeds `Sable`
  (power 14, corruption 50, `scheduleState:"dormant"`); `world.flags.metRival` / `rivalChallengeDay`
  exist but nothing drives them yet.

## Likely open design calls to workshop first (don't code until decided)

1. New dungeon(s) vs. reuse the forest graph with scaled enemies for bosses #2/#3?
2. How/where the rival first appears — hub event on a day-tick, a dungeon encounter, or gated
   by Fame (a famous persona attracts a rival)? Could tie into the new T15 Fame meter.
3. Knight tier: what changes mechanically (stat bumps, new slots, kit) beyond flavor?
4. Does the rival's disposition key off the player's path (Pure/Corrupt) and/or Unmasking?

## Working notes / conventions

- All balance in `config.js` (gitignored, holds live keys); keep `docs/config.example.js` in sync.
  **Don't commit `config.js`.**
- Verify with the preview (`.claude/launch.json`, port 4321) + reload after every src edit. Drive
  deterministic logic via `preview_eval` importing modules with throwaway state objects.
- **Gotcha:** async victory narration sets `ui.busy` (input lock) — scripted `attack` spam drops
  follow-up turns; pace combat drives or wait for the lock to clear.
- Mutator pattern: `src/alignment.js` (`adjustAlignment`) and `src/visibility.js`
  (`adjustVisibility`) are the single mutators for their axes — follow that shape for new meters.
- Commit per logical chunk. Avoid backticks in `git commit -m` messages (the shell eats them).
