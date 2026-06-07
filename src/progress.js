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
import { armRivalForBoss } from "./rival.js";

const TIER_ORDER = ["novice", "soldier", "knight", "awakened", "ascended"];

const mascotName = (state) => (state.model.mascot && state.model.mascot.name) || "Your mascot";

const TIER_REVEAL = {
  soldier(state) {
    const m = mascotName(state);
    pushLine(state, ART.star_large, "mascot");
    pushLine(state, "Light pours up through you — you rise to MAGICAL SOLDIER!", "banner");
    pushLine(state, `${m}: "You did it! …There's something I should tell you now."`, "mascot");
    pushLine(
      state,
      `${m}: "We aren't alone. Across the world there's an alliance of magical people, sworn to drive back corruption and keep cities pure — but there are far too few of us for every city. That's why we can travel from one to the next."`,
      "mascot"
    );
  },
  knight(state) {
    const m = mascotName(state);
    const path = state.model.character.path;
    const flavor =
      path === "pure"
        ? "Clean light hardens around you like armor — every edge of you turned to shelter for others."
        : path === "corrupt"
        ? "The light comes edged and hungry, a darker steel — power that protects, and tempts."
        : "Light folds into something tempered and sure — neither soft nor cruel, simply ready.";
    pushLine(state, ART.star_large, "mascot");
    pushLine(state, "You rise again — MAGICAL KNIGHT!", "banner");
    pushLine(state, flavor, "system");
    pushLine(state, `${m}: "A Knight. I knew you'd reach this. The alliance will want to hear of it."`, "mascot");
  },
};

/* Narrative beats that fire when a boss falls, regardless of whether a tier-up
   happens — this is how the player learns corruption's deeper nature (DESIGN §8).
   Each fires at most once (latched in world.flags.storyBeats). */
const BOSS_BEAT = {
  boss2(state) {
    const m = mascotName(state);
    pushLine(state, `${m}: "These aren't wild spawns. Something is *commanding* the corruption — a big boss, hidden, pulling it toward your city on purpose."`, "mascot");
    pushLine(state, `${m}: "Beat back its champions and we'll find it. …Though something about all this still doesn't sit right with me."`, "mascot");
  },
  boss3(state) {
    const m = mascotName(state);
    pushLine(state, `${m}: "I've started to understand. The corruption grows thickest where people have given up — it *feeds* on hopelessness."`, "mascot");
    pushLine(state, `${m}: "Every errand you run, every person you give hope back to — that may be the truer fight. Remember that."`, "mascot");
  },
};

/** React to a boss defeat: fire its story beat, then maybe advance a tier. */
export function handleBossDefeat(state) {
  const bossId = state.ui.justDefeatedBoss;
  if (!bossId) return state;
  state.ui.justDefeatedBoss = null;

  const ch = state.model.character;
  const flags = state.model.world.flags;

  // Story beat (corruption's deeper nature), latched so it never repeats.
  if (!flags.storyBeats) flags.storyBeats = [];
  if (BOSS_BEAT[bossId] && !flags.storyBeats.includes(bossId)) {
    flags.storyBeats.push(bossId);
    BOSS_BEAT[bossId](state);
  }

  // Arm the rival schedule off this boss (meets after #2, returns after #3).
  armRivalForBoss(state, bossId);

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
