# MAGICAL.EXE — Build Tasks (for Claude Code)

Hand Claude Code **one task at a time**, in order. Each is scoped to be reviewable on its own.
After each, run it / look at it before moving on. Don't batch — the point is small, verifiable steps.

Convention: each task lists a GOAL, what to BUILD, and a DONE check (how you know it works).

---

## PHASE 1 — Playable shell (no AI, no content yet)

### T1 — Terminal shell + Charm-style CSS
- GOAL: a fake terminal that looks right and takes input.
- BUILD: single HTML page; scrolling output area + fixed input line at bottom; CSS design
  tokens for the Charm palette (soft purples/pinks/teals on dark, rounded borders, generous
  padding, monospace). Echo typed input into the output area. Persistent (empty for now)
  stat panel + mascot panel regions in the layout.
- DONE: typing a line shows it in the scrollback; layout has the three regions; it *looks* cozy-terminal.
- NOTE: pick the monospace font now and verify the mascot bases from `mascots.md` render in it
  (use ASCII-only fallback if any glyph breaks). Do this before T7.

### T2 — Model–Update–View skeleton + save/load
- GOAL: the architecture spine.
- BUILD: a single `state` object (per DESIGN.md > State Shape), a pure `update(state, event)`,
  and `render(state)` that paints the DOM. Wire input -> event -> update -> render.
  localStorage save/load (single slot fine for now). A `schemaVersion` field.
- DONE: change state via a test event, see render update; reload page, state persists.

### T3 — Deterministic parser + /help + rotating prompts
- GOAL: command input with zero AI.
- BUILD: tokenizer + verb/synonym table (`n`/`north`/`go north`, `l`/`look`, `get`/`take`,
  `i`/`inventory`, `attack`, `rest`, etc.). Unknown input -> gentle nudge. `/help` lists command
  categories. Rotating contextual example prompt shown near the input (placeholder or a hint line).
- DONE: known commands route correctly; `/help` works; an example prompt rotates each turn.

---

## PHASE 2 — Character creation + mascot

### T4 — Character creation flow
- GOAL: the intake that seeds everything.
- BUILD: stepped Q&A in the terminal — gender presentation; occupation/study; 3 personality
  axes; city name; 3 favorite animals; favorite toy/game; secret place; mascot name (from list).
  Write all answers into `state.character` (+ pronouns derived from gender).
- DONE: completing creation produces a populated character in state, persisted.
- NOTE: city *description* generation is AI (Phase 4, PROMPTS.md > E). For now store the name and
  use a simple placeholder description; swap in AI later. Flag in UI copy as flavor, not fact.

### T5 — Mascot assignment + ASCII display
- GOAL: the helper appears.
- BUILD: fusion rules from `mascots.md` — pick base style by dominant animal, add features,
  set name, store `artKeySmall`/`artKeyLarge` + a placeholder `voice`. Render small mascot in the
  mascot panel; show large mascot on the reveal/intro moment.
- DONE: a mascot with chosen art + name shows after creation; small art sits in the panel.

---

## PHASE 3 — Core loop (hub + one dungeon + combat), still no AI

### T6 — Hub mode + slots + training + shop + rest
- GOAL: the day-to-day stat-raiser.
- BUILD: hub screen = activity menu + stat panel. 6 slots (from `config.js`). Training (direct
  stat growth). Free shop (browse/buy/sell, no slot). `rest` ends day, resets slots, increments
  `day`. Slot-growth hooks (Stamina/tier) wired but can stay inactive until tiers exist.
- DONE: spend slots on training (stats rise), shop is free, rest advances the day and resets slots.

### T7 — Exploration mode + one dungeon + Stamina
- GOAL: room-to-room MUD navigation.
- BUILD: room graph as data (DESIGN.md example). Movement between rooms, look, take items.
  Stamina as the limiter; running out forces retreat to hub. Build ONE dungeon (e.g. the forest)
  with a handful of rooms leading to a boss room.
- DONE: walk the dungeon room-to-room, pick up an item, Stamina drains, retreat works.

