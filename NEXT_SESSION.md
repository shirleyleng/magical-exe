# NEXT SESSION — T19: Final boss (3 phases) + Awakened→Ascended + endings

> Kickoff notes for the next session. Read `MEMORY.md` + `memory/v1-slice-status.md` first
> for full status. Delete/replace this file when T19 is underway.

## Where things stand (as of 2026-06-07)

Done & verified: T1–T16 (slice + AI + both axes + bosses #2/#3 + Soldier→Knight + rival arc),
**T17** (Boss #4 scripted story-loss + mascot injury + Sparring), and now **T18** (alliance visit
+ secret-place dungeon + the Hollow Doubt → magical weapon + mascot recovery + **Awakened** tier +
`true strike` ability + winnable Boss #4 rematch + rival-as-equal beat). Everything committed;
`config.js` stays uncommitted (synced to `docs/config.example.js`).

## What's next: T19 finale — fully designed, see DESIGN §9.5 "The finale"

The hope LAYER (front half of T19) is built (below). What remains is the **finale that consumes the
tally** — a 3-phase fight + the Awakened→Ascended resolution with a **four-ending** fork (note the
axis is now **Virtue**, not Purity):

- **Phase 1:** the "big boss," apparent source — a real winnable fight.
- **Phase 2 (twist):** you kill it and it *reforms as the city's despair* — another **normal
  winnable** fight (no damage-wall; the theme rides the fiction + the gate).
- **Phase 3 = ascension resolution:** a dramatized brink CHOICE ("answer with hope" / "seize the
  despair") + a **fuel-check gate WITH TEETH**. Four endings (2×2 = reach × enough-fuel):
  Virtuous Ascension (you + guardian-deity mascot) · Dark Ascension (dark deity, self intact) ·
  Quiet Tragedy (hope-but-short, replayable) · Eldritch Merge (seize-but-short → you+mascot become
  the horror; art = the mascot's own ASCII corrupted). Fame lowers the hope threshold.

Full spec + the build chunks are below and in DESIGN §9.5.

## ✅ Hope-source LAYER is BUILT (front half of T19, 2026-06-07)

The hidden Hope tally + all its sources are coded, verified, committed (config.js untracked):
- `src/hope.js` — `adjustHope` (only mutator, floors at 0, never shown as a number) +
  `hopeBand`/`hopeMoodLine` coarse ambient feedback.
- **Pull:** `errand` hub verb/menu (`config.errands` trade-off archetypes; bigger = better
  hope/slot; public rescue hidden under `mustLieLow`) in hub.js — deltas applied SILENTLY.
- **Push:** `src/dilemmas.js` one-shot rest events (`config.dilemmas`) with ambiguous outcomes +
  a hope-leaking inaction branch; latched in `flags.dilemmasSeen`.
- **Passive:** `config.errands.passiveHopePerBoss` on boss wins.
- **Feedback:** `doRest` reads the city's mood only when the hope band shifts (`ch.hopeBandSeen`).
- Verified: per-chunk + a 6-day integration (hope 73 / virtue 37, all dilemmas fired, no number
  ever printed). What remains of T19 is the **finale that consumes the tally** (below).

## ✅ The FINALE is fully designed too — see DESIGN.md §9.5 "The finale"

Workshopped 2026-06-07; the open calls are all decided. Build plan (suggested chunks):

1. **Final location + the two boss forms.** A final dungeon unlocked after the Awakened Boss #4
   rematch (`unlockReqBoss: "boss4"`), entered when the player chooses (state at entry = ending).
   Two enemies: P1 "big boss" + P2 the despair manifestation. Mascot soft-warns without revealing
   the hidden meter.
2. **Phase transitions in combat.** ONE continuous fight: a `phases` list on the combat state; on
   P1 victory, `endCombat` swaps to P2 (narrate the twist) instead of resolving; on P2 victory it
   triggers the ascension resolution (set a ui flag, e.g. `ui.finaleResolve`). Both phases are
   NORMAL winnable fights — no damage-wall. Losing a phase = gentle wake-at-home, re-enterable.
3. **Dedicated finale resolver** (new module, e.g. `src/endgame.js` — NOT `handleBossDefeat`).
   Presents the brink CHOICE menu ("answer with the hope you've gathered" / "seize the despair's
   power"), then the fuel-check gate → one of four endings (2×2: reach × enough-fuel). WITH TEETH:
   an off-path reach you lack fuel for fails. `effHopeThreshold = clamp(50 − fame·0.2, 30, 50)`;
   seize needs high Corruption / `path==="corrupt"`.
4. **Endings + the mascot-art horror.** Four ending screens (Virtuous Ascension w/ guardian-deity
   mascot · Dark Ascension · Quiet Tragedy (replayable) · Eldritch Merge). The Eldritch Merge art =
   a deterministic corruption of the player's own mascot ASCII (`mascot.js` ART → glitched/broken).
   Set `transformationTier = "ascended"` on the two ascension endings (+ slot). Point to prestige
   (T20) after a win.
5. **Climax flavor:** rival + relationships as narrative + light scripted assists (once-a-phase
   Sable assist, mascot heal) — NOT a full ally-combat system. The ascension narration enumerates
   what "feeds back" (Fame, errands/hope, mascot bond, Sable).

Small flavor still to write at build time: the mascot's fate in the Dark Ascension (bound/dimmed
familiar? horrified?); the exact `corrThreshold` for "seize" success.

Reusable hooks already in place: `config.tiers.ascended` ({reqBoss:"finalPhase2", reqMinHopeTally:50}),
`character.hopeTally` (now sourced), the T17 phase/clamp combat patterns, the menu system (add a
finale-choice kind), `src/hope.js` for the threshold read.

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
