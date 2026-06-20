// MAGICAL.EXE — finale tuning sweep.
// Goal: find config knobs that turn the finale into a real SKILL CHECK — a
// button-masher (light-bolt only, no abilities, no grace) should sweat, while a
// tactician (radiance-blind + ward + true-strike + grace) wins reliably.
// Knobs swept: assistHealPct (per-phase clutch heal), assistOncePerFight (vs per
// phase), city_despair power & maxHp. Held fixed: the stats a player realistically
// arrives with after beating boss4 (spi29 dge30 hp57 def12).

const { ENEMIES, DIFF } = require('./combat-sim.js');
const K = { dodgePerPoint:0.015, dodgeCap:0.5, defMitig:0.8, guardMitig:0.5 };
const rnd=()=>Math.random();
const dodge=(d)=>Math.min(K.dodgeCap,d*K.dodgePerPoint);
const dad=(raw,def)=>Math.max(1,Math.round(raw-def*K.defMitig));
const grace=(v)=> v>=70?{def:1.35,heal:1.30}: v>=40?{def:1.15,heal:1.15}:{def:1,heal:1};

function spawn(id,diff,ov={}){ const b={...ENEMIES[id],...ov},sm=DIFF[diff].enemyStatMult;
  return {id,maxHp:Math.round(b.maxHp*sm),hp:Math.round(b.maxHp*sm),power:Math.round(b.power*sm),
          defense:Math.round(b.defense*sm),speed:b.speed,dodge:b.dodge,damageMult:DIFF[diff].enemyDamageMult}; }

// generic finale runner. style: 'masher' | 'tactician'. T = tuning knobs.
function finale(p, diff, style, T){
  const g = style==='tactician' ? grace(70) : grace(0);
  const eff = { maxHp:p.maxHp, power:p.power, spirit:p.spirit,
                defense:Math.round(p.defense*g.def), speed:p.speed, dodge:p.dodge, heal:g.heal };
  const phases = [ {id:'grey_sovereign'}, {id:'city_despair', ov:{power:T.p2Power, maxHp:T.p2Hp}} ];
  let hp=eff.maxHp, potions=2, rounds=0, assistsLeft = T.assistOncePerFight?1:Infinity;
  for(let pi=0; pi<phases.length; pi++){
    const e = spawn(phases[pi].id, diff, phases[pi].ov||{});
    let pturn = !(e.speed>eff.speed);
    let blind=0, defendT=0, stag=0, assistUsedThisPhase=false, opened=false;
    while(hp>0 && e.hp>0 && rounds<1500){
      rounds++;
      if(pturn){
        const low = hp < eff.maxHp*0.40;
        if(style==='tactician'){
          if(!opened && defendT===0){ defendT=2; opened=true; }            // ward open
          else if(low && potions>0){ hp=Math.min(eff.maxHp,hp+20); potions--; }
          else if(low){ const h=Math.max(1,Math.round((eff.maxHp*0.30+eff.spirit)*eff.heal)); hp=Math.min(eff.maxHp,hp+h); } // mend
          else if(stag===0 && rnd()<0.5){ if(rnd()>=dodge(e.dodge)){ e.hp=Math.max(0,e.hp-dad(Math.round(eff.spirit*2.0),e.defense)); if(e.hp>0)stag=1; } } // true strike
          else { if(rnd()>=dodge(e.dodge)){ e.hp=Math.max(0,e.hp-dad(Math.round(eff.spirit*1.3),e.defense)); if(e.hp>0)blind=0.7; } } // radiance
        } else { // masher: light bolt + potions only
          if(low && potions>0){ hp=Math.min(eff.maxHp,hp+20); potions--; }
          else if(rnd()>=dodge(e.dodge)) e.hp=Math.max(0,e.hp-dad(Math.round(eff.spirit*1.6),e.defense));
        }
        if(e.hp<=0)break;
      } else {
        if(!assistUsedThisPhase && assistsLeft>0 && hp<=Math.round(eff.maxHp*0.4)){
          assistUsedThisPhase=true; assistsLeft--;
          hp=Math.min(eff.maxHp, hp+Math.max(1,Math.round(eff.maxHp*T.assistHealPct)));
          stag=Math.max(stag,1);
        }
        if(stag>0){ stag=0; }
        else {
          const b=blind; blind=0; const d = defendT>0?0.5:0; if(defendT>0)defendT--;
          if(rnd()<dodge(eff.dodge) || (b>0 && rnd()<b)){ /*miss*/ }
          else { let dmg=dad(e.power*e.damageMult, eff.defense); if(d>0)dmg=Math.max(1,Math.round(dmg*(1-d))); hp=Math.max(0,hp-dmg); }
        }
        if(hp<=0)break;
      }
      pturn=!pturn;
    }
    if(hp<=0)return false;
  }
  return true;
}
function rate(p,diff,style,T,n=6000){ let w=0; for(let i=0;i<n;i++) if(finale(p,diff,style,T))w++; return w/n; }

