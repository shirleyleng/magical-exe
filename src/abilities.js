/* MAGICAL.EXE — ability roster helpers (T14)
 *
 * Abilities are data in CONFIG.abilities. An ability with a `learn` block is acquired in
 * training once its prereqs (tier reached + a slider threshold) are met; abilities without
 * one are innate. `align` (pure/corrupt/neutral) gates learning and drives the soft-fizzle
 * in combat (see alignment.js). The actual combat effect lives in combat.js.
 */
import { CONFIG } from "../config.js";

export const TIER_ORDER = ["novice", "soldier", "knight", "awakened", "ascended"];
export function tierIndex(tier) {
  const i = TIER_ORDER.indexOf(tier);
  return i < 0 ? 0 : i;
}

export function getAbility(name) {
  return (CONFIG.abilities && CONFIG.abilities[name]) || null;
}

/** Whether the character meets a learnable ability's prereqs (innate abilities return false). */
export function meetsLearnReq(ch, def) {
  const L = def && def.learn;
  if (!L) return false;
  if (L.reqTier && tierIndex(ch.transformationTier) < tierIndex(L.reqTier)) return false;
  if (typeof L.reqCorruption === "number" && (ch.corruption || 0) < L.reqCorruption) return false;
  if (typeof L.reqGapPure === "number" && ((ch.purity || 0) - (ch.corruption || 0)) < L.reqGapPure) return false;
  return true;
}

/** Abilities the character could learn right now: learnable, not already known, prereqs met. */
export function learnableAbilities(ch) {
  return Object.entries(CONFIG.abilities || {})
    .filter(([name, def]) => def.learn && !ch.abilities.includes(name) && meetsLearnReq(ch, def))
    .map(([name, def]) => ({ name, def }));
}
