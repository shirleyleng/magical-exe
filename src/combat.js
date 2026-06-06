/* ============================================================
   MAGICAL.EXE — combat.js  (T8)
   Deterministic tactical combat. Turn order by Speed, Dodge evasion
   roll, Defense mitigation, guard, abilities (Spirit cost), items.
   All numbers come from config.js. The engine decides all truth — no
   AI here (AI-mediated freeform actions arrive in T13).

   Fight state lives in model.combat so it survives a reload:
     { enemy, returnMode, returnRoom, playerGuard, round, fromSlot }
   ============================================================ */

import { CONFIG } from "../config.js";
import { pushLine } from "./state.js";
import { getEnemy } from "./enemies.js";
import { DUNGEONS } from "./dungeons.js";
import { useItem } from "./hub.js";
import { requestNarration } from "./narrate.js";

const coin = () => CONFIG.economy.currencySymbol;

/* ---- environment tags (T13 plausibility judge) ----
   What the player can plausibly improvise with this fight. Read at startCombat
   from the current dungeon+room (exploration) or the hub defaults, then frozen
   onto combat state so it survives reloads and the async judge call. */
function envTagsFor(model) {
  const loc = model.world.currentLocation;
  const d = loc && DUNGEONS[loc];
  if (d) {
    const r = d.rooms[model.world.currentRoom];
    return [...(d.env || []), ...((r && r.tags) || [])];
  }
  return [...(CONFIG.combat.judge.hubEnvTags || ["open ground"])];
}

/* Starter abilities. Path-gated kits (Pure/Corrupt) arrive in T14. */
const ABILITIES = {
  "light bolt": { name: "light bolt", spirit: 3, mult: 1.6, verb: "hurl a bolt of light at" },
};

/* ---- spawn an enemy instance with difficulty + prestige scaling ---- */
function spawnEnemy(model, enemyId) {
  const base = getEnemy(enemyId);
  if (!base) return null;
  const diff = CONFIG.difficulty[model.difficulty] || CONFIG.difficulty.normal;
  const prestigeScale =
    1 + model.prestigeCount *
      (diff.prestigeScalesEnemies ? CONFIG.prestige.enemyScalePerPrestigeNormal : CONFIG.prestige.enemyScalePerPrestigeEasy);
  const sm = diff.enemyStatMult * prestigeScale;

  const maxHp = Math.round(base.maxHp * sm);
  return {
    id: base.id,
    name: base.name,
    isBoss: !!base.isBoss,
    maxHp,
    hp: maxHp,
    power: Math.round(base.power * sm),
    defense: Math.round(base.defense * sm),
    speed: base.speed,
    dodge: base.dodge,
    coins: Math.round((base.coins || 0) * diff.lootMult),
    loot: base.loot || [],
    damageMult: diff.enemyDamageMult,
  };
}

/* ---- math ---- */
function dodgeChance(dodgeStat) {
  return Math.min(CONFIG.combat.dodgeChanceCap, dodgeStat * CONFIG.combat.dodgeChancePerPoint);
}
function rolls(p) {
  return Math.random() < p;
}
function damageAfterDefense(raw, defense) {
  return Math.max(1, Math.round(raw - defense * CONFIG.combat.defenseMitigationPerPoint));
}

/* ---- status effects (T13) ----
   Effects live in combat.fx, keyed by effect kind: { value, turns }. `value` is
   the precomputed magnitude (a fraction or a flat number); `turns` is how many
   more times it applies. Effects are consumed at point-of-use (a player-buff like
   `expose` is spent by a player attack; an enemy-debuff like `blind` is spent on
   the enemy's turn) so duration reads intuitively regardless of who benefits. */
function setFx(c, kind, value, turns) {
  c.fx[kind] = { value, turns };
}
/** Consume one charge of an effect; returns its magnitude (0 if absent). */
function takeFx(c, kind) {
  const f = c.fx && c.fx[kind];
  if (!f) return 0;
  const v = f.value;
  if (--f.turns <= 0) delete c.fx[kind];
  return v;
}
function hasFx(c, kind) {
  return !!(c.fx && c.fx[kind]);
}

