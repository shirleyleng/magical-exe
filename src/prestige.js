/* ============================================================
   MAGICAL.EXE — prestige.js  (T20)
   Prestige / clean-slate (DESIGN §9 "Meta systems"). Lay down all
   story progress and start a fresh turning from Day 1 — keeping WHO you
   are (identity + mascot bond + learned abilities) but with your current
   stats HALVED as the cost. `prestigeCount` rises each time and (on
   Normal) makes enemies a notch stronger per turning (combat.js spawnEnemy
   already reads it), so prestige is the incremental-game ratchet: grow
   big, lay half of it down, regrow from a higher floor against a harder world.

   Available anytime from the hub via a confirmed choice (kind "prestige").
   ============================================================ */

import { CONFIG } from "../config.js";
import { pushLine, freshModel } from "./state.js";
import { refreshSlotsMax } from "./hub.js";

const mascotName = (model) => (model.mascot && model.mascot.name) || "Your mascot";

/** Open the confirm dialog. Defaults the highlight to "No" — this is irreversible. */
export function openPrestigeMenu(state) {
  const model = state.model;
  const ch = model.character;
  const m = mascotName(model);
  pushLine(state, "—", "hint");
  pushLine(state, "PRESTIGE — begin again, stronger", "banner");
  pushLine(state, "You'd lay down everything you've won — your tier, every boss felled, your whole way through the city — and start a fresh turning of the story from Day 1.", "system");
  pushLine(state, `You keep who you are: your name, ${m} and the bond between you, and every ability you've learned. But your stats are HALVED as you pour your strength back into a new beginning.`, "system");
  if (model.difficulty === "normal") {
    pushLine(state, "On Normal, the corruption rises to meet your experience — each turning makes the world a notch harder.", "hint");
  } else {
    pushLine(state, "On Easy, the world stays as forgiving as ever, turning after turning.", "hint");
  }
  pushLine(state, "This can't be undone. Begin again?", "system");
  state.ui.menu = {
    active: true,
    kind: "prestige",
    options: [
      { label: "Yes — lay it down and begin again", value: "confirm" },
      { label: "No, not yet", value: "__cancel__" },
    ],
    index: 1, // default to "No" — safer for a destructive action
  };
  return state;
}

/** Perform the prestige: rebuild a fresh model, carrying identity + halved stats
    + abilities + the difficulty/prestigeCount forward; everything else resets. */
export function doPrestige(state) {
  const old = state.model;
  const oc = old.character;
  const k = CONFIG.prestige.statMultiplier;
  const half = (n) => Math.max(1, Math.round((n || 0) * k));

  // Start from a clean model so nothing story-related is missed in the reset,
  // then carry the persistent pieces forward.
  const fresh = freshModel({
    saveSlotName: old.saveSlotName,
    createdAt: old.createdAt,
    difficulty: old.difficulty,
  });
  fresh.prestigeCount = (old.prestigeCount || 0) + 1;

  const nc = fresh.character;
  nc.created = true;
  // identity carries over wholesale
  nc.name = oc.name;
  nc.gender = oc.gender;
  nc.pronouns = oc.pronouns;
  nc.occupation = oc.occupation;
  nc.personality = oc.personality;
  nc.city = oc.city;
  nc.secretPlace = oc.secretPlace;
  // keep the weapon's ORIGIN flavor, but you'll recover the weapon again this run
  nc.magicalWeapon = { ...oc.magicalWeapon, found: false };
  // learned kit carries over (the chosen prestige perk)
  nc.abilities = [...(oc.abilities || [])];
  // meters reset to a centered, unwritten alignment (freshCharacter already did,
  // but path is derived — keep it balanced explicitly)
  nc.path = "balanced";
  // stats: halve the grown values; start the new run at full HP/Stamina
  nc.stats = {
    maxHp: half(oc.stats.maxHp),
    power: half(oc.stats.power),
    spirit: half(oc.stats.spirit),
    defense: half(oc.stats.defense),
    speed: half(oc.stats.speed),
    dodge: half(oc.stats.dodge),
    hp: 0,
    stamina: 0,
    maxStamina: half(oc.stats.maxStamina),
  };
  nc.stats.hp = nc.stats.maxHp;
  nc.stats.stamina = nc.stats.maxStamina;

  // mascot identity persists, fully restored for the new run
  fresh.mascot = old.mascot ? { ...old.mascot, present: true, injured: false, dimmed: false } : null;

  refreshSlotsMax(fresh);
  state.model = fresh;

  const m = mascotName(fresh);
  pushLine(state, "", "system");
  pushLine(state, "✦ A NEW TURNING ✦", "banner");
  pushLine(state, "You let it all go — and the world breathes in and begins again around you. The streets are unfamiliar-familiar; the corruption stirs as if for the very first time.", "system");
  pushLine(state, `${m}: "Round and round we go. But you carry everything that matters — and we're so much stronger than when we started. Let's do this properly this time."`, "mascot");
  pushLine(state, `(Prestige ${fresh.prestigeCount} · stats halved, abilities + bond kept · Day 1${old.difficulty === "normal" ? " · the world is harder now" : ""}.)`, "hint");
  pushLine(state, "Type /help any time. Try: train power · rest · explore", "hint");
  return state;
}
