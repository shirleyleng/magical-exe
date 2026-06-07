# NEXT SESSION — the v1 slice is COMPLETE (T1–T21). What's left is optional polish.

> Read `MEMORY.md` + `memory/v1-slice-status.md` first for full status. Delete/replace this file
> when the next focus is chosen.

## Where things stand (as of 2026-06-07)

**MAGICAL.EXE is feature-complete through T21 — the entire planned v1 slice is built, verified, and
live** at `magical-exe.redmint.studio` (Cloudflare Pages):

- Full story arc Novice→Soldier→Knight→Awakened→Ascended, with the four-ending finale.
- AI layer (parse/narrate/city/judge) + spend protection (caps / kill-switch / Turnstile CAPTCHA).
- Both axes (Virtue/Corruption coupled slider + Fame/Unmasking), the hidden Hope tally + errands/
  dilemmas, the rival arc, the secret place + magical weapon.
- T20 prestige/clean-slate + Easy/Normal difficulty (chosen at creation AND in settings).
- T21 credits/version (`src/version.js`, About screen, titlebar stamp) + deploy hardening
  (`scripts/build-config.js` regenerates `config.js` at build time; `_headers` no-cache for code;
  themed `404.html`). See `docs/DEPLOY.md`.

Everything committed and pushed; `config.js` stays gitignored (synced to `docs/config.example.js`,
which is also what the deploy builds from).

## Optional polish remaining (nothing is blocking)

**Spawned as task chips (start any from the chip, or just ask):**
1. **Story/prose polish** across all narrative files + fix the **"Generic Company Name"** placeholder
   leaking into the AI city description (`creation.js` occupation → `ai.js` city prompt / fallback).
2. **Shop menu item descriptions** that update as you scroll (build from item `type`/`amount`).
3. **Day-passing flavour text** after a rest (`hub.js` doRest/beginDay; a small rotating pool in config).
4. **Mascot ASCII animation** (idle blink/bob/sparkle; respect `prefers-reduced-motion`; keep the
   gone/dimmed states somber). In `backlog.md` too.

**Also flagged (in `backlog.md`):**
- **Mobile-friendly redesign** (layout is desktop-first; narrow widths stack + scroll).

**Deploy / housekeeping:**
- Swap the Turnstile **test** site key (`1x00000000000000000000AA`) for the real one — set
  `TURNSTILE_SITE_KEY` in Cloudflare Pages (domains allowlisted) for real bot protection on AI spend.
- README refresh (point at the live URL + the deploy flow).
- Bump `src/version.js` VERSION on the next release.

## Working notes / conventions (unchanged)

- All balance in `config.js` (gitignored; holds public Supabase/Turnstile values + balance + the
  `meta.buildStamp`). Keep `docs/config.example.js` in sync — it's the tracked source AND what the
  deploy builds from. **Don't commit `config.js`.** Avoid backticks in `git commit -m` (heredoc).
- Verify with the preview (`.claude/launch.json`, port 4321). **GOTCHA:** dynamic `import()` in
  `preview_eval` caches ES modules per page session — full-reload (`location.reload()` in its own
  eval) after each src edit. Drive logic via `update(state,event)` with `st.freshModel()` +
  `st.createState(m)`; suppress random room encounters with `m.world.cleared = { <roomId>: true }`.
  To screenshot a real rendered state, inject a model into `localStorage`
  (`magicalexe:slot:<name>` + `magicalexe:active`) and reload — restore the prior active slot after.
- Story reactions flow through `update.js afterCombat`: `justDefeatedBoss`→handleBossDefeat,
  `justLostStoryBoss`→handleStoryLoss, `finaleResolve`→`endgame.js handleFinaleResolve`.
- Deploy build: `node scripts/build-config.js` (Cloudflare build command); output dir `/`; env vars
  `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `TURNSTILE_SITE_KEY`. Keep the SPA catch-all OFF (404.html).
