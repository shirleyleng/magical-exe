/* Integration test for the Misted Place / companion-recovery sequence.
   Run: node scripts/sim/secret-place-test.js
   Drives the real modules: room descriptions, weapon+mascot recovery,
   the post-clear "look", and Sable's hub-return praise. */
import assert from "node:assert";
import { freshModel, createState } from "../../src/state.js";
import { describeRoom, retreat } from "../../src/explore.js";
import { handleBossDefeat } from "../../src/progress.js";

let pass = 0;
const ok = (name) => { pass++; console.log(`  ✓ ${name}`); };
const logText = (s) => s.log.map((l) => l.text).join("\n");
const clear = (s) => { s.log.length = 0; };

function mkState() {
  const m = freshModel();
  m.character.created = true;
  m.character.name = "Tess";
  m.character.transformationTier = "knight";
  m.character.stats.stamina = m.character.stats.maxStamina;
  m.character.hopeTally = 999;
  m.character.magicalWeapon = { fromToy: "PS Vita", object: "a shard of pure, humming light", found: false };
  m.mascot = { name: "Roro", present: false, injured: true, dimmed: false };
  m.mode = "exploration";
  m.world.currentLocation = "secret";
  m.world.flags.secretPlaceUnlocked = true;
  m.world.flags.mascotGone = true;
  m.world.flags.sparringUnlocked = true;
  return createState(m);
}

// ---- 1. Pre-fight rooms name the player's toy + companion ----
console.log("Room descriptions name the toy:");
{
  const s = mkState();
  s.model.world.currentRoom = "secret_hollow";
  describeRoom(s);
  let t = logText(s);
  assert.ok(/PS Vita/.test(t), "the Remembering names the toy");
  assert.ok(/Roro/.test(t), "and the companion by name");
  assert.ok(!/a small object|a beloved old toy/.test(t), "no generic 'a small object'/'beloved old toy'");

  clear(s);
  s.model.world.currentRoom = "secret_heart";
  describeRoom(s);
  t = logText(s);
  assert.ok(/PS Vita/.test(t) && /worst doubt/.test(t), "the Still Heart names the toy and still has the doubt (uncleared)");
  ok("the Misted Place weaves in the toy + companion instead of generic text");
}

// ---- 2. Recovery names the toy; post-clear look reflects the revival ----
console.log("Recovery + post-clear look:");
{
  const s = mkState();
  s.model.world.currentRoom = "secret_heart";
  s.model.world.flags.bossesDefeated.push("secretPlace"); // combat marks this on the win
  s.ui.justDefeatedBoss = "secretPlace";
  handleBossDefeat(s);
  const rec = logText(s);
  assert.ok(/PS Vita/.test(rec), "the weapon-recovery line names the toy (not just a generic weapon)");
  assert.strictEqual(s.model.character.magicalWeapon.found, true, "weapon marked found");
  assert.strictEqual(s.model.mascot.present, true, "companion is back");
  assert.strictEqual(s.model.world.flags.mascotGone, false, "mascot-gone lifted (training reopens)");
  assert.strictEqual(s.model.world.flags.pendingReturnPraise, true, "Sable's return praise is armed");

  clear(s);
  describeRoom(s); // look around, post-clear
  const look = logText(s);
  assert.ok(!/worst doubt/.test(look), "the doubt is no longer described after the win");
  assert.ok(/at your side|yours again|mending/.test(look), "the look reflects the revived companion");
  ok("recovery names the toy and the post-clear look makes sense");
}

// ---- 3. Sable greets you at the hub, once, and walks the options ----
console.log("Sable's hub-return praise:");
{
  const s = mkState();
  s.model.world.currentRoom = "secret_heart";
  s.model.world.flags.bossesDefeated.push("secretPlace");
  s.ui.justDefeatedBoss = "secretPlace";
  handleBossDefeat(s);
  clear(s);

  retreat(s); // leave → back to the hub
  const t = logText(s);
  assert.ok(/Sable/.test(t), "Sable is there");
  assert.ok(/Roro/.test(t), "and praises you over the recovered companion");
  assert.ok(/train/i.test(t) && /spar/i.test(t), "and walks through train + spar options");
  assert.strictEqual(s.model.world.flags.pendingReturnPraise, false, "praise consumed");

  clear(s);
  retreat(s); // second time home — no repeat
  assert.ok(!/Sable/.test(logText(s)), "praise does not fire again");
  ok("Sable greets you once and explains train/spar");
}

console.log(`\n${pass} checks passed.`);
