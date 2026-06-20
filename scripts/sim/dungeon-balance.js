// Balance check for the fleshed-out Harbor/Clocktower enemies.
// Adds the 4 new enemies to the sim and reports win rates at realistic player
// builds for the stage each is encountered. Run: node scripts/sim/dungeon-balance.js
const { ENEMIES, winRate, simulateBattle, effectiveStats } = require('./combat-sim.js');

// Average HP% remaining after a fight (over trials) — characterizes how "bloody"
// a fight is even when win rate is ~100%. Lower = costlier. Counts losses as 0.
function avgHpPct(player, id, diff, trials, opts) {
  const maxHp = effectiveStats(player).maxHp;
  let sum = 0;
  for (let i = 0; i < trials; i++) {
    const r = simulateBattle(player, id, diff, opts);
    sum += r.win ? r.hpLeft / maxHp : 0;
  }
  return sum / trials;
}

// New enemies (mirror src/enemies.js).
Object.assign(ENEMIES, {
  drowned_sailor:   { maxHp: 32, power: 11, defense: 2, speed: 4, dodge: 2, coins: 8,  boss: false },
  glass_warden:     { maxHp: 44, power: 10, defense: 4, speed: 7, dodge: 4, coins: 18, boss: false }, // harbor guardian (tuned)
  brass_moth:       { maxHp: 28, power: 10, defense: 3, speed: 9, dodge: 6, coins: 9,  boss: false },
  stopped_sentinel: { maxHp: 54, power: 13, defense: 6, speed: 4, dodge: 1, coins: 22, boss: false }, // clock guardian (tuned)
});

const diff = process.argv[2] || 'normal';

// Representative player builds at each dungeon stage (from debug-run.js progression).
// "fresh" = just beat the gating boss; "prepared" = trained partway to the next boss.
const BUILDS = {
  harbor: [
    { tag: 'fresh balanced (post-boss1)',  p: { maxHp: 33, power: 7,  spirit: 7,  defense: 5, speed: 7,  dodge: 5,  maxStamina: 20 }, useBolt: true },
    { tag: 'fresh bruiser  (post-boss1)',  p: { maxHp: 42, power: 10, spirit: 6,  defense: 6, speed: 8,  dodge: 4,  maxStamina: 20 }, useBolt: false },
    { tag: 'prepared balanced (mid)',      p: { maxHp: 38, power: 9,  spirit: 9,  defense: 7, speed: 9,  dodge: 7,  maxStamina: 24 }, useBolt: true },
  ],
  clocktower: [
    { tag: 'fresh balanced (post-boss2)',  p: { maxHp: 42, power: 10, spirit: 10, defense: 8, speed: 10, dodge: 8,  maxStamina: 26 }, useBolt: true },
    { tag: 'fresh bruiser  (post-boss2)',  p: { maxHp: 57, power: 15, spirit: 6,  defense: 8, speed: 10, dodge: 4,  maxStamina: 20 }, useBolt: false },
    { tag: 'prepared balanced (mid)',      p: { maxHp: 47, power: 12, spirit: 12, defense: 9, speed: 12, dodge: 10, maxStamina: 30 }, useBolt: true },
  ],
};

const STAGE_ENEMIES = {
  harbor:     [['brine_lurker', 'mob'], ['drowned_sailor', 'mob'], ['glass_warden', 'GUARDIAN']],
  clocktower: [['gear_wretch', 'mob'], ['brass_moth', 'mob'], ['stopped_sentinel', 'GUARDIAN']],
};

function pct(x) { return (x * 100).toFixed(0).padStart(3) + '%'; }

console.log(`\n=== Dungeon balance (difficulty=${diff}) ===`);
console.log(`win rate = chance to win the fight. mob target ~80-97%; guardian target ~45-75% (a real, tempting gamble).\n`);

for (const stage of ['harbor', 'clocktower']) {
  console.log(`── ${stage.toUpperCase()} ──`);
  for (const b of BUILDS[stage]) {
    const player = { ...b.p, corruption: 0, virtue: 0 };
    const cells = STAGE_ENEMIES[stage].map(([id, kind]) => {
      // 0 potions (rushed in) and 2 potions (prepared) + guard available.
      const wr0 = winRate(player, id, diff, 4000, { useBolt: b.useBolt, potions: 0, canGuard: true });
      const wr1 = winRate(player, id, diff, 4000, { useBolt: b.useBolt, potions: 1, canGuard: true });
      const wr2 = winRate(player, id, diff, 4000, { useBolt: b.useBolt, potions: 2, canGuard: true });
      // HP% remaining on the rushed-in (0-potion) attempt — how bloody the fight is.
      const hp0 = avgHpPct(player, id, diff, 4000, { useBolt: b.useBolt, potions: 0, canGuard: true });
      const mark = kind === 'GUARDIAN' ? '★' : ' ';
      return `${mark}${id.padEnd(16)} ${pct(wr0)} (0pot) / ${pct(wr1)} (1pot) / ${pct(wr2)} (2pot)   [HP left @0pot: ${pct(hp0)}]`;
    });
    console.log(`  ${b.tag.padEnd(26)}`);
    for (const c of cells) console.log(`      ${c}`);
  }
  console.log('');
}
