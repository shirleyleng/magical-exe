# Handoff prompt — build the high-tier Unmasking "reveal-or-hide" fork

> Paste the section below into a fresh session. It's written to be acted on cold.

---

## Task

Build the **high-tier Unmasking crisis**: the designed-but-unbuilt "forced story
crisis" where someone is in danger and you must **choose to reveal your secret
identity to save them, or stay hidden**. Right now, crossing the top Unmasking
threshold just sets a `mustLieLow` lock + prints a warning — it should instead
trigger a real branching decision with lasting consequences.

Keep the game's **goth-witchy-cozy** tone throughout. The decision should feel
weighty and a little sad, not punitive.

## Where this lives today (read these first)

- `src/visibility.js` — owns the Fame/Unmasking axis. `adjustVisibility(ch, {fame,
  unmasking})` is the ONLY meter mutator. Tiers `none/low/mid/high` come from
  `CONFIG.axes.unmasking.thresholds` (25/55/85). `checkUnmaskingEvents(state)` fires
  `fireUnmaskingEvent(state, tier)` once per newly-crossed tier (latched in
  `ch.unmaskingTierSeen`; re-armed by `relaxUnmasking`). **The `high` branch of
  `fireUnmaskingEvent` is what you're replacing** — today it just sets
  `ch.mustLieLow = true` + warns.
- `src/update.js` (~line 784) — `mustLieLow` blocks the hub `attack` verb until heat
  cools below `mid` (lifted by `relaxUnmasking`).
- `src/hub.js` — `lie low` and `misdirection` lower Unmasking (respect `residualFloor`).
- **`src/dilemmas.js` — copy this structure.** It's the existing one-shot branching
  moral event: fires at rest, opens a menu (kind `"dilemma"` routed in `update.js`
  `menuSelect`), latched in `flags.dilemmasSeen`, outcomes adjust meters silently.
  The reveal fork is the same shape — a one-shot, menu-driven, branching event.
- `src/endgame.js` `resolveBrink` — the finale's hope gate is
  `effHopeThreshold = clamp(50 − fame·0.2, 30, 50)`. **This is the strategic weight
  of the choice:** revealing yourself = big Fame = easier finale; staying hidden = the
  hidden-hero path = you need more hope. Your new Fame swings flow into this for free.
- `CONFIG.axes.fame.gainSaveCivilian` — a **stubbed** Fame source for saving a
  civilian. This crisis is the natural place to finally realize it.
- DESIGN.md §3 (Fame vs. Unmasking) — the canonical intent: *"High: identity at risk —
  forced story crisis; someone is threatened; you may have to choose to reveal yourself
  to save them. Top threshold event = 'you've been unmasked.'"*

## Recommended design (workshop the open decisions with the user before building)

A one-shot crisis fires when Unmasking first crosses `high`. A person in a public
place can only be saved by acting as your magical self in front of witnesses. Menu:

1. **Reveal yourself** — tear off the mask and save them in the open. Big Fame
   (`gainSaveCivilian` + more), `+hope` (the city watched a hero choose them), set a
   permanent `character.identityRevealed = true`. The secret is moot now: clear
   `mustLieLow`, and stop the heat events from mattering (anonymity is no longer the
   game you're playing). Easier finale hope gate. Likely a **one-way door**.
2. **Stay hidden** — protect your identity. Lean cozy-sad: you still save them, but
   *quietly*, at a cost — `-hope` (or a relationship/townsfolk hit), and you force the
   heat down (retreat into the shadows: shed a chunk of Unmasking, keep `mustLieLow`
   briefly). You remain the hidden hero — harder finale gate, secret intact.
3. *(Optional, path-gated)* **Cloud their memory** (Virtuous) / **silence the witness**
   (Corrupt) — fold in the deferred memory-cloud/wipe ability: save them AND keep the
   secret, but it costs (Virtue: Spirit; Corrupt: +Corruption, conspicuous).

### Open decisions to settle with the user first
- Is "reveal" a permanent one-way door? What visibly changes after (hub, mascot/rival
  lines, townsfolk acknowledgement)?
- Exact Fame/hope magnitudes (tie them to the finale gate math above).
- Does "stay hidden" still save the person (covertly, at a cost) or let them be harmed?
  (Tone suggests "saved quietly, but it costs you.")
- Build the memory-cloud third branch now, or keep it deferred?
- When/where does the crisis surface — immediately after the public win that crossed
  `high` (you're back at hub), or at the next rest like dilemmas? (Must NOT fire
  mid-combat.)

## Implementation checklist

- [ ] New module (e.g. `src/unmaskingcrisis.js`) or extend `visibility.js`: the crisis
      event + branch resolver, mirroring `dilemmas.js`.
- [ ] Change `fireUnmaskingEvent`'s `high` branch to set a *pending* crisis and surface
      the menu at the next safe point (mirror how dilemmas defer to rest), instead of
      only setting `mustLieLow`.
- [ ] Menu kind (e.g. `"unmaskingcrisis"`) routed in `update.js` `menuSelect`.
- [ ] New persisted flags: `character.identityRevealed` + a latch like
      `flags.unmaskingCrisisSeen`. **Seed in `freshModel` (state.js) AND backfill in
      `createState`** for old saves.
- [ ] Config block for the magnitudes (under `axes.unmasking` or a new
      `unmaskingCrisis`). Realize `axes.fame.gainSaveCivilian`.
- [ ] Confirm `identityRevealed` flows correctly into the finale Fame gate (endgame.js).
- [ ] Decide whether the HUD changes when revealed (e.g. the Unmasking bar's meaning).

## Project conventions & gotchas (important)

- **Deterministic engine.** The AI only narrates; it never decides outcomes. This fork
  is fully deterministic (like dilemmas) — no AI call needed.
- **`config.js` is gitignored.** Edit BOTH your local `config.js` (for dev) AND
  `docs/config.example.js` (the tracked source — `scripts/build-config.js` copies it
  whole to the deploy). Keep them in sync.
- **Dev server:** `python3 scripts/devserver.py 4321` (plain `http.server` serves stale
  ES modules — edits silently won't apply). After any src edit, full-reload the preview.
- **Verify two ways:** (1) a node ESM integration test in `scripts/sim/` (see
  `scripts/sim/dungeon-test.js` for the pattern — run with `node scripts/sim/<name>.js`,
  ESM auto-detected, no flag); (2) a browser drive — patch a save to Unmasking ≥ 85 (or
  win a public fight to cross it), confirm the crisis fires, both branches resolve, flags
  persist across reload, console is clean. NOTE: the preview's localStorage save is a
  *different origin* from the live site, so it's safe to mutate for tests.
- **AI narration sets `ui.busy`** (input lock) — when driving scripted commands in the
  browser, pace them or follow-ups get dropped.
- **Ship it:** commit + push to `main` (the remote is SSH and already authenticated).
  End the commit message with:
  `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`
- **Update memory** (`/Users/shirleyleng/.claude/projects/-Users-shirleyleng-magical-exe/memory/`)
  — there's a `v1-slice-status.md` worth appending to, and a `MEMORY.md` index.
