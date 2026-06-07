# NEXT SESSION — T17: Boss #4 story-loss + mascot injury + sparring

> Kickoff notes for the next session. Read `MEMORY.md` + `memory/v1-slice-status.md` first
> for full status. Delete/replace this file when T17 is underway.

## Where things stand (as of 2026-06-06)

Done & verified live: T1–T13 (slice + AI layer), **T11b** (Turnstile spend-gate), **T14 + T14.5**
(Purity/Corruption axis), **T15** (Fame/Unmasking axis), and now **T16** (Bosses #2/#3 + the
`explore` chooser + Soldier→Knight tier-up + corruption story beats + the rival Sable arc:
scheduled challenge duel + post-boss3 return). Everything committed; `config.js` stays uncommitted.

T16 DEFERRED (clean follow-ups, see `docs/TASKS.md` T16):
- Knight-tier ability kit — all abilities are still gated to `novice` (`config.abilities`);
  Knight currently grants +1 slot + flavor only. Add knight-gated abilities when desired.
- The rival's recurring-challenge loop — the return scene just sets `disposition: "respectful"`;
  Sable doesn't yet re-challenge on a recurring cadence.

## What's next: T17 — Boss #4 scripted story-loss + mascot injury + sparring (DESIGN §8)

The Knight→Awakened low point. This is the first **scripted, unwinnable** fight.

- **Scripted story-loss Boss #4:** telegraphed so it never reads as a bug or cheap skill failure
  — mascot warns up front, boss HP barely moves, narrative loss at a turn cap. Config already
  exists: `config.combat.storyLoss` (`enabled`, `maxPlayerTurnsBeforeIntervene: 5`,
  `bossHpVisibleDrainPerHit: 0.01`). Implement as a scripted story-battle, NOT normal combat —
  likely a distinct path in `combat.js` (or a guard in `endCombat`/`enemyTurn`) that intervenes
  at the turn cap regardless of damage.
- **Mascot injured + disappears:** after the loss, the mascot is hurt and leaves. Mascot lives in
  `model.mascot`; the HUD MASCOT panel + `progress.js` reveals reference it. Need a "mascot gone"
  state the HUD + training respect.
- **Sparring unlocks (rival):** Sable's training role replaces the mascot's. `DESIGN` §2/§7:
  Sparring is an activity that takes the mascot's training slot-role after the injury. The rival
  arc (T16, `src/rival.js`, `model.rivals[0]`) and the hub activity-slot system (`hub.js`,
  `slotsUsedToday.sparring` already exists as a key) are the hooks.

## Likely open design calls to workshop first (don't code until decided)

1. Where does Boss #4 live — a new dungeon, or a forced hub/story encounter? How is it reached
   (gated by Knight tier + a story flag)?
2. How is the scripted loss implemented — a separate `startStoryLoss` flow, or normal `startCombat`
   with a `storyLoss` flag that forces the intervention at the turn cap?
3. Mascot-gone: does training fully disable (forcing Sparring), or just reflavor? HUD treatment for
   the empty MASCOT panel?
4. Sparring mechanics — same as training (direct stat growth) but via the rival, or its own
   risk/reward (e.g. a spar that can also teach an ability)?

## Working notes / conventions

- All balance in `config.js` (gitignored, holds live keys); keep `docs/config.example.js` in sync.
  **Don't commit `config.js`.**
- Verify with the preview (`.claude/launch.json`, port 4321) + reload after every src edit. Drive
  deterministic logic via `preview_eval` importing modules with throwaway state objects (use
  `st.freshModel()` + `st.createState(m)` for a valid model; note `createState` recomputes `path`
  from the meters, so set `purity`/`corruption` to test path-flavored branches).
- **Gotchas:** (1) async victory narration sets `ui.busy` (input lock) — pace scripted combat
  drives. (2) The shell eats backticks in `git commit -m` — avoid them. (3) Don't bulk
  string-replace template fragments like `the ${e.name}` across a file — it clobbered the
  eRef/ERef helper definitions in combat.js last time; prefer targeted edits.
- Mutator pattern: `alignment.js` (`adjustAlignment`), `visibility.js` (`adjustVisibility`) are the
  single mutators for their axes. Boss reactions flow through `progress.js handleBossDefeat`
  (`state.ui.justDefeatedBoss`); day-cycle events tick from `update.js` after `doRest`/`doLieLow`.
- Commit per logical chunk.
