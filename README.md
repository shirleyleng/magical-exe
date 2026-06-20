# ✦ MAGICAL.EXE ✦

A cozy, browser-based text adventure where you discover you're a magical girl (or
boy, or person) and set out to lift the corruption from your city — one moonlit
dungeon, one quiet errand, one impossible choice at a time.

**▶ Play it: [magical-exe.redmint.studio](https://magical-exe.redmint.studio)**

It looks like a soft-glowing terminal, plays like a tactical text-MUD, and is
narrated by AI — but every die roll, hit, and outcome is decided by deterministic
client-side code. The AI only translates what you type and adds flavour; it never
decides what actually happens.

---

## What's in it

- **Character creation** → fuse a one-of-a-kind ASCII **mascot** companion that
  animates, reacts, and grows alongside you.
- **Hub life** — a daily activity-slot loop: train, shop, craft, run errands, rest.
- **Exploration** — room-to-room dungeons (Moonlit Forest, Drowned Harbor, Hollow
  Clocktower, and beyond), each with their own atmosphere, lore, and guarded prizes.
- **Tactical combat** with a status-effect system, plus **freeform actions** an AI
  judge weighs for plausibility (the engine still sets every number).
- **Two coupled meters that change your story:**
  - **Virtue ↔ Corruption** — power-with-a-cost vs. control-and-sustain.
  - **Fame ↔ Unmasking** — the more publicly you fight, the closer the city comes
    to learning who you are.
- **A five-tier arc** Novice → Soldier → Knight → Awakened → Ascended, a rival, a
  scripted low point, a secret place, and a **four-ending finale** shaped by a
  hidden tally of the hope you've quietly gathered.
- **Prestige + Easy/Normal** difficulty, **7 themes**, multi-slot saves, and a
  mobile-friendly layout.

## Tech

Vanilla HTML/CSS/JS, no framework, no bundler — it deploys as static files.

- **Architecture:** an Elm-style **Model → Update → View** loop. One serializable
  state object (which *is* the save), a pure-ish `update(state, event)`, and a
  `render(state)` that paints plain DOM styled to look terminal-y (no xterm.js).
- **Persistence:** `localStorage`, multiple named slots, auto- + manual save.
- **AI:** a **Supabase Edge Function** proxies **Claude Haiku 4.5** for the fuzzy
  command parser, room narration, city flavour, and the combat-plausibility judge.
  The Anthropic key lives server-side; the browser never calls Anthropic directly.
  Spend is protected by per-session + global caps, a kill switch, and a Cloudflare
  Turnstile human-check. **Everything degrades gracefully to deterministic-only
  mode** if AI is unavailable.

## Run it locally

```bash
# 1. Create your local config from the template
cp docs/config.example.js config.js
#    (edit config.js to add your Supabase URL/anon key + Turnstile site key;
#     leaving the placeholders just disables the AI layer — the game still runs)

# 2. Serve with the no-cache dev server (plain `python -m http.server` will serve
#    STALE ES modules and your edits silently won't apply)
python3 scripts/devserver.py 4321

# 3. Open http://localhost:4321
```

`config.js` is gitignored; `docs/config.example.js` is the tracked source of truth
for all balance/difficulty knobs. On deploy, `scripts/build-config.js` regenerates
`config.js` from the template, injecting public values from environment variables.

## Project map

| Path | What |
|------|------|
| `index.html`, `styles.css`, `themes.css` | the terminal shell + 7 themes |
| `src/` | the game: `update.js`, `render.js`, `combat.js`, `explore.js`, `dungeons.js`, `enemies.js`, `hub.js`, alignment/visibility/hope/endgame, the mascot + AI clients |
| `docs/` | `CLAUDE.md` (project context), `DESIGN.md` (full design), `PROMPTS.md` (AI prompts), `DEPLOY.md`, `mascots.md`, `config.example.js` |
| `supabase/` | the `ai-proxy` Edge Function + migrations |
| `scripts/` | dev server, `build-config.js`, and the balance simulators in `scripts/sim/` |

## Credits

Made by **[Red Mint Studio](https://ko-fi.com/shirleyleng)**. If you enjoy it,
a coffee on [Ko-fi](https://ko-fi.com/shirleyleng) is always appreciated. ♥

Aesthetic homages (no vendored code): [Charm](https://charm.sh)'s Lip Gloss /
Bubble Tea, [Compute Cuter](https://computecuter.com) by sailorhg, and the
[Rosé Pine](https://rosepinetheme.com) palette. Not affiliated with any of them.
