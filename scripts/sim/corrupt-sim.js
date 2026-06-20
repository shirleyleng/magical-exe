// MAGICAL.EXE — corrupt-build skilled combat model (alignment path B).
// Kit (per config.js + combat.js):
//   burst (innate corrupt move): power*1.6 dmg, +8 corruption/use
//   drain  : spirit*1.2 lifesteal, heal 50% of dmg dealt   (learn reqCorruption 40)
//   true strike (awakened, neutral): spirit*2.0 + stagger 1 turn
//   guard (innate): halve incoming this turn
// Corruption warp: power *1.10(@40)/*1.25(@70), maxHp *0.95/*0.85. NO grace boon
// (that's the virtue path) — corrupt trades defense/sustain control for raw power
// + lifesteal. A corrupt player runs hot on corruption, so warp is ~always on.

const { ENEMIES, DIFF } = require('./combat-sim.js');
const K = { dodgePerPoint:0.015, dodgeCap:0.5, defMitig:0.8, guardMitig:0.5, burstMult:1.6 };
const rnd = () => Math.random();
const dodgeChance = (d) => Math.min(K.dodgeCap, d * K.dodgePerPoint);
const dmgAfterDef = (raw, def) => Math.max(1, Math.round(raw - def * K.defMitig));

function warpFor(c){ if(c>=70)return{power:1.25,hp:0.85}; if(c>=40)return{power:1.10,hp:0.95}; return{power:1,hp:1}; }
function effective(p){
  const w = warpFor(p.corruption||0);
  return { maxHp:Math.max(1,Math.round(p.maxHp*w.hp)), power:Math.max(1,Math.round(p.power*w.power)),
           spirit:Math.max(1,p.spirit), defense:Math.max(0,p.defense), speed:p.speed, dodge:p.dodge };
}
function spawn(id,diff){ const b=ENEMIES[id],sm=DIFF[diff].enemyStatMult;
  return {id,maxHp:Math.round(b.maxHp*sm),hp:Math.round(b.maxHp*sm),power:Math.round(b.power*sm),
          defense:Math.round(b.defense*sm),speed:b.speed,dodge:b.dodge,damageMult:DIFF[diff].enemyDamageMult}; }

function engage(player, phaseIds, diff, opts={}){
  const eff = effective(player);
  const awakened = !!opts.awakened;
  let hp = eff.maxHp, potions = opts.potions||0, rounds=0;
  for(let pi=0; pi<phaseIds.length; pi++){
    const e = spawn(phaseIds[pi], diff);
    let playerTurn = !(e.speed > eff.speed);
    let stagger=0, guard=false, assistUsed=false;
    while(hp>0 && e.hp>0 && rounds<1500){
      rounds++;
      if(playerTurn){
        const lowHp = hp < eff.maxHp*0.45; // corrupt has no ward; leans on drain/guard when low
        if(lowHp && potions>0){ hp=Math.min(eff.maxHp,hp+20); potions--; }
        else if(lowHp){
          // drain: lifesteal heal (also chip damage)
          if(rnd()>=dodgeChance(e.dodge)){
            const dmg=dmgAfterDef(Math.round(eff.spirit*1.2), e.defense);
            e.hp=Math.max(0,e.hp-dmg);
            hp=Math.min(eff.maxHp, hp+Math.max(1,Math.round(dmg*0.5)));
          }
        }
        else if(awakened && stagger===0 && rnd()<0.4){
          if(rnd()>=dodgeChance(e.dodge)){ e.hp=Math.max(0,e.hp-dmgAfterDef(Math.round(eff.spirit*2.0),e.defense)); if(e.hp>0)stagger=1; }
        }
        else {
          // burst: heavy power hit (corruption already maxed, warp baked into eff.power)
          if(rnd()>=dodgeChance(e.dodge)) e.hp=Math.max(0,e.hp-dmgAfterDef(Math.round(eff.power*K.burstMult),e.defense));
        }
        if(e.hp<=0)break;
      } else {
        if(opts.finale && !assistUsed && hp<=Math.round(eff.maxHp*0.4)){ assistUsed=true; hp=Math.min(eff.maxHp,hp+Math.max(1,Math.round(eff.maxHp*0.18))); stagger=Math.max(stagger,1); }
        if(stagger>0){ stagger=0; }
        else if(rnd()>=dodgeChance(eff.dodge)){
          let dmg=dmgAfterDef(e.power*e.damageMult, eff.defense);
          if(guard)dmg=Math.max(1,Math.round(dmg*K.guardMitig));
          hp=Math.max(0,hp-dmg);
        }
        guard=false;
        if(hp<=0)break;
      }
      playerTurn=!playerTurn;
    }
    if(hp<=0)return {win:false,phaseReached:pi+1,rounds};
  }
  return {win:true,rounds,hpLeft:hp};
}
function wr(player,ids,diff,trials,opts){ let w=0; for(let i=0;i<trials;i++) if(engage(player,ids,diff,opts).win)w++; return w/trials; }
module.exports={engage,wr,effective};

if(require.main===module){
  const { wr:wrV } = require('./skilled-sim.js');     // virtuous kit
  const diff = process.argv[2]||'normal';
  console.log(`\n=== Alignment path comparison (${diff}) — same raw stats, different kit ===`);
  console.log(`  corrupt = burst(power*1.6, warp +power/-hp) + drain lifesteal`);
  console.log(`  virtuous = radiance(blind) + ward + mend + grace boon\n`);
  // matched raw stats at finale entry; corrupt runs corruption 70 (warp), virtuous virtue 70 (grace)
  const raw = { maxHp:57, power:24, spirit:24, defense:12, speed:18, dodge:30 };
  const corruptB  = { ...raw, corruption:70, virtue:0 };
  const virtuousB = { ...raw, corruption:0, virtue:70 };
  const sets = {
    'boss3 hour_warden':  ['hour_warden'],
    'boss4 grief_herald': ['grief_herald'],
    'FINALE (2-phase)':   ['grey_sovereign','city_despair'],
  };
  console.log('fight                  corrupt-kit   virtuous-kit');
  for(const [name,ids] of Object.entries(sets)){
    const fin=ids.length>1, awk = ids[0]==='grief_herald'||fin;
    const c = wr(corruptB, ids, diff, 6000, {awakened:awk,potions:2,finale:fin});
    const v = wrV(virtuousB, ids, diff, 6000, {awakened:awk,potions:2,finale:fin});
    console.log(`${name.padEnd(22)} ${(c*100).toFixed(1).padStart(6)}%      ${(v*100).toFixed(1).padStart(6)}%`);
  }
}
