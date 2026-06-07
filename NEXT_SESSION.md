# NEXT SESSION — T21: credits / about polish + deploy hardening (final slice item)

> Kickoff notes for the next session. Read `MEMORY.md` + `memory/v1-slice-status.md` first
> for full status. Delete/replace this file when T21 is underway.

## Where things stand (as of 2026-06-07)

**The whole game is mechanically complete: T1–T20.** Story arc Novice→Ascended with a four-ending
finale; AI layer (parse/narrate/city/judge) + spend protection (caps/kill-switch/CAPTCHA); both axes
(Virtue/Corruption + Fame/Unmasking); the hidden Hope tally + errands/dilemmas; **T20 prestige +
Easy/Normal difficulty**. Everything committed and pushed; the live site
(`magical-exe.redmint.studio`, Cloudflare Pages) boots correctly.

Recently shipped this session:
- **T19 finale** (`source` dungeon → two-phase fight → `src/endgame.js` brink resolver → 4 endings).
- **T20 prestige** (`src/prestige.js`, hub `prestige` verb + confirm) **+ difficulty** (creation step
  AND Settings → Difficulty).
- **Deploy fix:** `scripts/build-config.js` regenerates the gitignored `config.js` from
  `docs/config.example.js` at build time (Cloudflare env vars inject the public Supabase/Turnstile
  values). See `docs/DEPLOY.md`. This is why prod had been booting blank.

## What's next: T21 — credits/about + deploy hardening (the last slice task in docs/TASKS.md)

Mostly polish; the pieces largely exist:
- **About/credits** already exists (`showAbout` in update.js: Red Mint Studio + Ko-fi + aesthetic
  homages) and there's a persistent Ko-fi footer pill. Decide if anything more is wanted (a proper
  credits scroll? version/build stamp? link to the GitHub repo?).
- **Deploy:** the Cloudflare Pages build is now self-healing. Remaining hardening ideas: swap the
  Turnstile **test** site key (`1x00000000000000000000AA`) for the real one (env var
  `TURNSTILE_SITE_KEY`, domains allowlisted); confirm the SPA catch-all that serves index.html for
  missing paths isn't masking real 404s in a harmful way; a cache-busting story for `src/*.js` on
  deploy (the devserver sends no-store locally, but prod caching of ES modules could serve stale code
  after a deploy — check Cloudflare's asset caching / consider hashed filenames or a version query).
- **Playtest pass / balance** once everything's in.

## Deferred polish (spawned as task chips this session — not blocking)

1. **Story/prose polish** across all narrative files — and fix the **"Generic Company Name"**
   placeholder leaking into the AI city description (creation.js occupation → ai.js city prompt).
2. **Shop menu item descriptions** that update as you scroll the menu (build from item type/amount).
3. **Day-passing flavour text** after a rest (`hub.js` doRest/beginDay; a small rotating pool in config).
4. **Mascot ASCII animation** (idle blink/bob/sparkle; respect `prefers-reduced-motion`; keep the
   gone/dimmed states somber). Also in `backlog.md`, along with the **mobile-friendly redesign**.

## Working notes / conventions (unchanged)

- All balance in `config.js` (gitignored, holds the public Supabase/Turnstile values + balance);
  keep `docs/config.example.js` in sync — it's the tracked source AND what the deploy builds from.
  **Don't commit `config.js`.** Avoid backticks in `git commit -m` (use a heredoc).
- Verify with the preview (`.claude/launch.json`, port 4321). **GOTCHA:** dynamic `import()` in
  `preview_eval` caches ES modules per page session — full-reload (`location.reload()` in its own
  eval) after each src edit. Drive logic via `update(state,event)` with `st.freshModel()` +
  `st.createState(m)`; suppress random room encounters with `m.world.cleared = { <roomId>: true }`.
  To screenshot a real rendered state, inject a model into `localStorage`
  (`magicalexe:slot:<name>` + `magicalexe:active`) and reload — restore the prior active slot after.
- Story reactions flow through `update.js afterCombat`: `justDefeatedBoss`→handleBossDefeat,
  `justLostStoryBoss`→handleStoryLoss, `finaleResolve`→`endgame.js handleFinaleResolve`.
- Boss names beginning with "the" flow through the eRef/ERef article helpers in combat.js.
