# NEXT SESSION — T18: Secret-place dungeon + magical weapon + Knight→Awakened

> Kickoff notes for the next session. Read `MEMORY.md` + `memory/v1-slice-status.md` first
> for full status. Delete/replace this file when T18 is underway.

## Where things stand (as of 2026-06-07)

Done & verified: T1–T16 (slice + AI layer + Purity/Corruption + Fame/Unmasking + bosses #2/#3
+ Soldier→Knight + rival arc) and now **T17** (Boss #4 scripted story-loss + mascot injury/
disappearance + Sparring). Everything committed; `config.js` stays uncommitted (sparring block
added there + synced to `docs/config.example.js`).

T17 left these explicit hooks for T18:
- `model.world.flags.boss4Attempted` is set but **unused** until now — it marks that the Spire
  loss has happened.
- `model.world.flags.mascotGone` is true; `model.mascot.present=false` / `injured=true`.
- `model.character.magicalWeapon = { fromToy, object, found:false }` (set at creation) — T18
  flips `found:true`.
- The Spire (`spire` dungeon, boss `boss4` = Grief Herald) is **already coded to become a normal
  winnable fight the moment `magicalWeapon.found` is true** (explore.js gates `storyLoss` on
  `!found`). So once the weapon is found + Awakened activates, returning to the Spire apex is a
  real fight — no combat changes needed for the rematch itself.
- `config.tiers.awakened = { reqBoss:"secretPlace", reqWeaponFound:true }` already exists, and
  `progress.js handleBossDefeat` already checks `reqs.reqWeaponFound && !ch.magicalWeapon.found`.

## What's next: T18 — Secret-place dungeon + weapon + Awakened (DESIGN §8, TASKS T18)

- **Misted secret-place dungeon** themed on hopelessness + childhood memories of the mascot's
  training, with hints of the toy. The secret place + toy were chosen at character creation
  (`character.secretPlace`, `character.magicalWeapon.fromToy/object`) — weave those in.
- **Find the magical weapon:** the mascot is sleeping with it. Recovering the weapon should set
  `magicalWeapon.found = true` and **recover the mascot** (`mascot.present=true`, `injured=false`,
  clear `flags.mascotGone` so training reopens / spar becomes optional).
- **Activate Awakened tier:** gate `secretPlace` as a "boss" id that, once cleared with the weapon
  found, advances the tier via the existing `handleBossDefeat` path (TIER_REVEAL.awakened — needs
  writing in progress.js, mirror knight). Awakened grants +1 slot (already in `hub.slotUnlocks`).
- **Return + defeat Boss #4:** with the weapon found the Spire is winnable; beating boss4 should
  fire its own beat (rival congratulates + resumes challenging with respect — Sable arc advance).

## Likely open design calls to workshop first (don't code until decided)

1. How is the secret place reached/unlocked — a new entry in the explore chooser gated on
   `boss4Attempted` (+ alliance visit?), or a special prompt after the T17 aftermath?
2. Is `secretPlace` a real dungeon with a boss room (a memory/doubt "boss" themed on
   hopelessness), or a no-combat exploratory dungeon where the climax is *finding* the weapon
   (the "boss" being the act of recovery)? `config.tiers.awakened.reqBoss="secretPlace"` implies
   something pushes a bossId — decide what.
3. Does recovering the mascot make Sparring go away (back to training) or keep both available?
4. Knight/Awakened ability kit — still all-novice-gated (`config.abilities`). Add an Awakened
   ability or the magical-weapon attack now, or defer again?

## Working notes / conventions

- All balance in `config.js` (gitignored, holds live keys); keep `docs/config.example.js` in sync.
  **Don't commit `config.js`.**
- Verify with the preview (`.claude/launch.json`, port 4321). **GOTCHA (confirmed T17):** dynamic
  `import()` in `preview_eval` caches ES modules for the page session — you MUST full-reload the
  page (`location.reload()` in its own eval) after each src edit before re-importing, or you test
  stale code. Drive deterministic logic via `update(state,event)` with `st.freshModel()` +
  `st.createState(m)`; suppress random room encounters with `m.world.cleared = { <roomId>: true }`.
- **Other gotchas:** (1) async victory narration sets `ui.busy` (input lock) — pace scripted drives.
  (2) The shell eats backticks in `git commit -m` — use a heredoc, no backticks. (3) Don't bulk
  string-replace template fragments (clobbered eRef/ERef in combat.js once).
- Mutator pattern: `alignment.js`/`visibility.js` own their axes. Boss reactions flow through
  `progress.js handleBossDefeat` (`ui.justDefeatedBoss`); the T17 scripted loss flows through
  `progress.js handleStoryLoss` (`ui.justLostStoryBoss`); both resolved by `update.js afterCombat`.
- Commit per logical chunk.
