/* Integration test for the Awakened-arc polish:
   - the awakened weapon's flavour names the toy ({weapon} token)
   - the Boss #4 rematch gets an Awakened encouragement (not the story-loss warning)
   - you can shake Sable's offered hand (once)
   - the hub-return praise points at train + spar ability unlocks
   - the Misted Place music scenes resolve (misted → reunion)
   Run: node scripts/sim/awakened-arc-test.js */
import assert from "node:assert";
import { freshModel, createState } from "../../src/state.js";
import { startCombat, combatUse } from "../../src/combat.js";
import { moveDir } from "../../src/explore.js";
import { maybeMascotReturnPraise } from "../../src/hub.js";
import { update } from "../../src/update.js";
import { sceneForModel } from "../../src/music.js";

let pass = 0;
const ok = (n) => { pass++; console.log(`  ✓ ${n}`); };
const logText = (s) => s.log.map((l) => l.text).join("\n");

function awakened(extra) {
  const m = freshModel();
  m.character.created = true;
  m.character.name = "Tess";
  m.character.transformationTier = "awakened";
  m.character.abilities = ["light bolt", "guard", "true strike"];
  m.character.magicalWeapon = { fromToy: "PS Vita", object: "a shard of pure, humming light", found: true };
  m.character.stats.spirit = 30;
  m.character.stats.stamina = m.character.stats.maxStamina;
  m.mascot = { name: "Roro", present: true, injured: false, dimmed: false };
  m.world.flags.mascotRecovered = true;
  if (extra) extra(m);
  return createState(m);
}

// ---- 1. Awakened weapon flavour names the toy ----
console.log("Weapon flavour:");
{
  const s = startCombat(awakened(), "grief_herald", { returnMode: "exploration", returnRoom: "spire_apex", bossId: "boss4" });
  combatUse(s, "true strike");
  const t = logText(s);
  assert.ok(/awakened weapon/.test(t), "names it the awakened weapon");
  assert.ok(/the PS Vita/.test(t), "and weaves in the actual toy noun");
  ok("true strike flavour reads 'your awakened weapon — the PS Vita —'");
}

// ---- 2. Boss #4 rematch: Awakened encouragement, not the doom warning ----
console.log("Spire rematch:");
{
  const s = awakened((m) => {
    m.mode = "exploration";
    m.world.currentLocation = "spire";
    m.world.currentRoom = "spire_landing";
  });
  moveDir(s, "up"); // into the Weeping Apex → boss4
  const t = logText(s);
  assert.ok(/AWAKENED/.test(t), "the companion calls out your Awakening");
  assert.ok(/PS Vita/.test(t), "and names the weapon in hand");
  assert.ok(!/turn back|do NOT let it take you/.test(t), "no story-loss warning this time");
  assert.strictEqual(s.model.mode, "combat", "the winnable rematch begins");
  ok("the rematch gives an Awakened pep talk and starts the fight");
}

// ---- 3. Shake Sable's hand (once) ----
console.log("Handshake:");
{
  let s = awakened((m) => { m.mode = "hub"; m.world.flags.pendingHandshake = true; });
  s = update(s, { type: "input", text: "shake hand" });
  assert.ok(/Equals/.test(logText(s)), "the handshake beat plays");
  assert.strictEqual(s.model.world.flags.pendingHandshake, false, "the offer is consumed");
  assert.strictEqual(s.model.rivals[0].disposition, "respectful", "rival is now an equal");
  s.log.length = 0;
  s = update(s, { type: "input", text: "shake" });
  assert.ok(/No one's holding out a hand/.test(logText(s)), "shaking again does nothing");
  ok("you can shake Sable's hand, once");
}

// ---- 4. Hub-return praise points at train + spar ability unlocks ----
console.log("Return praise:");
{
  const s = awakened((m) => { m.mode = "hub"; m.world.flags.pendingReturnPraise = true; });
  maybeMascotReturnPraise(s);
  const t = logText(s);
  assert.ok(/true strike/i.test(t), "the companion names the trainable ability");
  assert.ok(/train/i.test(t) && /spar/i.test(t), "both train and spar are surfaced");
  assert.ok(/Sable|Roro/.test(t), "both characters speak");
  ok("the companion (train) and Sable (spar) both pitch new abilities");
}

// ---- 5. Misted Place music resolves; flips to reunion after recovery ----
console.log("Misted Place music:");
{
  const pre = freshModel(); pre.character.created = true; pre.mode = "exploration";
  pre.world.currentLocation = "secret"; pre.world.flags.mascotRecovered = false;
  assert.strictEqual(sceneForModel(pre), "misted-place", "before recovery → misted-place");
  pre.mode = "combat"; pre.combat = { enemy: { isBoss: true } };
  assert.strictEqual(sceneForModel(pre), "combat-secret", "the doubt fight → combat-secret (Mothlight Box)");
  const post = freshModel(); post.character.created = true; post.mode = "exploration";
  post.world.currentLocation = "secret"; post.world.flags.mascotRecovered = true;
  assert.strictEqual(sceneForModel(post), "reunion", "after recovery → reunion (Pastel Return)");
  ok("misted-place → combat-secret → reunion resolve correctly");
}

console.log(`\n${pass} checks passed.`);