// realistic finale-entry stats (post boss4)
const ENTRY = { maxHp:57, power:17, spirit:29, defense:12, speed:18, dodge:30 };
const BASE = ENEMIES.city_despair; // power 26, hp 240

if(require.main===module){
  const diff='normal';
  console.log(`\n=== Finale tuning sweep (NORMAL, entry stats spi29 dge30 hp57 def12) ===`);
  console.log(`Target: masher ~40-55%, tactician >=85%  → a real skill gap\n`);

  const current = { assistHealPct:0.25, assistOncePerFight:false, p2Power:BASE.power, p2Hp:BASE.maxHp };
  console.log('CURRENT config:');
  console.log(`   masher ${(rate(ENTRY,diff,'masher',current)*100).toFixed(0)}%   tactician ${(rate(ENTRY,diff,'tactician',current)*100).toFixed(0)}%   gap ${((rate(ENTRY,diff,'tactician',current)-rate(ENTRY,diff,'masher',current))*100).toFixed(0)}pts\n`);

  console.log('Candidate tunings:');
  const cands = [
    { name:'assist 0.25→0.12',                       T:{...current, assistHealPct:0.12} },
    { name:'assist once-per-fight (not per phase)',   T:{...current, assistOncePerFight:true} },
    { name:'P2 power 26→31',                          T:{...current, p2Power:31} },
    { name:'P2 power 26→30 + assist 0.15',            T:{...current, p2Power:30, assistHealPct:0.15} },
    { name:'P2 power 31 + hp 240→280 + assist 0.15',  T:{...current, p2Power:31, p2Hp:280, assistHealPct:0.15} },
    { name:'P2 power 32 + assist 0.12 + once-only',   T:{...current, p2Power:32, assistHealPct:0.12, assistOncePerFight:true} },
  ];
  console.log('tuning                                    masher  tactician  gap');
  for(const c of cands){
    const m=rate(ENTRY,diff,'masher',c.T), t=rate(ENTRY,diff,'tactician',c.T);
    const flag = (m>=0.35 && m<=0.58 && t>=0.85) ? '  ◀ SKILL CHECK' : '';
    console.log(`${c.name.padEnd(42)} ${(m*100).toFixed(0).padStart(4)}%   ${(t*100).toFixed(0).padStart(5)}%   ${((t-m)*100).toFixed(0).padStart(3)}pts${flag}`);
  }
}

// --- finer dial-in: target masher ~48-55% (learn-your-kit, not a rage loop) ---
if(require.main===module){
  const diff='normal';
  const cur={assistHealPct:0.25,assistOncePerFight:false,p2Power:26,p2Hp:240};
  console.log('\nFine dial-in (target masher ~48-55%, tactician >=90%):');
  console.log('tuning                                    masher  tactician  gap');
  const fine=[
    { name:'assist 0.25→0.15',                 T:{...cur, assistHealPct:0.15} },
    { name:'assist 0.18 + P2 power 28',        T:{...cur, assistHealPct:0.18, p2Power:28} },
    { name:'assist 0.15 + P2 power 28',        T:{...cur, assistHealPct:0.15, p2Power:28} },
    { name:'assist 0.18 + P2 power 29',        T:{...cur, assistHealPct:0.18, p2Power:29} },
  ];
  for(const c of fine){
    const m=rate(ENTRY,diff,'masher',c.T,9000), t=rate(ENTRY,diff,'tactician',c.T,9000);
    const flag=(m>=0.46 && m<=0.57 && t>=0.90)?'  ◀ RECOMMENDED':'';
    console.log(`${c.name.padEnd(42)} ${(m*100).toFixed(0).padStart(4)}%   ${(t*100).toFixed(0).padStart(5)}%   ${((t-m)*100).toFixed(0).padStart(3)}pts${flag}`);
  }
}