### T8 — Tactical combat core (deterministic)
- GOAL: the battle spine, no AI.
- BUILD: turn order by Speed; Dodge evasion roll; Defense mitigation; actions = attack, guard,
  use ability (Spirit cost), use item. Pull all numbers from `config.js`. Wire a hub-combat slot
  and dungeon encounters to it.
- DONE: a full fight resolves correctly (you can win or lose) using config values.

### T9 — Boss #1 + tier Novice -> Soldier + alliance reveal
- GOAL: first story beat, completes the v1 slice.
- BUILD: Boss #1 at the dungeon's end (a tougher tactical fight). On defeat: unlock Soldier tier
  (gated per `config.js` tiers), mascot delivers the world-alliance reveal, +1 slot unlock fires.
- DONE: beating Boss #1 transforms you to Soldier, plays the reveal, grants the slot.

### T10 — Multi-slot saves (auto + manual)
- GOAL: real save management.
- BUILD: multiple named save slots; auto-save (e.g. on `rest` and on entering/leaving dungeons);
  manual save/load; list/delete slots. Handle `schemaVersion` gracefully.
- DONE: create 2+ saves, load either, auto-save fires, delete works.

> ⛳ **END OF v1 SLICE.** Make this fully working and *fun* before Phase 4. Playtest the loop.

---

## PHASE 4 — AI layer (now spend starts; set Console cap first)

### T11 — Supabase Edge Function proxy + rate limiting
- GOAL: server-side AI key + spend safety.
- BUILD: Edge Function (Deno) holding the Anthropic key; CORS for your domain; anonymous
  Supabase auth; per-session + global daily caps + kill switch (values from `config.js > ai`,
  enforced server-side). Logs calls to a usage table.
- DONE: function proxies a Haiku call; caps enforced; over-cap returns graceful refusal.

### T11b — Bot protection: CAPTCHA human-check (DONE, Cloudflare Turnstile, "Option B")
- GOAL: stop bots from burning the Anthropic budget. Complements the T11 server-side caps —
  defense in depth.
- DESIGN DECISION: we gate the SPEND, not the auth. What costs money is the Anthropic call
  inside `ai-proxy`; minting an anon JWT is free. So instead of Supabase's project-global Auth
  CAPTCHA (which gates `signInAnonymously` itself — "Option A"), the proxy requires a Turnstile
  token before the FIRST paid call per user, verifies it via Cloudflare `siteverify`, and records
  the user in `verified_humans`. Later calls skip the check (one CAPTCHA per browser). This is
  code-only (no global dashboard flip), reversible, decoupled from auth, and leaves `ai-test.html`
  working (ping is exempt). Picked Turnstile over hCaptcha (free, lighter, less intrusive).
- BUILT: migration `verified_humans` (RLS service_role-only); `ai-proxy` human gate +
  `verifyTurnstile()` (secret `CLOUDFLARE_TURNSTILE_SECRET`, fail-closed); `src/captcha.js`
  (lazy Turnstile loader — blocked CDN never breaks boot); `src/ai.js` `setCaptchaProvider()` +
  reactive retry on `reason:"captcha"` (server stays source of truth); inline `#captcha` widget
  in the terminal (outside the reconciled scrollback), shown only on first AI use; `config.turnstile.siteKey`.
- DONE/VERIFIED LIVE: first paid call renders widget → token → verified → `ok:true`; second call
  skips the widget (verified-skip); blocked Turnstile → `{ok:false,reason:"captcha"}`, no throw,
  game continues deterministic-only.
- SHIPPED (✅ 2026-06-20): real Cloudflare Turnstile keys are live on production. The deploy
  build pulls the real `TURNSTILE_SITE_KEY` (starts `0x4AAAAA…`) from Cloudflare Pages env vars
  (allowlist includes `magical-exe.redmint.studio`); the matching `CLOUDFLARE_TURNSTILE_SECRET`
  is set on the Supabase Edge Function. Local dev still uses the always-pass test key
  `1x00000000000000000000AA` in `config.js` — see `docs/DEPLOY.md` for the full key table.
