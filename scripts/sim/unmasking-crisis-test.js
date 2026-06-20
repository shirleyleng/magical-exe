/* Integration test for the T20 Unmasking reveal-or-hide crisis.
   Run: node scripts/sim/unmasking-crisis-test.js   (ESM auto-detected)
   Imports the REAL game modules (not a sim reimplementation). */
import assert from "node:assert";
import { CONFIG } from "../../config.js";
import { freshModel, createState } from "../../src/state.js";
import { adjustVisibility, checkUnmaskingEvents } from "../../src/visibility.js";
import { effHopeThreshold } from "../../src/endgame.js";
import { maybeUnmaskingCrisis, resolveUnmaskingCrisis } from "../../src/unmaskingcrisis.js";

let pass = 0;
const ok = (name) => { pass++; console.log(`  ✓ ${name}`); };

/* A hub-mode state for a created character, with optional mutation. */
function mkState(mutate) {
  const model = freshModel();
  model.character.created = true;
  model.character.name = "Test";
  model.mode = "hub";
  if (mutate) mutate(model);
  return createState(model);
}

/* Drive the high-tier event the way combat.js does: a public win pushes Unmasking
   over the top threshold, then checkUnmaskingEvents fires. */
function crossHigh(s) {
  const ch = s.model.character;
  ch.fame = 10;
  ch.unmasking = CONFIG.axes.unmasking.thresholds.high - 2; // 83
  adjustVisibility(ch, { unmasking: 6 });                   // → 89, into `high`
  checkUnmaskingEvents(s);
  return s;
}

// ---- 1. Crossing high arms the crisis (and does NOT fire it mid-combat) ----
console.log("Arming:");
{
  const s = crossHigh(mkState());
  const ch = s.model.character;
  assert.strictEqual(ch.unmaskingTierSeen, "high", "tier latched to high");
  assert.strictEqual(ch.pendingUnmaskingCrisis, true, "crisis armed");
  assert.strictEqual(ch.mustLieLow, true, "lie-low lock also set");
  assert.strictEqual(s.model.world.flags.unmaskingCrisisSeen, false, "not yet latched as seen (only on resolve)");
  ok("crossing high arms pendingUnmaskingCrisis + mustLieLow, leaves the one-shot un-latched");
}

// ---- 2. The menu surfaces at the hub; never mid-combat ----
console.log("Surfacing:");
{
  const s = crossHigh(mkState());
  s.model.mode = "combat";                 // pretend we're still resolving the fight
  maybeUnmaskingCrisis(s);
  assert.ok(!s.ui.menu, "no menu while mode is combat");
  s.model.mode = "hub";
  maybeUnmaskingCrisis(s);
  assert.ok(s.ui.menu && s.ui.menu.active && s.ui.menu.kind === "unmaskingcrisis", "menu surfaces at the hub");
  assert.strictEqual(s.model.character.pendingUnmaskingCrisis, false, "pending flag consumed on surface");
  ok("crisis surfaces only at the hub, with kind:unmaskingcrisis");
}

// ---- 3. Path gating of the third option ----
console.log("Path gating:");
{
  // path is DERIVED from the virtue/corruption gap (createState recomputes it),
  // so seed the meters rather than the path string.
  const balanced = maybeUnmaskingCrisis(crossHigh(mkState()));
  assert.strictEqual(balanced.model.character.path, "balanced", "neutral meters → balanced");
  assert.strictEqual(balanced.ui.menu.options.length, 2, "balanced → 2 options");
  ok("balanced path → reveal / hide only");

  const virtuous = maybeUnmaskingCrisis(crossHigh(mkState((m) => { m.character.virtue = 60; })));
  assert.strictEqual(virtuous.model.character.path, "virtuous", "high virtue → virtuous");
  assert.strictEqual(virtuous.ui.menu.options.length, 3, "virtuous → 3 options");
  assert.strictEqual(virtuous.ui.menu.options[2].value, "cloud", "virtuous third = cloud");
  ok("virtuous path → adds 'cloud their memory'");

  const corrupt = maybeUnmaskingCrisis(crossHigh(mkState((m) => { m.character.corruption = 60; })));
  assert.strictEqual(corrupt.model.character.path, "corrupt", "high corruption → corrupt");
  assert.strictEqual(corrupt.ui.menu.options.length, 3, "corrupt → 3 options");
  assert.strictEqual(corrupt.ui.menu.options[2].value, "silence", "corrupt third = silence");
  ok("corrupt path → adds 'silence the witness'");
}

