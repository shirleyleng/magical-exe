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
  pushLine(state, "What will you train today?", "system");
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
    "For one clean breath it all clicks — blade, footing, breath as one. Maybe you can do this after all.",
    "You read the strike before it lands and answer it. {rival} actually pauses. \"...There it is.\"",
  ],
  solid: [
    "Blow after blow, no mercy, no praise. You hold. It isn't hope exactly — but it's something to stand on.",
    "{rival} drills you until your arms shake. \"Again.\" You're still standing. That's the lesson.",
  ],
  rough: [
    "You can't land a thing. {rival} doesn't go easy, and the old doubt creeps back in — am I even meant for this?",
    "You're flat on your back before you know it. \"Get up.\" You wonder, for a moment, why you bother.",
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
  pushLine(state, `${rivalName(state.model)} rolls her shoulders and raises her blade. "No mercy — that's how you get strong. A spar can break through, hold, or go badly. Choose."`, "system");
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

/* ---- rest ---- */
export function doRest(state) {
  const model = state.model;
  beginDay(state);
  pushLine(state, `You rest. Day ${model.day} dawns; your ${model.hub.slotsMax} slots are fresh and you feel restored.`, "system");
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
    "You sit a long while with someone who'd stopped expecting company. Nothing fixed — just less alone.",
    "You carry an old neighbour's shopping up four flights and stay for the tea you didn't have time for.",
    "You listen, really listen, to someone the whole city had learned to walk past.",
  ],
  service: [
    "Dawn to dark you give the day away — soup line, shelter, a stranger's leaking roof. You're tired in the good way.",
    "A whole day of small mercies, one after another, until your hands ache and the street looks a little less grey.",
  ],
  rescue: [
    "You pull someone clear of a corrupted snarl in the middle of the market — a gasp, then cheers. They saw you be brave.",
    "Out in the open, in front of everyone, you put yourself between the dark and someone who couldn't run. They won't forget it.",
  ],
  expedient: [
    "You help — but you take the shortcut, the one that leaves a taste in your mouth. It's done. Mostly.",
    "You fix it the fast way, the way that's easier than it is right. Best not to think too hard about it afterward.",
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
  pushLine(state, "The city is full of small hurts. How will you spend yourself?", "system");
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
    return buyItem(state, opt.value);
  }

  if (kind === "shopSell") {
    if (opt.value === "__back__") return openShopMenu(state);
    return sellIndex(state, opt.value);
  }

  return state;
}
