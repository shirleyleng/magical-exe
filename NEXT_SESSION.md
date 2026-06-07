# NEXT SESSION — T15: Fame / Unmasking axis

> Kickoff notes for the next session. Read `MEMORY.md` + `memory/v1-slice-status.md` first
> for full status. Delete/replace this file when T15 is underway.

## Where things stand (as of 2026-06-06)

Done & verified live: T1–T13 (slice + AI layer), **T11b** (Turnstile spend-gate, "Option B"),
**T14 + T14.5** (Purity/Corruption axis — coupled slider, corruption warp + purity **grace**
boon, `burst`, mercy/finish nudges, path ability kits: `mend`/`drain`/`radiance`/`ward`/`purify`,
soft-fizzle, learn-via-training). Settings menu + themes (live preview, dark/light groups) +
Ko-fi (footer + About) also shipped.

Backlog (memory/backlog.md): mascot idle animations; mobile-friendly redesign.

## What's next: T15 — Fame / Unmasking (the visibility axis)

Two linked meters (DESIGN.md §3 "Fame vs. Unmasking", TASKS.md T15). Config knobs already
exist in `config.js > axes.fame` and `axes.unmasking`; meters live on the character
(`fame`, `unmasking`, start 0/0). Neither moves yet — wire them up.

- **Fame** (good): rises from public wins, visible quests, saving civilians → unlocks
  events/allies/shops/story doors.
- **Unmasking** (rising = danger): public battles raise it; **corrupt-flavored play raises it
  FASTER** — this is corruption's *third* cost, tying T15 back to the T14 slider. Cools over
  time (`coolPerRestDay`); never trivially hits zero.
- **Escalating threshold events** (low/mid/high in config): rumors → active investigator +
  damage-control events → identity-at-risk crisis.
- **Lowering methods**: lie low, misdirection errand, relocate hub (2 days / all slots),
  memory cloud (Pure) / memory wipe (Corrupt).

## Open design calls to workshop at the start (don't code until decided)

1. **Scope this pass**: full threshold-event system now, or meters + gains + HUD first and
   events as a follow-up? (Events can be large.)
2. **HUD**: Fame/Unmasking already render as bare numbers — keep, or give Unmasking a
   danger-styled bar like the alignment slider?
3. **Where do gains fire**: combat victory = public win? exploration vs hub visibility? How
   does "saving civilians" surface as an action in the current slice?
4. **Event delivery**: do Unmasking threshold events interrupt on `rest`/day-tick, as hub
   events, or both?

## Working notes / conventions

- All balance in `config.js` (gitignored, holds live keys); keep `docs/config.example.js` in sync.
- Verify with the preview (`.claude/launch.json`, port 4321) + reload after every src edit.
  Drive deterministic logic via `preview_eval` importing modules with throwaway state objects.
- Alignment is the model for "coupled meters done right" — see `src/alignment.js`
  (`adjustAlignment` is the single mutator). Fame/Unmasking are simpler (not coupled to
  each other, but Unmasking gain rate keys off corruption/path).
- Commit per logical chunk. Don't commit `config.js`.
