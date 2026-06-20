/* Integration test for the finale music carry-through + end-game credits.
   Run: node scripts/sim/finale-credits-test.js */
import assert from "node:assert";
import { freshModel, createState } from "../../src/state.js";
import { handleFinaleResolve, resolveBrink } from "../../src/endgame.js";
import { sceneForModel } from "../../src/music.js";
import { update } from "../../src/update.js";
import { ART } from "../../src/mascot.js";

let pass = 0;
const ok = (n) => { pass++; console.log(`  ✓ ${n}`); };
const logText = (s) => s.log.map((l) => l.text).join("\n");

function atBrink(mutate) {
  const m = freshModel();
  m.character.created = true;
  m.character.name = "Tess";
  m.character.transformationTier = "awakened";
  m.character.path = "virtuous";
  m.character.hopeTally = 999;
  m.character.fame = 50;
  m.mascot = { name: "Roro", present: true, injured: false, dimmed: false, artKeySmall: "catflick_small", artKeyLarge: "catflick_large" };
  m.mode = "hub";
  if (mutate) mutate(m);
  const s = createState(m);
  s.ui.finaleResolve = true;
  return handleFinaleResolve(s);
}

// ---- 1. Finale music carries through the brink (mode is hub by now) ----
console.log("Finale music:");
{
  const s = atBrink();
  assert.strictEqual(s.model.world.flags.finaleActive, true, "finaleActive armed at the brink");
  assert.strictEqual(sceneForModel(s.model), "finale", "music stays on finale at the brink (not hub)");
  ok("the finale theme holds through the brink instead of flipping to the hub track");
}

// ---- 2. Virtuous Ascension → ascended, credits + Ko-fi, music still finale ----
console.log("Win + credits:");
{
  const s = atBrink();
  resolveBrink(s, "hope");
  const t = logText(s);
  assert.ok(/VIRTUOUS ASCENSION/.test(t), "the best ending plays");
  assert.strictEqual(s.model.world.flags.ascended, true, "flagged ascended");
  assert.strictEqual(s.model.mascot.present, true, "companion present in its deity form");
  assert.ok(/CREDITS/.test(t), "credits roll");
  assert.ok(/ko-fi\.com\/shirleyleng/.test(t), "with the Ko-fi support link");
  assert.strictEqual(sceneForModel(s.model), "finale", "finale music holds through the ending");
  ok("Virtuous Ascension ascends, rolls credits + Ko-fi, keeps finale music");
}

// ---- 3. Next command hands music back to the hub ----
console.log("Hand-off:");
{
  const s = atBrink();
  resolveBrink(s, "hope");
  const s2 = update(s, { type: "input", text: "status" });
  assert.strictEqual(s2.model.world.flags.finaleActive, false, "next command clears finaleActive");
  assert.strictEqual(sceneForModel(s2.model), "hub", "music returns to the hub");
  ok("the player's next command returns the music to the hub");
}

// ---- 4. Even a non-ascension ending shows credits ----
console.log("Tragedy credits:");
{
  const s = atBrink((m) => { m.character.hopeTally = 0; }); // not enough hope
  resolveBrink(s, "hope");
  const t = logText(s);
  assert.ok(/A QUIET ENDURING/.test(t), "the quiet ending plays");
  assert.ok(/CREDITS/.test(t) && /ko-fi/.test(t), "credits + Ko-fi shown there too");
  ok("non-ascension endings also roll credits");
}

// ---- 5. The mascot's deity art exists (god-tier panel source) ----
console.log("God-tier art:");
{
  assert.ok(ART.catflick_deity && /♡/.test(ART.catflick_deity), "per-base deity art present for the panel");
  ok("the end-game panel has a deity form to show");
}

console.log(`\n${pass} checks passed.`);