- FOLLOW-UP (Option A, optional): if anon `auth.users` bloat ever becomes a real problem (it's
  free $-wise + Supabase rate-limits anon sign-in per IP), additionally enable the project-global
  Supabase Auth CAPTCHA so bots can't even mint a JWT. Composes with B; pass the same token on
  `signInAnonymously({ options: { captchaToken } })`.

### T12 — AI fallback parser + narration + city description
- GOAL: the AI translator/narrator layer (PROMPTS.md A, C, E).
- BUILD: when deterministic parser misses -> call proxy -> structured action -> validate ->
  apply. Optional narration on non-trivial turns. Swap the T4 placeholder city description for
  AI-generated (one-time). Enable prompt caching. Degrade to deterministic-only if AI unavailable.
- DONE: a freeform command resolves via AI; trivial commands still skip AI; AI-off mode still plays.

### T13 — AI-mediated freeform combat actions (plausibility judge)
- GOAL: creative combat (PROMPTS.md B).
- BUILD: in combat, freeform action -> proxy with environment tags + abilities -> approved
  structured effect or rejection -> engine applies. Forbidden moves set `corruptionCost`.
- DONE: "throw sand to blind it" works on a beach; "open a dimension door" is refused.

---

## PHASE 5 — Depth systems

### T14 — Purity/Corruption axis (DONE) — NOTE: the Purity axis was renamed to **Virtue** on 2026-06-07 (entries below use the old name)
- BUILD: corruption as battle resource (burst/forbidden), stat-warp thresholds, ability gating
  (pure vs corrupt kits), path tracking (`path`). All values from `config.js`.
- DONE/VERIFIED: Purity & Corruption are ONE coupled slider (`src/alignment.js`: gaining one
  end drains the other; `path` = pure/balanced/corrupt from the gap). Corruption warps stats
  (`effectiveStats`: Power up / max HP down) shown in STATUS as a Pure←◆→Corr bar + ⚠ marker.
  `burst` = no-Spirit heavy hit that deepens corruption (the "battle resource"). Narrative
  nudge: `spare` a beaten non-boss foe → +Purity (it flees, no loot); a finishing blow on a
  spareable foe → +Corruption (this is how Purity rises in-slice). Path kits: `mend` (Pure heal)
  + `drain` (Corrupt lifesteal), LEARNED in training once tier + slider-threshold prereqs are met,
  with an opposed-alignment SOFT-FIZZLE whose chance scales with how far you've strayed. Starting
  meters now 0/0 (unwritten). DESIGN DECISIONS (workshopped): coupled slider; burst deepens (not
  spends); learn-via-training gated by tier+threshold; soft-fizzle (not hard-lock). Spirit-warp
  (spiritMult) deferred — Spirit is a consumable pool, needs a later refactor.
- T14.5 (balance pass): pure path made as tempting as corrupt. Added a Purity "grace" boon
  mirroring the corruption warp (high purity → Defense↑/healing↑) and a pure kit — radiance
  (damage + dazzle/blind), ward (defend buff), purify (cleanse + shed Corruption, fizzle-exempt).
  Corruption stays the raw-damage king; purity owns tempo/safety/sustain. Kits expand more w/ tiers 3–5.

### T15 — Fame/Unmasking axis
- BUILD: Fame gains (public wins, visible quests, saving civilians); Unmasking gains (public
  battles, corrupt actions faster); cooling; escalating threshold events; lowering methods
  (lie low, misdirection errand, relocate hub over 2 days, memory cloud/wipe by path).
- DONE: flashy wins raise both meters; thresholds fire events; lowering methods work.
- ✅ DONE (lightweight pass, 2026-06-06): public (hub) wins raise Fame + Unmasking; corrupt
  acts (burst/dark-kit/forbidden/finish) raise Unmasking faster; boss wins = big Fame; cooling
  at rest (residual floor); HUD Unmasking danger bar; escalating low/mid/high events (mid =
  -1 slot, high = lie-low lock); lowering methods `lie low` + `misdirection`.
- ⬜ DEFERRED to a follow-up: relocate-hub (2 days/all slots) + memory cloud/wipe abilities;
  the high-tier "choose to reveal yourself" branching crisis (currently a lock + warning);
  Unmasking gains in the forest (intentionally witness-free for now); `gainSaveCivilian`
  (no civilian-rescue action exists in the slice yet).