/* ---- start ---- */
export function startCombat(state, enemyId, opts = {}) {
  const model = state.model;
  const enemy = spawnEnemy(model, enemyId);
  if (!enemy) { pushLine(state, "Nothing answers your challenge.", "system"); return state; }

  model.combat = {
    enemy,
    returnMode: opts.returnMode || (model.mode === "combat" ? "hub" : model.mode),
    returnRoom: opts.returnRoom ?? model.world.currentRoom,
    bossId: opts.bossId || null,
    playerGuard: false,
    round: 1,
    fromSlot: !!opts.fromSlot,
    envTags: envTagsFor(model), // for the T13 freeform-action judge
    fx: {},                     // active status effects (T13), keyed by effect kind
  };
  model.mode = "combat";

  pushLine(state, `A ${enemy.name} rises before you!`, "banner");
  enemyStatusLine(state);

  // Speed decides who strikes first.
  if (enemy.speed > model.character.stats.speed) {
    pushLine(state, `The ${enemy.name} is quicker — it moves first!`, "hint");
    enemyTurn(state);
  } else {
    pushLine(state, "Your move. (attack · guard · use <ability> · use <item> · flee)", "hint");
  }
  return state;
}

function enemyStatusLine(state) {
  const e = state.model.combat.enemy;
  pushLine(state, `${e.name}: ${e.hp}/${e.maxHp} HP`, "hint");
}

/* ---- player actions ---- */
export function playerAttack(state) {
  const c = state.model.combat;
  const stats = state.model.character.stats;
  const e = c.enemy;

  if (rolls(dodgeChance(e.dodge))) {
    pushLine(state, `You swing — the ${e.name} slips aside!`, "system");
  } else {
    const dmg = damageAfterDefense(stats.power, exposedDefense(c, e));
    e.hp = Math.max(0, e.hp - dmg);
    pushLine(state, `You strike the ${e.name} for ${dmg}.`, "system");
  }
  return afterPlayerAction(state);
}

/** Enemy's effective defense for a player attack, spending one `expose` charge. */
function exposedDefense(c, e) {
  const ex = takeFx(c, "expose"); // fraction, e.g. 0.3
  return ex > 0 ? e.defense * (1 - ex) : e.defense;
}

export function playerGuard(state) {
  state.model.combat.playerGuard = true;
  pushLine(state, "You raise your guard.", "system");
  return afterPlayerAction(state);
}

export function playerAbility(state, name) {
  const c = state.model.combat;
  const ch = state.model.character;
  const stats = ch.stats;
  const ab = ABILITIES[name];

  if (!ab || !ch.abilities.includes(name)) {
    pushLine(state, `You don't know "${name}". You know: ${ch.abilities.join(", ")}.`, "system");
    return state; // not a turn-consuming action
  }
  if (stats.spirit < ab.spirit) {
    pushLine(state, `Not enough Spirit for ${ab.name} (needs ${ab.spirit}).`, "system");
    return state;
  }
  stats.spirit -= ab.spirit;
  const e = c.enemy;
  if (rolls(dodgeChance(e.dodge))) {
    pushLine(state, `You ${ab.verb} the ${e.name}, but it evades!`, "system");
  } else {
    const dmg = damageAfterDefense(Math.round(stats.power * ab.mult), exposedDefense(c, e));
    e.hp = Math.max(0, e.hp - dmg);
    pushLine(state, `You ${ab.verb} the ${e.name} for ${dmg}! (-${ab.spirit} Spirit)`, "system");
  }
  return afterPlayerAction(state);
}

export function combatUse(state, target) {
  const ch = state.model.character;
  if (!target) {
    pushLine(state, "Use what? An ability (use light bolt) or item (use healing draught).", "system");
    return state;
  }
  // Ability?
  if (ABILITIES[target] || ch.abilities.includes(target)) return playerAbility(state, target);
  // Item — consuming one costs your turn.
  const before = ch.inventory.length;
  useItem(state, target);
  if (ch.inventory.length < before) {
    const c = state.model.combat;
    if (!c) return state;
    if (c.enemy.hp <= 0) return endCombat(state, "victory");
    return enemyTurn(state);
  }
  return state; // nothing happened -> free, act again
}

/** Show the current fight state (the `look` command in combat). */
export function combatLook(state) {
  const c = state.model.combat;
  const stats = state.model.character.stats;
  enemyStatusLine(state);
  pushLine(state, `You: ${stats.hp}/${stats.maxHp} HP · Spirit ${stats.spirit}.`, "hint");
  const fx = activeFxSummary(c);
  if (fx) pushLine(state, fx, "hint");
  return state;
}

