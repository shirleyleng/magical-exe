# MAGICAL.EXE — Game Design

A cozy-terminal, single-player text game. You discover you're a magical girl/boy/person
and work to rid your city of corruption — which, you slowly learn, is born from human
hopelessness. Story-and-systems driven, in the spirit of WitchSpring / Princess Maker /
Volcano Princess, wrapped in a Charm-style fake terminal.

---

## 1. Core loop

Two modes the game switches between:

### Hub mode (home city) — scarcity of *time*
- Screen = activity menu + persistent stat panel + mascot panel.
- **6 activity slots/day** to start. Slots grow via higher Stamina and transformation tier
  (each milestone unlocks +1 slot). Tune in `config.js`.
- Activity types (each consumes a slot unless noted):
  - **Training** — raise a chosen stat directly (no XP; see Stats).
  - **Combat** — fight a hub-area corrupted monster for loot/materials.
  - **Errand** — side quests / NPC flavor / *bringing hope to people* (this is secretly the
    real fight against corruption — see Plot).
  - **Sparring** — unlocked later (rival), takes the mascot's training role after the injury arc.
  - **Shop** — **FREE, no slot.** Browse/buy/sell anytime.
- `rest` ends the day: resets slots, increments `day`, ticks rival schedules + time-gated events.

### Exploration mode (dungeons) — scarcity of *Stamina*
- Room-to-room graph navigation (MUD-style). Locations: forest, alternate dimension,
  mountains, beach, the secret-place dungeon, etc.
- No day cycle inside a dungeon. **Stamina** is the limiter; running out forces retreat.
- Rooms contain descriptions, exits, items, possible encounters.
- **Each dungeon ends in a boss** that gates story progression and (often) a transformation tier.

---

## 2. Stats (direct stat-building, no XP)

`HP / Power / Spirit / Defense / Speed / Dodge / Stamina`

- **HP** — health; 0 = defeat.
- **Power** — physical/offensive magic damage.
- **Spirit** — resource spent on abilities; also magical potency.
- **Defense** — mitigates incoming damage.
- **Speed** — turn order in combat.
- **Dodge** — evasion roll chance.
- **Stamina** — exploration resource (and gates extra hub slots at thresholds).

Training raises a chosen stat directly. Balance is tuned entirely in `config.js` (growth
per training, enemy scaling, difficulty multipliers). **Balance comes from playtesting the
config, not from theory** — keep every knob in one file.

---

## 3. The three axes (what makes choices bite)

### Virtue vs. Corruption (one slider, opposite ends)
Combines three roles:
1. **Battle resource.** Spend Corruption for burst damage / forbidden moves. Cheap power,
   real cost.
2. **Stat & ability gate.** High Corruption warps stats (e.g. Power up, HP/Spirit decay) and
   unlocks aggressive/forbidden abilities; high Virtue unlocks support/light/healing abilities.
   Transformation tiers branch Virtuous/Corrupt in flavor and kit.
3. **Narrative branch.** Choices and *how* you win (mercy vs. finishing blow) nudge the slider
   and steer which story beats and endings you reach.

### Fame vs. Unmasking (two linked meters)
- **Fame** — public magical-persona reputation. Rises from public wins, visible quests, saving
  civilians. Unlocks events, allies, sponsors, better shops, story doors. **Good.**
- **Unmasking** — how close anyone is to connecting your magical persona to your civilian
  identity. **Rising = danger.** (Named "Unmasking" so a rising bar reads correctly as threat.)
- **The tension:** the same flashy actions that build Fame also raise Unmasking. Corruption-
  flavored play raises Unmasking *faster* (dark power is conspicuous) — so Corruption now has a
  third cost: blowing your cover.
- **Unmasking thresholds (escalating):**
  - Low: rumors, a nosy classmate, a tabloid sketch.
  - Mid: someone actively investigates (rival/reporter/hunter); damage-control events fire
    (cost a slot/errand).
  - High: identity at risk — forced story crisis; someone is threatened; you may have to choose
    to reveal yourself to save them. Top threshold event = "you've been unmasked."
- **Lowering Unmasking:** lie low (skip public battles that day), misdirection errands, **relocate
  your home hub** (consumes all slots, takes 2 days), **memory cloud** (Virtuous path) or
  **memory wipe** (Corrupt path) abilities.
- Cools over time but never trivially hits zero — once a little known, never fully anonymous
  again (genre-appropriate).

