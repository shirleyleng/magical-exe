# NEXT SESSION — T19: Final boss (3 phases) + Awakened→Ascended + endings

> Kickoff notes for the next session. Read `MEMORY.md` + `memory/v1-slice-status.md` first
> for full status. Delete/replace this file when T19 is underway.

## Where things stand (as of 2026-06-07)

Done & verified: T1–T16 (slice + AI + both axes + bosses #2/#3 + Soldier→Knight + rival arc),
**T17** (Boss #4 scripted story-loss + mascot injury + Sparring), and now **T18** (alliance visit
+ secret-place dungeon + the Hollow Doubt → magical weapon + mascot recovery + **Awakened** tier +
`true strike` ability + winnable Boss #4 rematch + rival-as-equal beat). Everything committed;
`config.js` stays uncommitted (synced to `docs/config.example.js`).

## What's next: T19 — Final boss + Ascension + endings (DESIGN §8, TASKS T19)

The finale. A 3-phase fight + the Awakened→Ascended tier + a Purity/Corruption fork on the ending.

- **Phase 1:** fight the "big boss" as the apparent source of the corruption.
- **Phase 2 (twist):** defeating P1 doesn't stop it — the boss becomes the **manifested despair of
  the whole city** (every person you couldn't help feeds it). Hopelessness made literal.
- **Phase 3 (ascension trigger):** you don't out-muscle despair — you **answer it with accumulated
  hope.** Gate ascension partly on a hidden **hope tally**; the rival fights beside you.
- **Purity/Corruption fork:** Pure = ascension through connection/hope; Corrupt = a darker
  ascension that seizes the despair's power → a different ending.

## ⚠️ Critical pre-req to design first: the hope tally has no SOURCE yet

`character.hopeTally` exists (`startingMeters`, currently 0) and `config.tiers.ascended =
{ reqBoss:"finalPhase2", reqMinHopeTally:50 }` is already wired into `progress.js handleBossDefeat`
(`reqs.reqMinHopeTally && ch.hopeTally < reqs.reqMinHopeTally`). BUT **nothing increments
hopeTally** today — Fame is the only meter that climbs. DESIGN §8 says *errands that bring people
hope are the true fight*. So T19 (or a T18.5) needs a **hope source**: an errand/help activity in
the hub that raises hopeTally (and probably ties into the existing `gainSaveCivilian` Fame hook
that was deferred in T15). Without it, ascension can't be gated on hope as designed.

## Likely open design calls to workshop first (don't code until decided)

1. How are the 3 phases structured in the engine? One `startCombat` with phase transitions inside
   `endCombat` (re-spawn next phase instead of ending), or three chained boss encounters? The
   `bossId` for the ascension gate is `finalPhase2` — decide what fires that and what `finalPhase3`
   /the final win looks like.
2. Where is the hope tally earned — a new `errand`/`help` hub activity (costs a slot, +hopeTally,
   maybe +Fame), and/or retroactively from existing errands (misdirection is currently the only
   errand and it's about hiding, not hope)? How much hope per action vs `reqMinHopeTally`?
3. Phase 3 ascension: is it automatic once hope ≥ threshold at the right moment, or a *choice* the
   player makes (answer despair with hope vs seize its power) that also sets the Pure/Corrupt fork?
4. The two endings — how different (just flavor text, or different final mechanics/credits)? Does
   reaching Ascended unlock anything post-game (prestige is T20)?
5. Does the rival literally join the fight (an ally in combat — new system) or is it narrative
   ("Sable fights beside you" as flavor + maybe a stat/heal assist)?

## Working notes / conventions

- All balance in `config.js` (gitignored, holds live keys); keep `docs/config.example.js` in sync.
  **Don't commit `config.js`.**
- Verify with the preview (`.claude/launch.json`, port 4321). **GOTCHA:** dynamic `import()` in
  `preview_eval` caches ES modules per page session — full-reload (`location.reload()` in its own
  eval) after each src edit before re-importing, or you test stale code. Drive logic via
  `update(state,event)` with `st.freshModel()` + `st.createState(m)`; suppress random room
  encounters with `m.world.cleared = { <roomId>: true }`.
- **Other gotchas:** (1) async victory narration sets `ui.busy` (input lock) — pace scripted drives.
  (2) Shell eats backticks in `git commit -m` — use a heredoc. (3) Don't bulk string-replace
  template fragments (clobbered eRef/ERef in combat.js once).
- Story reactions flow through `update.js afterCombat`: `ui.justDefeatedBoss`→`handleBossDefeat`
  (tier-up via `TIER_REVEAL`, beats via `BOSS_BEAT`, latched in `flags.storyBeats`),
  `ui.justLostStoryBoss`→`handleStoryLoss`. Tier gates live in `config.tiers` + handleBossDefeat.
  `BOSS_ENEMY` maps bossId→enemy; dungeons gate via `unlockReqBoss`/`unlockReqTier`/`unlockReqFlag`.
- **Outstanding polish (not blocking T19):** STATUS-panel labels are still abbreviated (PWR/SPR/
  DEF/SPD/STA) — a background task chip is open to spell them out + re-align columns. Mobile design
  pass still flagged in the backlog.
- Commit per logical chunk.