/* Human-readable list of effects in play, for `look` during a fight. */
function activeFxSummary(c) {
  const labels = {
    blind: "blinded", slow: "slowed", expose: "exposed",
    stagger: "staggering", burn: "burning", defend: "warded",
  };
  const parts = Object.keys(c.fx || {}).map((k) => {
    const who = k === "defend" ? "you" : `the ${c.enemy.name}`;
    return `${who} ${labels[k] || k} (${c.fx[k].turns})`;
  });
  return parts.length ? "In play: " + parts.join(", ") + "." : "";
}

/* ---- freeform creative actions (T13, PROMPTS.md B) ----
   The AI judge has already approved a verdict and the engine validated it; here we
   turn its effect TYPE + MAGNITUDE into a real status effect, charge any corruption
   cost, then spend the player's turn (the enemy gets to respond). The AI never sets
   numbers — every magnitude comes from CONFIG.combat.judge. */
export function applyJudgedAction(state, verdict) {
  const c = state.model.combat;
  if (!c) return state;
  const J = CONFIG.combat.judge;

  // Forbidden/dark improvisation stains you (Purity/Corruption axis lands in T13.5+,
  // but the meter already exists — record the cost now).
  if (verdict.corruptionCost > 0) {
    const ch = state.model.character;
    ch.corruption = Math.min(100, (ch.corruption || 0) + verdict.corruptionCost);
    pushLine(state, `Shadow coils into you. (+${verdict.corruptionCost} Corruption)`, "system");
  }

  const turns = Math.min(J.maxTurns, Math.max(1, verdict.turns || 1));
  const mag = verdict.magnitude === "moderate" ? "moderate" : "minor";
  const pick = (table) => table[mag] ?? table.minor;

  switch (verdict.effect) {
    case "blind":
    case "distract":
      setFx(c, "blind", pick(J.missChance), turns); break;
    case "slow":
      setFx(c, "slow", pick(J.powerDownPct), turns); break;
    case "expose":
      setFx(c, "expose", pick(J.defenseDownPct), turns); break;
    case "defend":
      setFx(c, "defend", pick(J.dmgReduction), turns); break;
    case "burn":
      setFx(c, "burn", pick(J.burnDamage), turns); break;
    case "stagger":
      setFx(c, "stagger", 1, turns); break;
    case "douse":
      if (hasFx(c, "burn")) delete c.fx.burn; break; // counter to flame; else pure flavor
    case "none":
    default:
      break; // approved but no mechanical effect — still costs the turn
  }

  return afterPlayerAction(state); // the improvisation was the player's move
}

export function playerFlee(state) {
  const c = state.model.combat;
  if (c.enemy.isBoss) {
    pushLine(state, "There's no fleeing this one.", "system");
    return state;
  }
  const stats = state.model.character.stats;
  const chance = stats.speed >= c.enemy.speed ? 0.7 : 0.4;
  if (rolls(chance)) {
    pushLine(state, "You break away and slip into the dark.", "system");
    return endCombat(state, "flee");
  }
  pushLine(state, "You can't get clear!", "system");
  return enemyTurn(state);
}

/* After a turn-consuming player action: check win, else enemy turn. */
function afterPlayerAction(state) {
  const c = state.model.combat;
  enemyStatusLine(state);
  if (c.enemy.hp <= 0) return endCombat(state, "victory");
  return enemyTurn(state);
}

/* ---- enemy turn ----
   Status effects (T13) resolve here: burn ticks first (even a staggered enemy
   smoulders), then stagger can rob its turn, then blind/slow/defend shape the hit. */
