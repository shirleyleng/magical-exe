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
import { coolUnmasking, relaxUnmasking, recapHeat, adjustVisibility, checkUnmaskingEvents } from "./visibility.js";
import { adjustAlignment } from "./alignment.js";
import { adjustHope, hopeBand, hopeMoodLine } from "./hope.js";

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

const rivalName = (model) => (model.rivals && model.rivals[0] && model.rivals[0].name) || "your rival";

/** T17: the mascot ran your training; once it's gone, training is closed and
    Sparring takes its place. Returns true (and prints a redirect) if blocked. */
function trainingClosed(state) {
  if (!state.model.world.flags.mascotGone) return false;
  pushLine(state, `There's no one to train you now — your mascot is gone. Spar with ${rivalName(state.model)} instead. (type spar)`, "system");
  return true;
}

/* ---- training ---- */
export function trainDirect(state, statKey) {
  const model = state.model;
  if (trainingClosed(state)) return state;
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
  if (trainingClosed(state)) return state;
  const key = resolveStat(target);
  if (key) return trainDirect(state, key);
  if (target && getAbility(target)) return learnAbility(state, target, "training");
  pushLine(state, "Train what? Try a stat (power, spirit, defense, speed, dodge, hp, stamina) or an ability you can learn.", "system");
  return state;
}

/** `train` with no argument -> a selection menu. */
export function openTrainMenu(state) {
  if (trainingClosed(state)) return state;
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
  pushLine(state, "What'll you put the day's work into?", "system");
  state.ui.menu = { active: true, kind: "train", options, index: 0 };
  return state;
}

/** Learn an ability in training (or sparring): spends slot(s); prereqs must hold.
    `slotKey` records which activity it counted against (training | sparring). */
export function learnAbility(state, name, slotKey = "training") {
  const model = state.model;
  const ch = model.character;
  const def = getAbility(name);
  if (!def || !def.learn) { pushLine(state, "There's nothing to learn there.", "system"); return state; }
  if (ch.abilities.includes(name)) { pushLine(state, `You already know ${name}.`, "system"); return state; }
  if (!meetsLearnReq(ch, def)) { pushLine(state, `You're not ready to learn ${name} yet.`, "system"); return state; }
  const cost = def.learn.slotCost || 1;
  if (slotsFree(model) < cost) { pushLine(state, "Not enough activity slots left today. Type rest to begin a new day.", "system"); return state; }
  model.hub.slotsUsedToday[slotKey] += cost;
  ch.abilities.push(name);
  pushLine(state, `You spend the day in focused practice. You've learned ${name} — ${def.learn.blurb}.`, "banner");
  return state;
}

/* ---- sparring (T17) ----
   Once the mascot is gone, training closes and the rival's spar takes its place:
   a risk/reward grind (config.sparring) that mostly grinds you down, sometimes
   breaks through, and occasionally just goes badly. The hopelessness theme made
   mechanical — but the only road forward. */
// Sparring unlocks at the mascot's disappearance (T17) and stays available even
// after the mascot returns (T18) — the rivalry persists. Keyed on its own flag,
// NOT mascotGone, so recovering the mascot reopens training without closing spar.
const sparringOpen = (state) => state.model.world.flags.sparringUnlocked === true;

function pickSparOutcome() {
  const outs = CONFIG.sparring.outcomes;
  const total = outs.reduce((a, o) => a + o.weight, 0);
  let r = Math.random() * total;
  for (const o of outs) { if ((r -= o.weight) < 0) return o; }
  return outs[outs.length - 1];
}