---

## 4. Combat

### Tactical core (deterministic, instant — the spine)
- Turn order by **Speed**. **Dodge** = evasion roll. **Defense** mitigates.
- Actions: attack, guard, use ability (spends **Spirit**), use item, spend **Corruption** for
  burst/forbidden moves.
- This is the WitchSpring-style tactical meat. Fully deterministic, no AI.

### Creative freeform actions (Claude-mediated, bounded)
- Player types a freeform action (e.g. "throw sand to blind it").
- Engine sends Claude the combat state + **environment tags** (e.g. `["beach","sand","open"]`)
  + the action. Claude judges plausibility against the tags and returns a **structured effect**
  (e.g. `{"effect":"blind","turns":1,"magnitude":"minor"}`) or rejects as impossible.
- Engine applies the validated effect. Sand on a beach -> approved. "Open a dimension door to
  eject the monster" -> rejected ("you don't have that power... yet").
- Forbidden / over-powered creative moves may **cost Corruption** — ties the systems together.
- Exact judge prompt + allow/deny examples in `PROMPTS.md`. This is the highest-leverage AI piece.

---

## 5. Transformation tiers (these double as story acts)

`Novice -> Magical Soldier -> Magical Knight -> Awakened -> Ascended Deity`

- Gated by **story beats AND a threshold** (stat/Stamina minimum + a key boss defeated).
- Each tier branches **Virtuous / Corrupt / Balanced** flavor (`path` in state) for look + kit.
- Extra hub slot unlocked at tier milestones.

See Plot (section 8) for what triggers each tier.

---

## 6. Character creation

A structured intake at game start. Answers seed pronouns, flavor, the mascot, the magical
weapon, and a late-game dungeon.

1. **Gender presentation:** girl / boy / person -> pronouns + "magical ___" labeling throughout.
2. **Occupation/study:** working (at [job]) / high-school / university / grad student ->
   flavors the intro ("on my way home from ___") and daily-life texture.
3. **Personality axes** (store as tags; lightly flavor NPC reactions + which dialogue options
   appear): Reserved <-> Adventurous; Formal <-> Casual; Cautious <-> Bold.
4. **City/town name:** AI generates a cozy, *plausible* description seeded by the name (optionally
   one search). **AI-flavored, not guaranteed factual** — avoid promising real geography.
5. **Three favorite animals** -> fused into the mascot (see `mascots.md` for fusion rules + art).
6. **Mascot name:** chosen from a random cute/magical/fantasy list (in `mascots.md`).
7. **Favorite toy/game -> magical weapon:** map the answer to a recognizable object
   (board game -> a signature piece; card game -> an iconic card; plush -> the plush itself; etc.).
   Recovered in the awakened-tier quest.
8. **A secret/special place:** becomes the awakening-doubt dungeon later (section 8).

---

## 7. The mascot (helper)

- A fusion of the player's 3 animals. AI writes its **name (or pick from list), personality, and
  voice**; art comes from the curated `mascots.md` library (small + large sets). See CLAUDE.md
  on why art is curated, not freely AI-generated.
- Acts as tutorial voice, hint-giver, and deliverer of the rotating example prompts.
- Plot-critical: trains you, is injured and disappears (knight->awakened low point), found
  sleeping with your recovered magical weapon, reinstated on ascension to awakened.

---

## 8. Plot / story spine

**Premise:** A cozy ordinary life in your named city. On the way home from school/work, you
hear a cry for help — and meet your magical mascot, who reveals you have hidden magical powers.

**End goal:** Rid the city of corruption. A "big boss" commands the corrupted-monster spawns,
but **clues throughout reveal corruption is born from the sadness/hopelessness of the city's
people.** The errands that bring people hope are secretly the real fight.

### Act / tier structure

**Novice -> Soldier** — after defeating **Dungeon Boss #1**, the mascot reveals a **world
alliance** of magical people dedicated to eliminating corruption and keeping cities whole — but
there aren't enough of them to cover every city. (This is the in-fiction reason you can travel
city-to-city.)

**Soldier -> Knight** — after **Bosses #2 and #3**, you learn corruption's deeper nature: first
you learn about the big boss; eventually you realize errands (bringing hope) are the true
counter to corruption-from-hopelessness.
- A few days after Boss #2: **meet your rival** (initial motive: defeat you).
- A few days after Boss #3: rival returns, hinting **not everything about corruption is what it
  seems.** The rival is still alliance-affiliated but knows more than your mascot is telling you.

