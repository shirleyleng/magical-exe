// MAGICAL.EXE — combat & progression simulator
// Standalone reimplementation of the game's combat math (from src/combat.js,
// src/enemies.js, src/abilities.js, config.js) for difficulty / time-to-beat
// analysis. Numbers mirror the live config as of 2026-06-07.

// ----------------------------- constants -----------------------------
const START = { maxHp: 30, power: 6, spirit: 6, defense: 4, speed: 6, dodge: 4, maxStamina: 20 };

const DIFF = {
  easy:   { enemyStatMult: 0.85, enemyDamageMult: 0.8, lootMult: 1.2 },
  normal: { enemyStatMult: 1.0,  enemyDamageMult: 1.0, lootMult: 1.0 },
};

// base enemy stats (enemies.js)
const ENEMIES = {
  dust_sprite:      { maxHp: 12,  power: 4,  defense: 1,  speed: 7,  dodge: 4, coins: 3,  boss: false },
  shadow_imp:       { maxHp: 18,  power: 6,  defense: 2,  speed: 5,  dodge: 3, coins: 5,  boss: false },
  grove_warden:     { maxHp: 60,  power: 10, defense: 4,  speed: 6,  dodge: 2, coins: 25, boss: true },   // boss1
  brine_lurker:     { maxHp: 26,  power: 9,  defense: 3,  speed: 6,  dodge: 4, coins: 7,  boss: false },
  tideheart_wraith: { maxHp: 92,  power: 14, defense: 6,  speed: 7,  dodge: 3, coins: 40, boss: true },   // boss2
  gear_wretch:      { maxHp: 34,  power: 11, defense: 4,  speed: 5,  dodge: 3, coins: 9,  boss: false },
  hour_warden:      { maxHp: 130, power: 18, defense: 8,  speed: 6,  dodge: 2, coins: 60, boss: true },   // boss3
  grief_wisp:       { maxHp: 40,  power: 13, defense: 5,  speed: 6,  dodge: 4, coins: 11, boss: false },
  grief_herald:     { maxHp: 200, power: 24, defense: 14, speed: 13, dodge: 4, coins: 100,boss: true },   // boss4 (story-loss first time)
  doubt_echo:       { maxHp: 120, power: 17, defense: 7,  speed: 8,  dodge: 3, coins: 0,  boss: true },   // secret place
  grey_sovereign:   { maxHp: 190, power: 22, defense: 12, speed: 10, dodge: 3, coins: 0,  boss: true },   // finale P1
  city_despair:     { maxHp: 240, power: 28, defense: 13, speed: 11, dodge: 3, coins: 0,  boss: true },   // finale P2 (power 26→28: skill-check tuning)
};

// combat constants (config.js)
const K = {
  dodgePerPoint: 0.015, dodgeCap: 0.5,
  defMitig: 0.8, guardMitig: 0.5,
  burstMult: 1.6,
};

// ----------------------------- helpers -----------------------------
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const rnd = () => Math.random();
const dodgeChance = (d) => Math.min(K.dodgeCap, d * K.dodgePerPoint);
const dmgAfterDef = (raw, def) => Math.max(1, Math.round(raw - def * K.defMitig));

// warp player stats by corruption/virtue (alignment.js); for a "neutral" player
// these are identity. We keep hooks so we can model a corrupt build later.
function effectiveStats(p) {
  let powerMult = 1, hpMult = 1, defMult = 1;
  if (p.corruption >= 70) { powerMult = 1.25; hpMult = 0.85; }
  else if (p.corruption >= 40) { powerMult = 1.10; hpMult = 0.95; }
  if (p.virtue >= 70) defMult = 1.35;
  else if (p.virtue >= 40) defMult = 1.15;
  return {
    maxHp: Math.max(1, Math.round(p.maxHp * hpMult)),
    power: Math.max(1, Math.round(p.power * powerMult)),
    spirit: Math.max(1, p.spirit),
    defense: Math.max(0, Math.round(p.defense * defMult)),
    speed: p.speed, dodge: p.dodge,
  };
}

function spawnEnemy(id, diff) {
  const base = ENEMIES[id];
  const sm = DIFF[diff].enemyStatMult;
  return {
    id, boss: base.boss,
    maxHp: Math.round(base.maxHp * sm),
    hp: Math.round(base.maxHp * sm),
    power: Math.round(base.power * sm),
    defense: Math.round(base.defense * sm),
    speed: base.speed, dodge: base.dodge,
    damageMult: DIFF[diff].enemyDamageMult,
  };
}