const SPAR_FLAVOR = {
  breakthrough: [
    "For one clean breath it all clicks into place — blade, footing, lungs, all of it one moving thing. So this is what it's supposed to feel like. Maybe you can do this after all.",
    "You read the strike before it even leaves their shoulder, and you answer it. {rival} actually stops. A slow, real smile. \"...There. THERE it is. That's the one I've been waiting for.\"",
  ],
  solid: [
    "Blow after blow, no mercy and no praise, just the work. You hold. It isn't hope, exactly — but it's solid ground under your feet, and right now that's worth more.",
    "{rival} drills you until your arms shake and your grip starts to go. \"Again.\" You're still standing when they finally call it. That, you're starting to understand, was the whole lesson.",
  ],
  rough: [
    "You can't land a single thing on them. {rival} doesn't go easy — they never do — and in the gaps between breaths the old doubt slips back in through the cracks. Am I even meant for this?",
    "You're flat on your back staring at the sky before you've registered the throw. \"Get up.\" Just that. And for one ugly second, on the cold ground, you genuinely wonder why you keep bothering to.",
  ],
};

const pickLine = (arr, rival) => arr[Math.floor(Math.random() * arr.length)].replace(/\{rival\}/g, rival);

/** Spar a stat with the rival: a weighted risk/reward roll on the training gain. */
export function doSpar(state, statKey) {
  const model = state.model;
  if (!sparringOpen(state)) {
    pushLine(state, "Your mascot still guides your training — there's no need to spar yet.", "system");
    return state;
  }
  if (slotsFree(model) <= 0) {
    pushLine(state, "You're out of activity slots for today. Type rest to begin a new day.", "system");
    return state;
  }
  const rival = rivalName(model);
  const stats = model.character.stats;
  const out = pickSparOutcome();
  model.hub.slotsUsedToday.sparring += 1;

  if (out.key === "rough") {
    const hurt = CONFIG.sparring.hpCostOnRough;
    stats.hp = Math.max(1, stats.hp - hurt);
    pushLine(state, pickLine(SPAR_FLAVOR.rough, rival), "system");
    pushLine(state, `A rough session — no gain, and it cost you. (-${hurt} HP)`, "hint");
  } else {
    const base = CONFIG.training.gainPerSession[statKey] || 0;
    const cap = CONFIG.training.softCap[statKey];
    const gain = Math.round(base * out.mult);
    let value = stats[statKey] + gain;
    if (cap != null && value > cap) value = cap;
    stats[statKey] = value;
    if (statKey === "maxHp") stats.hp = stats.maxHp;
    if (statKey === "maxStamina") stats.stamina = stats.maxStamina;
    refreshSlotsMax(model); // maxStamina growth can unlock a slot
    pushLine(state, pickLine(SPAR_FLAVOR[out.key], rival), "system");
    pushLine(state, `${out.key === "breakthrough" ? "A breakthrough! " : ""}Your ${statLabel(statKey)} is now ${stats[statKey]}. (+${gain})`, "system");
  }
  pushLine(state, `Slots: ${slotsUsed(model)}/${model.hub.slotsMax} used today.`, "hint");
  return state;
}

/** `spar <stat>` from the command parser. */
export function sparCommand(state, target) {
  if (!sparringOpen(state)) {
    pushLine(state, "Your mascot still guides your training — there's no need to spar yet.", "system");
    return state;
  }
  const key = resolveStat(target);
  if (key) return doSpar(state, key);
  if (target && getAbility(target)) return learnAbility(state, target, "sparring");
  pushLine(state, "Spar to sharpen what? Try a stat (power, spirit, defense, speed, dodge, hp, stamina) or an ability you can learn.", "system");
  return state;
}

