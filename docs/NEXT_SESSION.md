# Next session — T11b: CAPTCHA on anonymous sign-in

> Kickoff prompt for the next working session. Paste the block below (or just
> open this file and go). Status lives in the project memory: `MEMORY.md` +
> `v1-slice-status.md`. As of the last session, **T13 (combat judge) is done,
> committed (`5b261bd`), and verified live.**

## Kickoff prompt

Continuing MAGICAL.EXE. T13 (combat judge) is done, committed (`5b261bd`), and verified
live. Read `MEMORY.md` + `v1-slice-status.md` for full status. Let's do **T11b: CAPTCHA on
anonymous sign-in** — the last spend-protection layer before depth systems.

**Goal:** stop bots from minting anonymous JWTs and burning the Anthropic budget. Today
anyone can hit `signInAnonymously()` (`src/ai.js`) freely; the only guards are server-side
caps in the `ai_config` table (kill switch + global/per-session daily caps) and the $10/mo
Anthropic cap. CAPTCHA adds a human check at the sign-in gate itself.

**Plan to flesh out (don't code until we've decided):**

1. **Pick a provider** — Cloudflare Turnstile (free, less intrusive, recommended) vs
   hCaptcha. Both are natively supported by Supabase Auth. Decide first.
2. **Supabase side:** enable CAPTCHA protection in Auth settings (Dashboard → Authentication
   → Attack Protection) for project `dozfiisefvwubtjbaemt`, using the provider's **secret**
   key. Note: this makes CAPTCHA mandatory for *all* auth flows incl. anonymous — confirm
   that's what we want, or scope it.
3. **Client side:** render the widget (lazy, like we lazy-load supabase-js — a blocked CDN
   must NOT break game boot), get a token, pass it as
   `signInAnonymously({ options: { captchaToken } })` in `ensureSession()` (`src/ai.js`).
   Keep the **graceful-degrade** contract: if CAPTCHA fails/unavailable, `callAI` still
   returns `{ok:false}` and the game runs deterministic-only — never crashes.
4. **UX:** the widget should appear only on first AI use (first freeform parse/judge/narrate
   call), not at boot — the game must be fully playable with zero AI and zero CAPTCHA
   friction. Decide where it renders in the terminal UI.
5. **Config:** site key into `config.js` (untracked, holds the live keys) with a placeholder
   in `docs/config.example.js`. Secret key is Supabase-side only, never in client code.

**Open questions to surface:** Turnstile vs hCaptcha; whether to gate only anon sign-in or
all auth; where the widget lives in the terminal layout; whether to also wire the optional
"free account → higher caps" path now or leave for later.

Verify with the preview + live Supabase as usual. `supabase` CLI is installed and linked;
deploy edge fns with `supabase functions deploy ai-proxy` (Docker-not-running warning is
harmless). Don't commit `config.js`.

## Quick reference (where things live)

- **Anon sign-in:** `src/ai.js` → `ensureSession()` (`signInAnonymously()`), lazy supabase-js
  load, never-throws `callAI`.
- **Server gate / rate limits:** `supabase/functions/ai-proxy/index.ts` (JWT validate → kill
  switch → global cap → per-session cap → Haiku call → log `ai_usage`).
- **Caps config (dashboard-editable):** `ai_config` table (see
  `supabase/migrations/20260606120000_ai_proxy.sql`).
- **Public Supabase url + anon key:** `config.js` (untracked); placeholders in
  `docs/config.example.js`. Supabase project ref: `dozfiisefvwubtjbaemt`.
- **AI prompts spec:** `docs/PROMPTS.md`. Build order: `CLAUDE.md` → BUILD ORDER (T11b is
  part of step 11's cost/safety hardening).
