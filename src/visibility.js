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
import { pushLine } from "./state.js";

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

/* ----------------------------------------------------------------------------
   Threshold events (escalating: low → mid → high). They fire the moment a gain
   pushes Unmasking into a higher tier than already seen (call right after a
   public win), and re-arm when heat cools back below a tier (so a returning
   investigator can fire again). Each tier carries a lightweight consequence.
---------------------------------------------------------------------------- */

/** Fire any newly-crossed Unmasking event. Call after an Unmasking gain. */
export function checkUnmaskingEvents(state) {
  const ch = state.model.character;
  const tier = unmaskingTier(ch.unmasking || 0);
  if (tierIndex(tier) <= tierIndex(ch.unmaskingTierSeen || "none")) return;
  ch.unmaskingTierSeen = tier;
  fireUnmaskingEvent(state, tier);
}

function fireUnmaskingEvent(state, tier) {
  const ch = state.model.character;
  if (tier === "low") {
    pushLine(state, "⚠ Rumors stir. A tabloid runs a smudged sketch of your magical persona; a classmate swears they saw something.", "banner");
    pushLine(state, "(Nothing dangerous yet — but the city is starting to watch. `lie low` or run a `misdirection` errand to cool off.)", "hint");
  } else if (tier === "mid") {
    pushLine(state, "⚠ Someone is actively investigating you — a reporter, or worse, a hunter — pulling threads toward your real name.", "banner");
    state.model.hub.pendingDamageControl = true; // costs a slot at the start of your next day
    pushLine(state, "(You'll burn part of tomorrow covering your tracks. Lower your Unmasking before this gets worse.)", "hint");
  } else if (tier === "high") {
    pushLine(state, "‼ YOUR IDENTITY IS ON THE LINE. One more public mistake and the mask comes off for good.", "banner");
    ch.mustLieLow = true; // no public skirmishes until heat drops below mid
    pushLine(state, "(You can't risk public magic now. `lie low` or `misdirection` until the heat dies down.)", "hint");
  }
}

/** After cooling/lowering, re-arm dropped tiers and lift the lie-low lock once safe. */
export function relaxUnmasking(state) {
  const ch = state.model.character;
  const cur = tierIndex(unmaskingTier(ch.unmasking || 0));
  if (tierIndex(ch.unmaskingTierSeen || "none") > cur) {
    ch.unmaskingTierSeen = unmaskingTier(ch.unmasking || 0);
  }
  if (ch.mustLieLow && cur < tierIndex("mid")) {
    ch.mustLieLow = false;
    pushLine(state, "The heat has died down enough to risk showing your face again.", "system");
  }
}

/** A short status line on current heat — shown in the rest recap. */
export function recapHeat(state) {
  const ch = state.model.character;
  const tier = unmaskingTier(ch.unmasking || 0);
  if (tier === "none") return;
  const note = {
    low: "Whispers follow your magical persona.",
    mid: "Someone is actively investigating you.",
    high: "Your secret identity is hanging by a thread.",
  }[tier];
  pushLine(state, `Unmasking ${ch.unmasking} — ${note}`, tier === "high" ? "banner" : "hint");
}
