/* ============================================================
   MAGICAL.EXE — errands.js  (errand content layer)
   Turns the four abstract errand archetypes into a LIVING TOWN:

   - VIGNETTES: concrete one-off situations that rotate day to day, so the
     errand menu never shows the same flat list twice. Each belongs to an
     archetype (kindness / service / rescue / expedient) and inherits that
     bucket's axis math + slot cost from CONFIG.errands.archetypes (the
     balance source) — the vignette is pure CONTENT.

   - TOWNSFOLK: recurring people whose help builds across days. Each is an
     ordered arc of steps; helping advances the relationship (one step per
     day, max) and the final step pays off — a gift, a heartfelt line, a
     little extra hope. This is what makes the hidden Hope tally feel
     *personal*: a town that's quietly counting on you.

   Selection is deterministic within a day (stable if you reopen the menu)
   and shifts across days. Mutation of relationship progress lives in
   advanceNpc(); the axis/slot bookkeeping stays in hub.js (doErrand).
   ============================================================ */
import { CONFIG } from "../config.js";

const archetypeOf = (id) => (CONFIG.errands.archetypes || []).find((a) => a.id === id) || null;
const isPublicArch = (id) => !!(archetypeOf(id) && archetypeOf(id).public);

/* ---- one-off vignettes (rotate daily) ----
   Ordered interleaved by archetype so the daily window always shows a mix.
   `outcome` may be a string or an array (sampled in hub.js). */
const VIGNETTES = [
  { id: "gv_busfare", archetype: "kindness",
    label: "Cover a stranger's fare and ride with them to their stop",
    outcome: "They protest, then don't, then talk the whole way — about nothing, about everything, the way people do when someone finally has time for them. You miss your own stop on purpose. It's the best wrong turn you take all week." },
  { id: "gv_soupline", archetype: "service",
    label: "Work the soup line from dawn until the pot scrapes empty",
    outcome: "Ladle, smile, ladle, smile, until your shoulders forget how to be anything but useful. By the last bowl you know half their names and all of their orders, and the warmth in the room isn't only from the stove." },
  { id: "gv_marketcat", archetype: "rescue",
    label: "A child's balloon-creature has slipped its string and gone grey — wade in",
    outcome: "You catch it a breath before the grey sets, and hand it back trembling but bright. The whole market exhales at once, then claps — for the kid, for the silly little creature, for the small public proof that someone will always come." },
  { id: "gv_shortcut", archetype: "expedient",
    label: "Jimmy says he can make a neighbour's problem 'go away' — for a little of your dark",
    outcome: "It works. Of course it works; the easy way always works, that's the whole trap of it. The neighbour is grateful and you are efficient and something behind your ribs goes very slightly colder, and you decide not to name it." },
  { id: "gv_letters", archetype: "kindness",
    label: "Read the afternoon's post aloud for someone whose eyes have gone",
    outcome: "A gas bill, a flyer, and then — a granddaughter's letter, which you read twice because the first time their face does something that deserves a second pass. They keep that one. You can tell they'll keep that one for a long while." },
  { id: "gv_floodroof", archetype: "service",
    label: "Patch the leaking roofs of the low quarter, all through the rain",
    outcome: "Soaked to the bone, fingers pruned, tar under every nail — and street by street the drumming of buckets goes quiet as, one by one, the ceilings hold. You climb down into a row of dry kitchens and somebody's already put the kettle on for you." },
  { id: "gv_bridge", archetype: "rescue",
    label: "Someone's frozen on the old footbridge as the dark gathers — go bring them in",
    outcome: "You don't rush it. You just stand close, in plain view of the gathering crowd, and talk, low and easy, until their hand finds yours and they let you walk them back to the lit end of the bridge. People saw. People will remember someone came." },
  { id: "gv_skim", archetype: "expedient",
    label: "Square the shelter's ledger the fast way — nobody ever checks the numbers",
    outcome: "The books balance. The shelter stays open. You took the shortcut that only works because no one's looking, and it lands, and the relief is real — and so is the faint, sour aftertaste you rinse twice and still taste at midnight." },
  { id: "gv_bench", archetype: "kindness",
    label: "Sit on the cold bench with the man who's there every single night",
    outcome: "You don't fix anything. You couldn't if you tried. You just sit, and share the bad coffee from the all-night stand, and let him not be the only person awake in the whole grey city for one ordinary hour. Sometimes that is the entire job." },
];

