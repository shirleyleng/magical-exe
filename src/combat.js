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
import { adjustAlignment, effectiveStats, fizzleChance, healMultiplier, derivePath } from "./alignment.js";
import { adjustVisibility, checkUnmaskingEvents } from "./visibility.js";
import { getAbility } from "./abilities.js";
import { beginRivalTalk } from "./rivaltalk.js";

/* A named rival takes no article ("Sable hits you", not "the Sable hits you");
   a boss whose name already begins with "the" (e.g. "the Grey Sovereign") keeps its
   own article, just cased to fit the sentence; ordinary monsters get one ("the dust sprite"). */
const builtInArticle = (e) => !!e && (e.isRival || /^the\s/i.test(e.name));
const eRef = (e) => (!e ? "it" : !builtInArticle(e) ? `the ${e.name}` : e.isRival ? e.name : e.name.replace(/^The\s/, "the "));
const ERef = (e) => (!e ? "It" : !builtInArticle(e) ? `The ${e.name}` : e.isRival ? e.name : e.name.replace(/^the\s/, "The "));

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
    isRival: !!base.isRival,
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
/** Corruption warp can shrink max HP; current HP can't exceed the warped max. */
function clampHpToWarp(ch) {
  const effMax = effectiveStats(ch).maxHp;
  if (ch.stats.hp > effMax) ch.stats.hp = effMax;
}

/** Full HP restore at the end of a battle (win / mercy / flee) — wounds don't carry between
   fights. Prints a gentle note only when there was actually something to mend. */
