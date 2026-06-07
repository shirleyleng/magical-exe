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
- SHIP TODO (before real players): swap Cloudflare's always-pass TEST keys for real ones —
  `config.turnstile.siteKey` (public; allowlist domains incl. localhost) + the matching secret
  via `supabase secrets set CLOUDFLARE_TURNSTILE_SECRET=...`.
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

### T14 — Purity/Corruption axis (DONE)
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

### T18 — Secret-place dungeon + magical weapon + Knight -> Awakened
- BUILD: misted secret-place dungeon themed on hopelessness/childhood memories with toy hints;
  find the magical weapon (mascot sleeping with it); activate Awakened tier (recovers mascot);
  return and defeat Boss #4; rival congratulates + resumes challenging with respect.
- DONE: weapon found, Awakened unlocks, mascot back, Boss #4 now winnable, rival arc advances.

### T19 — Final boss (3 phases) + Awakened -> Ascended + endings
- BUILD: Phase 1 big boss; Phase 2 twist (manifested city despair); Phase 3 ascension trigger
  gated partly on `hopeTally` (errands/relationships feed back), rival fights beside you.
  Purity vs Corruption fork -> different ascension + endings.
- DONE: all three phases play; ascension fires when hope tally + beats are met; both endings reachable.

---

## PHASE 7 — Meta + polish

### T20 — Prestige/clean-slate + Easy/Normal scaling
- BUILD: prestige (halve stats, restart; Normal scales enemies per `prestigeCount`, Easy doesn't).
  Difficulty multipliers from `config.js` applied throughout.
- DONE: prestige resets correctly with scaling; Easy vs Normal differ as configured.

### T21 — Credits, about screen, deploy
- BUILD: in-game about/credits with the Charm homage line (DESIGN.md > Credits); README with the
  same; deploy static build to Netlify or GitHub Pages; confirm the Supabase function CORS allows
  the live domain.
- DONE: game live at a URL; credit line present; AI proxy works from the deployed origin.

---

## Suggested first message to Claude Code

> "Read CLAUDE.md, DESIGN.md, mascots.md, and config.example.js. We're building per TASKS.md.
> Start with T1 only — the terminal shell and Charm-style CSS — and stop when it's done so I can
> review. Copy config.example.js to config.js. Don't start T2 yet."
