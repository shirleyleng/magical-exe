/* ============================================================
   MAGICAL.EXE — hub.js  (T6)
   Hub-mode activities: training (direct stat growth, costs a slot),
   the free shop (buy/sell), and `rest` (ends the day, resets slots).
   Activity slots are the scarcity of *time* in the hub.

   Slot count grows with maxStamina thresholds and transformation
   tiers (config.hub.slotUnlocks) — computeSlotsMax() derives it so it
   stays correct as those change.
   ============================================================ */

import { CONFIG } from "../config.js";
import { pushLine } from "./state.js";
import { getAbility, meetsLearnReq, learnableAbilities } from "./abilities.js";

const TIER_ORDER = ["novice", "soldier", "knight", "awakened", "ascended"];

/* ---- slot accounting ---- */
export function computeSlotsMax(model) {
  let max = CONFIG.hub.startingSlots;
  const su = CONFIG.hub.slotUnlocks;
  for (const th of su.staminaThresholds) {
    if (model.character.stats.maxStamina >= th) max += 1;
  }
  const reached = TIER_ORDER.indexOf(model.character.transformationTier);
  for (const t of su.transformationTiers) {
    if (TIER_ORDER.indexOf(t) <= reached) max += 1;
  }
  return max;
}

export function refreshSlotsMax(model) {
  model.hub.slotsMax = computeSlotsMax(model);
  return model.hub.slotsMax;
}

export function slotsUsed(model) {
  return Object.values(model.hub.slotsUsedToday).reduce((a, b) => a + b, 0);
}

export function slotsFree(model) {
  return Math.max(0, model.hub.slotsMax - slotsUsed(model));
}

/* ---- stat alias resolution (shared by command + menu) ---- */
const STAT_ALIASES = {
  power: "power", pwr: "power",
  spirit: "spirit", spr: "spirit",
  defense: "defense", def: "defense",
  speed: "speed", spd: "speed",
  dodge: "dodge",
  hp: "maxHp", maxhp: "maxHp", health: "maxHp",
  stamina: "maxStamina", sta: "maxStamina",
};

export function resolveStat(which) {
  return STAT_ALIASES[(which || "").toLowerCase()] || null;
}

function statLabel(key) {
  return key === "maxHp" ? "max HP" : key === "maxStamina" ? "max Stamina" : key;
}

/* ---- training ---- */
export function trainDirect(state, statKey) {
  const model = state.model;
  if (slotsFree(model) <= 0) {
    pushLine(state, "You're out of activity slots for today. Type rest to begin a new day.", "system");
    return state;
  }

  const gain = CONFIG.training.gainPerSession[statKey] || 0;
  const cap = CONFIG.training.softCap[statKey];
  const stats = model.character.stats;

  let value = stats[statKey] + gain;
  if (cap != null && value > cap) value = cap;
  stats[statKey] = value;
  if (statKey === "maxHp") stats.hp = stats.maxHp;
  if (statKey === "maxStamina") stats.stamina = stats.maxStamina;

  model.hub.slotsUsedToday.training += 1;
  refreshSlotsMax(model); // maxStamina growth can unlock a slot

  pushLine(state, `You train hard. Your ${statLabel(statKey)} is now ${stats[statKey]}.`, "system");
  pushLine(state, `Slots: ${slotsUsed(model)}/${model.hub.slotsMax} used today.`, "hint");
  return state;
}

/** `train <stat>` from the command parser. */
export function trainCommand(state, target) {
  const key = resolveStat(target);
  if (!key) {
    pushLine(state, "Train what? Try: power, spirit, defense, speed, dodge, hp, stamina.", "system");
    return state;
  }
  return trainDirect(state, key);
}

