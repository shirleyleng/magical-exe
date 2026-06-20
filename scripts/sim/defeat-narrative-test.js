/* Integration test for the post-defeat "warp home" narrative (combat.js).
   Run: node scripts/sim/defeat-narrative-test.js
   Drives a real fight to a loss and inspects the scrollback. */
import assert from "node:assert";
import { freshModel, createState } from "../../src/state.js";
import { startCombat, playerAttack } from "../../src/combat.js";

let pass = 0;
const ok = (name) => { pass++; console.log(`  ✓ ${name}`); };

function mkState(mutate) {
  const model = freshModel();
  model.character.created = true;
  model.character.name = "Test";
  model.mode = "hub";
  model.mascot = { name: "Pip", present: true, injured: false, dimmed: false };
  // Glass jaw, no punch: the player can't win and dies fast → deterministic defeat.
  model.character.stats.hp = 1;
  model.character.stats.maxHp = 40;
  model.character.stats.power = 0;
  model.character.stats.dodge = 0;
  if (mutate) mutate(model);
  return createState(model);
}

/* Throw the player into a fight and attack until it resolves back out of combat. */
function fightToDefeat(s) {
  s = startCombat(s, "dust_sprite", { returnMode: "hub", fromSlot: true });
  for (let i = 0; i < 60 && s.model.mode === "combat"; i++) s = playerAttack(s);
  return s;
}
const logText = (s) => s.log.map((l) => l.text).join("\n");

// ---- 1. Companion present: warp beat + a companion-flavored wake ----
console.log("Companion present:");
{
  const s = fightToDefeat(mkState());
  assert.strictEqual(s.model.mode, "hub", "returned to the hub after defeat");
  const t = logText(s);
  assert.ok(/magic|light|spell|transformation/i.test(t), "a magical warp-home beat is told");
  assert.ok(/Pip/.test(t), "the companion (Pip) is part of the landing");
  assert.ok(s.model.character.stats.hp >= 1, "you wake alive (hp >= 1)");
  ok("defeat warps you home with the companion catching you");
}

// ---- 2. Companion gone: the lonely wake, no companion named ----
console.log("Companion gone:");
{
  const s = fightToDefeat(mkState((m) => {
    m.world.flags.mascotGone = true;
    m.mascot.present = false;
  }));
  const t = logText(s);
  assert.ok(/alone|empty|no one|quiet/i.test(t), "the wake reads as lonely");
  assert.ok(!/Pip/.test(t), "the missing companion is NOT named in the lonely wake");
  ok("defeat lands in an empty house when the companion is gone");
}

// ---- 3. Variety: the wake line doesn't repeat back-to-back ----
console.log("Variety:");
{
  let s = mkState();
  const wakes = [];
  for (let n = 0; n < 4; n++) {
    s.model.character.stats.hp = 1; // reset the glass jaw each round
    s = fightToDefeat(s);
    // the wake is the longest non-hint line mentioning the companion or solitude
    const w = s.log.filter((l) => l.kind === "system" && /Pip|alone|empty|floor|home/i.test(l.text)).pop();
    if (w) wakes.push(w.text);
    s.log.length = 0;
  }
  let repeats = 0;
  for (let i = 1; i < wakes.length; i++) if (wakes[i] === wakes[i - 1]) repeats++;
  assert.strictEqual(repeats, 0, "no wake line repeats immediately");
  ok("the wake line varies across consecutive defeats");
}

console.log(`\n${pass} checks passed.`);
