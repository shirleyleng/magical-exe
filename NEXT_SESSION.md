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

## ✅ Hope tally + endings design is LOCKED — see DESIGN.md §9.5

Workshopped 2026-06-07. Full spec in **DESIGN.md §9.5 "Hope tally & the ending fork"**. Summary:
- **Hope is hidden.** Sources: (1) a repeatable opt-in **`errand` hub activity** with archetypes
  that TRADE axes (quiet kindness = hope+purity; public rescue = hope+fame+unmask via the stubbed
  `gainSaveCivilian`; expedient/dark help = small hope + corruption); bigger errands give a BETTER
  hope/slot rate (commitment pays). (2) **One-shot dilemma events** that fire at `rest` (reuse the
  T15 event-tick) with sincere/expedient/**ignore** branches — ignoring costs hope. (3) **Passive**
  hope per boss + per kindly rescue.
- **Feedback:** per-choice ambiguous (no numbers), but the cumulative trend is FELT via city-mood
  flavor + mascot reads + Fame as a loose proxy; the ending names it in retrospect. Heavy themes
  stay in lingering ambiguity, not on-screen horror (cozy register).
- **Endings (path-first, Fame-modified):** pure+hope≥THRESHOLD → Pure Ascension; corrupt path →
  Dark Ascension (banked hope can't override what you became); else → Despair ending. Fame LOWERS
  the hope threshold needed (`reqMinHopeTally`=50, floor ~30). The coupled slider keeps hope-earning
  and corruption near-mutually-exclusive on its own.
- **`hopeTally` still has no code SOURCE today** — building it is the front half of T19 (or T18.5),
  and must land BEFORE the finale + ending screens that consume it.

## Likely open design calls still to workshop (don't code until decided)

1. How are the 3 phases structured in the engine? One `startCombat` with phase transitions inside
   `endCombat` (re-spawn next phase instead of ending), or three chained boss encounters? The
   `bossId` for the ascension gate is `finalPhase2` — decide what fires that and what `finalPhase3`
   /the final win looks like.
2. Phase 3 ascension: automatic once the gate (path + hope/Fame) is met at the right moment, or a
   *choice* the player confirms (answer despair with hope vs seize its power)?
3. The endings — how different (flavor text only, or different final mechanics/credits)? Does
   reaching Ascended unlock anything post-game (prestige is T20)?
4. Does the rival literally join the fight (an ally in combat — new system) or is it narrative
   ("Sable fights beside you" as flavor + maybe a stat/heal assist)?
5. Errand content: how many archetypes ship (3 vs +restoration/cleanse 4th), and how many authored
   one-shot dilemma events for the first pass?

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
