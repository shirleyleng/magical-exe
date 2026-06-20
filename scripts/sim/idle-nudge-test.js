/* Integration test for the training-rut nudge (hub.js maybeIdleNudge, fired by doRest).
   Run: node scripts/sim/idle-nudge-test.js
   Imports the REAL game modules — drives doRest and inspects the scrollback. */
import assert from "node:assert";
import { freshModel, createState, markStoryActivity } from "../../src/state.js";
import { doRest } from "../../src/hub.js";

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

const logText = (s) => s.log.map((l) => l.text).join("\n");
// The most recent nudge line (mascot-kind, mentions "days now"); null if none.
function lastNudge(s) {
  const hits = s.log.filter((l) => l.kind === "mascot" && /days now/.test(l.text));
  return hits.length ? hits[hits.length - 1].text : null;
}
function clearLog(s) { s.log.length = 0; }

// ---- 1. Companion voices the nudge after NUDGE_AFTER training-only days ----
console.log("Companion branch:");
{
  const s = mkState((m) => { m.mascot = { name: "Pip", present: true }; });
  doRest(s); // day 1 -> 2, streak 0, no nudge
  assert.strictEqual(lastNudge(s), null, "no nudge on the first rest");
  doRest(s); // day 2 -> 3, streak 1, no nudge
  assert.strictEqual(lastNudge(s), null, "no nudge after one idle day");
  doRest(s); // day 3 -> 4, streak 2 -> NUDGE
  const n = lastNudge(s);
  assert.ok(n, "nudge fires after 2 idle days");
  assert.ok(/training dummy/.test(n), "companion-flavored (training dummy), not Sable");
  assert.ok(/explore .*shop .*errands/i.test(logText(s)), "hint lists explore/shop/errands");
  ok("companion nudges after 2 training-only days");
}

// ---- 2. markStoryActivity resets the streak (no nudge) ----
console.log("Reset:");
{
  const s = mkState((m) => { m.mascot = { name: "Pip", present: true }; });
  doRest(s); doRest(s);          // day now 3, streak 1
  markStoryActivity(s.model);    // player explored/shopped/etc this day
  clearLog(s);
  doRest(s);                     // streak back to 0
  assert.strictEqual(lastNudge(s), null, "doing something varied clears the rut");
  ok("a varied activity resets the streak");
}

// ---- 3. Throttled: at most once every NUDGE_AFTER days ----
console.log("Throttle:");
{
  const s = mkState((m) => { m.mascot = { name: "Pip", present: true }; });
  doRest(s); doRest(s); doRest(s); // nudge on the 3rd (day 3)
  assert.ok(lastNudge(s), "nudge on day 3");
  clearLog(s);
  doRest(s);                       // day 4: throttled
  assert.strictEqual(lastNudge(s), null, "no nudge the very next day (throttle)");
  clearLog(s);
  doRest(s);                       // day 5: re-nudges
  assert.ok(lastNudge(s), "re-nudges 2 days later");
  ok("nudge throttled to once per 2 days");
}

// ---- 4. Sable voices it when the companion is gone ----
console.log("Sable branch (mascot gone):");
{
  const s = mkState((m) => {
    m.mascot = { name: "Pip", present: false };
    m.world.flags.mascotGone = true;
    m.world.flags.boss4Attempted = true;
  });
  doRest(s); doRest(s); doRest(s); // nudge on the 3rd
  const n = lastNudge(s);
  assert.ok(n, "nudge fires during the mascot-gone arc (no longer suppressed)");
  assert.ok(/Sable/.test(n), "voiced by Sable");
  assert.ok(/sparring ring/.test(n), "references the sparring ring, not the training dummy");
  assert.ok(/Pip/.test(n), "names the missing companion");
  assert.ok(/alliance/i.test(logText(s)), "hint points at the alliance (the arc's way out)");
  ok("Sable nudges, pointing at the alliance, when the companion is gone");
}

console.log(`\n${pass} checks passed.`);
