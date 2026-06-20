// Full-dungeon-run attrition for Harbor & Clocktower.
// Mechanics (verified vs src): HP fully restores after EVERY battle; only room
// MOVES cost Stamina (2 each, config.exploration.staminaPerMove); combat is free.
// So HP isn't cumulative — each fight starts fresh — and a run is gated by Stamina
// (path length) + the single hardest fight, not by chip damage.
// Run: node scripts/sim/dungeon-run.js [normal|easy]
const { ENEMIES, winRate } = require('./combat-sim.js');

Object.assign(ENEMIES, {
  drowned_sailor:   { maxHp: 32, power: 11, defense: 2, speed: 4, dodge: 2, coins: 8,  boss: false },
  glass_warden:     { maxHp: 44, power: 10, defense: 4, speed: 7, dodge: 4, coins: 18, boss: false },
  brass_moth:       { maxHp: 28, power: 10, defense: 3, speed: 9, dodge: 6, coins: 9,  boss: false },
  stopped_sentinel: { maxHp: 54, power: 13, defense: 6, speed: 4, dodge: 1, coins: 22, boss: false },
});

const STAMINA_PER_MOVE = 2;
const diff = process.argv[2] || 'normal';

// Each leg = one room MOVE. enc = chance the destination room spawns a fight on entry.
// (Entrance-room encounters never fire — you start there, never move into it.)
const RUNS = {
  harbor: {
    bossId: 'tideheart_wraith',
    player: { maxHp: 42, power: 10, spirit: 10, defense: 8, speed: 10, dodge: 8, maxStamina: 26, corruption: 0, virtue: 0 },
    useBolt: true,
    direct: [ { enc: 0.55, mob: 'brine_lurker' }, { enc: 0.55, mob: 'drowned_sailor' } ], // market, chapel -> then deep(boss)
    detour: [ { enc: 0.85, mob: 'glass_warden', guardian: true } ], // market->tidepool->market round trip = +2 moves
    detourMoves: 2,
  },
  clocktower: {
    bossId: 'hour_warden',
    player: { maxHp: 51, power: 13, spirit: 13, defense: 11, speed: 13, dodge: 11, maxStamina: 32, corruption: 0, virtue: 0 },
    useBolt: true,
    direct: [ { enc: 0.6, mob: 'gear_wretch' }, { enc: 0.55, mob: 'brass_moth' } ], // gallery, archive -> then belfry(boss)
    detour: [ { enc: 0.85, mob: 'stopped_sentinel', guardian: true } ],
    detourMoves: 2,
  },
};

const pct = (x) => (x * 100).toFixed(0) + '%';
// Survive one leg: no spawn (1-enc) OR spawn and win.
function legSurvive(player, leg, potions) {
  const wr = winRate(player, leg.mob, diff, 6000, { useBolt: player.useBolt, potions, canGuard: false });
  return (1 - leg.enc) + leg.enc * wr;
}

console.log(`\n=== Full dungeon run (difficulty=${diff}) ===`);
console.log(`HP resets after every fight; only moves cost Stamina (${STAMINA_PER_MOVE}/move). Trash fought at 0 potions (you save them); boss/guardian at 2.\n`);

for (const [name, r] of Object.entries(RUNS)) {
  const p = { ...r.player, useBolt: r.useBolt };
  const bossDirectMoves = r.direct.length + 1;            // legs + final step into the boss room
  const bossWR = winRate(p, r.bossId, diff, 6000, { useBolt: p.useBolt, potions: 2, canGuard: false });

  // Direct route: survive each trash leg (0 pot) then beat the boss (2 pot).
  let pReach = r.direct.reduce((acc, leg) => acc * legSurvive(p, leg, 0), 1);
  const pClearDirect = pReach * bossWR;
  const expFightsDirect = r.direct.reduce((a, l) => a + l.enc, 0) + 1;
  const staDirect = bossDirectMoves * STAMINA_PER_MOVE;

  // Completionist: detour for the signature item (guardian fight, 2 pot) THEN the boss.
  const pGuardLeg = r.detour.reduce((acc, leg) => acc * legSurvive(p, leg, 2), 1);
  const pClearFull = pReach * pGuardLeg * bossWR;
  const staFull = (bossDirectMoves + r.detourMoves) * STAMINA_PER_MOVE;
  const expFightsFull = expFightsDirect + r.detour.reduce((a, l) => a + l.enc, 0);

  console.log(`── ${name.toUpperCase()} ──  (player sta pool ${p.maxStamina}; boss ${r.bossId} winRate ${pct(bossWR)})`);
  console.log(`  DIRECT to boss:`);
  console.log(`     Stamina: ${staDirect}/${p.maxStamina} (${pct(staDirect/p.maxStamina)} of pool) · ~${expFightsDirect.toFixed(1)} fights · P(clear run) ${pct(pClearDirect)}`);
  console.log(`  COMPLETIONIST (grab signature loot, then boss):`);
  console.log(`     Stamina: ${staFull}/${p.maxStamina} (${pct(staFull/p.maxStamina)} of pool) · ~${expFightsFull.toFixed(1)} fights · P(clear run) ${pct(pClearFull)}`);
  console.log(`     -> the detour costs +${r.detourMoves*STAMINA_PER_MOVE} Stamina and swaps in the guardian gamble (run-clear ${pct(pClearDirect)} -> ${pct(pClearFull)}).`);
  console.log('');
}
