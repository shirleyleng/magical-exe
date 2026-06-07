/* ============================================================
   MAGICAL.EXE — parser.js
   The deterministic command parser. Runs FIRST, always (CLAUDE.md >
   command parser cascade). Tokenize -> match known verbs/synonyms ->
   return a canonical command. Zero API cost, instant. Only when this
   returns matched:false does the engine (later, T12) fall back to AI.

   parse(raw) -> { matched, verb, target, modifier, raw }
   ============================================================ */

// Direction tokens -> canonical direction.
const DIRECTIONS = {
  n: "north", north: "north",
  s: "south", south: "south",
  e: "east", east: "east",
  w: "west", west: "west",
  u: "up", up: "up",
  d: "down", down: "down",
  in: "in", inside: "in", enter: "in",
  out: "out", outside: "out", back: "out",
  across: "across",
};

// First-token synonyms -> canonical verb.
const VERBS = {
  // movement
  go: "move", walk: "move", move: "move",
  // looking
  look: "look", l: "look",
  examine: "examine", x: "examine", inspect: "examine", exam: "examine",
  // inventory
  inventory: "inventory", i: "inventory", inv: "inventory", items: "inventory", bag: "inventory",
  // items
  take: "take", get: "take", grab: "take", pick: "take",
  drop: "drop",
  use: "use", equip: "use",
  // combat
  attack: "attack", hit: "attack", fight: "attack", battle: "attack", a: "attack",
  guard: "guard", defend: "guard", block: "guard",
  burst: "burst", unleash: "burst", surge: "burst",
  spare: "spare", mercy: "spare",
  // social
  talk: "talk", speak: "talk", ask: "talk",
  // hub
  train: "train", practice: "train",
  spar: "spar", sparring: "spar", duel: "spar",
  alliance: "alliance", hq: "alliance", allies: "alliance", contact: "alliance", report: "alliance",
  rest: "rest", sleep: "rest",
  lielow: "lielow", lie: "lielow", hide: "lielow", laylow: "lielow", lay: "lielow",
  misdirect: "misdirect", misdirection: "misdirect", decoy: "misdirect", cover: "misdirect",
  shop: "shop", store: "shop",
  buy: "buy", purchase: "buy",
  sell: "sell",
  // exploration
  explore: "explore", venture: "explore", dungeon: "explore", adventure: "explore",
  retreat: "retreat", leave: "retreat", flee: "retreat", escape: "retreat", home: "retreat",
  // meta
  status: "status", stats: "status", stat: "status",
  save: "save",
  load: "load",
  saves: "saves", slots: "saves",
  delete: "delete", del: "delete", remove: "delete",
  help: "help", commands: "help", "?": "help",
  map: "map",
  theme: "theme", themes: "theme", palette: "theme",
  settings: "settings", options: "settings", preferences: "settings",
  prefs: "settings", config: "settings",
};

const NO_MATCH = (raw) => ({ matched: false, verb: null, target: null, targetRaw: null, modifier: null, raw });

export function parse(raw) {
  const text = (raw || "").trim().replace(/\s+/g, " ");
  if (!text) return NO_MATCH(raw);

  // Slash commands (e.g. /help) drop the leading slash.
  let body = text.startsWith("/") ? text.slice(1) : text;
  const tokensRaw = body.split(" ");                 // original case (for names)
  const tokens = body.toLowerCase().split(" ");
  const first = tokens[0];

  // Bare direction: "n", "north"
  if (DIRECTIONS[first] && tokens.length === 1) {
    return { matched: true, verb: "move", target: DIRECTIONS[first], targetRaw: null, modifier: null, raw };
  }
  // "go north" / "walk south"
  if ((first === "go" || first === "walk" || first === "move") && DIRECTIONS[tokens[1]]) {
    return { matched: true, verb: "move", target: DIRECTIONS[tokens[1]], targetRaw: null, modifier: null, raw };
  }
  // "look at <thing>" -> examine
  if (first === "look" && tokens[1] === "at" && tokens.length > 2) {
    return { matched: true, verb: "examine", target: tokens.slice(2).join(" "), targetRaw: tokensRaw.slice(2).join(" "), modifier: null, raw };
  }

  const verb = VERBS[first];
  if (!verb) return NO_MATCH(raw);

  const target = tokens.slice(1).join(" ") || null;        // lowercased (item matching)
  const targetRaw = tokensRaw.slice(1).join(" ") || null;  // original case (slot names)
  return { matched: true, verb, target, targetRaw, modifier: null, raw };
}

/** Categorized command list for /help. */
export const HELP = [
  "COMMANDS",
  "  Move:    n s e w up down   (or: go north)",
  "  Look:    look (l) · examine <thing> (x)",
  "  Items:   take <item> · drop <item> · use <item> · inventory (i)",
  "  Combat:  attack · guard · burst · use <ability> · spare",
  "  Hub:     train <stat> · spar <stat> · rest · shop · buy <item> · sell <item> · explore · alliance",
  "  Lay low: lie low · misdirection   (cool your Unmasking when the heat rises)",
  "  Explore: n s e w · look · take <item> · retreat",
  "  Meta:    status · save [name] · load · saves · delete <name> · /help",
  "  Settings: settings  (theme / color palette · about & credits)",
  "Or just describe what you want to do in your own words — the mascot will try to follow.",
];
