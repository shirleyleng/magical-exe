/* Integration test for T20 Sable talk-mode (src/rivaltalk.js).
   Run: node scripts/sim/rivaltalk-test.js   (ESM auto-detected)
   Imports the REAL game modules. */
import assert from "node:assert";
import { CONFIG } from "../../config.js";
import { freshModel, createState } from "../../src/state.js";
import { parse } from "../../src/parser.js";
import { beginRivalTalk, handleRivalTalk, endRivalTalk, isRivalTalkExit } from "../../src/rivaltalk.js";

let pass = 0;
const ok = (name) => { pass++; console.log(`  ✓ ${name}`); };
const lastLine = (s) => s.log[s.log.length - 1];

function mkState(scene) {
  const model = freshModel();
  model.character.created = true;
  model.character.name = "Test";
  const s = createState(model);
  if (scene) beginRivalTalk(s, scene);
  return s;
}

// Force AI availability on/off for the free-text branch (aiAvailable reads CONFIG.supabase).
const realSupabase = CONFIG.supabase;
const aiOn = () => { CONFIG.supabase = { url: "https://x.supabase.co", anonKey: "anon-key" }; };
const aiOff = () => { CONFIG.supabase = { url: "YOUR_URL", anonKey: "YOUR_KEY" }; };

// ---- 1. Entering talk mode ----
console.log("Enter:");
{
  const s = mkState("return");
  assert.ok(s.model.rivalTalk && s.model.rivalTalk.active, "rivalTalk active");
  assert.strictEqual(s.model.rivalTalk.scene, "return", "scene recorded");
  assert.ok(s.log.some((l) => /talk to her/i.test(l.text)), "linger prompt printed");
  ok("beginRivalTalk opens talk mode + prints the linger prompt");
}

// ---- 2. Authored topic → deterministic answer, no AI ----
console.log("Topics:");
{
  const s = mkState("return");
  s.ui.effect = null;
  handleRivalTalk(s, "tell me about the corruption");
  assert.ok(!s.ui.effect, "no AI effect for an authored topic");
  assert.ok(/whole shape of it/i.test(lastLine(s).text), "the canon corruption-hint answer fired");
  assert.ok(s.model.rivalTalk.asked.includes("corruption"), "topic latched in asked[]");
  ok("a matched topic answers deterministically (lore-safe, no AI spend)");

  const s2 = mkState("challenge");
  handleRivalTalk(s2, "what's your name?");
  assert.ok(/Sable/.test(lastLine(s2).text), "challenge-scene name topic fired");
  ok("topics are scene-specific (challenge: name)");
}

// ---- 3. Free-text → bounded AI effect when available ----
console.log("Free-text (AI on):");
{
  aiOn();
  const s = mkState("return");
  s.ui.effect = null;
  handleRivalTalk(s, "tell me a joke, Sable");
  assert.ok(s.ui.effect && s.ui.effect.type === "ai", "an AI effect is queued");
  assert.strictEqual(s.ui.effect.kind, "dialogue", "kind is 'dialogue'");
  assert.strictEqual(s.ui.effect.vars.scene, "return", "scene passed to the prompt");
  assert.ok(s.ui.effect.vars.question.length > 0, "the question is passed");
  assert.ok(s.ui.effect.vars.fallback, "a curated fallback is attached");
  assert.strictEqual(s.ui.busy, true, "input is locked while she 'considers'");
  ok("unmatched free-text routes to the bounded 'dialogue' AI persona");
  CONFIG.supabase = realSupabase;
}

// ---- 4. Free-text → curated deflection when AI is off ----
console.log("Free-text (AI off):");
{
  aiOff();
  const s = mkState("return");
  s.ui.effect = null;
  handleRivalTalk(s, "tell me a joke, Sable");
  assert.ok(!s.ui.effect, "no AI effect when AI is unavailable");
  assert.ok(lastLine(s).kind === "mascot" && lastLine(s).text.length > 0, "a Sable-voiced deflection prints instead");
  ok("free-text degrades gracefully to an in-character deflection");
  CONFIG.supabase = realSupabase;
}

// ---- 5. Exit detection ----
console.log("Exit:");
{
  assert.strictEqual(isRivalTalkExit("leave", parse("leave")), true, "'leave' exits");
  assert.strictEqual(isRivalTalkExit("bye", parse("bye")), true, "'bye' exits");
  assert.strictEqual(isRivalTalkExit("home", parse("home")), true, "'home'/retreat exits");
  assert.strictEqual(isRivalTalkExit("tell me about the corruption", parse("tell me about the corruption")), false, "a question does not exit");
  ok("isRivalTalkExit distinguishes goodbyes from questions");
}

// ---- 6. A real command breaks off (parser still matches it) ----
console.log("Command break-off:");
{
  const s = mkState("return");
  const cmd = parse("rest");
  assert.ok(cmd.matched && cmd.verb === "rest", "‘rest’ still parses as a command");
  assert.strictEqual(isRivalTalkExit("rest", cmd), false, "‘rest’ is not a goodbye — update.js runs it after ending talk");
  ok("a bare command is a real command (handled upstream), not dialogue");
}

// ---- 7. endRivalTalk closes the scene ----
console.log("End:");
{
  const s = mkState("return");
  endRivalTalk(s);
  assert.strictEqual(s.model.rivalTalk, null, "talk mode cleared");
  assert.ok(/Sable/.test(lastLine(s).text), "a parting line printed");

  const s2 = mkState("challenge");
  const before = s2.log.length;
  endRivalTalk(s2, { silent: true });
  assert.strictEqual(s2.model.rivalTalk, null, "talk mode cleared (silent)");
  assert.strictEqual(s2.log.length, before, "silent exit prints nothing");
  ok("endRivalTalk clears state; silent mode stays quiet");
}

console.log(`\n${pass} checks passed.`);
