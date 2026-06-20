// MAGICAL.EXE — "skilled player" combat model.
// Adds the virtuous ability kit a tactically-aware player would use, modeled
// exactly per config.js + combat.js:
//   radiance  : spirit*1.3 dmg, installs blind moderate(0.7 miss) 1 turn
//   ward      : installs defend moderate(0.5 dmg cut) 2 turns
//   mend      : heal (maxHp*0.30 + spirit) * graceHeal
//   true strike (awakened): spirit*2.0 dmg, installs stagger 1 turn (enemy skips)
//   guard (innate): halve incoming this turn
// Grace boon from virtue: def *1.15(@40)/*1.35(@70), heal *1.15/*1.30.
// fx consumed on enemy turn exactly like takeFx() in combat.js.

const { ENEMIES, DIFF } = require('./combat-sim.js');
const K = { dodgePerPoint: 0.015, dodgeCap: 0.5, defMitig: 0.8, guardMitig: 0.5 };
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const rnd = () => Math.random();
const dodgeChance = (d) => Math.min(K.dodgeCap, d * K.dodgePerPoint);
const dmgAfterDef = (raw, def) => Math.max(1, Math.round(raw - def * K.defMitig));

function graceFor(virtue) {
  if (virtue >= 70) return { def: 1.35, heal: 1.30 };
  if (virtue >= 40) return { def: 1.15, heal: 1.15 };
  return { def: 1.0, heal: 1.0 };
}
function warpFor(corruption) {
  if (corruption >= 70) return { power: 1.25, hp: 0.85 };
  if (corruption >= 40) return { power: 1.10, hp: 0.95 };
  return { power: 1.0, hp: 1.0 };
}
function effective(p) {
  const g = graceFor(p.virtue || 0), w = warpFor(p.corruption || 0);
  return {
    maxHp: Math.max(1, Math.round(p.maxHp * w.hp)),
    power: Math.max(1, Math.round(p.power * w.power)),
    spirit: Math.max(1, p.spirit),
    defense: Math.max(0, Math.round(p.defense * g.def)),
    speed: p.speed, dodge: p.dodge,
    healMult: g.heal,
  };
}
function spawn(id, diff) {
  const b = ENEMIES[id], sm = DIFF[diff].enemyStatMult;
  return { id, maxHp: Math.round(b.maxHp*sm), hp: Math.round(b.maxHp*sm),
    power: Math.round(b.power*sm), defense: Math.round(b.defense*sm),
    speed: b.speed, dodge: b.dodge, damageMult: DIFF[diff].enemyDamageMult };
}