function restoreAfterBattle(state, ch) {
  const max = effectiveStats(ch).maxHp;
  const mended = ch.stats.hp < max;
  ch.stats.hp = max;
  if (mended) pushLine(state, "You breathe out, and the aches of the fight close over. (HP fully restored)", "hint");
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

/* Install a status effect by kind + magnitude, pulling real numbers from CONFIG.combat.judge.
   Shared by the AI judge (T13) and the virtue ability kit (T14.5) so both stay config-driven. */
function installEffect(c, effect, magnitude, turns) {
  const J = CONFIG.combat.judge;
  const mag = magnitude === "moderate" ? "moderate" : "minor";
  const pick = (table) => table[mag] ?? table.minor;
  const t = Math.min(J.maxTurns, Math.max(1, turns || 1));
  switch (effect) {
    case "blind":
    case "distract": setFx(c, "blind", pick(J.missChance), t); break;
    case "slow":     setFx(c, "slow", pick(J.powerDownPct), t); break;
    case "expose":   setFx(c, "expose", pick(J.defenseDownPct), t); break;
    case "defend":   setFx(c, "defend", pick(J.dmgReduction), t); break;
    case "burn":     setFx(c, "burn", pick(J.burnDamage), t); break;
    case "stagger":  setFx(c, "stagger", 1, t); break;
    case "douse":    if (hasFx(c, "burn")) delete c.fx.burn; break;
    case "none":
    default: break;
  }
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
    couldSpare: false,          // latches once the foe is beaten enough to spare (T14)
    corruptActs: 0,             // corrupt-flavored moves this fight → extra Unmasking on a public win (T15)
    storyLoss: !!opts.storyLoss, // T17: a scripted, unwinnable fight (Boss #4) ending in the mascot's sacrifice
    // T19 finale: ONE continuous fight across `phases` (enemy ids). On a phase win
    // endCombat swaps to the next form instead of resolving; the last phase hands off
    // to the ascension resolver (endgame.js). assist fires once per phase (DESIGN §9.5).
    finale: !!opts.finale,
    phases: opts.phases || null,
    phaseIndex: 0,
    phaseAssistUsed: false,
  };
  model.mode = "combat";
  clampHpToWarp(model.character); // corruption gained since last fight may cap HP lower

  pushLine(state, enemy.isRival
    ? `${enemy.name} steps into your path, weapon already drawn!`
    : builtInArticle(enemy)
    ? `${ERef(enemy)} rises before you!`
    : `A ${enemy.name} rises before you!`, "banner");
  enemyStatusLine(state);

  // Speed decides who strikes first.
  if (enemy.speed > model.character.stats.speed) {
    pushLine(state, `${ERef(enemy)} is quicker — it moves first!`, "hint");
    enemyTurn(state);
  } else {
    pushLine(state, "Your move. (attack · guard · burst · use <ability> · use <item> · flee)", "hint");
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
  const eff = effectiveStats(state.model.character); // power amplified by corruption warp
  const e = c.enemy;

  if (rolls(dodgeChance(e.dodge))) {
    pushLine(state, `You swing — ${eRef(e)} slips aside!`, "system");
  } else {
    const dmg = damageAfterDefense(eff.power, exposedDefense(c, e));
    e.hp = Math.max(0, e.hp - dmg);
    pushLine(state, `You strike ${eRef(e)} for ${dmg}.`, "system");
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

/** Burst (the corruption "battle resource"): a heavy hit at no Spirit cost that DEEPENS your
   corruption — cheap power, real cost (worse warp, drifts you toward the dark end). */
export function playerBurst(state) {
  const c = state.model.combat;
  const ch = state.model.character;
  const e = c.enemy;
  const eff = effectiveStats(ch);
  const K = CONFIG.axes.corruption;

  if (rolls(dodgeChance(e.dodge))) {
    pushLine(state, `Dark power surges — but ${eRef(e)} twists aside!`, "system");
  } else {
    const dmg = damageAfterDefense(Math.round(eff.power * K.burstDamageMult), exposedDefense(c, e));
    e.hp = Math.max(0, e.hp - dmg);
    pushLine(state, `You unleash a corrupt burst on ${eRef(e)} for ${dmg}!`, "system");
  }
  adjustAlignment(ch, { corruption: K.burstCorruptionGain });
  clampHpToWarp(ch);
  c.corruptActs += 1;            // conspicuous dark power → raises Unmasking faster on a public win
  pushLine(state, `The power answers — and stains you. (+${K.burstCorruptionGain} Corruption)`, "system");
  return afterPlayerAction(state);
}

/** Mercy: spare a beaten, non-boss foe. It flees unharmed (no loot) and your Virtue rises. */
export function playerSpare(state) {
  const c = state.model.combat;
  if (!c) return state;
  const e = c.enemy;
  if (e.isBoss) { pushLine(state, "This foe gives no opening for mercy.", "system"); return state; }
  if (!c.couldSpare) {
    pushLine(state, `${ERef(e)} is still standing strong — wear it down before you can spare it.`, "system");
    return state; // not a turn-consuming action
  }
  return endCombat(state, "mercy");
}

export function playerAbility(state, name) {
  const c = state.model.combat;
  const ch = state.model.character;
  const stats = ch.stats;
  const ab = getAbility(name);

  if (!ab || !ch.abilities.includes(name)) {
    pushLine(state, `You don't know "${name}". You know: ${ch.abilities.join(", ")}.`, "system");
    return state; // not a turn-consuming action
  }
  const eff = effectiveStats(ch);   // warp: Power up / HP down · grace: Defense up
  // Spirit is the magical-strength stat: it costs nothing to cast, but it SCALES an ability's
  // damage and healing (a high-Spirit mage hits and mends harder). `mult` multiplies it.
  const magic = Math.max(1, eff.spirit);
  const e = c.enemy;

  // Soft-fizzle: an opposed-alignment move can falter when you've drifted the other way. Chance
  // scales with how far you've strayed (alignment.js). purify is exempt — it's how you climb back.
  if (ab.kind !== "purify" && rolls(fizzleChance(ch, ab.align))) {
    const why = ab.align === "virtuous"
      ? "the light gutters out — your heart is too shadowed"
      : "the dark power slips your grasp — too much light in you";
    pushLine(state, `Your ${name} falters; ${why}.`, "system");
    return afterPlayerAction(state);
  }

  if (ab.kind === "heal") {
    const heal = Math.max(1, Math.round((eff.maxHp * (ab.healPct || 0.3) + magic) * healMultiplier(ch)));
    stats.hp = Math.min(eff.maxHp, stats.hp + heal);
    pushLine(state, `You ${ab.verb}; ${heal} HP returns.`, "system");

  } else if (ab.kind === "lifesteal") {
    if (rolls(dodgeChance(e.dodge))) {
      pushLine(state, `You reach for ${eRef(e)}, but it slips away!`, "system");
    } else {
      const dmg = damageAfterDefense(Math.round(magic * (ab.mult || 1)), exposedDefense(c, e));
      e.hp = Math.max(0, e.hp - dmg);
      const heal = Math.max(1, Math.round(dmg * (ab.lifestealPct || 0.5)));
      stats.hp = Math.min(eff.maxHp, stats.hp + heal);
      pushLine(state, `You ${ab.verb} ${eRef(e)} for ${dmg}, drawing ${heal} back into yourself.`, "system");
    }

  } else if (ab.kind === "buff") {
    if (ab.applyFx) installEffect(c, ab.applyFx.kind, ab.applyFx.magnitude, ab.applyFx.turns);
    pushLine(state, `You ${ab.verb}.`, "system");

  } else if (ab.kind === "purify") {
    if (hasFx(c, "burn")) delete c.fx.burn; // cleanse a lingering burn on yourself
    const parts = [];
    if (ab.shedCorruption) {
      const before = ch.corruption || 0;
      ch.corruption = Math.max(0, before - ab.shedCorruption);
      ch.path = derivePath(ch);
      if (before - ch.corruption > 0) parts.push(`-${before - ch.corruption} Corruption`);
    }
    if (ab.healPct) {
      const heal = Math.max(1, Math.round((eff.maxHp * ab.healPct + magic * 0.5) * healMultiplier(ch)));
      stats.hp = Math.min(eff.maxHp, stats.hp + heal);
      parts.push(`+${heal} HP`);
    }
    pushLine(state, `You ${ab.verb}; the shadow in you thins.${parts.length ? ` (${parts.join(", ")})` : ""}`, "system");

  } else { // damage (with optional applyFx, e.g. radiance's dazzle)
    if (rolls(dodgeChance(e.dodge))) {
      pushLine(state, `You ${ab.verb} ${eRef(e)}, but it evades!`, "system");
    } else {
      const dmg = damageAfterDefense(Math.round(magic * (ab.mult || 1)), exposedDefense(c, e));
      e.hp = Math.max(0, e.hp - dmg);
      let extra = "";
      if (ab.applyFx && e.hp > 0) {
        installEffect(c, ab.applyFx.kind, ab.applyFx.magnitude, ab.applyFx.turns);
        extra = " The light leaves it reeling.";
      }
      pushLine(state, `You ${ab.verb} ${eRef(e)} for ${dmg}!${extra}`, "system");
    }
  }

  // Leaning on a path ability nudges the slider that way (coupled). purify already shed above.
  if (ab.nudge) {
    adjustAlignment(ch, ab.nudge);
    clampHpToWarp(ch);
    if (ab.nudge.corruption > 0) c.corruptActs += 1; // dark kit is conspicuous (T15)
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
  if (getAbility(target) || ch.abilities.includes(target)) return playerAbility(state, target);
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
  pushLine(state, `You: ${stats.hp}/${stats.maxHp} HP.`, "hint");
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
    const who = k === "defend" ? "you" : eRef(c.enemy);
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

  // Forbidden/dark improvisation stains you — a coupled corruption gain (drains virtue,
  // updates path, may deepen the stat-warp). Re-clamp HP in case max HP just shrank.
  if (verdict.corruptionCost > 0) {
    const ch = state.model.character;
    adjustAlignment(ch, { corruption: verdict.corruptionCost });
    clampHpToWarp(ch);
    c.corruptActs += 1;          // forbidden improvisation is conspicuous (T15)
    pushLine(state, `Shadow coils into you. (+${verdict.corruptionCost} Corruption)`, "system");
  }

  installEffect(c, verdict.effect, verdict.magnitude, verdict.turns);
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
  if (c.storyLoss) return storyLossTick(state); // scripted Boss #4 — can't be won (T17)
  enemyStatusLine(state);
  if (c.enemy.hp <= 0) return endCombat(state, "victory");
  maybeOfferSpare(state);
  return enemyTurn(state);
}

/* ---- T17: scripted story-loss (Boss #4) ----
   The fight is real combat, but the boss can't be hurt and won't kill you: your
   hits are clamped to a sliver so its HP "barely moves", and the enemy turn floors
   your HP at 1. After a set number of player turns the mascot throws itself in the
   way — injured, then gone. Heavily telegraphed so it never reads as a bug. */
function storyLossTick(state) {
  const c = state.model.combat;
  const e = c.enemy;
  const SL = CONFIG.combat.storyLoss;
  // Boss HP barely moves: undo any damage past the scripted per-turn sliver.
  const floor = Math.ceil(e.maxHp * (1 - SL.bossHpVisibleDrainPerHit * c.round));
  if (e.hp < floor) e.hp = floor;
  enemyStatusLine(state);
  pushLine(state, `${ERef(e)} shrugs off the blow as if it never landed.`, "hint");
  if (c.round >= SL.maxPlayerTurnsBeforeIntervene) return storyLossIntervene(state);
  return enemyTurn(state);
}

/* The mascot's sacrifice: end of the scripted fight. Hands off to progress.js
   (handleStoryLoss) via state.ui.justLostStoryBoss for the aftermath beat. */
function storyLossIntervene(state) {
  const model = state.model;
  const c = model.combat;
  const ch = model.character;
  const m = (model.mascot && model.mascot.name) || "Your mascot";
  pushLine(state, `Your strength runs out long before its patience does. You've nothing left — no Spirit, no second wind, no clever trick. ${ERef(c.enemy)} raises one slow hand to end you, almost gently—`, "banner");
  pushLine(state, `"NO — NO, you don't!" ${m} streaks past your shoulder, a small comet of light, and throws its whole self into the blow meant for you.`, "mascot");
  pushLine(state, `A flash. A cry — small and bright and yours, and then cut clean off. When the rain clears enough to see, ${m} is simply gone, and so is the towering shape, melting back into the grey as though you were never worth finishing. As though it had already taken the only thing that mattered.`, "banner");
  if (model.mascot) { model.mascot.injured = true; model.mascot.present = false; }
  model.world.flags.boss4Attempted = true;
  ch.stats.hp = Math.max(1, Math.round(ch.stats.maxHp * 0.25));
  model.combat = null;
  model.mode = "hub";
  model.world.currentLocation = "homebase";
  model.world.currentRoom = null;
  pushLine(state, "You wake at home, on the floor, in your clothes. You don't remember the climb down the spire, or the road back, or any of it. The house is very quiet. The house is going to be very quiet for a while.", "system");
  state.ui.justLostStoryBoss = "boss4"; // progress.js: aftermath + alliance/Awakened hook + sparring unlock
  return state;
}

/** Once a non-boss foe is worn down past the spare threshold, surface the mercy choice.
   `couldSpare` latches so a later killing blow counts as a deliberate finish. */
function maybeOfferSpare(state) {
  const c = state.model.combat;
  const e = c.enemy;
  if (e.isBoss || c.couldSpare) return;
  if (e.hp <= Math.round(e.maxHp * CONFIG.axes.alignment.spareEnemyHpPct)) {
    c.couldSpare = true;
    pushLine(state, `${ERef(e)} is barely holding together — you could finish it, or spare it.`, "hint");
  }
}

/* ---- enemy turn ----
   Status effects (T13) resolve here: burn ticks first (even a staggered enemy
   smoulders), then stagger can rob its turn, then blind/slow/defend shape the hit. */
function enemyTurn(state) {
  const c = state.model.combat;
  const e = c.enemy;
  const stats = state.model.character.stats;

  // T19 finale: a clutch assist when you're on the brink (heals + staggers the boss),
  // once per phase. Sets a stagger the check below then spends, robbing the enemy's turn.
  maybeFinaleAssist(state);

  // Burn: flat damage-over-time, ticks before the enemy can act.
  const burn = takeFx(c, "burn");
  if (burn > 0) {
    e.hp = Math.max(c.storyLoss ? 1 : 0, e.hp - burn); // a scripted boss can't be burned down
    pushLine(state, `${ERef(e)} smoulders for ${burn}.`, "system");
    if (e.hp <= 0) return endCombat(state, "victory");
  }

  // Stagger: it loses the turn entirely.
  if (takeFx(c, "stagger") > 0) {
    pushLine(state, `${ERef(e)} reels — it can't strike back this turn.`, "system");
    return endEnemyTurn(state);
  }

  const blind = takeFx(c, "blind");   // extra miss chance (also covers "distract")
  const slow = takeFx(c, "slow");     // fraction off the enemy's power
  const defend = takeFx(c, "defend"); // fraction off incoming damage (self ward)

  if (rolls(dodgeChance(stats.dodge)) || (blind > 0 && rolls(blind))) {
    pushLine(state, blind > 0
      ? `${ERef(e)} strikes wide — it can't find you!`
      : `${ERef(e)} lunges — you dodge!`, "system");
  } else {
    let raw = e.power * e.damageMult * (1 - slow);
    let dmg = damageAfterDefense(raw, effectiveStats(state.model.character).defense); // grace boon raises Defense
    if (c.playerGuard) dmg = Math.max(1, Math.round(dmg * CONFIG.combat.guardMitigation));
    if (defend > 0) dmg = Math.max(1, Math.round(dmg * (1 - defend)));
    // During the scripted story-loss the boss never quite finishes you — the mascot
    // gets the last word (storyLossIntervene), so floor HP at 1 until then.
    stats.hp = Math.max(c.storyLoss ? 1 : 0, stats.hp - dmg);
    const tags = [c.playerGuard ? "guarded" : null, defend > 0 ? "warded" : null].filter(Boolean);
    pushLine(state, `${ERef(e)} hits you for ${dmg}${tags.length ? ` (${tags.join(", ")})` : ""}.`, "system");
    if (state.ui) state.ui.mascotReact = "hit"; // the mascot winces with you
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
  pushLine(state, `You: ${stats.hp}/${stats.maxHp} HP. Your move.`, "hint");
  return state;
}

/* Fame/Unmasking fallout of a win (T15). Only PUBLIC (hub) battles touch the
   public eye — the forest has no witnesses. A boss is a known, talked-about deed
   and earns Fame wherever it's fought; corrupt-flavored moves raise Unmasking
   faster (corruption's third cost), as does a needless finishing blow. */
function grantWinVisibility(state, c, ch) {
  const AX = CONFIG.axes;
  const isPublic = c.returnMode === "hub";
  let fame = 0;
  let unmasking = 0;

  if (c.enemy.isBoss) fame += AX.fame.gainVisibleQuest;   // visible quest
  else if (isPublic) fame += AX.fame.gainPublicWin;

  if (isPublic) {
    unmasking += AX.unmasking.gainPublicBattle;
    // a finishing blow you could have spared is itself a conspicuous, ruthless act
    const ruthlessFinish = !c.enemy.isBoss && c.couldSpare ? 1 : 0;
    unmasking += (c.corruptActs + ruthlessFinish) * AX.unmasking.gainCorruptAction;
  }

  if (!fame && !unmasking) return;
  const d = adjustVisibility(ch, { fame, unmasking });
  const parts = [];
  if (d.fame) parts.push(`+${d.fame} Fame`);
  if (d.unmasking) parts.push(`+${d.unmasking} Unmasking`);
  if (parts.length) pushLine(state, `Word spreads through the city. (${parts.join(" · ")})`, "system");
  if (d.unmasking > 0) checkUnmaskingEvents(state); // an escalating threshold may have just been crossed
}

/* ---- defeat: the magical-girl "warp home" beat ----
   You don't die — the magic refuses the killing blow and pulls you out of the
   fight. We vary the telling so repeated losses don't read identically, and split
   the landing by whether your companion is still here to catch you (once it's gone,
   the wake is the lonely one, echoing the mascot-gone rest flavour). {mascot}
   resolves to the companion's name. */
const DEFEAT_WARP = [
  "The killing blow comes — and the magic takes it instead of you. Light tears up from the mark over your heart, indignant, and folds the world away before the dark can close. You don't get to fall. Not like this; not while it still has a say in the matter.",
  "Everything narrows to a single white point of pain — and then the spell that made you simply unmakes the moment. Your transformation shatters in a soundless burst, spilling you up and out of the fight, somewhere the dark can't reach to finish what it started.",
  "You feel yourself going. And then the light catches you — the way it always swears it will and you never quite believe until it does — and lifts you up and out and away, the fight dwindling to a far-off nothing behind your shut eyes.",
];
const DEFEAT_WAKE_COMPANION = [
  "You wake on your own floor, plain-clothed and shaking, the ceiling exactly where you left it. {mascot} is curled tight against your collarbone, spent from holding the spell lit the whole way home. Safe. Both of you. Barely — but the magic kept its half of the bargain, the way it always does.",
  "The hush of your own rooms settles over you. {mascot} won't stop fussing — circling, nudging, scolding in that wordless way of its — until you sit up and say it out loud: that you're alright, that you'll be alright. You only half-believe it. With {mascot} here, half is enough to stand on.",
  "Home. Just like that, between one heartbeat and the next. You lie there cataloguing aches while {mascot} presses close and warm against you, counting your breaths as though it could lose track of you if it stopped. Alive to try again — and someone glad of it.",
];
const DEFEAT_WAKE_ALONE = [
  "You wake on your own floor, alone, the house holding its breath around you. No small bright weight settles onto your chest to count your breaths and be sure you made it back. You lie in the quiet a while, and the quiet doesn't answer. Then you get up — because there's no one left to get up for you.",
  "You come to in the dark of your own rooms, aching in places you didn't know you had. There's no one to fuss over you now, no warmth at your throat, no wordless scolding. Only you, and the ache, and the empty shape where the fussing used to be. You drag yourself upright anyway. You always do.",
  "The magic sets you down gently in an empty house. Once, that landing had something soft waiting in it. Now there's just the floor, and the cold, and the long climb back to your feet — which you make, alone, because the alternative is to stay down, and you haven't earned the right to stay down yet.",
];

function defeatNarrative(model) {
  const gone = !!(model.world.flags && model.world.flags.mascotGone);
  const wakePool = gone ? DEFEAT_WAKE_ALONE : DEFEAT_WAKE_COMPANION;
  const last = model.world.lastDefeatWake;
  const choices = wakePool.length > 1 ? wakePool.filter((l) => l !== last) : wakePool;
  const wake = choices[Math.floor(Math.random() * choices.length)];
  model.world.lastDefeatWake = wake; // never the same wake twice running
  const warp = DEFEAT_WARP[Math.floor(Math.random() * DEFEAT_WARP.length)];
  const mascotName = (model.mascot && model.mascot.name) || "your companion";
  return { warp, wake: wake.replace(/\{mascot\}/g, mascotName) };
}

/* ---- resolution ---- */
function endCombat(state, outcome) {
  const model = state.model;
  const c = model.combat;
  const ch = model.character;

  // A rival duel resolves on its own terms — no loot, no public-eye fallout, no
  // story-boss flags. It's a personal contest; outcome is flavored, never harsh.
  if (c.enemy.isRival) return endRivalDuel(state, c, ch, outcome);

  if (outcome === "mercy") {
    const gain = CONFIG.axes.alignment.mercyVirtueGain;
    adjustAlignment(ch, { virtue: gain });
    pushLine(state, `You lower your hand. You don't have to. The ${c.enemy.name} shrinks back, confused by the mercy, and slips away into the dark unharmed — and something in you settles and steadies, quiet as a closed door. (+${gain} Virtue)`, "banner");
    restoreAfterBattle(state, ch);
    if (c.returnMode === "exploration" && c.returnRoom) model.world.cleared[c.returnRoom] = true;
    model.combat = null;
    model.mode = c.returnMode;
    pushLine(state, c.returnMode === "exploration" ? "The way is clear. (look around)" : "(Back at the hub.)", "hint");
    return state;
  }

  if (outcome === "victory") {
    // T19 finale: this is ONE continuous fight. A phase win swaps to the next form
    // (the twist) instead of resolving; the final phase hands off to the brink
    // resolver (endgame.js), NOT the normal boss-defeat path (no loot/tier/flags).
    if (c.finale) {
      if (c.phases && c.phaseIndex < c.phases.length - 1) return advancePhase(state);
      return triggerFinaleResolve(state);
    }

    pushLine(state, `The ${c.enemy.name} dissolves into motes of light. Victory!`, "banner");
    if (state.ui) state.ui.mascotReact = "happy"; // the mascot cheers the win
    // A killing blow on a foe you could have spared stains you (coupled corruption gain).
    if (!c.enemy.isBoss && c.couldSpare) {
      const gain = CONFIG.axes.alignment.finishCorruptionGain;
      adjustAlignment(ch, { corruption: gain });
      clampHpToWarp(ch);
      pushLine(state, `You struck the final blow without mercy. (+${gain} Corruption)`, "system");
    }
    // Public-eye fallout: Fame for the win, Unmasking for being seen — more if you fought dirty.
    grantWinVisibility(state, c, ch);
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
    restoreAfterBattle(state, ch); // wounds don't carry between fights
    model.combat = null;
    model.mode = c.returnMode;
    pushLine(state, c.returnMode === "exploration" ? "The way is clear. (look around)" : "(Back at the hub.)", "hint");
    return state;
  }

  if (outcome === "flee") {
    restoreAfterBattle(state, ch);
    model.combat = null;
    model.mode = c.returnMode;
    return state;
  }

  // defeat — gentle: the magic refuses the killing blow and warps you home.
  const dn = defeatNarrative(model);
  pushLine(state, dn.warp, "banner");
  pushLine(state, dn.wake, "system");
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

/* A rival duel: winnable, low-stakes, flavored either way. Always returns you to
   the hub on your feet — the point is the rivalry, not a loss penalty. */
function endRivalDuel(state, c, ch, outcome) {
  const model = state.model;
  const name = c.enemy.name;
  if (outcome === "victory" || outcome === "mercy") {
    pushLine(state, `${name} drops to one knee, chest heaving — and then, of all things, laughs, bright and surprised. "…Huh. Not bad. Not bad AT ALL. Maybe the whispers had a point."`, "banner");
    pushLine(state, `"Don't go getting comfortable, though. I'll be back, and next time I won't be sizing you up." ${name} melts backward into the dark, already grinning about the rematch.`, "mascot");
    restoreAfterBattle(state, ch);
  } else if (outcome === "flee") {
    pushLine(state, `You break off and slip out of the duel. ${name} doesn't give chase — just calls after you, unbothered: "Running already? Fine. We'll finish this another day, you and me."`, "system");
    restoreAfterBattle(state, ch);
  } else {
    // defeat — no harsh penalty; Sable pulls the final blow.
    pushLine(state, `${name} knocks you flat, blade a hair from your throat — then pulls it back and offers a hand up instead of pressing it home. "…Not yet. You're not ready yet, and I'm not interested in beating someone who isn't. Train harder. I want you at your absolute best when I take you."`, "banner");
    ch.stats.hp = Math.max(1, Math.round(ch.stats.maxHp * 0.5));
  }
  model.combat = null;
  model.mode = "hub";
  model.world.currentLocation = "homebase";
  model.world.currentRoom = null;
  // After a real bout (a win, or her sparing you), Sable sticks around — you can
  // talk to her. A flee means she let you go without a word; no lingering then.
  if (outcome === "victory" || outcome === "mercy" || outcome === "defeat") {
    return beginRivalTalk(state, "challenge");
  }
  return state;
}

/* ---- T19 finale: phase transitions + the brink hand-off ----
   The fight is continuous. Beating one form (the apparent source) reveals the next
   (the city's despair pouring together). We swap the enemy in place — same combat
   object, fresh round/fx — and narrate the twist; the player keeps initiative. */
function advancePhase(state) {
  const model = state.model;
  const c = model.combat;
  c.phaseIndex += 1;
  const nextId = c.phases[c.phaseIndex];
  const next = spawnEnemy(model, nextId);

  pushLine(state, `${ERef(c.enemy)} comes apart in your hands like wet paper — and does not die. You feel it the instant before you see it: this was never the thing you came to kill.`, "banner");
  pushLine(state, "The grey doesn't lift. It pours inward instead — every shuttered window, every bowed head, every swallowed cry and unanswered knock and small daily surrender in the whole vast city, all of it running together at once into a single drowning weight that stands up, slow and terrible, where the Sovereign fell.", "system");
  const m = (model.mascot && model.mascot.name) || "Your mascot";
  pushLine(state, `${m}, very small: "Oh. Oh, no. That — that's all of it. Everything they ever stopped letting themselves feel. You can't punch THIS out of the world, love. There isn't a fist big enough." Then, fiercer: "But we don't run from it. We never have. We answer it. Together. Now."`, "mascot");

  c.enemy = next;
  c.fx = {};
  c.playerGuard = false;
  c.round = 1;
  c.couldSpare = false;
  c.phaseAssistUsed = false;
  pushLine(state, `${ERef(next)} rises before you!`, "banner");
  enemyStatusLine(state);
  pushLine(state, "Your move. (attack · guard · burst · use <ability> · use <item>)", "hint");
  return state;
}

/* The last phase is down. Despair can't be ended by a final blow — so instead of a
   normal victory we hand off to the dedicated brink resolver (endgame.js) via a ui
   flag. Combat ends here; the choice + fuel-check gate live outside combat. */
function triggerFinaleResolve(state) {
  const model = state.model;
  pushLine(state, "The City's Despair folds to its knees under the very last of your strength — and still, even now, it does not vanish. It can't. It only sinks down and waits, vast and patient and ancient as winter, for you to decide what comes next. Everything you are has carried you to exactly this moment.", "banner");
  model.combat = null;
  model.mode = "hub"; // out of the tactical loop; the resolver narrates from here
  state.ui.finaleResolve = true; // update.js afterCombat → endgame.js handleFinaleResolve
  return state;
}

/* Once per finale phase, when you're driven to the brink (HP below a threshold), the
   people you've gathered step in — Sable draws the boss's focus (it staggers, losing
   its turn) and the mascot pours a clutch heal into you. Light scripted assist, not
   a full ally-combat system (DESIGN §9.5). Fires from enemyTurn before the enemy acts. */
function maybeFinaleAssist(state) {
  const c = state.model.combat;
  if (!c || !c.finale || c.phaseAssistUsed) return false;
  const ch = state.model.character;
  const eff = effectiveStats(ch);
  const F = CONFIG.finale;
  if (ch.stats.hp > Math.round(eff.maxHp * F.assistHpPct)) return false;

  c.phaseAssistUsed = true;
  const m = (state.model.mascot && state.model.mascot.name) || "Your mascot";
  const rival = (state.model.rivals && state.model.rivals[0]) || { name: "Sable" };
  const heal = Math.max(1, Math.round(eff.maxHp * F.assistHealPct * healMultiplier(ch)));
  ch.stats.hp = Math.min(eff.maxHp, ch.stats.hp + heal);
  pushLine(state, `"NOT — TODAY!" ${rival.name} throws themselves bodily across ${eRef(c.enemy)}'s line of sight, blade up, buying you a breath with their own — and it recoils, thrown off you just long enough.`, "system");
  pushLine(state, `${m} presses hard to your chest, light spilling out of it warm and fierce and furious. "Up. UP. I did not come all this way back to you just to watch this — the whole city's holding its breath for you right now, so you get UP." (+${heal} HP)`, "mascot");
  setFx(c, "stagger", 1, 1); // the enemy loses its coming turn
  return true;
}