// ----------------------------- one battle -----------------------------
// policy: how the player acts each turn. Returns 'attack' | 'bolt' | 'guard' | 'heal' | 'burst'
// Default smart policy: use light bolt if spirit-build better, else attack; guard/heal when low.
function simulateBattle(player, enemyId, diff, opts = {}) {
  const eff = effectiveStats(player);
  const e = spawnEnemy(enemyId, diff);
  let hp = eff.maxHp;
  let potions = opts.potions || 0; // healing draughts (+20 hp)
  const useBolt = (opts.useBolt !== undefined) ? opts.useBolt : (eff.spirit * 1.6 > eff.power);

  // who goes first
  let playerTurn = !(e.speed > eff.speed);
  let guard = false;
  let rounds = 0;
  const maxRounds = 500;

  while (hp > 0 && e.hp > 0 && rounds < maxRounds) {
    rounds++;
    if (playerTurn) {
      // decide action
      const lowHp = hp < eff.maxHp * 0.35;
      if (lowHp && potions > 0) {
        hp = Math.min(eff.maxHp, hp + 20); potions--;
      } else if (lowHp && opts.canGuard) {
        guard = true;
      } else {
        // damage action
        if (useBolt) {
          if (rnd() >= dodgeChance(e.dodge)) {
            const dmg = dmgAfterDef(Math.round(eff.spirit * 1.6), e.defense);
            e.hp = Math.max(0, e.hp - dmg);
          }
        } else {
          if (rnd() >= dodgeChance(e.dodge)) {
            const dmg = dmgAfterDef(eff.power, e.defense);
            e.hp = Math.max(0, e.hp - dmg);
          }
        }
      }
      if (e.hp <= 0) break;
    } else {
      // enemy attacks
      if (rnd() >= dodgeChance(eff.dodge)) {
        let raw = e.power * e.damageMult;
        let dmg = dmgAfterDef(raw, eff.defense);
        if (guard) dmg = Math.max(1, Math.round(dmg * K.guardMitig));
        hp = Math.max(0, hp - dmg);
      }
      guard = false;
      if (hp <= 0) break;
    }
    playerTurn = !playerTurn;
  }
  return { win: e.hp <= 0 && hp > 0, hpLeft: hp, rounds, timeout: rounds >= maxRounds };
}

function winRate(player, enemyId, diff, trials = 4000, opts = {}) {
  let wins = 0;
  for (let i = 0; i < trials; i++) if (simulateBattle(player, enemyId, diff, opts).win) wins++;
  return wins / trials;
}

// ---- continuous two-phase finale (combat.js advancePhase + maybeFinaleAssist) ----
// HP carries between phases; each phase grants ONE assist (heal 25% maxHp + stagger
// the enemy one turn) the first time HP drops below 40% maxHp. assistHpPct=0.4,
// assistHealPct=0.25 (config.js finale).
function simulateFinale(player, diff, opts = {}) {
  const eff = effectiveStats(player);
  const phases = ['grey_sovereign', 'city_despair'];
  let hp = eff.maxHp;
  let potions = opts.potions || 0;
  const useBolt = (opts.useBolt !== undefined) ? opts.useBolt : (eff.spirit * 1.6 > eff.power);
  let rounds = 0;

  for (let pi = 0; pi < phases.length; pi++) {
    const e = spawnEnemy(phases[pi], diff);
    let playerTurn = !(e.speed > eff.speed);
    let guard = false, assistUsed = false, enemyStagger = 0;

    while (hp > 0 && e.hp > 0 && rounds < 1000) {
      rounds++;
      if (playerTurn) {
        const lowHp = hp < eff.maxHp * 0.35;
        if (lowHp && potions > 0) { hp = Math.min(eff.maxHp, hp + 20); potions--; }
        else if (lowHp && opts.canGuard) { guard = true; }
        else {
          const raw = useBolt ? Math.round(eff.spirit * 1.6) : eff.power;
          if (rnd() >= dodgeChance(e.dodge)) e.hp = Math.max(0, e.hp - dmgAfterDef(raw, e.defense));
        }
        if (e.hp <= 0) break;
      } else {
        // assist check fires before the enemy acts (combat.js enemyTurn)
        if (!assistUsed && hp <= Math.round(eff.maxHp * 0.4)) {
          assistUsed = true;
          hp = Math.min(eff.maxHp, hp + Math.max(1, Math.round(eff.maxHp * 0.18)));
          enemyStagger = 1; // enemy loses this turn
        }
        if (enemyStagger > 0) { enemyStagger--; }
        else if (rnd() >= dodgeChance(eff.dodge)) {
          let dmg = dmgAfterDef(e.power * e.damageMult, eff.defense);
          if (guard) dmg = Math.max(1, Math.round(dmg * K.guardMitig));
          hp = Math.max(0, hp - dmg);
        }
        guard = false;
        if (hp <= 0) break;
      }
      playerTurn = !playerTurn;
    }
    if (hp <= 0) return { win: false, phaseReached: pi + 1, hpLeft: 0, rounds };
    // phase win: continue to next phase with current HP (no restore)
  }
  return { win: true, phaseReached: 2, hpLeft: hp, rounds };
}

function finaleWinRate(player, diff, trials = 4000, opts = {}) {
  let wins = 0;
  for (let i = 0; i < trials; i++) if (simulateFinale(player, diff, opts).win) wins++;
  return wins / trials;
}

module.exports = { START, ENEMIES, DIFF, effectiveStats, spawnEnemy, simulateBattle, winRate, simulateFinale, finaleWinRate };

// ----------------------------- CLI report -----------------------------
if (require.main === module) {
  const diff = process.argv[2] || 'normal';
  console.log(`\n=== MAGICAL.EXE difficulty sim (difficulty=${diff}) ===\n`);

  // baseline: starting character, no training
  const fresh = { ...START, spirit: 6, corruption: 0, virtue: 0 };
  console.log('Fresh character vs trash + boss1 (no training):');
  for (const id of ['dust_sprite', 'shadow_imp', 'grove_warden']) {
    const wr = winRate(fresh, id, diff);
    const b = simulateBattle(fresh, id, diff);
    console.log(`  ${id.padEnd(16)} winRate=${(wr*100).toFixed(1)}%  (sample rounds=${b.rounds}, hpLeft=${b.hpLeft})`);
  }
}
