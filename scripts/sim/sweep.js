const cp=require('child_process');
// reuse day-sim internals by requiring it would run main; instead inline a quick bar sweep
const { START, winRate, simulateBattle, finaleWinRate, simulateFinale } = require('./combat-sim.js');
const GAIN={power:1,spirit:1,defense:1,speed:1,dodge:1,maxHp:3,maxStamina:2},SOFTCAP={dodge:30,maxStamina:120};
const ARCH={optimal:['dodge','spirit','maxHp','spirit','defense','dodge','spirit','maxStamina','speed']};
const PATH=[{id:'grove_warden',tier:'soldier'},{id:'tideheart_wraith'},{id:'hour_warden',tier:'knight'},{id:'doubt_echo'},{id:'grief_herald',tier:'awakened'},{id:'finale',tier:'ascended'}];
function applyTrain(p,s){if(SOFTCAP[s]&&p[s]>=SOFTCAP[s])return false;p[s]+=GAIN[s];if(SOFTCAP[s])p[s]=Math.min(p[s],SOFTCAP[s]);return true;}
function slots(p,t){let s=6;for(const x of[40,60,80])if(p.maxStamina>=x)s++;return s+t;}
function run(diff,bar){let p={...START,spirit:6,corruption:0,virtue:0},mix=ARCH.optimal,rot=0,day=0,tiers=0,i=0,losses=0;
 while(i<PATH.length&&day<300){const step=PATH[i],fin=step.id==='finale',ub=true;
  const wr=fin?finaleWinRate(p,diff,800,{useBolt:ub,potions:2}):winRate(p,step.id,diff,800,{useBolt:ub,potions:2});
  if(wr>=bar){day++;const res=fin?simulateFinale(p,diff,{useBolt:ub,potions:2}):simulateBattle(p,step.id,diff,{useBolt:ub,potions:2});
   if(res.win){if(step.tier)tiers++;i++;if(['soldier','knight','awakened'].includes(step.tier))day+=2;}else{losses++;day++;}}
  else{const sl=slots(p,tiers);for(let s=0;s<sl;s++){let t=0;while(t<mix.length){const st=mix[rot%mix.length];rot++;if(applyTrain(p,st))break;t++;}}day++;}}
 return{day,beaten:i>=PATH.length,losses};}
function dist(diff,bar,n=120){let D=[],L=0,F=0;for(let k=0;k<n;k++){const r=run(diff,bar);if(r.beaten){D.push(r.day);L+=r.losses;}else F++;}D.sort((a,b)=>a-b);return{med:D[Math.floor(D.length/2)],mean:(D.reduce((a,b)=>a+b,0)/D.length).toFixed(1),avgLoss:(L/D.length).toFixed(1),fails:F,min:D[0],max:D[D.length-1]};}
console.log('How play-style (boss-attempt confidence) shifts days-to-beat [optimal build]:\n');
for(const diff of['easy','normal']){console.log(`### ${diff.toUpperCase()}`);console.log('confidence  median  mean   range    avg bossLosses');
 for(const bar of[0.5,0.65,0.8,0.95]){const d=dist(diff,bar);console.log(`  ${(bar*100).toFixed(0).padStart(3)}%      ${String(d.med).padStart(4)}   ${String(d.mean).padStart(5)}  ${d.min}-${d.max}     ${d.avgLoss}`);}console.log('');}