/** `train` with no argument -> a selection menu. */
export function openTrainMenu(state) {
  if (slotsFree(state.model) <= 0) {
    pushLine(state, "You're out of activity slots for today. Type rest to begin a new day.", "system");
    return state;
  }
  const g = CONFIG.training.gainPerSession;
  const options = [
    { label: `Power     (+${g.power})`, value: "power" },
    { label: `Spirit    (+${g.spirit})`, value: "spirit" },
    { label: `Defense   (+${g.defense})`, value: "defense" },
    { label: `Speed     (+${g.speed})`, value: "speed" },
    { label: `Dodge     (+${g.dodge})`, value: "dodge" },
    { label: `Max HP    (+${g.maxHp})`, value: "maxHp" },
    { label: `Max Stam. (+${g.maxStamina})`, value: "maxStamina" },
  ];
  // Path abilities you're eligible to learn (tier + slider threshold met) appear here.
  for (const { name, def } of learnableAbilities(state.model.character)) {
    const cost = def.learn.slotCost || 1;
    options.push({ label: `Learn ${name} — ${def.learn.blurb} [${cost} slot]`, value: `learn:${name}` });
  }
  options.push({ label: "Cancel", value: "__cancel__" });
  pushLine(state, "What will you train today?", "system");
  state.ui.menu = { active: true, kind: "train", options, index: 0 };
  return state;
}

/** Learn an ability in training: spends slot(s); requires prereqs still met. */
export function learnAbility(state, name) {
  const model = state.model;
  const ch = model.character;
  const def = getAbility(name);
  if (!def || !def.learn) { pushLine(state, "There's nothing to learn there.", "system"); return state; }
  if (ch.abilities.includes(name)) { pushLine(state, `You already know ${name}.`, "system"); return state; }
  if (!meetsLearnReq(ch, def)) { pushLine(state, `You're not ready to learn ${name} yet.`, "system"); return state; }
  const cost = def.learn.slotCost || 1;
  if (slotsFree(model) < cost) { pushLine(state, "Not enough activity slots left today. Type rest to begin a new day.", "system"); return state; }
  model.hub.slotsUsedToday.training += cost;
  ch.abilities.push(name);
  pushLine(state, `You spend the day in focused practice. You've learned ${name} — ${def.learn.blurb}.`, "banner");
  return state;
}

/* ---- shop (free, no slot) ---- */
function findItem(id) {
  return CONFIG.economy.shop.find((it) => it.id === id || it.name === id);
}
const coin = () => CONFIG.economy.currencySymbol;

export function openShopMenu(state) {
  const coins = state.model.character.coins ?? 0;
  const options = CONFIG.economy.shop.map((it) => ({
    label: `${it.name}  —  ${coin()}${it.price}`,
    value: it.id,
  }));
  options.push({ label: "Sell something…", value: "__sell__" });
  options.push({ label: "Leave", value: "__leave__" });
  pushLine(state, `The shop is warm and cluttered. You have ${coin()}${coins}.`, "system");
  state.ui.menu = { active: true, kind: "shop", options, index: 0 };
  return state;
}

export function openSellMenu(state) {
  const inv = state.model.character.inventory;
  if (!inv.length) {
    pushLine(state, "You have nothing to sell.", "system");
    return openShopMenu(state);
  }
  const options = inv.map((name, i) => {
    const it = findItem(name);
    const price = it ? it.sell : 1;
    return { label: `${name}  (+${coin()}${price})`, value: String(i) };
  });
  options.push({ label: "Back", value: "__back__" });
  pushLine(state, "Sell what?", "system");
  state.ui.menu = { active: true, kind: "shopSell", options, index: 0 };
  return state;
}

export function buyItem(state, id) {
  const ch = state.model.character;
  const it = findItem(id);
  if (!it) { pushLine(state, "They don't sell that.", "system"); return state; }
  if ((ch.coins ?? 0) < it.price) {
    pushLine(state, `You can't afford the ${it.name} (${coin()}${it.price}).`, "system");
    return openShopMenu(state);
  }
  ch.coins -= it.price;
  ch.inventory.push(it.name);
  pushLine(state, `You buy a ${it.name}. (${coin()}${ch.coins} left)`, "system");
  return openShopMenu(state); // stay in the shop
}

