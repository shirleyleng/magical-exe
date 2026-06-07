/* MAGICAL.EXE — Virtue/Corruption axis (T14)
 *
 * Virtue and Corruption are the two ends of ONE coupled slider. Gaining one end drains the
 * other (couplingDrain), so play drifts you toward an end; `path` (virtuous/balanced/corrupt) is
 * read from the gap between them. Corruption doubles as the absolute "darkness depth" that
 * warps your stats past the config thresholds. All magnitudes live in CONFIG.axes.
 *
 * Side-effect-free helpers over the character object; the only mutator is adjustAlignment().
 */
import { CONFIG } from "../config.js";

const A = () => CONFIG.axes.alignment;

const clampMeter = (v) => Math.max(0, Math.min(100, Math.round(v)));

/** virtuous / balanced / corrupt, from the gap between the two ends. */
export function derivePath(ch) {
  const gap = (ch.virtue || 0) - (ch.corruption || 0);
  const t = A().pathGap;
  if (gap >= t) return "virtuous";
  if (gap <= -t) return "corrupt";
  return "balanced";
}

/**
 * Apply a coupled change to the slider. Pass positive deltas, e.g. { corruption: 8 } or
 * { virtue: 4 }. Gaining one end also drains the other by couplingDrain * gain. Clamps both
 * to 0..100 and recomputes ch.path. Returns the actual { corruption, virtue } deltas applied
 * (post-clamp) so callers can report the real movement.
 */
export function adjustAlignment(ch, delta = {}) {
  const drain = A().couplingDrain;
  const dC = delta.corruption || 0;
  const dV = delta.virtue || 0;
  const beforeC = ch.corruption || 0;
  const beforeV = ch.virtue || 0;
  ch.corruption = clampMeter(beforeC + dC - drain * dV);
  ch.virtue = clampMeter(beforeV + dV - drain * dC);
  ch.path = derivePath(ch);
  return { corruption: ch.corruption - beforeC, virtue: ch.virtue - beforeV };
}

/** The active stat-warp multipliers for a corruption level (highest threshold reached wins). */
export function warpFor(corruption) {
  let w = { powerMult: 1, hpMult: 1, spiritMult: 1 };
  for (const th of CONFIG.axes.corruption.warpThresholds || []) {
    if ((corruption || 0) >= th.at) w = th;
  }
  return w;
}

/** The active "grace" boon for a virtue level (mirror of the warp; highest threshold wins). */
export function graceFor(virtue) {
  let g = { defenseMult: 1, healMult: 1 };
  for (const th of (CONFIG.axes.virtue && CONFIG.axes.virtue.graceThresholds) || []) {
    if ((virtue || 0) >= th.at) g = th;
  }
  return g;
}

/** Healing-potency multiplier from the virtue grace boon (virtuous builds heal harder). */
export function healMultiplier(ch) {
  return graceFor(ch.virtue).healMult || 1;
}

/** True if corruption is high enough to be warping stats (drives a HUD marker). */
export function isWarped(ch) {
  const w = warpFor(ch.corruption);
  return w.powerMult !== 1 || w.hpMult !== 1;
}

/** True if virtue is high enough that the grace boon is active (drives a HUD marker). */
export function isGraced(ch) {
  const g = graceFor(ch.virtue);
  return g.defenseMult !== 1 || g.healMult !== 1;
}

/**
 * Combat-effective stats (non-destructive — base stats untouched). Corruption warp amplifies
 * Power and decays max HP; the virtue grace boon raises Defense. Spirit warp is reserved.
 */
export function effectiveStats(ch) {
  const s = ch.stats;
  const w = warpFor(ch.corruption);
  const g = graceFor(ch.virtue);
  return {
    ...s,
    power: Math.max(1, Math.round(s.power * w.powerMult)),
    maxHp: Math.max(1, Math.round(s.maxHp * w.hpMult)),
    defense: Math.max(0, Math.round(s.defense * g.defenseMult)),
  };
}

/**
 * Soft-fizzle chance: an ability whose alignment OPPOSES your current lean can falter. The
 * chance scales with how far you've drifted into the wrong end, capped. Neutral abilities and
 * abilities aligned with (or neutral to) your lean never fizzle.
 */
export function fizzleChance(ch, align) {
  if (align !== "virtuous" && align !== "corrupt") return 0;
  const into = align === "virtuous"
    ? (ch.corruption || 0) - (ch.virtue || 0)   // how deep in corrupt while casting a virtuous move
    : (ch.virtue || 0) - (ch.corruption || 0);  // how deep in virtue while casting a corrupt move
  if (into <= 0) return 0;
  return Math.min(A().fizzleChanceCap, into * A().fizzlePerGapPoint);
}
