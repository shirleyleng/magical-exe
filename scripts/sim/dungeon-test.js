/* Integration test for the fleshed-out Harbor & Clocktower (data + new logic).
   Run: node --experimental-default-type=module scripts/sim/dungeon-test.js
   Imports the REAL game modules (not the sim reimplementation). */
import assert from "node:assert";
import { CONFIG } from "../../config.js";
import { DUNGEONS, unlockedDungeons } from "../../src/dungeons.js";
import { ENEMIES } from "../../src/enemies.js";
import { freshModel } from "../../src/state.js";
import { enterDungeon, moveDir, takeItem } from "../../src/explore.js";
import { useItem } from "../../src/hub.js";

let pass = 0;
const ok = (name) => { pass++; console.log(`  ✓ ${name}`); };

function findItem(name) {
  return CONFIG.economy.shop.find((it) => it.id === name || it.name === name)
      || (CONFIG.economy.items || []).find((it) => it.id === name || it.name === name);
}

// ---- 1. Data integrity ----
console.log("Data integrity:");
for (const id of ["harbor", "clocktower"]) {
  const d = DUNGEONS[id];
  const roomCount = Object.keys(d.rooms).length;
  assert.strictEqual(roomCount, 5, `${id} should have 5 rooms, has ${roomCount}`);
  ok(`${id} has 5 rooms`);
  for (const [rid, r] of Object.entries(d.rooms)) {
    if (r.encounter) {
      assert.ok(ENEMIES[r.encounter.monster], `${rid} encounter monster "${r.encounter.monster}" missing from ENEMIES`);
      assert.ok(r.encounter.chance > 0 && r.encounter.chance <= 1, `${rid} bad chance`);
    }
    for (const it of (r.items || [])) {
      assert.ok(findItem(it), `${rid} item "${it}" has no definition (findItem)`);
    }
    for (const [dir, dest] of Object.entries(r.exits || {})) {
      assert.ok(d.rooms[dest], `${rid} exit ${dir} -> "${dest}" is not a real room`);
    }
  }
  ok(`${id}: all encounters/items/exits resolve`);
}
// dew vial is now usable
assert.ok(findItem("dew vial") && findItem("dew vial").type === "heal", "dew vial should be a heal item");
ok("dew vial resolves to a heal item (latent bug fixed)");
// signature items
assert.strictEqual(findItem("tideglass charm").type, "restore", "tideglass charm should be restore");
assert.strictEqual(findItem("stopped-hour cog").type, "restore", "stopped-hour cog should be restore");
ok("signature items (tideglass charm / stopped-hour cog) are restore-type");

// ---- 2. Unlock gating ----
console.log("Unlock gating:");
const mkState = (mutate) => {
  const model = freshModel();
  model.character.created = true;
  model.character.name = "Test";
  model.character.city = "Hollowvale";
  model.character.transformationTier = "soldier";
  model.character.stats.stamina = model.character.stats.maxStamina = 40;
  model.character.stats.hp = model.character.stats.maxHp = 60;
  model.world.flags.bossesDefeated = ["boss1"];
  if (mutate) mutate(model);
  return { model, log: [], ui: {} };
};
{
  const noBoss = freshModel();
  assert.ok(!unlockedDungeons(noBoss).some((d) => d.id === "harbor"), "harbor locked pre-boss1");
  const s = mkState();
  assert.ok(unlockedDungeons(s.model).some((d) => d.id === "harbor"), "harbor unlocked post-boss1");
  ok("harbor: locked pre-boss1, unlocked post-boss1");
}

// ---- 3. Exploration: lore beats fire once, peacefully (no encounters) ----
console.log("Exploration (Math.random pinned to 1 = no encounters):");
const realRandom = Math.random;
Math.random = () => 1; // make every `random < chance` false -> never spawns an encounter
try {
  const s = mkState();
  enterDungeon(s, "harbor"); // arrive at pier
  const textAfter = (n) => s.log.slice(n).map((l) => (typeof l === "string" ? l : l.text || "")).join("\n");
  const pierBeatFired = s.log.some((l) => (l.text || l).includes("guest list"));
  assert.ok(pierBeatFired, "pier lore beat should fire on arrival");
  ok("harbor pier lore beat fires on entry");

  // pier -> market -> chapel; chapel beat should fire
  moveDir(s, "north"); // market
  const beforeChapel = s.log.length;
  moveDir(s, "north"); // chapel
  const chapelBeat = s.log.slice(beforeChapel).some((l) => (l.text || l).includes("didn't drown by accident"));
  assert.ok(chapelBeat, "chapel lore beat should fire");
  ok("harbor chapel lore beat fires");

  // re-enter chapel -> beat must NOT repeat
  moveDir(s, "south"); // market
  const beforeReChapel = s.log.length;
  moveDir(s, "north"); // chapel again
  const repeated = s.log.slice(beforeReChapel).some((l) => (l.text || l).includes("didn't drown by accident"));
  assert.ok(!repeated, "chapel beat must not repeat");
  ok("lore beats latch (no repeat)");

  // roomBeats flag recorded
  assert.ok(s.model.world.flags.roomBeats.includes("harbor_chapel"), "roomBeats should record harbor_chapel");
  ok("roomBeats flag records visited beats");

  // side room: signature item present, takeable
  const s2 = mkState();
  enterDungeon(s2, "harbor");
  moveDir(s2, "north"); // market
  moveDir(s2, "east");  // tidepool (side) — random pinned to 1 so guardian doesn't spawn
  takeItem(s2, "tideglass");
  assert.ok(s2.model.character.inventory.includes("tideglass charm"), "should pick up tideglass charm");
  ok("signature loot is in the side room and takeable");
} finally {
  Math.random = realRandom;
}

// ---- 4. useItem: dew vial heals, restore items restore ----
console.log("useItem effects:");
{
  const s = mkState((m) => { m.character.stats.hp = 10; m.character.inventory = ["dew vial"]; });
  useItem(s, "dew vial");
  assert.strictEqual(s.model.character.stats.hp, 22, "dew vial should heal 12 (10 -> 22)");
  assert.ok(!s.model.character.inventory.includes("dew vial"), "dew vial consumed");
  ok("use dew vial heals 12 and is consumed");
}
{
  const s = mkState((m) => { m.character.stats.hp = 10; m.character.stats.stamina = 5; m.character.inventory = ["tideglass charm"]; });
  useItem(s, "tideglass charm");
  assert.strictEqual(s.model.character.stats.hp, 40, "tideglass +30 HP (10 -> 40)");
  assert.strictEqual(s.model.character.stats.stamina, 17, "tideglass +12 Stamina (5 -> 17)");
  ok("use tideglass charm restores HP+Stamina");
}
{
  const s = mkState((m) => { m.character.stats.hp = 10; m.character.stats.stamina = 2; m.character.inventory = ["stopped-hour cog"]; });
  useItem(s, "stopped-hour cog");
  assert.strictEqual(s.model.character.stats.stamina, s.model.character.stats.maxStamina, "cog refills Stamina to full");
  ok("use stopped-hour cog refills Stamina to full");
}

console.log(`\nALL ${pass} CHECKS PASSED ✦`);