export function sellIndex(state, indexStr) {
  const ch = state.model.character;
  const i = Number(indexStr);
  const name = ch.inventory[i];
  if (name == null) { pushLine(state, "That's gone already.", "system"); return openShopMenu(state); }
  const it = findItem(name);
  const price = it ? it.sell : 1;
  ch.inventory.splice(i, 1);
  ch.coins = (ch.coins ?? 0) + price;
  pushLine(state, `You sell the ${name} for ${coin()}${price}. (${coin()}${ch.coins} total)`, "system");
  return ch.inventory.length ? openSellMenu(state) : openShopMenu(state);
}

/** `sell <item>` from the command parser. */
export function sellCommand(state, target) {
  if (!target) { pushLine(state, "Sell what?", "system"); return state; }
  const ch = state.model.character;
  const i = ch.inventory.findIndex((n) => n.toLowerCase() === target.toLowerCase());
  if (i === -1) { pushLine(state, `You aren't carrying a ${target}.`, "system"); return state; }
  return sellIndex(state, String(i));
}

/* ---- use a consumable (works in hub and, later, combat) ---- */
export function useItem(state, target) {
  if (!target) { pushLine(state, "Use what?", "system"); return state; }
  const ch = state.model.character;
  const i = ch.inventory.findIndex((n) => n.toLowerCase() === target.toLowerCase());
  if (i === -1) { pushLine(state, `You aren't carrying a ${target}.`, "system"); return state; }

  const name = ch.inventory[i];
  const it = findItem(name);
  const stats = ch.stats;

  if (it && it.type === "heal") {
    if (stats.hp >= stats.maxHp) { pushLine(state, "Your HP is already full.", "system"); return state; }
    stats.hp = Math.min(stats.maxHp, stats.hp + it.amount);
    ch.inventory.splice(i, 1);
    pushLine(state, `You drink the ${name}. HP is now ${stats.hp}/${stats.maxHp}.`, "system");
    return state;
  }
  if (it && it.type === "stamina") {
    if (stats.stamina >= stats.maxStamina) { pushLine(state, "Your Stamina is already full.", "system"); return state; }
    stats.stamina = Math.min(stats.maxStamina, stats.stamina + it.amount);
    ch.inventory.splice(i, 1);
    pushLine(state, `You drink the ${name}. Stamina is now ${stats.stamina}/${stats.maxStamina}.`, "system");
    return state;
  }
  pushLine(state, `You can't use the ${name} right now.`, "system");
  return state;
}

/* ---- rest ---- */
export function doRest(state) {
  const model = state.model;
  const stats = model.character.stats;
  model.day += 1;
  model.hub.slotsUsedToday = { training: 0, combat: 0, errand: 0, sparring: 0 };
  refreshSlotsMax(model);
  // A night's rest restores HP and Stamina (and prevents exploration soft-locks).
  stats.hp = stats.maxHp;
  stats.stamina = stats.maxStamina;
  pushLine(state, `You rest. Day ${model.day} dawns; your ${model.hub.slotsMax} slots are fresh and you feel restored.`, "system");
  return state;
}

/* ---- menu select router for hub menus ---- */
export function handleHubMenu(state, kind, opt) {
  pushLine(state, opt.label, "echo");
  state.ui.menu = null;

  if (opt.value === "__cancel__") { pushLine(state, "(never mind)", "hint"); return state; }

  if (kind === "train") {
    if (opt.value.startsWith("learn:")) return learnAbility(state, opt.value.slice(6));
    return trainDirect(state, opt.value);
  }

  if (kind === "shop") {
    if (opt.value === "__leave__") { pushLine(state, "You step back out into the day.", "system"); return state; }
    if (opt.value === "__sell__") return openSellMenu(state);
    return buyItem(state, opt.value);
  }

  if (kind === "shopSell") {
    if (opt.value === "__back__") return openShopMenu(state);
    return sellIndex(state, opt.value);
  }

  return state;
}
