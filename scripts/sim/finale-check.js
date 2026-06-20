const { winRate, finaleWinRate, simulateFinale, effectiveStats } = require('./combat-sim.js');

// representative finale-entry builds observed from progression sims
const builds = {
  'optimal-normal (spi-heavy)': { maxHp:57, power:17, spirit:29, defense:12, speed:18, dodge:30, maxStamina:34, corruption:0, virtue:0 },
  'balanced-normal':            { maxHp:54, power:20, spirit:18, defense:14, speed:14, dodge:24, maxStamina:30, corruption:0, virtue:0 },
  'bruiser-normal (pow-heavy)': { maxHp:66, power:30, spirit:6,  defense:16, speed:14, dodge:8,  maxStamina:26, corruption:0, virtue:0 },
};

for (const diff of ['normal','easy']) {
  console.log(`\n==== ${diff.toUpperCase()} : finale win rate (continuous 2-phase) vs naive separate-battle ====`);
  for (const [name,b] of Object.entries(builds)) {
    const useBolt = b.spirit*1.6 > b.power;
    const cont = finaleWinRate(b, diff, 5000, {useBolt, potions:2});
    // naive: treat each phase as its own full-HP fight, both must be won
    const p1 = winRate(b,'grey_sovereign',diff,5000,{useBolt,potions:2});
    const p2 = winRate(b,'city_despair',diff,5000,{useBolt,potions:2});
    const naive = p1*p2;
    // how far into the fight do losses happen
    let p1deaths=0,trials=3000;
    for(let i=0;i<trials;i++){const r=simulateFinale(b,diff,{useBolt,potions:2}); if(!r.win&&r.phaseReached===1)p1deaths++;}
    console.log(`  ${name}`);
    console.log(`     continuous finale: ${(cont*100).toFixed(1)}%   | naive(P1*P2): ${(naive*100).toFixed(1)}%   (P1 ${(p1*100).toFixed(0)}% , P2 ${(p2*100).toFixed(0)}%)`);
    console.log(`     of all runs, died in phase 1: ${(p1deaths/trials*100).toFixed(1)}%`);
  }
}
