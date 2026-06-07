/* ----------------------------------------------------------------------------
   visibility.js — the Fame / Unmasking axis (DESIGN §3, T15).

   Two linked public-eye meters, mirroring how alignment.js owns the Purity/
   Corruption slider. They are NOT coupled to each other (rising Fame doesn't
   lower Unmasking), but the same flashy acts that build Fame also raise
   Unmasking — and corruption-flavored play raises Unmasking FASTER (dark power
   is conspicuous). That is corruption's third cost: blowing your cover.

   `adjustVisibility` is the single mutator. Everything else derives.
---------------------------------------------------------------------------- */
import { CONFIG } from "../config.js";

const clamp = (v) => Math.max(0, Math.min(100, Math.round(v)));

/** The ONLY place fame/unmasking change. Clamps 0–100, returns actual deltas. */
export function adjustVisibility(ch, { fame = 0, unmasking = 0 } = {}) {
  const before = { fame: ch.fame || 0, unmasking: ch.unmasking || 0 };
  ch.fame = clamp(before.fame + fame);
  ch.unmasking = clamp(before.unmasking + unmasking);
  return { fame: ch.fame - before.fame, unmasking: ch.unmasking - before.unmasking };
}

/* Danger tiers, low→high. "none" = anonymous. */
export const UNMASK_TIERS = ["none", "low", "mid", "high"];

/** Which danger tier does `unmasking` sit in? */
export function unmaskingTier(unmasking) {
  const t = CONFIG.axes.unmasking.thresholds;
  if (unmasking >= t.high) return "high";
  if (unmasking >= t.mid) return "mid";
  if (unmasking >= t.low) return "low";
  return "none";
}

/** Index into UNMASK_TIERS (0 = none) — handy for ratchet/compare logic. */
export function tierIndex(tier) {
  return Math.max(0, UNMASK_TIERS.indexOf(tier));
}

/**
 * Passive cooling, applied once per rested day. Heat bleeds off by
 * `coolPerRestDay`, but once you've stepped into the public eye (fame > 0) it
 * never trivially returns to zero — `residualFloor` is the rumor that lingers.
 * Returns the actual amount cooled (>= 0).
 */
export function coolUnmasking(ch) {
  const ax = CONFIG.axes.unmasking;
  const before = ch.unmasking || 0;
  if (before <= 0) return 0;
  const floor = (ch.fame || 0) > 0 ? ax.residualFloor : 0;
  ch.unmasking = Math.max(floor, before - ax.coolPerRestDay);
  return before - ch.unmasking;
}