// ---- 4. REVEAL: one-way door, big Fame, secret spent ----
console.log("Reveal branch:");
{
  const s = crossHigh(mkState());
  const ch = s.model.character;
  const fameBefore = ch.fame;
  const gateBefore = effHopeThreshold(ch);
  resolveUnmaskingCrisis(s, "reveal");
  const expectFame = CONFIG.axes.fame.gainSaveCivilian + CONFIG.unmaskingCrisis.reveal.revealFameBonus;
  assert.strictEqual(ch.identityRevealed, true, "identity permanently revealed");
  assert.strictEqual(ch.mustLieLow, false, "lie-low lock cleared");
  assert.strictEqual(ch.fame - fameBefore, expectFame, "Fame jumps by gainSaveCivilian + revealFameBonus");
  assert.strictEqual(s.model.world.flags.unmaskingCrisisSeen, true, "crisis latched as seen");
  // Heat now no-ops: re-crossing high must NOT re-arm the crisis.
  ch.pendingUnmaskingCrisis = false;
  adjustVisibility(ch, { unmasking: 50 });
  checkUnmaskingEvents(s);
  assert.strictEqual(ch.pendingUnmaskingCrisis, false, "revealed → Unmasking events are inert");
  // Finale gate: more Fame ⇒ lower hope threshold (easier finale).
  const gateAfter = effHopeThreshold(ch);
  assert.ok(gateAfter < gateBefore, `reveal lowers the finale hope gate (${gateBefore} → ${gateAfter})`);
  ok(`reveal: permanent, +${expectFame} Fame, gate ${gateBefore}→${gateAfter}, heat inert afterward`);
}

// ---- 5. HIDE: saved quietly, secret intact, heat shed ----
console.log("Hide branch:");
{
  const s = crossHigh(mkState((m) => { m.character.hopeTally = 20; }));
  const ch = s.model.character;
  const unmaskBefore = ch.unmasking;
  const hopeBefore = ch.hopeTally || 0;
  resolveUnmaskingCrisis(s, "hide");
  assert.strictEqual(ch.identityRevealed, false, "secret intact");
  assert.strictEqual(ch.unmasking, unmaskBefore - CONFIG.unmaskingCrisis.hide.unmaskingShed, "Unmasking shed");
  assert.ok((ch.hopeTally || 0) < hopeBefore, "hope dips (no one saw a hero choose them)");
  assert.strictEqual(s.model.world.flags.unmaskingCrisisSeen, true, "crisis latched");
  ok("hide: secret holds, Unmasking shed, hope dips");
}

// ---- 6. CLOUD (virtuous): keep both, costs Spirit ----
console.log("Cloud branch:");
{
  const s = crossHigh(mkState((m) => { m.character.virtue = 60; }));
  const ch = s.model.character;
  const spiritBefore = ch.stats.spirit;
  resolveUnmaskingCrisis(s, "cloud");
  assert.strictEqual(ch.identityRevealed, false, "secret intact");
  assert.strictEqual(ch.stats.spirit, spiritBefore - CONFIG.unmaskingCrisis.cloud.spiritCost, "Spirit drained by the cost");
  assert.strictEqual(s.model.world.flags.unmaskingCrisisSeen, true, "crisis latched");
  ok("cloud: secret holds, Spirit spent");
}

// ---- 7. SILENCE (corrupt): keep both, raises Corruption + heat ----
console.log("Silence branch:");
{
  const s = crossHigh(mkState((m) => { m.character.corruption = 60; }));
  const ch = s.model.character;
  const corrBefore = ch.corruption;
  const unmaskBefore = ch.unmasking;
  resolveUnmaskingCrisis(s, "silence");
  assert.strictEqual(ch.identityRevealed, false, "secret intact");
  assert.ok(ch.corruption > corrBefore, "Corruption rises");
  assert.strictEqual(ch.unmasking, unmaskBefore + CONFIG.unmaskingCrisis.silence.unmasking, "heat RISES (conspicuous)");
  ok("silence: secret holds, Corruption + heat rise");
}

// ---- 8. Persistence / backfill for old saves ----
console.log("Persistence:");
{
  const old = freshModel();
  delete old.character.pendingUnmaskingCrisis;
  delete old.character.identityRevealed;
  delete old.world.flags.unmaskingCrisisSeen;
  const s = createState(old);
  assert.strictEqual(s.model.character.pendingUnmaskingCrisis, false, "backfilled pendingUnmaskingCrisis");
  assert.strictEqual(s.model.character.identityRevealed, false, "backfilled identityRevealed");
  assert.strictEqual(s.model.world.flags.unmaskingCrisisSeen, false, "backfilled unmaskingCrisisSeen");
  ok("createState backfills the three new fields for pre-T20 saves");
}

// ---- 9. Re-crossing high after a HIDE reinstates the warning, not the crisis ----
console.log("Re-cross after hide:");
{
  const s = crossHigh(mkState());
  resolveUnmaskingCrisis(s, "hide");
  const ch = s.model.character;
  ch.pendingUnmaskingCrisis = false;
  ch.unmaskingTierSeen = "mid";          // heat cooled below high, then climbs again
  ch.unmasking = CONFIG.axes.unmasking.thresholds.high + 5;
  checkUnmaskingEvents(s);
  assert.strictEqual(ch.pendingUnmaskingCrisis, false, "crisis does NOT re-fire (one-shot)");
  ok("re-crossing high after hide reinstates the lie-low warning only");
}

console.log(`\n${pass} checks passed.`);