---

## PHASE 6 — Remaining story arc (tiers 3–5)

### T16 — Bosses #2 & #3 + Soldier -> Knight + rival introduction
- BUILD: two more dungeons/bosses; corruption-deepens hints; meet rival after #2 (wants to beat
  you); rival returns after #3 ("not everything is what it seems"); Knight tier on #3 + threshold.
- DONE: arc beats fire in order; rival schedule ticks off `day`; Knight unlock works.
- ✅ DONE (2026-06-06): two new themed dungeons (Drowned Harbor → boss2 Tideheart Wraith,
  unlocks after boss1; Hollow Clocktower → boss3 Hour Warden, unlocks after boss2) with an
  `explore` chooser menu + `explore <name>` shortcut + progressive unlock. Soldier→Knight
  tier-up on boss3 (path-flavored reveal, +1 slot); one-time corruption story beats on boss2
  (hidden big boss) + boss3 (hopelessness/errands). Rival arc: Sable schedule ticks off `day`
  at rest/lie-low — challenges you to a winnable duel a few days after boss2, returns with the
  "not everything is what it seems" hint a few days after boss3 (`config.rival`). Verified per
  chunk + cross-module integration (beat boss2 → arm → rest to due day → duel fires).
- ⬜ DEFERRED: knight-tier ability kit (all abilities still gated to novice); the deeper rival
  recurring-challenge loop (return scene just sets `respectful` for now).