/* ---- recurring townsfolk (relationship arcs) ----
   Each step inherits the NPC's archetype. The final step completes the arc:
   a payoff line (+ optional gift / coins / bonus hope). One step per day
   (the npc's vignette id is stable, so done-today gating limits it). */
const TOWNSFOLK = [
  {
    id: "tomas", name: "Tomas", archetype: "kindness",
    finaleEcho: "Tomas at his window, no longer talking to an empty chair",
    steps: [
      { label: "Carry old Tomas's shopping up the four flights — his hip's gone again",
        outcome: "He insists he's fine on every single landing, and leans on the rail a little harder on every single landing, and by the top you're both pretending you didn't notice. \"You're a good one,\" he says, like an accusation. \"Don't let this place make you otherwise.\"" },
      { label: "Tomas left the kettle on again; stay a while so the flat isn't so quiet",
        outcome: "His wife's chair still sits angled toward the window, and he still talks in her direction sometimes, mid-sentence, without seeming to know he does it. You stay past the second cup. The quiet, when you finally leave, seems to have lost a little of its weight." },
      { label: "Walk Tomas down to the memorial — he won't go alone, and today he wants to",
        outcome: "He's steady on your arm the whole way and silent the whole way back. At his door he grips your hand in both of his, hard, the way the old grip things they're afraid of dropping. \"Thank you,\" he says. \"For not making me do that by myself.\"" },
    ],
    payoff: {
      line: "The next morning Tomas is waiting on the step. He folds your hands around his late wife's pocket-watch — warm from his palm, ticking still. \"She'd have liked you something fierce. Take it. An old man's done counting his hours; you go and spend yours well.\"",
      gift: "moonstone shard", hope: 4, virtue: 2,
    },
  },
  {
    id: "marisol", name: "Marisol", archetype: "service",
    finaleEcho: "Marisol on the night ward, who got to watch her daughter dance",
    steps: [
      { label: "Run trays on the night ward so Nurse Marisol can sit down for ten whole minutes",
        outcome: "She doesn't sit, of course. She uses the ten minutes to do three other things — but slower, almost human-paced, and at the end of them she actually looks at you. \"Who sent you?\" she asks, suspicious of kindness, the way the overworked always are." },
      { label: "Marisol still hasn't eaten — bring food and stand over her until she stops to eat it",
        outcome: "\"I don't have TIME—\" she starts, and you put the bowl in her hands anyway, and she eats it standing up in four enormous bites and then, very quietly, has to look at the ceiling for a second. \"…Thank you. God. When did I last—\" She doesn't finish it." },
      { label: "Cover Marisol's entire shift so she can make her daughter's recital",
        outcome: "She fights you on it for a full minute and then she's gone, coat half on, the most alive you've ever seen her. The ward is brutal without her. You'd do it again tomorrow. Some debts you're glad to carry." },
    ],
    payoff: {
      line: "Marisol finds you days later and hugs you fierce and fast, all antiseptic and exhaustion and fight. \"I got to watch her dance. Do you understand what you — \" She stops, steadies. \"You ever get hurt out there. Any hour. You come to me. That's not an offer, it's an order.\"",
      gift: "healing draught", hope: 4,
    },
  },
  {
    id: "pen", name: "Pen", archetype: "kindness",
    finaleEcho: "Pen singing the little warding song into the dark, unafraid",
    steps: [
      { label: "Pen's been waiting at the corner for hours — their kitten's wandered off again. Go look.",
        outcome: "You find it under the laundromat, unbothered and faintly smug. Pen, all of seven, hugs it and then hugs you, briefly and ferociously, and informs you that you are now officially Pen's Second Best Friend (the kitten is, regrettably, first)." },
      { label: "The kitten's safe, but Pen's still shaking — walk them the long way home and let them talk",
        outcome: "Pen talks the entire way: about the kitten, about the grey, about being scared in a way they don't have grown-up words for yet and so describe with terrible, perfect accuracy. You mostly listen. By their gate they're walking lighter. So, you notice, are you." },
      { label: "Pen's afraid the grey will take the kitten for good — teach them the little warding song",
        outcome: "It's the silly hum your mascot taught you, the one for small frightened things in the dark. Pen learns it in one go and sings it, fierce and off-key, into the kitten's fur. \"Now it can't get us,\" they declare. And the awful thing is — said like that, you almost believe it too." },
    ],
    payoff: {
      line: "Pen barrels into you at the corner, beaming, kitten draped over one shoulder. \"It's BRIGHTER. Look! I sang it every night like you said!\" And — you'd swear it on anything — the little creature's fur does catch the light a shade warmer than the grey ever allowed. \"When I'm big,\" Pen announces, \"I'm gonna be exactly like you.\"",
      hope: 6, virtue: 2,
    },
  },
];