/** `spar` with no argument -> a selection menu. */
export function openSparMenu(state) {
  if (!sparringOpen(state)) {
    pushLine(state, "Your mascot still guides your training — there's no need to spar yet.", "system");
    return state;
  }
  if (slotsFree(state.model) <= 0) {
    pushLine(state, "You're out of activity slots for today. Type rest to begin a new day.", "system");
    return state;
  }
  const g = CONFIG.training.gainPerSession;
  const options = [
    { label: `Power     (~+${g.power}, risky)`, value: "power" },
    { label: `Spirit    (~+${g.spirit}, risky)`, value: "spirit" },
    { label: `Defense   (~+${g.defense}, risky)`, value: "defense" },
    { label: `Speed     (~+${g.speed}, risky)`, value: "speed" },
    { label: `Dodge     (~+${g.dodge}, risky)`, value: "dodge" },
    { label: `Max HP    (~+${g.maxHp}, risky)`, value: "maxHp" },
    { label: `Max Stam. (~+${g.maxStamina}, risky)`, value: "maxStamina" },
  ];
  // With the mascot gone, sparring is also the only way left to learn abilities.
  for (const { name, def } of learnableAbilities(state.model.character)) {
    const cost = def.learn.slotCost || 1;
    options.push({ label: `Learn ${name} — ${def.learn.blurb} [${cost} slot]`, value: `learn:${name}` });
  }
  options.push({ label: "Cancel", value: "__cancel__" });
  pushLine(state, `${rivalName(state.model)} rolls their shoulders till they crack and brings their blade up. "No mercy from me — that's the only way anyone gets strong, and you don't have time for the kind way. A spar can break something open, or just hold the line, or go badly. All three teach you something. Choose."`, "system");
  state.ui.menu = { active: true, kind: "spar", options, index: 0 };
  return state;
}

/* ---- shop (free, no slot) ---- */
function findItem(id) {
  return CONFIG.economy.shop.find((it) => it.id === id || it.name === id);
}
const coin = () => CONFIG.economy.currencySymbol;

/** Human-readable effect of an item, built from its type/amount (facts stay in config). */
function itemEffectText(it) {
  if (!it) return "A curious trinket.";
  switch (it.type) {
    case "heal":     return `Restores ${it.amount} HP.`;
    case "stamina":  return `Restores ${it.amount} Stamina.`;
    case "material": return "Crafting material.";
    default:         return "A curious trinket.";
  }
}