// One continuous engagement against a list of phase enemy-ids (HP carries; assist per phase).
// opts: { awakened, potions, finale }
function engage(player, phaseIds, diff, opts = {}) {
  const eff = effective(player);
  const awakened = !!opts.awakened;
  let hp = eff.maxHp, potions = opts.potions || 0, rounds = 0;

  for (let pi = 0; pi < phaseIds.length; pi++) {
    const e = spawn(phaseIds[pi], diff);
    let playerTurn = !(e.speed > eff.speed);
    let fx = { blind: 0, defend: 0, defendTurns: 0, stagger: 0 }; // enemy/self effects
    let assistUsed = false;
    let opened = false; // cast ward once at the start of a boss fight
    const isBoss = ENEMIES[phaseIds[pi]].boss;

    while (hp > 0 && e.hp > 0 && rounds < 1500) {
      rounds++;
      if (playerTurn) {
        const lowHp = hp < eff.maxHp * 0.40;
        // policy:
        if (!opened && isBoss && fx.defendTurns === 0) {
          // open with ward: 50% incoming reduction for 2 enemy turns
          fx.defend = 0.5; fx.defendTurns = 2; opened = true;
        } else if (lowHp && potions === 0) {
          // mend: heal (maxHp*0.30 + spirit) * graceHeal
          const heal = Math.max(1, Math.round((eff.maxHp * 0.30 + eff.spirit) * eff.healMult));
          hp = Math.min(eff.maxHp, hp + heal);
        } else if (lowHp && potions > 0) {
          hp = Math.min(eff.maxHp, hp + 20); potions--;
        } else if (awakened && fx.stagger === 0 && rnd() < 0.5) {
          // true strike: 2.0x + stagger (alternate w/ radiance to keep enemy locked)
          if (rnd() >= dodgeChance(e.dodge)) {
            e.hp = Math.max(0, e.hp - dmgAfterDef(Math.round(eff.spirit * 2.0), e.defense));
            if (e.hp > 0) fx.stagger = 1;
          }
        } else {
          // radiance: 1.3x + blind(0.7) 1 turn
          if (rnd() >= dodgeChance(e.dodge)) {
            e.hp = Math.max(0, e.hp - dmgAfterDef(Math.round(eff.spirit * 1.3), e.defense));
            if (e.hp > 0) fx.blind = 0.7; // installs 1-turn blind
          }
        }
        if (e.hp <= 0) break;
      } else {
        // enemy turn — mirror combat.js enemyTurn order
        if (opts.finale && !assistUsed && hp <= Math.round(eff.maxHp * 0.4)) {
          assistUsed = true;
          hp = Math.min(eff.maxHp, hp + Math.max(1, Math.round(eff.maxHp * 0.18)));
          fx.stagger = Math.max(fx.stagger, 1);
        }
        if (fx.stagger > 0) { fx.stagger = 0; /* enemy loses turn */ }
        else {
          const blind = fx.blind; fx.blind = 0; // consume 1-turn blind
          const defend = fx.defendTurns > 0 ? fx.defend : 0;
          if (fx.defendTurns > 0) fx.defendTurns--;
          if (rnd() < dodgeChance(eff.dodge) || (blind > 0 && rnd() < blind)) {
            // enemy misses
          } else {
            let dmg = dmgAfterDef(e.power * e.damageMult, eff.defense);
            if (defend > 0) dmg = Math.max(1, Math.round(dmg * (1 - defend)));
            hp = Math.max(0, hp - dmg);
          }
        }
        if (hp <= 0) break;
      }
      playerTurn = !playerTurn;
    }
    if (hp <= 0) return { win: false, phaseReached: pi + 1, rounds };
  }
  return { win: true, rounds, hpLeft: hp };
}

function wr(player, phaseIds, diff, trials, opts) {
  let w = 0; for (let i = 0; i < trials; i++) if (engage(player, phaseIds, diff, opts).win) w++;
  return w / trials;
}

module.exports = { engage, wr, effective };

if (require.main === module) {
  // Compare skilled-virtuous kit vs the no-ability "optimal" baseline at matched stats.
  // Representative builds at each gate (spirit-forward, since skilled leans virtue/spirit).
  const diff = process.argv[2] || 'normal';
  console.log(`\n=== Skilled virtuous kit — win rates (${diff}) ===`);
  console.log(`(virtue level drives grace boon + which abilities are online)\n`);

  const builds = {
    'boss2 entry (spi15 dge12 hp45 def6, V45)':  { maxHp:45, power:8,  spirit:15, defense:6,  speed:9,  dodge:12, virtue:45, corruption:0 },
    'boss3 entry (spi20 dge20 hp48 def8, V55)':  { maxHp:48, power:9,  spirit:20, defense:8,  speed:11, dodge:20, virtue:55, corruption:0 },
    'finale entry(spi29 dge30 hp57 def12,V70)':  { maxHp:57, power:17, spirit:29, defense:12, speed:18, dodge:30, virtue:70, corruption:0 },
  };
  const map = {
    'boss2 entry (spi15 dge12 hp45 def6, V45)':  ['tideheart_wraith'],
    'boss3 entry (spi20 dge20 hp48 def8, V55)':  ['hour_warden'],
    'finale entry(spi29 dge30 hp57 def12,V70)':  ['grey_sovereign','city_despair'],
  };
  for (const [name, b] of Object.entries(builds)) {
    const ids = map[name];
    const fin = ids.length > 1;
    const skilled = wr(b, ids, diff, 6000, { awakened: fin, potions: 2, finale: fin });
    console.log(`  ${name}`);
    console.log(`     skilled-virtuous win rate vs ${ids.join('→')}: ${(skilled*100).toFixed(1)}%`);
  }
}
