// MAGICAL.EXE — progression / time-to-beat simulator
// Builds on combat-sim.js. Models the day/slot economy and a greedy "rational
// player" who trains the most win-rate-efficient stats, then beats each boss on
// the critical path. Reports training sessions and in-game days to beat the game.

const { START, winRate, simulateBattle } = require('./combat-sim.js');

// training gains per session (config.js training.gainPerSession)
const GAIN = { power: 1, spirit: 1, defense: 1, speed: 1, dodge: 1, maxHp: 3, maxStamina: 2 };
const SOFTCAP = { dodge: 30, maxStamina: 120 };

// critical-path bosses in order, with the win-rate bar we treat as "ready".
const PATH = [
  { id: 'grove_warden',     name: 'Boss1 Grove Warden (Forest)',    bar: 0.85 },
  { id: 'tideheart_wraith', name: 'Boss2 Tideheart Wraith (Harbor)', bar: 0.85 },
  { id: 'hour_warden',      name: 'Boss3 Hour Warden (Clocktower)',  bar: 0.85 },
  // boss4 first encounter is a scripted story-loss (no stats can win) — skipped in stat model
  { id: 'doubt_echo',       name: 'Secret: the Hollow Doubt',        bar: 0.85 },
  { id: 'grief_herald',     name: 'Boss4 rematch Grief Herald (Spire)', bar: 0.85 },
  { id: 'grey_sovereign',   name: 'Finale P1 Grey Sovereign',        bar: 0.80 },
  { id: 'city_despair',     name: 'Finale P2 City Despair',          bar: 0.80 },
];

const STAT_KEYS = ['power', 'spirit', 'defense', 'maxHp', 'dodge', 'maxStamina', 'speed'];

function clonePlayer(p) { return { ...p }; }

function applyTrain(p, stat) {
  if (SOFTCAP[stat] && p[stat] >= SOFTCAP[stat]) return false;
  p[stat] += GAIN[stat];
  if (SOFTCAP[stat]) p[stat] = Math.min(p[stat], SOFTCAP[stat]);
  return true;
}

// Greedily add training sessions until player clears `enemyId` at `bar` win rate.
// Each session: pick the stat that most raises win rate (sampled). Cap total sessions.
function trainUntilReady(player, enemyId, diff, bar, maxSessions = 400) {
  let sessions = 0;
  // quick check
  if (winRate(player, enemyId, diff, 1500) >= bar) return { sessions: 0, player };
  while (sessions < maxSessions) {
    let bestStat = null, bestWR = -1;
    for (const stat of STAT_KEYS) {
      const test = clonePlayer(player);
      if (!applyTrain(test, stat)) continue;
      const wr = winRate(test, enemyId, diff, 600);
      if (wr > bestWR) { bestWR = wr; bestStat = stat; }
    }
    if (!bestStat) break;
    applyTrain(player, bestStat);
    sessions++;
    // re-evaluate with more trials when close
    if (bestWR >= bar) {
      if (winRate(player, enemyId, diff, 3000) >= bar) break;
    }
  }
  return { sessions, player };
}

// Slots available on a given day depend on tier reached + maxStamina thresholds.
function slotsFor(p, tiersReached) {
  let slots = 6;
  for (const t of [40, 60, 80]) if (p.maxStamina >= t) slots++;
  slots += tiersReached; // +1 per soldier/knight/awakened/ascended
  return slots;
}

function run(diff, opts = {}) {
  const trials = opts.trials || 3000;
  let p = { ...START, spirit: 6, corruption: 0, virtue: 0 };
  let totalSessions = 0;
  const log = [];

  // tiers: soldier after boss1, knight after boss3, awakened after boss4 rematch, ascended at finale
  const tierAfter = { grove_warden: 'soldier', hour_warden: 'knight', grief_herald: 'awakened' };
  let tiersReached = 0;

  for (const step of PATH) {
    const before = totalSessions;
    const r = trainUntilReady(p, step.id, diff, step.bar);
    totalSessions += r.sessions;
    const finalWR = winRate(p, step.id, diff, trials);
    log.push({
      step: step.name,
      sessionsForStep: r.sessions,
      cumulativeSessions: totalSessions,
      winRate: finalWR,
      stats: { power: p.power, spirit: p.spirit, defense: p.defense, maxHp: p.maxHp, dodge: p.dodge, speed: p.speed, maxStamina: p.maxStamina },
    });
    if (tierAfter[step.id]) tiersReached++;
  }

  // Convert cumulative sessions -> days. A player spends ~all slots on training
  // until ready, but must also rest each day. Slots grow as maxStamina/tiers grow.
  // We replay session count against a growing slot budget.
  let days = 0, sessionsLeft = totalSessions, simStamina = START.maxStamina, simTiers = 0;
  // approximate: tiers unlock across the run; assume ~half the tiers by midpoint.
  // We'll just use the FINAL slot trajectory replay using p.maxStamina growth share.
  // Simpler robust estimate: average slots over the run.
  const avgSlots = (slotsFor(START, 0) + slotsFor(p, tiersReached)) / 2;
  const daysTraining = Math.ceil(totalSessions / avgSlots);
  // plus combat/explore days: each boss needs ~1-2 days of exploration+fight. 7 path steps.
  const combatDays = PATH.length * 2;

  return { totalSessions, log, finalStats: p, avgSlots: avgSlots.toFixed(1), daysTraining, combatDays, totalDays: daysTraining + combatDays };
}

if (require.main === module) {
  for (const diff of ['easy', 'normal']) {
    console.log(`\n################ DIFFICULTY: ${diff.toUpperCase()} ################`);
    const r = run(diff);
    for (const e of r.log) {
      const s = e.stats;
      console.log(`\n${e.step}`);
      console.log(`  +${e.sessionsForStep} sessions (cum ${e.cumulativeSessions})  winRate=${(e.winRate*100).toFixed(1)}%`);
      console.log(`  stats: pow${s.power} spi${s.spirit} def${s.defense} hp${s.maxHp} dge${s.dodge} spd${s.speed} sta${s.maxStamina}`);
    }
    console.log(`\n--- SUMMARY (${diff}) ---`);
    console.log(`  total training sessions: ${r.totalSessions}`);
    console.log(`  avg slots/day: ${r.avgSlots}`);
    console.log(`  est. training days: ${r.daysTraining}`);
    console.log(`  est. combat/explore days: ${r.combatDays}`);
    console.log(`  ESTIMATED TOTAL DAYS TO BEAT: ~${r.totalDays}`);
  }
}
