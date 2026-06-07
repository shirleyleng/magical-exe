/* ============================================================
   MAGICAL.EXE — mascotAnim.js
   A tiny JS frame-cycler for the HUD mascot. ONE setInterval drives a
   composed, fixed-height frame so the monospace grid never shifts:

       row 0      sparkle deco line (twinkles while idle)
       rows 1-3   the figure, padded + gently bobbed within 3 rows

   Idle = blink + bob + sparkle. One-shot reactions = speak / hit / happy.
   Frames come from mascot.js (ART + FRAMES) — curated, not generated.

   Safety:
   - Single interval, idempotent init -> no timer leaks.
   - Targets whatever `.mascot-art` pre is live right now (render rebuilds
     it each paint), so there's never a stale-node reference.
   - Respects prefers-reduced-motion: no idle motion, no reactions.
   - Only animates when the mascot is present; the gone/dimmed states keep
     whatever somber art render painted (the animator stays out of it).
   ============================================================ */

import { ART, FRAMES } from "./mascot.js";

const TICK_MS = 150;
const AREA = 3; // figure rows under the sparkle line -> 4 lines total, always
const SPARKLES = ["·  ·  ·", "✦  ·  ☆", "·  ✦  ·", "☆  ·  ✦"];
const HAPPY_SPARKLE = "✦  ☆  ✦";

let getEl = null;
let timer = null;
let tick = 0;
let base = "blob";
let animate = false; // true only while the mascot is present
let reduced = false; // prefers-reduced-motion
let reaction = null; // { kind, until } — one-shot speak/hit/happy

function figureFor(b, variant) {
  if (variant === "happy") return ART.star_small;
  if (variant && FRAMES[b] && FRAMES[b][variant]) return FRAMES[b][variant];
  return ART[`${b}_small`] || ART.blob_small;
}

/* Lay a 1-2 line figure into a fixed 4-line box (sparkle + 3 figure rows),
   offset vertically by `bob` so the figure rises/settles without resizing. */
function compose(figure, sparkleLine, bob) {
  const fig = String(figure).split("\n");
  const top = Math.min(bob, Math.max(0, AREA - fig.length));
  const rows = [sparkleLine];
  for (let i = 0; i < top; i++) rows.push("");
  for (const l of fig) rows.push(l);
  while (rows.length < AREA + 1) rows.push("");
  return rows.join("\n");
}

/** The neutral static frame render.js paints for a present mascot — same
    geometry as the animator's frames, so there's no jump when motion starts. */
export function idleFrame(b) {
  return compose(figureFor(b, "open"), SPARKLES[0], 0);
}

/** Pure: the composed frame for a base at a given tick. With `reactionKind`
    ("speak"|"hit"|"happy") it returns that reaction pose; otherwise the idle
    blink/bob/sparkle frame. Shared by the live animator AND the mascot gallery
    so both show exactly the same motion. */
export function composeFrameAt(b, tick, reactionKind) {
  if (reactionKind === "happy") return compose(ART.star_small, HAPPY_SPARKLE, tick % 2);
  if (reactionKind) return compose(figureFor(b, reactionKind), SPARKLES[tick % SPARKLES.length], 0);
  const bob = Math.floor(tick / 6) % 2; // gentle rise/settle ~every 0.9s
  const blink = tick % 26 === 0; // a quick blink ~every 3.9s
  const spark = SPARKLES[Math.floor(tick / 3) % SPARKLES.length];
  return compose(figureFor(b, blink ? "blink" : "open"), spark, bob);
}

/** Called by render each paint: which base, and is the mascot present? */
export function syncMascot(opts = {}) {
  if (opts.base) base = opts.base;
  animate = opts.status === "present";
  if (!animate) reaction = null;
}

/** Trigger a one-shot reaction pose (kind: "speak" | "hit" | "happy"). */
export function reactMascot(kind) {
  if (!animate || reduced) return;
  reaction = { kind, until: tick + (kind === "happy" ? 9 : 3) };
}

function frameNow() {
  if (reaction && tick < reaction.until) return composeFrameAt(base, tick, reaction.kind);
  reaction = null;
  return composeFrameAt(base, tick, null);
}

function step() {
  tick++;
  if (reduced || !animate) return; // render owns the static frame in these states
  const el = getEl && getEl();
  if (el) el.textContent = frameNow();
}

/** Start the animator. `elGetter` returns the live mascot <pre> (or null).
    Idempotent — calling twice does not start a second interval. */
export function initMascotAnim(elGetter) {
  if (timer) return;
  getEl = elGetter;
  const mq = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)");
  if (mq) {
    reduced = mq.matches;
    const onChange = (e) => { reduced = e.matches; };
    if (mq.addEventListener) mq.addEventListener("change", onChange);
    else if (mq.addListener) mq.addListener(onChange);
  }
  timer = setInterval(step, TICK_MS);
}