export function openShopMenu(state) {
  const coins = state.model.character.coins ?? 0;
  const options = CONFIG.economy.shop.map((it) => ({
    label: `${it.name}  —  ${coin()}${it.price}`,
    value: it.id,
    detail: `${itemEffectText(it)}  ·  buy ${coin()}${it.price}  ·  sell ${coin()}${it.sell}`,
  }));
  // Forge with moonstone shards once you've gathered enough.
  const mc = moonCraft();
  if (mc && countItem(state.model.character, mc.material) >= mc.shardsPerBoost) {
    options.push({
      label: "Forge with moonstone shards…",
      value: "__craft__",
      detail: `Spend ${mc.shardsPerBoost} ${mc.material}s for a permanent stat boost.`,
    });
  }
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
    return {
      label: `${name}  (+${coin()}${price})`,
      value: String(i),
      detail: `${itemEffectText(it)}  ·  sell for ${coin()}${price}`,
    };
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

/* ---- moonstone crafting (forge a permanent stat boost at the shop) ----
   Free (no slot), like the rest of the shop. Spend `shardsPerBoost` moonstone shards to
   permanently raise a chosen stat by config.crafting.moonstone.boost[stat]. softCaps apply. */
const moonCraft = () => CONFIG.crafting && CONFIG.crafting.moonstone;
function countItem(ch, name) {
  return ch.inventory.filter((n) => n.toLowerCase() === name.toLowerCase()).length;
}

/** Shop sub-menu: pick which stat to forge with your shards. */
export function openCraftMenu(state) {
  const mc = moonCraft();
  const ch = state.model.character;
  if (!mc) { pushLine(state, "There's nothing to forge here.", "system"); return openShopMenu(state); }
  const have = countItem(ch, mc.material);
  if (have < mc.shardsPerBoost) {
    pushLine(state, `You need ${mc.shardsPerBoost} ${mc.material}s to forge anything (you have ${have}).`, "system");
    return openShopMenu(state);
  }
  const b = mc.boost;
  const options = [
    { label: `Power     (+${b.power})`, value: "power" },
    { label: `Spirit    (+${b.spirit})`, value: "spirit" },
    { label: `Defense   (+${b.defense})`, value: "defense" },
    { label: `Speed     (+${b.speed})`, value: "speed" },
    { label: `Dodge     (+${b.dodge})`, value: "dodge" },
    { label: `Max HP    (+${b.maxHp})`, value: "maxHp" },
    { label: `Max Stam. (+${b.maxStamina})`, value: "maxStamina" },
    { label: "Back", value: "__back__" },
  ];
  pushLine(state, `The shopkeep turns a moonstone shard to the light. "Three of these, and I can work the magic of one into your very bones — permanent, mind. What'll it be?" (you have ${have})`, "system");
  state.ui.menu = { active: true, kind: "craft", options, index: 0 };
  return state;
}

/** Consume the shards and apply the permanent boost. */
export function doCraft(state, statKey) {
  const mc = moonCraft();
  const ch = state.model.character;
  const stats = ch.stats;
  if (!mc) return state;
  const need = mc.shardsPerBoost;
  if (countItem(ch, mc.material) < need) {
    pushLine(state, `You don't have enough ${mc.material}s.`, "system");
    return openShopMenu(state);
  }
  const gain = (mc.boost && mc.boost[statKey]) || 0;
  if (!gain) { pushLine(state, "That can't be forged.", "system"); return openCraftMenu(state); }

  // Remove `need` shards from the satchel.
  let removed = 0;
  for (let i = ch.inventory.length - 1; i >= 0 && removed < need; i--) {
    if (ch.inventory[i].toLowerCase() === mc.material.toLowerCase()) { ch.inventory.splice(i, 1); removed++; }
  }

  const cap = CONFIG.training.softCap[statKey];
  let value = stats[statKey] + gain;
  if (cap != null && value > cap) value = cap;
  stats[statKey] = value;
  if (statKey === "maxHp") stats.hp = stats.maxHp;
  if (statKey === "maxStamina") stats.stamina = stats.maxStamina;
  refreshSlotsMax(state.model); // maxStamina growth can unlock a slot

  pushLine(state, `The shopkeep works the shards into a slow bright heat and presses it home. Your ${statLabel(statKey)} is now ${stats[statKey]}. (-${need} ${mc.material}s)`, "banner");
  return countItem(ch, mc.material) >= need ? openCraftMenu(state) : openShopMenu(state);
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
  if (it && it.type === "material") {
    pushLine(state, `The ${name} hums faintly in your palm. It's not for using on its own — take a few to the shop to forge them into something permanent.`, "system");
    return state;
  }
  pushLine(state, `You can't use the ${name} right now.`, "system");
  return state;
}

/* ---- day rollover (shared by rest + lie low) ---- */
function beginDay(state) {
  const model = state.model;
  model.day += 1;
  model.hub.slotsUsedToday = { training: 0, combat: 0, errand: 0, sparring: 0 };
  refreshSlotsMax(model);
  // A mid-tier investigator eats part of the morning (T15 damage-control).
  if (model.hub.pendingDamageControl) {
    model.hub.slotsMax = Math.max(1, model.hub.slotsMax - 1);
    model.hub.pendingDamageControl = false;
    pushLine(state, "You spend the morning covering your tracks from a snooping investigator. (-1 slot today)", "system");
  }
  // A night's rest restores HP and Stamina (and prevents exploration soft-locks).
  const stats = model.character.stats;
  stats.hp = stats.maxHp;
  stats.stamina = stats.maxStamina;
}

/* ---- day-passing flavour at rest ----
   A small bit of personal/domestic texture each time a day rolls over: the
   quiet life around the heroics. Context-varied — by story phase (tier), by
   whether the mascot is here, and by a slow seasonal cadence — and it never
   repeats the line it showed last (model.hub.lastRestFlavor). This is purely
   additive ambience; it is DELIBERATELY distinct from readCityMood (which
   reports the hidden Hope tally), so the two never say the same kind of thing.
   Tokens: {mascot} -> the mascot's name, {season} -> the current season. */
const SEASONS = [
  "the first soft weeks of spring",
  "the long gold of summer",
  "a cooling, rust-coloured autumn",
  "the close, candle-lit quiet of winter",
];
const seasonOf = (day) => SEASONS[Math.floor(((day || 1) - 1) / 7) % SEASONS.length];

const REST_FLAVOR = {
  // mascot present — early story (novice / soldier): the strangeness still fresh
  early: [
    "You eat dinner standing at the counter, still half in your other life. The double of it all hasn't worn off yet — ordinary by daylight, something else entirely once the dark comes down.",
    "Sleep comes slow. You keep turning the day over: the impossible parts of it sitting right beside the bus fare and the unwashed dishes, stubbornly refusing to feel impossible.",
    "{mascot} curls into the crook of your neck as you drift off, impossibly warm for something so small, and for a moment the whole strange shape of your new life feels like the most natural thing in the world.",
    "You catch yourself grinning at nothing on the way to bed — at the secret of it, the sheer unlikely fact of you. There'll be more to do tomorrow. Tonight, that's plenty.",
  ],
  // mascot present — mid story (knight): the double life is just life now
  mid: [
    "The double life doesn't feel like a costume anymore. It's just your life. You can barely remember being startled by any of it.",
    "You're tired in the way sleep only half-mends. There's more weight on you now — people who'd notice if you stopped. You're a little surprised to find you don't mind carrying it.",
    "{mascot} talks you down from the day's worries with the patience of something far older than it looks, until the knot behind your ribs loosens just enough to let you sleep.",
  ],
  // mascot present — late story (awakened / ascended): the weight of what's coming
  late: [
    "The hush before what's coming has a particular weight to it. You lie awake a while, listening to the city breathe through the walls, and promise it — silently, fiercely — that you won't let it down.",
    "You've come a long way from the person who heard a cry for help and simply turned toward it. On nights like this you can almost feel that person watching, and you hope, more than anything, they'd be proud.",
    "{mascot} doesn't say much tonight. It just stays close, the way you stay close to someone on the eve of something enormous. You're grateful for it past the reach of words.",
  ],
  // mascot gone (the knight->awakened low point): the empty house
  gone: [
    "The house is too quiet to sleep in. You leave a light on out of a habit that no longer has a reason, and lie awake listening for a small bright voice that doesn't come.",
    "You set out two cups before you remember, and then you put the second one quietly back. The day ends the way they all have lately — heavily, and alone.",
    "You work until your hands ache and fall asleep where you sit, because the bed is where you'd have to be still, and being still is where the missing gets loudest.",
    "Somewhere out there, you tell yourself, your mascot is sleeping too. You have to believe that. You hold onto it like a railing in the dark, and at last — at long last — you drift off.",
  ],
  // tier-agnostic seasonal cadence: the world keeps turning around you
  seasonal: [
    "Outside, the city has slipped into {season}; you notice it the way you notice most things now — late, and all at once, from a window on your way to bed.",
    "It's {season} already, apparently. The days keep turning whether or not you're ready for them, and there's a strange small comfort in that — the world quietly keeping its appointments.",
    "{season}. You'd lost track. The corner shops have changed their windows and the light comes in a different colour now, and life — stubborn, ordinary, lovely — simply carries on around you.",
  ],
};

/** Pick a flavour line for this rest, context-chosen and never an immediate repeat. */
function restFlavorLine(model) {
  const flags = model.world.flags || {};
  const tier = model.character.transformationTier;
  let pool;
  if (flags.mascotGone) {
    pool = REST_FLAVOR.gone;
  } else {
    const phase =
      tier === "knight" ? REST_FLAVOR.mid
      : tier === "awakened" || tier === "ascended" ? REST_FLAVOR.late
      : REST_FLAVOR.early;
    const seasonal = REST_FLAVOR.seasonal.map((l) => l.replace(/\{season\}/g, seasonOf(model.day)));
    pool = [...phase, ...seasonal];
  }
  if (!pool.length) return null;
  const last = model.hub.lastRestFlavor;
  const choices = pool.length > 1 ? pool.filter((l) => l !== last) : pool;
  const line = choices[Math.floor(Math.random() * choices.length)];
  model.hub.lastRestFlavor = line;
  return line.replace(/\{mascot\}/g, (model.mascot && model.mascot.name) || "your companion");
}

/* ---- rest ---- */
export function doRest(state) {
  const model = state.model;
  beginDay(state);
  pushLine(state, `You rest. Day ${model.day} dawns; your ${model.hub.slotsMax} slots are fresh and you feel restored.`, "system");
  const flavor = restFlavorLine(model); // additive day-passing texture (distinct from city mood)
  if (flavor) pushLine(state, flavor, "system");
  // The public eye cools a little overnight (T15) — but never fully forgets.
  const cooled = coolUnmasking(model.character);
  if (cooled > 0) pushLine(state, `The talk dies down a little. (-${cooled} Unmasking)`, "hint");
  relaxUnmasking(state);
  recapHeat(state);
  readCityMood(state); // ambient, hidden-hope feedback when the mood band shifts
  return state;
}

/* The morning read of the city's mood — the only signal of the hidden Hope tally.
   Fires once at the start, then only when hope crosses into a new band, so it's a
   felt drift rather than a number (or daily spam). */
function readCityMood(state) {
  const ch = state.model.character;
  const band = hopeBand(ch.hopeTally || 0);
  if (ch.hopeBandSeen === band) return;
  ch.hopeBandSeen = band;
  pushLine(state, hopeMoodLine(ch), "hint");
}

/* ---- lowering methods (T15) ---- */

/** Lie low: spend the whole day out of sight — a big Unmasking drop, day advances. */
export function doLieLow(state) {
  const model = state.model;
  const ch = model.character;
  const ax = CONFIG.axes.unmasking;
  if ((ch.unmasking || 0) <= 0) {
    pushLine(state, "No one's looking your way — there's nothing to lie low from.", "system");
    return state;
  }
  beginDay(state);
  const before = ch.unmasking;
  const floor = (ch.fame || 0) > 0 ? ax.residualFloor : 0;
  ch.unmasking = Math.max(floor, before - ax.lieLowReduction);
  pushLine(state, `You keep your head down — no public magic, no heroics. Day ${model.day} dawns quietly. (-${before - ch.unmasking} Unmasking)`, "system");
  relaxUnmasking(state);
  recapHeat(state);
  return state;
}

/** Misdirection errand: plant a false lead — moderate Unmasking drop, costs a slot, no day. */
export function doMisdirect(state) {
  const model = state.model;
  const ch = model.character;
  const ax = CONFIG.axes.unmasking;
  if ((ch.unmasking || 0) <= 0) {
    pushLine(state, "There's no heat to misdirect right now.", "system");
    return state;
  }
  if (slotsFree(model) <= 0) {
    pushLine(state, "You're out of activity slots for today. Rest first.", "system");
    return state;
  }
  model.hub.slotsUsedToday.errand += 1;
  const before = ch.unmasking;
  const floor = (ch.fame || 0) > 0 ? ax.residualFloor : 0;
  ch.unmasking = Math.max(floor, before - ax.misdirectionReduction);
  pushLine(state, `You plant a false lead — a staged sighting clear across town. (-${before - ch.unmasking} Unmasking · 1 slot)`, "system");
  relaxUnmasking(state);
  return state;
}

/* ---- T18: the alliance ----
   Reach out to the magical alliance. Before the Spire loss it's just distant
   flavor; after it (flags.boss4Attempted), the elder reveals the road to
   Awakened and unlocks the secret-place dungeon (flags.secretPlaceUnlocked).
   Free — no slot, like the shop. */
export function visitAlliance(state) {
  const model = state.model;
  const flags = model.world.flags;
  const ch = model.character;

  if (!flags.boss4Attempted) {
    pushLine(state, "You reach out through the alliance channel. It's thin and far away — a hundred cities calling at once. There's nothing they can do for you tonight.", "system");
    return state;
  }

  if (!flags.secretPlaceUnlocked) {
    flags.allianceVisited = true;
    flags.secretPlaceUnlocked = true;
    pushLine(state, "You finally reach the alliance — really reach them, the way Sable told you to.", "banner");
    pushLine(state, `An elder's voice answers, worn and kind: "We wondered when you'd call. Your mascot didn't fail you — it bought you time. What took it can't be beaten as you are now. You have to AWAKEN."`, "mascot");
    pushLine(state, `"Awakening isn't given, child. You walk back to who you were before any of this — your truest place — and you face the doubt that waits there. Your weapon sleeps in that place. So does your mascot."`, "mascot");
    const place = ch.secretPlace ? `“${ch.secretPlace}”` : "the place you used to hide when the world was too much";
    const toy = ch.magicalWeapon && ch.magicalWeapon.fromToy ? ` And you remember ${ch.magicalWeapon.fromToy} — the one thing you never quite threw away.` : "";
    pushLine(state, `You know the place at once: ${place}.${toy}`, "system");
    pushLine(state, "(A misted path opens. Type explore to seek your secret place.)", "hint");
    return state;
  }

  pushLine(state, `The alliance has told you all they can. "Go to your secret place. Awaken. Then finish what took your mascot." The channel goes quiet.`, "mascot");
  return state;
}

/* ---- errands (T19 hope layer) ----
   Opt-in help that brings the city hope (the hidden tally, hope.js). Archetypes
   trade axes (config.errands): quiet help builds Virtue, public rescue builds
   Fame but raises Unmasking, expedient help is fast but corrupts. Hope is NEVER
   shown as a number — only the flavor + the city's mood drift hint at it. */
const ERRAND_FLAVOR = {
  kindness: [
    "You sit a long while with someone who'd quietly stopped expecting anyone to come. Nothing gets fixed. They're just, for an afternoon, a little less alone — and it turns out that was the whole thing they needed.",
    "You carry an old neighbour's shopping up four narrow flights, and then you stay for the tea you didn't have time for, and then for the second cup you really didn't, because she's telling you about her husband and her eyes are bright.",
    "You listen — really listen, no clock running in your head — to someone the whole rest of the city has quietly learned to walk a little faster past.",
  ],
  service: [
    "Dawn to dark, you give the whole day away — the soup line, the shelter, a stranger's leaking roof in the rain. By dusk you're wrung out and aching and tired in the good way, the way that means it counted.",
    "A whole day of small mercies, one stacked on the next on the next, until your hands ache and your back complains and the street, when you finally look up at it, seems just a shade less grey than it did this morning.",
  ],
  rescue: [
    "You pull someone clear of a corrupted snarl in the middle of the crowded market — a single held gasp from everyone watching, and then, breaking over you, the cheers. They all saw it. They saw you be brave for them.",
    "Out in the open, in front of the whole street, you put yourself square between the dark and someone who couldn't run from it. It's the kind of thing a person carries the rest of their life. They won't forget it. Neither, you suspect, will you.",
  ],
  expedient: [
    "You help — you do — but you take the shortcut, the one that gets it done and leaves a faint sour taste at the back of your mouth. It's handled. Mostly. You decide not to examine the 'mostly' too closely.",
    "You fix it the fast way. The way that's so much easier than it is right. It works, and the person thanks you, and you smile back, and it's probably best not to turn the whole thing over in your head too much later tonight.",
  ],
};
const sample = (arr) => arr[Math.floor(Math.random() * arr.length)];

const errandArchetypes = () => (CONFIG.errands && CONFIG.errands.archetypes) || [];

/** `errand` with no/unknown target -> a chooser of the ways to spend yourself. */
export function openErrandMenu(state) {
  const model = state.model;
  if (slotsFree(model) <= 0) {
    pushLine(state, "You're out of activity slots for today. Type rest to begin a new day.", "system");
    return state;
  }
  const lieLow = model.character.mustLieLow;
  const options = errandArchetypes()
    .filter((a) => !(a.public && lieLow)) // no public heroics while your cover is too hot
    .map((a) => ({ label: `${a.label} — ${a.blurb} [${a.slots} slot${a.slots > 1 ? "s" : ""}]`, value: a.id }));
  options.push({ label: "Cancel", value: "__cancel__" });
  pushLine(state, "The city is full of small hurts, the kind no boss fight ever fixes. How do you want to spend yourself today?", "system");
  state.ui.menu = { active: true, kind: "errand", options, index: 0 };
  return state;
}

/** Resolve one errand. Meter changes are applied SILENTLY (hope is hidden; the
    visible meters move in STATUS but get no per-errand callout) — you feel it, you
    don't read it. */
export function doErrand(state, id) {
  const model = state.model;
  const ch = model.character;
  const a = errandArchetypes().find((x) => x.id === id);
  if (!a) { pushLine(state, "That isn't something you can do.", "system"); return state; }
  if (a.public && ch.mustLieLow) {
    pushLine(state, "Not out in the open — your cover is too hot right now. Lie low first.", "system");
    return state;
  }
  if (slotsFree(model) < a.slots) {
    pushLine(state, "There isn't enough of the day left for that. Rest first.", "system");
    return state;
  }
  model.hub.slotsUsedToday.errand += a.slots;
  if (a.virtue || a.corruption) adjustAlignment(ch, { virtue: a.virtue || 0, corruption: a.corruption || 0 });
  if (a.fame || a.unmasking) adjustVisibility(ch, { fame: a.fame || 0, unmasking: a.unmasking || 0 });
  if (a.hope) adjustHope(ch, a.hope);

  pushLine(state, sample(ERRAND_FLAVOR[a.id] || ["You spend the hours helping where you can."]), "system");
  pushLine(state, `Slots: ${slotsUsed(model)}/${model.hub.slotsMax} used today.`, "hint");
  if (a.public) checkUnmaskingEvents(state); // a public deed may have crossed an Unmasking threshold
  return state;
}

/** `errand <name>` shortcut (matches an archetype id or label word). */
export function errandCommand(state, target) {
  if (!target) return openErrandMenu(state);
  const t = target.toLowerCase();
  const a = errandArchetypes().find((x) => x.id === t || x.label.toLowerCase().includes(t));
  if (!a) { pushLine(state, "You're not sure what you mean by that. Type errand to see how you can help.", "system"); return state; }
  return doErrand(state, a.id);
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

  if (kind === "spar") {
    if (opt.value.startsWith("learn:")) return learnAbility(state, opt.value.slice(6), "sparring");
    return doSpar(state, opt.value);
  }

  if (kind === "errand") return doErrand(state, opt.value);

  if (kind === "shop") {
    if (opt.value === "__leave__") { pushLine(state, "You step back out into the day.", "system"); return state; }
    if (opt.value === "__sell__") return openSellMenu(state);
    if (opt.value === "__craft__") return openCraftMenu(state);
    return buyItem(state, opt.value);
  }

  if (kind === "shopSell") {
    if (opt.value === "__back__") return openShopMenu(state);
    return sellIndex(state, opt.value);
  }

  if (kind === "craft") {
    if (opt.value === "__back__") return openShopMenu(state);
    return doCraft(state, opt.value);
  }

  return state;
}