### T17 — Boss #4 story-loss + mascot injury + sparring (DONE)
- BUILD: scripted unwinnable Boss #4 (telegraphed per `config.js > combat.storyLoss`, mascot
  warns, HP barely moves, narrative loss at turn cap). Mascot injured + disappears. Rival unlocks
  Sparring (replaces mascot's training role).
- DONE: fight reads as scripted loss (not a bug); mascot gone; sparring available.
- ✅ DONE (2026-06-07): chunked. (A) New tier-gated dungeon **Sorrowing Spire** (`spire`,
  `unlockReqBoss:boss3` + new `unlockReqTier:knight`) ending at the **Grief Herald** (boss4).
  Scripted loss = a `storyLoss` flag on normal combat (`combat.js`): player hits clamped to
  `bossHpVisibleDrainPerHit` (HP barely moves), enemy floored from killing you, mascot intervenes
  at `maxPlayerTurnsBeforeIntervene` — injured + gone — handing off via `ui.justLostStoryBoss`.
  Only scripted until `magicalWeapon.found` (T18 makes it winnable). (B) **Mascot-gone:** training
  closed (`hub.trainingClosed` on `flags.mascotGone`), HUD MASCOT panel shows a dimmed empty perch
  + "<name> — missing" (`render.js` + `.mascot-art--gone`). (C) **Sparring** (`config.sparring`,
  risk/reward breakthrough/solid/rough scaling the training gain, rough costs HP) via `spar`
  verb/menu; `learnAbility` takes a `slotKey` so abilities are learnable via sparring. The
  unlock moment (`progress.js handleStoryLoss`) plays the aftermath + Sable's pivot: ask the
  alliance for a better way, the **Awakened** tier exists and is the only road back for your
  mascot (the T18 hook). Verified per chunk + a full `update()` integration (explore spire → up →
  up → scripted loss → mascot gone → train blocked → spar works); console-clean.
- ⬜ DEFERRED: `boss4Attempted` flag is set but unused until T18; the spar menu only lists
  learnable abilities the player already qualifies for (tier+threshold) — no knight-tier kit yet.

### T18 — Secret-place dungeon + magical weapon + Knight -> Awakened (DONE)
- BUILD: misted secret-place dungeon themed on hopelessness/childhood memories with toy hints;
  find the magical weapon (mascot sleeping with it); activate Awakened tier (recovers mascot);
  return and defeat Boss #4; rival congratulates + resumes challenging with respect.
- DONE: weapon found, Awakened unlocks, mascot back, Boss #4 now winnable, rival arc advances.
- ✅ DONE (2026-06-07): chunked. (A) New **`alliance`** hub verb (free; distant flavor pre-loss,
  reveals the Awakened road + unlocks the secret place after `boss4Attempted`, personalized with
  `character.secretPlace` + `magicalWeapon.fromToy`). New **`secret`** dungeon ("the Misted Place")
  via new `unlockReqFlag` support, ending at boss `secretPlace` = **the Hollow Doubt** (`doubt_echo`,
  beatable at Knight). Added `in`/`out`/`across` directions (also fixes the clocktower `across`
  exit). (B) Defeating the doubt runs `progress.js recoverWeaponAndMascot` (sets
  `magicalWeapon.found`, restores `mascot.present`/`injured`, clears `flags.mascotGone`) BEFORE the
  tier gate, so `tiers.awakened.reqWeaponFound` passes → `TIER_REVEAL.awakened` (path-flavored) +
  the milestone slot. Mascot back reopens training; **sparring persists** (decoupled onto its own
  `flags.sparringUnlocked`, set in `handleStoryLoss`). (C) `config.abilities` **"true strike"**
  (Awakened-`reqTier`, neutral mult-2.0 hit that staggers) — never appears before the weapon since
  it's tier-gated. `BOSS_BEAT.boss4` fires the rival's congratulation on the now-winnable Spire
  rematch (explore.js already drops `storyLoss` once `magicalWeapon.found`); she resumes as an
  equal. Also: `train`/`spar <ability>` now learn by name, not just via the menu. Verified per
  chunk + a full `update()` integration (post-T17 state → alliance → secret place → doubt win →
  Awakened + mascot back → learn true strike → Spire rematch win → rival beat) + an Awakened HUD
  screenshot; all console-clean. `config.js` NOT committed; `docs/config.example.js` synced.
- ⬜ DEFERRED: rival's recurring-challenge *cadence* (disposition flips to respectful but Sable
  doesn't auto-re-challenge on a schedule yet); secret-place boss grants Fame like any boss even
  though it's a private place (minor).

### T19 — Hope layer + Final boss (3 phases) + Awakened -> Ascended + endings
- BUILD (hope layer, front half): the hidden Hope tally + its sources, so the finale has
  something to gate on. **DONE (✅ 2026-06-07):** `src/hope.js` (`adjustHope` — only mutator,
  floors at 0, never shown as a number; `hopeBand`/`hopeMoodLine` coarse ambient feedback).
  **Pull:** `errand` hub activity (`config.errands` trade-off archetypes — quiet kindness/day of
  service/public rescue/cut-a-corner; bigger = better hope/slot) in hub.js, routes deltas to
  alignment/visibility/hope SILENTLY; public rescue hidden under `mustLieLow`. **Push:**
  `src/dilemmas.js` one-shot moral events at rest (`config.dilemmas`; lost child / weird noise /
  shuttered pharmacy) with ambiguous outcomes + an inaction/expedient branch that LEAKS hope.
  **Passive:** `config.errands.passiveHopePerBoss` on each boss win. **Feedback:** `doRest` reads
  the city's mood only when the hope band shifts. Verified per chunk + a 6-day integration (hope
  73 / virtue 37, all dilemmas fired, no hope number ever printed); console-clean.
