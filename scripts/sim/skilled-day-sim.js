// Time-to-beat for a TACTICALLY SKILLED player who uses the virtuous ability kit
// (radiance/ward/mend/true-strike) and commits to virtue (grace boons). Compares
// against the no-ability "optimal" baseline from day-sim.js.

const { wr } = require('./skilled-sim.js');
const { START } = require('./combat-sim.js');

const GAIN = { power:1, spirit:1, defense:1, speed:1, dodge:1, maxHp:3, maxStamina:2 };
const SOFTCAP = { dodge:30, maxStamina:120 };
// skilled player trains spirit (scales every ability) + dodge + hp; rounds out.
const MIX = ['spirit','dodge','spirit','maxHp','dodge','spirit','defense','maxStamina','speed'];

// path: each step is a list of phase ids; virtue assumed by that point (skilled leans virtue).
const PATH = [
  { ids:['grove_warden'],     tier:'soldier',  virtue:20, awakened:false },
  { ids:['tideheart_wraith'], tier:null,        virtue:35, awakened:false },
  { ids:['hour_warden'],      tier:'knight',    virtue:50, awakened:false },
  { ids:['doubt_echo'],       tier:null,        virtue:60, awakened:false },
  { ids:['grief_herald'],     tier:'awakened',  virtue:65, awakened:true  },
  { ids:['grey_sovereign','city_despair'], tier:'ascended', virtue:70, awakened:true, finale:true },
];

function applyTrain(p,s){ if(SOFTCAP[s]&&p[s]>=SOFTCAP[s])return false; p[s]+=GAIN[s]; if(SOFTCAP[s])p[s]=Math.min(p[s],SOFTCAP[s]); return true; }
function slots(p,t){ let s=6; for(const x of[40,60,80]) if(p.maxStamina>=x)s++; return s+t; }

function runOne(diff, bar){
  let p = { ...START, spirit:6, corruption:0, virtue:0 };
  let rot=0, day=0, tiers=0, i=0;
  while(i<PATH.length && day<300){
    const step = PATH[i];
    p.virtue = step.virtue; // skilled player has leaned virtue to here
    const opts = { awakened: step.awakened, potions:2, finale: !!step.finale };
    const w = wr(p, step.ids, diff, 900, opts);
    if(w >= bar){
      day++;
      const res = wr(p, step.ids, diff, 1, opts) >= 1; // single trial -> win?
      // (re-roll a real single outcome)
      const single = require('./skilled-sim.js').engage(p, step.ids, diff, opts).win;
      if(single){ if(step.tier)tiers++; i++; if(['soldier','knight','awakened'].includes(step.tier))day+=2; }
      else { day++; }
    } else {
      const sl = slots(p, tiers);
      for(let s=0;s<sl;s++){ let t=0; while(t<MIX.length){ const st=MIX[rot%MIX.length]; rot++; if(applyTrain(p,st))break; t++; } }
      day++;
    }
  }
  return { day, beaten: i>=PATH.length };
}

function dist(diff, bar, n=150){
  const D=[]; let F=0;
  for(let k=0;k<n;k++){ const r=runOne(diff,bar); if(r.beaten)D.push(r.day); else F++; }
  D.sort((a,b)=>a-b);
  const q=x=>D[Math.floor(x*(D.length-1))];
  return { n:D.length, fails:F, mean:(D.reduce((a,b)=>a+b,0)/D.length).toFixed(1), p10:q(.1), p50:q(.5), p90:q(.9), min:D[0], max:D[D.length-1] };
}

if(require.main===module){
  const bar = 0.75;
  console.log(`\n=== Time-to-beat: TACTICALLY SKILLED player (virtuous ability kit, ${bar*100}% attempt bar) ===\n`);
  for(const diff of ['easy','normal']){
    const d = dist(diff, bar);
    console.log(`${diff.toUpperCase().padEnd(7)}  median ${d.p50}d   mean ${d.mean}d   p10 ${d.p10}  p90 ${d.p90}   range ${d.min}-${d.max}${d.fails?`  [${d.fails} no-finish]`:''}`);
  }
  console.log('\n(compare to no-ability baseline: Easy ~20d, Normal ~24d median)');
}
