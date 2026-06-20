// MAGICAL.EXE — integrated day-by-day economy sim with player archetypes.
// Models the real slot budget growing over the run, fights bosses with actual
// RNG (a lost boss costs a day + recovery), and reports a distribution of
// in-game days to beat the game for several player skill profiles.

const { START, winRate, simulateBattle, finaleWinRate, simulateFinale } = require('./combat-sim.js');

const GAIN = { power: 1, spirit: 1, defense: 1, speed: 1, dodge: 1, maxHp: 3, maxStamina: 2 };
const SOFTCAP = { dodge: 30, maxStamina: 120 };

const PATH = [
  { id: 'grove_warden',     tier: 'soldier' },
  { id: 'tideheart_wraith', tier: null },
  { id: 'hour_warden',      tier: 'knight' },
  { id: 'doubt_echo',       tier: null },
  { id: 'grief_herald',     tier: 'awakened' },   // rematch (story-loss first time is free narrative)
  { id: 'finale',           tier: 'ascended' },   // continuous 2-phase fight (HP carries)
];

function applyTrain(p, stat) {
  if (SOFTCAP[stat] && p[stat] >= SOFTCAP[stat]) return false;
  p[stat] += GAIN[stat];
  if (SOFTCAP[stat]) p[stat] = Math.min(p[stat], SOFTCAP[stat]);
  return true;
}
function slotsFor(p, tiersReached) {
  let slots = 6;
  for (const t of [40, 60, 80]) if (p.maxStamina >= t) slots++;
  return slots + tiersReached;
}

// ---- player archetypes: a weighted "training mix". The trainer round-robins
// through the (possibly repeated) stat list so the mix is actually spread, not
// dumped into the first uncapped stat. ----
const ARCHETYPES = {
  // optimal: spirit-bolt + dodge-tank, rounded out with hp/def/stamina.
  optimal:  ['dodge', 'spirit', 'maxHp', 'spirit', 'defense', 'dodge', 'spirit', 'maxStamina', 'speed'],
  // balanced: the "reasonable but unoptimized" player spreading across everything.
  balanced: ['power', 'spirit', 'defense', 'maxHp', 'dodge', 'speed', 'maxStamina'],
  // bruiser: the intuitive "train attack & HP" player who ignores dodge/spirit.
  bruiser:  ['power', 'maxHp', 'power', 'defense', 'maxHp', 'speed'],
};

// Decide if player is "ready" for a boss at a given confidence bar.
function ready(p, id, bar, trials = 1500) {
  return winRate(p, id, { /*diff bound below*/ }, trials) >= bar;
}

function runOne(diff, archKey, bar) {
  let p = { ...START, spirit: 6, corruption: 0, virtue: 0 };
  const mix = ARCHETYPES[archKey];
  let rot = 0; // round-robin pointer into the training mix
  let day = 0, tiersReached = 0, stepIdx = 0;
  let attemptsThisBoss = 0;
  const MAX_DAYS = 400;
  // bruiser uses basic attack (power); others use light bolt when spirit-heavy.
  const useBolt = archKey !== 'bruiser';

  while (stepIdx < PATH.length && day < MAX_DAYS) {
    const step = PATH[stepIdx];
    const isFinale = step.id === 'finale';
    const wr = isFinale
      ? finaleWinRate(p, diff, 1200, { useBolt, potions: 2 })
      : winRate(p, step.id, diff, 1200, { useBolt, potions: 2 });

    if (wr >= bar) {
      // attempt the boss (one day: explore + fight)
      day++;
      attemptsThisBoss++;
      const res = isFinale
        ? simulateFinale(p, diff, { useBolt, potions: 2 })
        : simulateBattle(p, step.id, diff, { useBolt, potions: 2 });
      if (res.win) {
        if (step.tier) tiersReached++;
        stepIdx++;
        attemptsThisBoss = 0;
        // narrative gaps: rival/story beats add idle days after key bosses
        if (step.tier === 'soldier' || step.tier === 'knight' || step.tier === 'awakened') day += 2;
      } else {
        // lost: defeat recovery, lose the day, train a bit more next loop
        day += 1;
      }
    } else {
      // training day: spend all slots, round-robin through the archetype's mix.
      const slots = slotsFor(p, tiersReached);
      for (let s = 0; s < slots; s++) {
        let tries = 0;
        while (tries < mix.length) { // skip capped stats, advance rotation
          const stat = mix[rot % mix.length]; rot++;
          if (applyTrain(p, stat)) break;
          tries++;
        }
      }
      day++;
    }
  }
  return { days: day, beaten: stepIdx >= PATH.length, finalStats: p };
}

function distribution(diff, archKey, bar, runs = 200) {
  const days = [];
  let fails = 0;
  for (let i = 0; i < runs; i++) {
    const r = runOne(diff, archKey, bar);
    if (r.beaten) days.push(r.days); else fails++;
  }
  days.sort((a, b) => a - b);
  const pct = (q) => days.length ? days[Math.floor(q * (days.length - 1))] : NaN;
  const mean = days.length ? (days.reduce((a, b) => a + b, 0) / days.length) : NaN;
  return { n: days.length, fails, mean, p10: pct(0.1), p50: pct(0.5), p90: pct(0.9), min: days[0], max: days[days.length-1] };
}

if (require.main === module) {
  const bar = 0.75; // a player attempts a boss when they feel ~75%+ likely to win
  console.log(`\n=== Time-to-beat distribution (player attempts boss at ~${bar*100}% confidence, 2 potions/fight) ===`);
  console.log(`(in-game DAYS to reach the finale ending)\n`);
  for (const diff of ['easy', 'normal']) {
    console.log(`\n################ ${diff.toUpperCase()} ################`);
    console.log(`archetype   n    mean   p10  p50(median)  p90   range`);
    for (const arch of ['optimal', 'balanced', 'bruiser']) {
      const d = distribution(diff, arch, bar, 150);
      const f = d.fails ? `  [${d.fails} no-finish]` : '';
      console.log(`${arch.padEnd(10)} ${String(d.n).padStart(3)}  ${String(Math.round(d.mean)).padStart(5)}  ${String(d.p10).padStart(4)}  ${String(d.p50).padStart(6)}      ${String(d.p90).padStart(4)}  ${d.min}-${d.max}${f}`);
    }
  }
  console.log('');
}
