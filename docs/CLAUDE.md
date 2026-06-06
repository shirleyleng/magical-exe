# MAGICAL.EXE — Project Context

> This file gives Claude Code persistent context for the project. Read it first,
> then `DESIGN.md` for full game design, `PROMPTS.md` for the AI integration,
> `mascots.md` for the ASCII library, and `config.example.js` for balance knobs.

## What this is

A single-player, browser-based, text MUD-style game with a fake-terminal interface.
The player discovers they're a magical girl/boy/person and works to rid their city of
"corruption." Visual style is an homage to Charm's Lip Gloss aesthetic (cozy terminal:
rounded borders, soft-but-vivid palette, monospace), recreated in CSS — **not** the
actual Charm Go libraries.

## Hard constraints (do not violate)

- **Plain DOM, no terminal emulator.** A scrolling output area + an input line, styled
  with CSS to look terminal-y. Do NOT use xterm.js. Persistent panels (stat bar, mascot)
  are styled DOM elements.
- **No bundler-heavy stack required.** Vanilla HTML/CSS/JS is the default. A light build
  (Vite) is acceptable if it helps, but the deliverable must deploy as static files to
  Netlify or GitHub Pages.
- **No browser storage APIs are forbidden HERE** (this is a real site, not a Claude
  artifact): localStorage is REQUIRED for saves.
- **All game truth is deterministic and client-side.** The AI never decides what actually
  happens. See "AI boundary" below.
- **Charm is an aesthetic homage only.** No vendored Charm code. Include the credit line
  (see DESIGN.md > Credits).

## Tech stack

- Frontend: vanilla HTML/CSS/JS (plain DOM). Single-page.
- Persistence: `localStorage`, multiple named save slots, auto-save + manual save.
- AI proxy: **Supabase Edge Function** (Deno) holding the Anthropic API key server-side.
  The browser calls the Edge Function, never Anthropic directly.
- AI model: **Claude Haiku 4.5** (`claude-haiku-4-5-20251001`) for parsing + narration.
- Hosting: static files (Netlify or GitHub Pages). Supabase project for the Edge Function.

## Architecture: the Elm pattern

Borrow Bubble Tea's structure (Model–Update–View), even though we're not using Bubble Tea:

- **Model** — one serializable state object (the save). See DESIGN.md > State Shape.
- **Update** — a single pure-ish function `update(state, event) -> newState`. Every change
  (command, combat action, timer-equivalent, NPC tick) flows through here. No scattered
  mutation.
- **View** — `render(state)` paints the DOM from state. State change -> re-render.

This makes saves trivial (serialize Model), keeps logic centralized, and makes the build
clean for an AI pair-programmer.

## The two modes

- **Hub mode** (home city): activity-slot driven. Screen = activity menu + stat panel.
  6 slots/day to start (grows via Stamina + transformation tier). Shop access is FREE
  (no slot). `rest` ends the day, resets slots, advances `day`, ticks rivals/events.
- **Exploration mode** (dungeons: forest, alt-dimension, mountains, beach, etc.): room-to-room
  graph navigation. Limiting resource is **Stamina**, not slots. No day cycle. Boss at the
  end gates story progression.

## The command parser cascade (cost-critical)

1. **Deterministic parser runs first, always.** Tokenize -> match known verbs/synonyms
   (`n`/`north`/`go north`, `l`/`look`, `get`/`take`, `i`/`inventory`, `attack`, etc.).
   Match -> execute directly. Zero API cost, instant. This handles the large majority of turns.
2. **Only on no-confident-match** -> call the Supabase proxy -> Claude interprets intent,
   returns structured JSON.
3. Engine validates the structured action against current state and applies it.

Always prefer the deterministic path. The AI is the fallback for freeform/creative input.

## AI boundary (critical)

Claude is a **translator and narrator**, never the engine:
- IN: turn fuzzy player text into a structured, validated action.
- OUT: write flavor prose for what the engine already decided happened.
- The engine (your code) decides all truth: stats, hits, loot, what exists.
See PROMPTS.md for the exact system prompts and the combat-plausibility judge.

## Cost & safety (build these from day one)

- Use Haiku 4.5. Enable **prompt caching** on the static system prompt (it's identical every
  call — ~90% savings on cached input).
- **Supabase-side rate limiting:** per-session cap (anonymous sign-in token) + a **global
  daily kill switch** in the Edge Function. If global calls exceed the comfort cap, return a
  graceful "AI features resting" and let the game continue in deterministic-only mode.
- **Anthropic Console:** set a monthly spend cap + usage alert emails. Belt and suspenders
  with the Supabase kill switch.
- Progressive friction for players: anonymous play with hard caps by default; optional free
  account raises limits + enables cloud save; global kill switch protects spend regardless.
- The game must **degrade gracefully** to deterministic-only mode whenever AI is unavailable.

## BUILD ORDER — ship a vertical slice first

Do NOT build the whole game before anything is playable. Target order:

**v1 slice (make this fully working and fun before anything else):**
1. Terminal shell: DOM output + input line, Charm-style CSS, stat panel, mascot panel.
2. Model–Update–View skeleton + localStorage save/load (one slot is fine to start).
3. Character creation flow (see DESIGN.md > Character Creation).
4. Mascot assignment + ASCII display (small + large) from `mascots.md`.
5. Deterministic parser + `/help` + rotating example prompts.
6. Hub mode: 6 slots, training (direct stat growth), free shop, `rest`.
7. Exploration mode: one dungeon (room graph) + Stamina + one boss.
8. Tactical combat core (no AI yet).
9. Tiers novice -> soldier (first boss unlocks soldier + the alliance reveal).
10. Multi-slot saves, manual + auto.

**Then layer in:**
11. Supabase Edge Function proxy + AI fallback parser + narration + rate limiting.
12. AI-mediated freeform combat actions (plausibility judge).
13. Purity/Corruption axis + Fame/Unmasking axis.
14. Tiers 3–5, rival arc, special-place dungeon, 3-phase finale + ascension.
15. Prestige/clean-slate mechanic, Easy/Normal scaling.

Keep everything tunable via `config.js` (copy from `config.example.js`).

## File map

- `CLAUDE.md` — this file.
- `DESIGN.md` — full game design + plot + state shape.
- `PROMPTS.md` — AI system prompts (parser, combat judge, narration, mascot voice).
- `mascots.md` — ASCII library + name list + fusion rules.
- `config.example.js` — balance/difficulty knobs (copy to `config.js`).