function enemyTurn(state) {
  const c = state.model.combat;
  const e = c.enemy;
  const stats = state.model.character.stats;

  // Burn: flat damage-over-time, ticks before the enemy can act.
  const burn = takeFx(c, "burn");
  if (burn > 0) {
    e.hp = Math.max(0, e.hp - burn);
    pushLine(state, `The ${e.name} smoulders for ${burn}.`, "system");
    if (e.hp <= 0) return endCombat(state, "victory");
  }

  // Stagger: it loses the turn entirely.
  if (takeFx(c, "stagger") > 0) {
    pushLine(state, `The ${e.name} reels — it can't strike back this turn.`, "system");
    return endEnemyTurn(state);
  }

  const blind = takeFx(c, "blind");   // extra miss chance (also covers "distract")
  const slow = takeFx(c, "slow");     // fraction off the enemy's power
  const defend = takeFx(c, "defend"); // fraction off incoming damage (self ward)

  if (rolls(dodgeChance(stats.dodge)) || (blind > 0 && rolls(blind))) {
    pushLine(state, blind > 0
      ? `The ${e.name} strikes wide — it can't find you!`
      : `The ${e.name} lunges — you dodge!`, "system");
  } else {
    let raw = e.power * e.damageMult * (1 - slow);
    let dmg = damageAfterDefense(raw, stats.defense);
    if (c.playerGuard) dmg = Math.max(1, Math.round(dmg * CONFIG.combat.guardMitigation));
    if (defend > 0) dmg = Math.max(1, Math.round(dmg * (1 - defend)));
    stats.hp = Math.max(0, stats.hp - dmg);
    const tags = [c.playerGuard ? "guarded" : null, defend > 0 ? "warded" : null].filter(Boolean);
    pushLine(state, `The ${e.name} hits you for ${dmg}${tags.length ? ` (${tags.join(", ")})` : ""}.`, "system");
  }
  return endEnemyTurn(state);
}

/* Shared tail of the enemy's turn: clear guard, advance the round, check defeat. */
function endEnemyTurn(state) {
  const c = state.model.combat;
  const stats = state.model.character.stats;
  c.playerGuard = false;
  c.round += 1;
  if (stats.hp <= 0) return endCombat(state, "defeat");
  pushLine(state, `You: ${stats.hp}/${stats.maxHp} HP · Spirit ${stats.spirit}. Your move.`, "hint");
  return state;
}

/* ---- resolution ---- */
function endCombat(state, outcome) {
  const model = state.model;
  const c = model.combat;
  const ch = model.character;

  if (outcome === "victory") {
    pushLine(state, `The ${c.enemy.name} dissolves into motes of light. Victory!`, "banner");
    if (c.enemy.coins) {
      ch.coins = (ch.coins ?? 0) + c.enemy.coins;
      pushLine(state, `You gather ${coin()}${c.enemy.coins}.`, "system");
    }
    for (const item of c.enemy.loot) {
      if (rolls(0.5)) { ch.inventory.push(item); pushLine(state, `You find a ${item}.`, "system"); }
    }
    // Narrate ordinary victories (boss wins are scripted story beats — leave them alone).
    if (!c.enemy.isBoss) {
      requestNarration(state, {
        scene: `a clash with a ${c.enemy.name}`,
        resolved: `you defeated the ${c.enemy.name}`,
        mood: "triumphant, breathless",
      });
    }
    if (c.returnMode === "exploration" && c.returnRoom) {
      model.world.cleared[c.returnRoom] = true;
    }
    if (c.bossId && !model.world.flags.bossesDefeated.includes(c.bossId)) {
      model.world.flags.bossesDefeated.push(c.bossId);
      state.ui.justDefeatedBoss = c.bossId; // T9 reacts to this (tier-up, reveal)
    }
    model.combat = null;
    model.mode = c.returnMode;
    pushLine(state, c.returnMode === "exploration" ? "The way is clear. (look around)" : "(Back at the hub.)", "hint");
    return state;
  }

  if (outcome === "flee") {
    model.combat = null;
    model.mode = c.returnMode;
    return state;
  }

  // defeat — gentle: wake at home, barely standing.
  pushLine(state, "Darkness rushes in… and you wake at home, aching but alive.", "banner");
  ch.stats.hp = Math.max(1, Math.round(ch.stats.maxHp * 0.25));
  if (!c.enemy.isBoss) {
    requestNarration(state, {
      scene: `a losing fight with a ${c.enemy.name}`,
      resolved: `the ${c.enemy.name} overwhelmed you; you barely made it home`,
      mood: "melancholy, shaken",
    });
  }
  model.combat = null;
  model.mode = "hub";
  model.world.currentLocation = "homebase";
  model.world.currentRoom = null;
  pushLine(state, "(Rest to recover fully.)", "hint");
  return state;
}