export function townsfolkList() { return TOWNSFOLK; }

/** Short finale callbacks for every townsperson the player meaningfully helped — woven
    into the ascension coda so the people you lifted up are named at the climax. */
export function helpedEchoes(model) {
  const tf = (model.world && model.world.townsfolk) || {};
  return TOWNSFOLK
    .filter((t) => tf[t.id] && tf[t.id].helped > 0 && t.finaleEcho)
    .map((t) => t.finaleEcho);
}

function npcProgress(model, id) {
  return (model.world.townsfolk && model.world.townsfolk[id]) || { helped: 0, done: false };
}

/** The NPC's currently-available vignette (their next unmet step), or null if their arc is done. */
function npcCurrent(model, t) {
  const st = npcProgress(model, t.id);
  if (st.done || st.helped >= t.steps.length) return null;
  const step = t.steps[st.helped];
  return {
    id: `npc:${t.id}`, npcId: t.id, npc: t, archetype: t.archetype,
    label: step.label, outcome: step.outcome, bonus: step.bonus || null, stepIndex: st.helped,
  };
}

/* Stable per-day window into the generic pool (shifts a little each day). */
function rotateByDay(arr, day, n) {
  if (!arr.length) return [];
  const start = (((day || 1) - 1) * 2) % arr.length;
  const out = [];
  for (let i = 0; i < Math.min(n, arr.length); i++) out.push(arr[(start + i) % arr.length]);
  return out;
}

/** The errands on offer this visit: due relationship steps first, then a rotating set of
    one-offs. Stable within a day; drops anything already done today or (public) while hot. */
export function offeredErrands(model) {
  const done = (model.hub && model.hub.errandsDoneToday) || [];
  const lieLow = !!model.character.mustLieLow;
  const due = TOWNSFOLK.map((t) => npcCurrent(model, t)).filter(Boolean).slice(0, 2);
  const gen = rotateByDay(VIGNETTES, model.day, 4);
  const seen = new Set();
  const picks = [];
  for (const v of [...due, ...gen]) {
    if (seen.has(v.id)) continue;
    if (done.includes(v.id)) continue;
    if (lieLow && isPublicArch(v.archetype)) continue; // no public heroics while cover is hot
    seen.add(v.id);
    picks.push(v);
    if (picks.length >= 5) break;
  }
  return picks;
}

/** Resolve an offered errand id back to its vignette object (generic or an NPC's current step). */
export function findVignette(model, id) {
  if (typeof id !== "string") return null;
  if (id.startsWith("npc:")) {
    const t = TOWNSFOLK.find((x) => x.id === id.slice(4));
    return t ? npcCurrent(model, t) : null;
  }
  const v = VIGNETTES.find((x) => x.id === id);
  return v ? { ...v } : null;
}

/** Advance a townsperson's arc by one step. Returns { completed, payoff, npc }. */
export function advanceNpc(model, npcId) {
  const t = TOWNSFOLK.find((x) => x.id === npcId);
  if (!t) return { completed: false, payoff: null, npc: null };
  if (!model.world.townsfolk) model.world.townsfolk = {};
  const st = model.world.townsfolk[npcId] || { helped: 0, done: false };
  st.helped += 1;
  const completed = st.helped >= t.steps.length;
  if (completed) st.done = true;
  model.world.townsfolk[npcId] = st;
  return { completed, payoff: completed ? t.payoff : null, npc: t };
}