**Knight -> Awakened** — **Boss #4** is a scripted **story-loss**: tuned so it reads as
unwinnable within 5 turns (telegraph heavily — mascot warns, boss HP barely moves — so it never
feels like a bug or cheap skill failure; implement as a scripted story-battle, not normal combat).
The mascot intervenes, is **injured, and disappears.**
- Rival motivates you to train harder -> unlocks **Sparring** activity (takes the mascot's role).
- The alliance tells you of the **Awakened tier**, reachable via a special quest to find your
  **magical weapon** (your childhood toy, mapped to an object at creation).
- **Special-place dungeon:** a misted version of your secret place, full of memories of the
  mascot's training and your childhood (with hints of the toy). Themed on **hopelessness**
  ("am I even good enough to be a magical girl? can I truly save the world?") — the same doubt
  the finale will literalize.
- You find the magical weapon; the **mascot is sleeping with it** and is recovered when you
  activate the Awakened tier. You return and **defeat Boss #4.** Mascot reinstated; rival
  congratulates you and resumes challenging you, now with respect.

**Awakened -> Ascended Deity** — at the **final boss**, a 3-phase fight:
- **Phase 1:** fight the "big boss" as the apparent source.
- **Phase 2 (twist):** defeating it doesn't stop the corruption — it was never one being. The
  boss becomes the **manifested despair of the entire city** (every person you couldn't fully
  help feeds it). The hopelessness theme, now literal and overwhelming.
- **Phase 3 (ascension trigger):** you don't out-muscle despair — you **answer it with
  accumulated hope.** The Fame, relationships, errands, mascot bond, and the rival now fighting
  beside you "feed back" and ignite **ascension.** *Make the systems matter at the climax:* gate
  ascension partly on a hidden **hope tally** accumulated from errands/relationships, so the
  player who built hope literally has fuel to ascend.
- **Virtue/Corruption fork:** Virtuous = ascension through connection/hope; Corrupt = a darker
  ascension that seizes the despair's power -> a different ending.

### v1 SLICE BOUNDARY
For the first shippable build, implement **through Novice -> Soldier only**: character creation,
mascot, one hub, one dungeon + Boss #1, the core loop, tactical combat, saves. Everything from
Boss #2 onward is post-slice. (See CLAUDE.md > Build Order.)

---

## 9. Meta systems

- **Prestige / clean-slate:** give up all progress, **halve current stats**, restart.
  Easy mode: monsters unchanged. Normal mode: monsters get a notch harder per prestige
  (`prestigeCount` in state drives scaling). Incremental-game "prestige" feel.
- **Difficulty:** Easy / Normal as simple multipliers in `config.js` (enemy stats, etc.).
- **Help & discovery:** `/help` (deterministic, lists command categories) + **rotating example
  prompts** in the terminal (contextual: combat prompts in battle, exploration prompts in
  dungeons) — this is how players discover the freeform-AI feature exists.

---

## 9.5 Hope tally & the ending fork (workshopped 2026-06-07, for T19)

The endings are decided by a hidden **Hope tally** plus the Virtue/Corruption slider, with Fame as
a modifier. The player is never shown a hope number — they only *feel* the trend.

**Sources of hope (errands = the "true fight" against hopelessness):**
- **Pull — an `errand` hub activity** (opt-in, repeatable, costs slots). Archetypes that *trade*
  axes rather than stack them, so Virtue/Fame/Hope stay independent ending inputs:
  - *Quiet kindness:* +hope, +virtue, no Fame/Unmasking · small = +2 hope/+1 virtue/1 slot ·
    big = +6 hope/+3 virtue/2 slots — **bigger errands give a BETTER hope/slot rate** (commitment
    pays; ~2.0 → 3.0 per slot).
  - *Public rescue:* +hope, +Fame, +Unmasking (seen heroics) — reuses the stubbed
    `axes.fame.gainSaveCivilian`.
  - *Expedient/dark help:* small hope + Corruption (you "helped," but cut a corner). The small
    hope leak is cosmetic — see precedence below.
- **Push — dilemma events** (one-shot, latched; fire at `rest`, reusing the T15 event-tick
  pattern). Branching menu: a sincere choice (+hope/+virtue), an expedient choice
  (+corruption, ~0 hope), and **ignore** (inaction costs hope — e.g. not investigating a cry).
- **Passive:** a little hope per boss felled and per rescue resolved kindly, so a hope-minded
  player nears the threshold *naturally* — errands are the deliberate top-up, not a grind wall.

**Feedback (hidden meter, but never arbitrary):** individual choices are **ambiguous** — no number,
no explicit "that was bad" (the dark option only reads *off* in tone). But the **cumulative** state
is felt: city-mood lines in errand/rest flavor, the mascot's periodic read ("people are starting to
believe again"), and Fame as a loose visible proxy. The ending names the tally in retrospect.
Heavy subject matter stays in *lingering ambiguity* ("you never do find out…"), not on-screen horror,
to fit the cozy register.

### The finale (3 phases) + the four endings (workshopped 2026-06-07)

**Reaching it:** a final location unlocks after the Awakened Boss #4 rematch. You enter when YOU
choose — your hope/path *at that moment* is your ending (no forced grind). The mascot soft-warns
without revealing the number ("the city has to believe in you — do you feel it believing?").

**Structure — ONE continuous combat, phases swap inside `endCombat`** (no return-to-hub between
phases, so the twist lands mid-fight):
- **Phase 1:** the "big boss," the apparent source — a real, winnable Awakened-tier fight.
- **Phase 2 (twist):** you kill it and it *reforms as the manifested despair of the whole city* —
  another big but **normal winnable** fight. (No damage-wall: the "you can't out-muscle despair"
  theme rides the fiction + the gate, not a repeated scripted wall.)
- **Phase 3 = ascension resolution** (not a tactical fight): the brink choice + the fuel-check gate.

**The brink — a dramatized choice, but the gate decides whether you have the FUEL to hold it:**
the player picks how to meet the despair; what you built decides if it works. Telegraphed in tone,
but it has TEETH — a deliberate off-path reach can fail a good run (no take-back).

|                      | enough fuel                                   | not enough fuel                                  |
|----------------------|-----------------------------------------------|--------------------------------------------------|
| **Reach for hope**   | **Virtuous Ascension** — you + mascot ascend; the mascot becomes its own guardian-animal deity | **Quiet Tragedy** — despair endures; you + mascot survive but hollow, the city stays grey; bittersweet, replayable toward a better end |
| **Seize the despair**| **Dark Ascension** — you keep *yourself* but become a dark deity (monstrous, but by choice)     | **Eldritch Merge** — you + mascot are consumed into the next corrupted being (loss of self) |

- "enough fuel" for **hope** = `hopeTally ≥ THRESHOLD`; for **seize** = high Corruption / `path === corrupt`.
- Horror is reserved for **hubris** (grasping power you can't hold), never for trying-and-missing —
  so a gentle non-optimizer who reaches for hope and falls short gets the *quiet tragedy*, not the merge.
- **Eldritch Merge art** = a deterministic corruption of the player's own mascot ASCII (mascot.js
  ART) — glitched glyphs, broken symmetry — the curated-art payoff: your mascot becomes the horror.
- **Fame modifies THRESHOLD:** high Fame lowers the hope you personally need (the city's belief
  carries you); a hidden hero needs more — and Fame costs Unmasking risk. Anchor: `reqMinHopeTally`
  = 50 (`config.tiers.ascended`), Fame floor ~30, e.g. `clamp(50 − fame·0.2, 30, 50)`.
- The **coupled Virtue/Corruption slider does the heavy lifting**: earning hope (virtue-flavored
  help) drains corruption and vice-versa, so high-hope and high-corruption are near-mutually-exclusive
  — the fuel checks line up with who you became without needing a hard path gate.

**Rival + relationships at the climax:** narrative + light **scripted assists** (once a phase Sable
draws the boss's focus → a free turn / guaranteed hit; the mascot a heal) — NOT a full ally-combat
system. The ascension narration enumerates what "feeds back": Fame (the city believes), errands
(hope returns), the mascot bond, Sable fighting beside you. Hope is the literal fuel.

**Losing a finale phase** is gentle (wake at home, re-enterable) — not a hard fail.

**Build note:** BUILT (T19, 2026-06-07). The hope layer (errands + dilemmas + passive + ambient
feedback) and the finale both shipped. The finale lives in: the `source` dungeon ("the Heart of the
Grey", `unlockReqBoss:"boss4"`); the two-phase fight in `combat.js` (a `phases` list on combat state,
`advancePhase` swaps forms in place, `triggerFinaleResolve` hands off via `ui.finaleResolve`); and a
dedicated resolver `src/endgame.js` (NOT `handleBossDefeat`) that owns the no-take-back brink menu +
the fuel-check gate → the four endings. The Eldritch Merge art is `mascot.js corruptArt` (a
deterministic glyph-corruption of the player's own mascot). Decided at build time: the Dark-Ascension
mascot stays as a bound/dimmed familiar (sadder than leaving; contrasts the guardian deity), and
`seizeCorrThreshold` = 50 (or `path === "corrupt"`).

---

## 10. State shape (the save object)

One serializable object = one save slot. Rough skeleton (extend as needed):

```json
{
  "saveSlotName": "Run 1",
  "createdAt": "2026-06-06T00:00:00Z",
  "schemaVersion": 1,
  "difficulty": "normal",
  "prestigeCount": 0,
  "mode": "hub",
  "day": 4,
  "character": {
    "name": "Lumi",
    "gender": "girl",
    "pronouns": { "subj": "she", "obj": "her", "poss": "her" },
    "occupation": { "type": "highschool", "detail": null },
    "personality": { "reservedAdventurous": 0.7, "formalCasual": 0.4, "cautiousBold": 0.6 },
    "city": "Brightwater",
    "secretPlace": "the old footbridge by the canal",
    "magicalWeapon": { "fromToy": "chess set", "object": "the white knight piece", "found": false },
    "path": "balanced",
    "transformationTier": "novice",
    "stats": { "hp": 40, "maxHp": 40, "power": 12, "spirit": 8, "defense": 6,
               "speed": 9, "dodge": 5, "stamina": 30, "maxStamina": 30 },
    "corruption": 15,
    "virtue": 60,
    "fame": 5,
    "unmasking": 10,
    "hopeTally": 0,
    "inventory": ["moonstone shard", "healing draught"],
    "abilities": ["light bolt", "guard"]
  },
  "mascot": {
    "name": "Pip",
    "animals": ["cat", "owl", "fox"],
    "artKeySmall": "blob_small",
    "artKeyLarge": "blob_large",
    "voice": "gentle, encouraging, a little sleepy",
    "injured": false,
    "present": true
  },
  "hub": {
    "slotsMax": 6,
    "slotsUsedToday": { "training": 1, "combat": 0, "errand": 0, "sparring": 0 }
  },
  "world": {
    "currentLocation": "homebase",
    "currentRoom": null,
    "flags": { "metRival": false, "rivalChallengeDay": null, "bossesDefeated": [] }
  },
  "rivals": [
    { "name": "Sable", "power": 14, "corruption": 50, "scheduleState": "dormant",
      "disposition": "unmet" }
  ],
  "questFlags": { "lostKitten": "unstarted" }
}
```

Rooms (exploration) stay as **separate data**, keyed by id, so content is editable without
touching logic:

```json
{
  "forest_clearing": {
    "name": "Moonlit Clearing",
    "desc": "Silver light pools between the trees. Something rustles north.",
    "exits": { "north": "forest_den", "south": "forest_edge" },
    "items": ["dew vial"],
    "encounter": { "monster": "shadow imp", "chance": 0.4 },
    "onEnterFlag": null
  }
}
```

---

## 11. Credits (include in README + an in-game "about"/credits screen)

> Visual style inspired by [Charm](https://charm.sh)'s Lip Gloss. Not affiliated with
> Charmbracelet, Inc.

Charm's libraries are MIT-licensed; this game recreates the *aesthetic* in CSS and does not
include Charm code. The credit is a courtesy. (If Charm code is ever vendored, include their
MIT license text verbatim.)

### Theme credits (selectable palettes — `themes.css`)
The in-game themes are aesthetic homages recreated in CSS; no theme code is vendored.
- **Lip Gloss** — [Charm](https://charm.sh)'s Lip Gloss (as above).
- **Cotton Candy** — inspired by [Compute Cuter](https://computecuter.com) by **sailorhg**
  (header art by **_dollgirls**), a kawaii-pastel computing-aesthetic guide.
- **Rosé Pine / Rosé Pine Dawn** — palettes from [Rosé Pine](https://rosepinetheme.com)
  (the Rosé Pine theme is MIT-licensed; we use only the colour values).
- **Moonlit · Matcha · Phosphor** — original palettes for this game.

These credits should also appear on the in-game about/credits screen (T21).
