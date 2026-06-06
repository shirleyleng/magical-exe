/* ============================================================
   MAGICAL.EXE — progress.js  (T9)
   Transformation-tier progression. When a story boss is defeated
   (state.ui.justDefeatedBoss), check whether its tier's requirements
   are now met and, if so, transform the player and play the reveal.
   Tiers are gated by a boss AND a threshold (config.tiers).

   v1 slice implements Novice -> Soldier (Boss #1 + the alliance
   reveal). Knight/Awakened/Ascended reveals arrive in T16+.
   ============================================================ */

import { CONFIG } from "../config.js";
import { pushLine } from "./state.js";
import { ART } from "./mascot.js";
import { refreshSlotsMax } from "./hub.js";

const TIER_ORDER = ["novice", "soldier", "knight", "awakened", "ascended"];

const TIER_REVEAL = {
  soldier(state) {
    const m = (state.model.mascot && state.model.mascot.name) || "Your mascot";
    pushLine(state, ART.star_large, "mascot");
    pushLine(state, "Light pours up through you — you rise to MAGICAL SOLDIER!", "banner");
    pushLine(state, `${m}: "You did it! …There's something I should tell you now."`, "mascot");
    pushLine(
      state,
      `${m}: "We aren't alone. Across the world there's an alliance of magical people, sworn to drive back corruption and keep cities pure — but there are far too few of us for every city. That's why we can travel from one to the next."`,
      "mascot"
    );
  },
};

/** React to a boss defeat: maybe advance a tier and play its reveal. */
export function handleBossDefeat(state) {
  const bossId = state.ui.justDefeatedBoss;
  if (!bossId) return state;
  state.ui.justDefeatedBoss = null;

  const ch = state.model.character;

  // Which tier does this boss gate?
  const tierName = Object.keys(CONFIG.tiers).find((t) => CONFIG.tiers[t].reqBoss === bossId);
  if (!tierName) return state;

  // Only advance to the immediate next tier.
  const curIdx = TIER_ORDER.indexOf(ch.transformationTier);
  if (TIER_ORDER.indexOf(tierName) !== curIdx + 1) return state;

  // Threshold gates.
  const reqs = CONFIG.tiers[tierName];
  const staminaPct = ch.stats.stamina / ch.stats.maxStamina;
  if (reqs.reqMinStaminaPct && staminaPct < reqs.reqMinStaminaPct) {
    pushLine(state, "You feel a threshold just out of reach — recover your Stamina and return.", "hint");
    return state;
  }
  if (reqs.reqWeaponFound && !ch.magicalWeapon.found) return state;
  if (reqs.reqMinHopeTally && ch.hopeTally < reqs.reqMinHopeTally) return state;

  // Transform!
  ch.transformationTier = tierName;
  const before = state.model.hub.slotsMax;
  refreshSlotsMax(state.model); // a tier milestone grants +1 slot

  const reveal = TIER_REVEAL[tierName];
  if (reveal) reveal(state);

  if (state.model.hub.slotsMax > before) {
    pushLine(state, `(A new path opens — you now have ${state.model.hub.slotsMax} activity slots.)`, "hint");
  }
  return state;
}
