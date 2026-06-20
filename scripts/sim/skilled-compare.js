// side-by-side: skilled-virtuous kit vs no-ability baseline at IDENTICAL stats
const { wr } = require('./skilled-sim.js');
const { winRate, finaleWinRate } = require('./combat-sim.js');
const builds = {
  'boss1 grove_warden':   { b:{maxHp:30,power:6,spirit:10,defense:4,speed:8,dodge:11,virtue:30,corruption:0}, ids:['grove_warden'] },
  'boss2 tideheart':      { b:{maxHp:45,power:8,spirit:15,defense:6,speed:9,dodge:12,virtue:45,corruption:0}, ids:['tideheart_wraith'] },
  'boss3 hour_warden':    { b:{maxHp:48,power:9,spirit:20,defense:8,speed:11,dodge:20,virtue:55,corruption:0}, ids:['hour_warden'] },
  'boss4 grief_herald':   { b:{maxHp:57,power:17,spirit:29,defense:12,speed:18,dodge:30,virtue:70,corruption:0}, ids:['grief_herald'] },
  'FINALE (2-phase)':     { b:{maxHp:57,power:17,spirit:29,defense:12,speed:18,dodge:30,virtue:70,corruption:0}, ids:['grey_sovereign','city_despair'] },
};
for(const diff of ['normal']){
  console.log(`### ${diff.toUpperCase()} — same stats, with vs without tactical abilities`);
  console.log('fight                  no-abilities   skilled-kit   delta');
  for(const [name,{b,ids}] of Object.entries(builds)){
    const fin = ids.length>1;
    const base = fin?finaleWinRate(b,diff,6000,{useBolt:true,potions:2}):winRate(b,ids[0],diff,6000,{useBolt:true,potions:2});
    const skill = wr(b,ids,diff,6000,{awakened: ids[0]==='grief_herald'||fin, potions:2, finale:fin});
    const d = ((skill-base)*100);
    console.log(`${name.padEnd(22)} ${(base*100).toFixed(1).padStart(6)}%      ${(skill*100).toFixed(1).padStart(6)}%   ${d>=0?'+':''}${d.toFixed(1)}pts`);
  }
}