- BUILD (finale, back half): one continuous fight (P1 big boss → P2 manifested-despair twist) then a
  brink choice + fuel-check gate, rival/mascot beside you. **DONE (✅ 2026-06-07):** `source` dungeon
  "the Heart of the Grey" (`unlockReqBoss:"boss4"`); two phases in `combat.js` (`phases` on combat
  state, `advancePhase` swaps forms in place, `triggerFinaleResolve` → `ui.finaleResolve`); both
  NORMAL winnable, losing a phase is gentle/re-enterable. Dedicated `src/endgame.js` resolver (NOT
  handleBossDefeat): no-take-back brink menu (kind "brink", esc-proof) + gate
  `effHopeThreshold = clamp(50−fame·0.2,30,50)`, seize needs corruption≥50 or path corrupt → 2×2 of
  four endings: **Virtuous Ascension** (you + guardian-deity mascot) · **Dark Ascension** (dark deity,
  self intact, mascot bound/dimmed) · **Quiet Tragedy** (reach-but-short, replayable, not ascended) ·
  **Eldritch Merge** (seize-but-short = hubris; art = deterministic `mascot.js corruptArt` of the
  player's own mascot). Both ascensions set `transformationTier="ascended"` + `flags.ascended` + a
  slot; coda points to prestige. Climax flavor = mascot soft-warning + Sable/mascot once-per-phase
  scripted assist (heal + stagger), NOT full ally combat. Verified per chunk + a full real-path
  `update()` integration + a live dimmed-mascot screenshot; console-clean.
- DECIDED (the open design calls): phase transitions live in `endCombat` (one continuous fight, not
  chained bosses); **player-confirmed** brink choice (not auto-ascend); FOUR distinct ending screens
  (a 2×2, upgraded from the original 3); rival = narrative + light scripted assist (not a real combat
  ally); THRESHOLD anchor 50 / Fame relief 0.2 / floor 30 / seizeCorrThreshold 50.

---

## PHASE 7 — Meta + polish

### T20 — Prestige/clean-slate + Easy/Normal scaling
- BUILD: prestige (halve stats, restart; Normal scales enemies per `prestigeCount`, Easy doesn't).
  Difficulty multipliers from `config.js` applied throughout.
- **DONE (✅ 2026-06-07):** `src/prestige.js` — a hub `prestige` verb opens a confirm dialog
  (kind "prestige", defaults to "No") → `doPrestige` rebuilds from `freshModel()` carrying identity
  (name/gender/occupation/personality/city/secret-place + weapon ORIGIN flavor), the mascot bond
  (restored present/un-injured/un-dimmed), and learned abilities; current stats HALVED
  (`CONFIG.prestige.statMultiplier`, floored 1, full HP/Stamina on the new run); story fully resets
  (tier→novice, bosses/flags/meters/day/coins/inventory) and `prestigeCount++`. Enemy scaling was
  already wired in `combat.js spawnEnemy` (verified 60→66→72 per prestige on Normal; Easy flat 51).
  STATUS panel shows a `✦N` tag. Difficulty (Easy/Normal) is player-chosen BOTH at character creation
  (new menu step after name → `model.difficulty`) AND in Settings → Difficulty (kind "difficulty"
  submenu). Verified end-to-end via `update()`; console-clean. Decisions (workshopped): prestige
  available anytime w/ confirm; carries identity + halved stats + abilities; difficulty pick at
  creation AND changeable in settings.

### T21 — Credits, about screen, deploy
- BUILD: in-game about/credits with the Charm homage line (DESIGN.md > Credits); README with the
  same; deploy static build to Netlify or GitHub Pages; confirm the Supabase function CORS allows
  the live domain.
- DONE: game live at a URL; credit line present; AI proxy works from the deployed origin.
- **DONE (✅ 2026-06-07):** Game live at magical-exe.redmint.studio (Cloudflare Pages). Deploy fix:
  `scripts/build-config.js` regenerates the gitignored `config.js` from `docs/config.example.js` at
  build time, injecting public values (SUPABASE_URL/ANON_KEY, TURNSTILE_SITE_KEY) from env vars +
  a per-deploy build date into `CONFIG.meta.buildStamp`; see `docs/DEPLOY.md`. About screen
  (`showAbout`) shows version (`src/version.js`, v1.0.0) + build stamp + GitHub link + Ko-fi +
  homages + the deterministic-engine note; titlebar stamped from version. `_headers` pins
  code+config to `no-cache` (ETag revalidation) so deploys aren't masked by stale ES-module caches.
  `404.html` themed not-found page (keep the Cloudflare SPA catch-all OFF). Verified in preview;
  console-clean. REMAINING (optional polish, not blocking): README refresh; the four deferred
  flavour task chips. (Real Turnstile site key swap is now ✅ done — see the SHIPPED note above.)

---

## Suggested first message to Claude Code

> "Read CLAUDE.md, DESIGN.md, mascots.md, and config.example.js. We're building per TASKS.md.
> Start with T1 only — the terminal shell and Charm-style CSS — and stop when it's done so I can
> review. Copy config.example.js to config.js. Don't start T2 yet."
