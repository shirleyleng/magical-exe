const { START, winRate, simulateBattle, finaleWinRate } = require('./combat-sim.js');
const GAIN = { power:1,spirit:1,defense:1,speed:1,dodge:1,maxHp:3,maxStamina:2 };
const SOFTCAP = { dodge:30, maxStamina:120 };
const ARCH = { bruiser:['power','maxHp','power','defense','maxHp','speed'],
               balanced:['power','spirit','defense','maxHp','dodge','speed','maxStamina'] };
const PATH=[{id:'grove_warden',tier:'soldier'},{id:'tideheart_wraith'},{id:'hour_warden',tier:'knight'},
            {id:'doubt_echo'},{id:'grief_herald',tier:'awakened'},{id:'finale',tier:'ascended'}];
function applyTrain(p,s){if(SOFTCAP[s]&&p[s]>=SOFTCAP[s])return false;p[s]+=GAIN[s];if(SOFTCAP[s])p[s]=Math.min(p[s],SOFTCAP[s]);return true;}
function slots(p,t){let s=6;for(const x of[40,60,80])if(p.maxStamina>=x)s++;return s+t;}
const arch=process.argv[2]||'bruiser', diff=process.argv[3]||'normal', bar=0.75;
let p={...START,spirit:6,corruption:0,virtue:0},mix=ARCH[arch],rot=0,day=0,tiers=0,i=0;
const useBolt=arch!=='bruiser';
while(i<PATH.length&&day<300){
  const step=PATH[i],fin=step.id==='finale';
  const wr=fin?finaleWinRate(p,diff,1000,{useBolt,potions:2}):winRate(p,step.id,diff,1000,{useBolt,potions:2});
  if(wr>=bar){day++;if(step.tier)tiers++;console.log(`day ${day}: BEAT ${step.id} wr=${(wr*100).toFixed(0)}% stats pow${p.power} spi${p.spirit} def${p.defense} hp${p.maxHp} dge${p.dodge} spd${p.speed} sta${p.maxStamina}`);i++;if(['soldier','knight','awakened'].includes(step.tier))day+=2;}
  else{const sl=slots(p,tiers);for(let s=0;s<sl;s++){let t=0;while(t<mix.length){const st=mix[rot%mix.length];rot++;if(applyTrain(p,st))break;t++;}}day++;}
}
console.log(`\nFINAL: beaten=${i>=PATH.length} day=${day}`);
