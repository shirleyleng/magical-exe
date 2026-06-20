/* Integration test: repeatable spar menu + Spire re-entry block (T20 follow-ups).
   Run: node scripts/sim/companion-flow-test.js   (ESM auto-detected) */
import assert from "node:assert";
import { freshModel, createState } from "../../src/state.js";
import { openSparMenu, handleHubMenu, visitAlliance } from "../../src/hub.js";
import { enterDungeon } from "../../src/explore.js";

let pass = 0;
const ok = (name) => { pass++; console.log(`  ✓ ${name}`); };

function mkState(mut) {
  const m = freshModel();
  m.character.created = true;
  m.character.name = "Test";
  m.mode = "hub";
  if (mut) mut(m);
  return createState(m);
}

// ---- 1. Spar menu repeats after each spar ----
console.log("Spar repeat:");
{
  const s = mkState((m) => {
    m.world.flags.sparringUnlocked = true;
    m.hub.slotsMax = 8;
  });
  openSparMenu(s);
  assert.ok(s.ui.menu && s.ui.menu.kind === "spar", "spar menu opens");
  // Pick Power (index 0) three times — the menu should re-open each time.
  for (let i = 0; i < 3; i++) {
    const opt = s.ui.menu.options[0];
    handleHubMenu(s, "spar", opt);
    assert.ok(s.ui.menu && s.ui.menu.kind === "spar", `menu re-opens after spar #${i + 1}`);
  }
  ok("the spar menu re-offers itself after each spar (no retyping)");

  // Choosing "Done sparring" closes it.
  const cancel = s.ui.menu.options.find((o) => o.value === "__cancel__");
  handleHubMenu(s, "spar", cancel);
  assert.strictEqual(s.ui.menu, null, "‘Done sparring’ closes the menu");
  ok("‘Done sparring’ exits cleanly");
}

// ---- 2. Spar menu stops re-opening when slots run out ----
console.log("Spar slot exhaustion:");
{
  const s = mkState((m) => { m.world.flags.sparringUnlocked = true; });
  // Leave exactly one slot free (slotsMax is recomputed from stamina, so spend via used).
  const max = s.model.hub.slotsMax;
  s.model.hub.slotsUsedToday.combat = max - 1;
  openSparMenu(s);
  assert.ok(s.ui.menu && s.ui.menu.kind === "spar", "opens with the last slot");
  handleHubMenu(s, "spar", s.ui.menu.options[0]); // spends the last slot
  assert.strictEqual(s.ui.menu, null, "does NOT re-open when out of slots");
  assert.ok(s.log.some((l) => /last of the day|rest, then spar/i.test(l.text)), "tells the player they're spent");
  ok("the loop ends itself when the day's slots are gone");
}

// ---- 3. Spire is blocked while the companion is gone ----
console.log("Spire block:");
{
  const s = mkState((m) => {
    m.world.flags.mascotGone = true;
    m.world.flags.boss4Attempted = true; // (always true once mascotGone in real play)
    m.mascot = { name: "Pip" };
    m.character.stats.stamina = 20;
  });
  enterDungeon(s, "spire");
  assert.strictEqual(s.model.mode, "hub", "you do NOT enter the spire (still at the hub)");
  assert.ok(s.ui.menu && s.ui.menu.kind === "spireBlock", "an alliance-or-turn-back menu is offered");
  assert.ok(s.log.some((l) => /Pip/.test(l.text)), "the block names your companion");
  ok("blocked from re-entering the spire while the companion is gone");

  // Picking the alliance routes to visitAlliance (unlocks the secret place).
  const allyOpt = s.ui.menu.options.find((o) => o.value === "alliance");
  handleHubMenu(s, "spireBlock", allyOpt);
  assert.strictEqual(s.model.world.flags.secretPlaceUnlocked, true, "alliance call unlocks the secret place");
  ok("the offered alliance option reaches out and opens the recovery path");
}

// ---- 4. Once recovered, the spire opens again ----
console.log("Spire re-opens after recovery:");
{
  const s = mkState((m) => {
    m.world.flags.mascotGone = false; // recovered (recoverWeaponAndMascot clears it)
    m.mascot = { name: "Pip", present: true };
    m.character.stats.stamina = 20;
  });
  enterDungeon(s, "spire");
  assert.strictEqual(s.model.mode, "exploration", "with the companion back, you can enter for the rematch");
  assert.ok(!(s.ui.menu && s.ui.menu.kind === "spireBlock"), "no block menu after recovery");
  ok("the block lifts once the companion is recovered (winnable rematch)");
}

// ---- 5. Other dungeons are never blocked ----
console.log("Other dungeons unaffected:");
{
  const s = mkState((m) => {
    m.world.flags.mascotGone = true;
    m.mascot = { name: "Pip" };
    m.character.stats.stamina = 20;
  });
  enterDungeon(s, "forest");
  assert.strictEqual(s.model.mode, "exploration", "the forest still lets you in");
  ok("the block is specific to the spire, not all exploration");
}

console.log(`\n${pass} checks passed.`);
