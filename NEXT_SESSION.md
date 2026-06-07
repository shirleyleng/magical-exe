# NEXT SESSION — T20: prestige / clean-slate + Easy/Normal scaling

> Kickoff notes for the next session. Read `MEMORY.md` + `memory/v1-slice-status.md` first
> for full status. Delete/replace this file when T20 is underway.

## Where things stand (as of 2026-06-07)

**The whole story arc is DONE.** T1–T18 (slice + AI + both axes + bosses #1–#4 + rival arc +
secret-place + Awakened) and now **all of T19** — the hope layer (errands + dilemmas + passive +
ambient mood) AND the **finale**:

- `source` dungeon "the Heart of the Grey" (`unlockReqBoss:"boss4"`), entered when the player chooses.
- ONE continuous two-phase fight (`combat.js`): P1 `grey_sovereign` "the Grey Sovereign" → (twist) P2
  `city_despair` "the City's Despair". `advancePhase` swaps forms in place; `triggerFinaleResolve`
  hands off via `ui.finaleResolve`. Once-per-phase Sable/mascot clutch assist (heal + stagger).
- `src/endgame.js` brink resolver (NOT handleBossDefeat): a no-take-back choice menu (kind "brink",
  esc-proof) + the fuel-check gate WITH TEETH → four endings:
  - **Virtuous Ascension** (hope ≥ `clamp(50−fame·0.2,30,50)`): you + guardian-deity mascot.
  - **Dark Ascension** (corruption ≥ 50 or path corrupt): dark deity, self intact, mascot bound/dimmed.
  - **Quiet Tragedy** (reached for hope, short): survive hollow — NOT ascended, finale stays replayable.
  - **Eldritch Merge** (seized, short = hubris): you+mascot become the horror; art = `mascot.js
    corruptArt`, a deterministic corruption of the player's own mascot ASCII.
  - Both ascensions set `transformationTier="ascended"` + `flags.ascended` + a milestone slot; coda
    points to prestige.

Everything committed (`config.js` stays untracked, synced to `docs/config.example.js`). Verified per
chunk + a full real-path `update()` integration + a live screenshot. Console-clean.

## What's next: T20 — prestige / clean-slate + Easy/Normal scaling (DESIGN §9)

Hooks already in place:
- `model.prestigeCount` (state.js) + `CONFIG.prestige` (`statMultiplier:0.5`,
  `enemyScalePerPrestigeNormal:0.1`, `enemyScalePerPrestigeEasy:0.0`).
- `combat.js spawnEnemy` ALREADY applies `prestigeScale` off `prestigeCount` + the difficulty's
  `prestigeScalesEnemies` flag — so enemy scaling is wired; what's missing is the *prestige action*.
- `flags.ascended` now marks a completed run — the natural trigger to OFFER prestige from.
- `CONFIG.difficulty[normal|easy]` multipliers already feed spawnEnemy; difficulty is chosen... check
  whether character creation sets `model.difficulty` (it defaults to "normal" in freshModel) — may need
  an Easy/Normal pick in creation or settings.

Suggested build (DESIGN §9 "Meta systems"):
1. A `prestige` hub verb (gated on `flags.ascended`, or available anytime per design — decide):
   confirm-menu → halve current stats (`statMultiplier`), `prestigeCount++`, reset story progress
   (bosses/tier/flags/weapon/mascot) but KEEP identity (name/mascot/city/secretPlace) + maybe a
   keepsake. Incremental-game "prestige" feel.
2. Easy/Normal surfaced to the player (creation step or settings) writing `model.difficulty`.
3. Verify enemy scaling actually changes with prestigeCount on Normal vs Easy.

Then T21: credits/about polish (About screen exists) + deploy (static files → Netlify/Pages; the
Supabase fn is already deployed). See `docs/TASKS.md`.

## Working notes / conventions (unchanged)

- All balance in `config.js` (gitignored, holds live keys); keep `docs/config.example.js` in sync.
  **Don't commit `config.js`.** Avoid backticks in `git commit -m` — use a heredoc.
- Verify with the preview (`.claude/launch.json`, port 4321). **GOTCHA:** dynamic `import()` in
  `preview_eval` caches ES modules per page session — full-reload (`location.reload()` in its own
  eval) after each src edit before re-importing, or you test stale code. Drive logic via
  `update(state,event)` with `st.freshModel()` + `st.createState(m)`; suppress random room encounters
  with `m.world.cleared = { <roomId>: true }`. To screenshot a real rendered state, inject a model
  into `localStorage` (`magicalexe:slot:<name>` + `magicalexe:active`) and reload — restore the prior
  active slot after.
- **Other gotchas:** async victory narration sets `ui.busy` (boss wins aren't narrated, so finale
  drives run synchronously). Don't bulk string-replace template fragments in combat.js (clobbered
  eRef/ERef once). Boss names beginning with "the" now flow through the eRef/ERef article helpers.
- Story reactions flow through `update.js afterCombat`: `justDefeatedBoss`→handleBossDefeat,
  `justLostStoryBoss`→handleStoryLoss, `finaleResolve`→`endgame.js handleFinaleResolve`.
- **Outstanding polish (not blocking):** STATUS-panel labels still abbreviated (PWR/SPR/DEF/SPD/STA) —
  a background task chip is open. Mobile design pass still flagged in the backlog.
