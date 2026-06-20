/* ============================================================
   MAGICAL.EXE — music.js
   Background-music engine. Owns two <audio> elements and crossfades
   between them as the scene changes (title / hub / explore / combat /
   boss / finale). The scene→track mapping lives in SCENES below — it's
   the one place to re-score the game; reassign freely.

   Autoplay is blocked by browsers until the player interacts, so playback
   is "armed" on the first gesture (any click/key, or the music toggle).
   Enabled + volume persist in localStorage across save slots, like theme.
   ============================================================ */

const TRACK_DIR = "music/";

// Friendly name -> filename in /music (spaces are URL-encoded on use).
const TRACKS = {
  "Moon Ribbon":            "Moon Ribbon.mp3",
  "Pastel Errand Loop":     "Pastel Errand Loop.mp3",
  "Errand Wand":            "Errand Wand.mp3",
  "Ribbon Up":              "Ribbon Up.mp3",
  "Star Wand Static":       "Star Wand Static.mp3",
  "Sailor Hope":            "Sailor Hope.mp3",
  // Per-dungeon battle themes
  "Moonlit Bloom Protocol": "Moonlit Bloom Protocol.mp3",
  "Harbor Tide":            "Harbor Tide.mp3",
  "Moonglass Tower":        "Moonglass Tower.mp3",
  // The hub after the companion is lost — sparse and mournful
  "Faint Roomlight":        "Faint Roomlight.mp3",
  // The Misted Place (secret dungeon) and the companion's revival
  "Mothlight Box":          "Mothlight Box.mp3",
  "Pastel Return":          "Pastel Return.mp3",
  // The City's Despair finale — hope path and corrupted path
  "Heart of the City":      "Heart of the City.mp3",
  "Despair of the City":    "Despair of the City.mp3",
  // Late-game places of dread
  "Sorrowing Spire":        "Sorrowing Spire.mp3",   // the Spire / Boss #4 (Grief Herald)
  "Hollow Hour Descent":    "Hollow Hour Descent.mp3", // the climb into the Heart of the Grey
};

// Each scene is a playlist. Multi-track scenes advance track-to-track as
// each finishes; single-track scenes loop. THIS is the dial to re-score:
// move a track name to a different scene and the game's music changes.
const SCENES = {
  title:    ["Pastel Errand Loop"],
  hub:      ["Pastel Errand Loop", "Errand Wand"], // calmer "loop" tracks for the resting hub
  "hub-gone": ["Faint Roomlight"],                 // the hub after the companion is lost — mellow, mournful
  explore:  ["Ribbon Up", "Moon Ribbon"],
  "misted-place": ["Mothlight Box"],               // the secret dungeon of memory (explore + the doubt fight)
  reunion:        ["Pastel Return"],               // the secret dungeon once the companion is revived
  "explore-spire":  ["Sorrowing Spire"],           // climbing the Sorrowing Spire (sets the mood for the boss)
  "explore-source": ["Hollow Hour Descent"],       // descending into the Heart of the Grey before the finale
  // Per-dungeon battle themes (cover both regular fights and that dungeon's boss).
  "combat-forest":     ["Moonlit Bloom Protocol"],
  "combat-harbor":     ["Harbor Tide"],
  "combat-clocktower": ["Moonglass Tower"],
  "combat-secret":     ["Mothlight Box"],
  "combat-spire":      ["Sorrowing Spire"], // Boss #4 — the Grief Herald
  combat:  ["Star Wand Static"], // generic fallback (hub skirmishes, later dungeons)
  boss:    ["Sailor Hope"],      // boss fights in dungeons without their own theme
  finale:  ["Heart of the City"],   // the City's Despair fight + the hope-path brink/ending
  "finale-dark": ["Despair of the City"], // kicks in the moment the player chooses to seize the Despair at the brink
};

// Which dungeon (world.currentLocation) maps to which battle scene.
const DUNGEON_COMBAT = {
  forest:     "combat-forest",
  harbor:     "combat-harbor",
  clocktower: "combat-clocktower",
  secret:     "combat-secret", // the doubt fight stays in the misted mood
  spire:      "combat-spire",  // Boss #4 / the Grief Herald
};

/* Per-dungeon explore-mode music (the WALK, not the fight). When a dungeon
   has its own atmosphere, use it; otherwise fall back to the generic explore
   playlist. The finale dungeon doesn't appear here — it uses the finale theme
   from the moment combat starts via combat.finale. */
const DUNGEON_EXPLORE = {
  spire:  "explore-spire",
  source: "explore-source",
};

const ENABLED_KEY = "magicalexe.music.enabled";
const VOLUME_KEY  = "magicalexe.music.volume";
const DEFAULT_FADE_MS = 1100; // default crossfade duration
const DEFAULT_VOLUME = 0.5;   // background-friendly

/* Per-transition fade duration. Combat snaps in fast (it should hit); endings,
   reunions, and grief shifts breathe; everything else uses the default. Keys
   are "from→to" scene names or "*→to" wildcards; the table is read by
   fadeMsFor() with sensible fallbacks. */
const FADE_TABLE = {
  // Snap into combat — the music should bite as the fight starts.
  "hub→combat": 350, "explore→combat": 350,
  "hub→boss": 350, "explore→boss": 350,
  "hub→finale": 600, "explore→finale": 600,
  "hub→combat-forest": 350, "hub→combat-harbor": 350, "hub→combat-clocktower": 350,
  "explore→combat-forest": 350, "explore→combat-harbor": 350,
  "explore→combat-clocktower": 350, "explore→combat-secret": 350,
  "explore-spire→combat-spire": 600, // a slower bite — the Spire is a heavier fight
  "hub→explore-spire": 1400, "hub→explore-source": 1800,
  "explore-source→finale": 1200,     // the descent rolls into the final fight
  // Release after combat — let it breathe.
  "combat→hub": 1500, "combat→explore": 1500,
  "boss→hub": 1500, "boss→explore": 1500,
  "combat-forest→explore": 1500, "combat-harbor→explore": 1500,
  "combat-clocktower→explore": 1500, "combat-secret→explore": 1500,
  "combat-spire→explore-spire": 1800, "combat-spire→hub": 2000,
  // Emotional / dramatic shifts — long enough to register as a turn of the page.
  "hub→hub-gone": 2000, "hub-gone→hub": 2000,
  "misted-place→reunion": 2200,
  "finale→hub": 2500, "finale-dark→hub": 2500,
  // Leaving creation.
  "title→hub": 1400,
};
function fadeMsFor(from, to) {
  if (!from) return DEFAULT_FADE_MS;
  return FADE_TABLE[`${from}→${to}`] ?? FADE_TABLE[`*→${to}`] ?? DEFAULT_FADE_MS;
}

/* ---- runtime state ---- */
let els = null;        // [audioA, audioB]
let activeIdx = 0;     // which element is currently "foreground"
let enabled = true;
let volume = DEFAULT_VOLUME;
let armed = false;     // has a user gesture unlocked playback yet?
let scene = null;      // current scene name
let playlist = [];     // tracks for `scene`
let plPos = 0;         // index within `playlist`
let curTrack = null;   // track name currently in the foreground (for the marquee)
let fadeTimer = null;
let onChange = null;   // UI-sync callback ({ enabled, volume, track })

/* ---- persistence (best-effort; private mode falls back to session) ---- */
function readEnabled() {
  try { const v = localStorage.getItem(ENABLED_KEY); return v === null ? true : v === "1"; }
  catch { return true; }
}
function readVolume() {
  try { const v = parseFloat(localStorage.getItem(VOLUME_KEY)); return Number.isFinite(v) ? v : DEFAULT_VOLUME; }
  catch { return DEFAULT_VOLUME; }
}
function persist() {
  try {
    localStorage.setItem(ENABLED_KEY, enabled ? "1" : "0");
    localStorage.setItem(VOLUME_KEY, String(volume));
  } catch { /* session-only */ }
}

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const trackUrl = (name) => encodeURI(TRACK_DIR + (TRACKS[name] || ""));

/* Map the game model to a scene name. Pure read; safe on partial models. */
export function sceneForModel(model) {
  if (!model || !model.character || !model.character.created) return "title";
  // The finale theme carries through the fight, the brink choice, and the ending
  // (flags.finaleActive stays set until the player issues their next command).
  // Once the player chooses to SEIZE the Despair at the brink, the music turns:
  // finale-dark covers both Dark Ascension and the Eldritch Merge.
  if (model.world && model.world.flags && model.world.flags.finaleActive) {
    return model.world.flags.finaleCorrupt ? "finale-dark" : "finale";
  }
  if (model.mode === "combat" && model.combat) {
    if (model.combat.finale) return "finale";
    // A dungeon with its own battle theme uses it for every fight there (boss included).
    const loc = model.world && model.world.currentLocation;
    if (DUNGEON_COMBAT[loc]) return DUNGEON_COMBAT[loc];
    if (model.combat.enemy && model.combat.enemy.isBoss) return "boss";
    return "combat";
  }
  if (model.mode === "exploration") {
    const loc = model.world && model.world.currentLocation;
    // The Misted Place: mysterious memory music, but it turns warm the moment the
    // companion is revived there (and stays warm on any later visit).
    if (loc === "secret") {
      return model.world.flags && model.world.flags.mascotRecovered ? "reunion" : "misted-place";
    }
    if (DUNGEON_EXPLORE[loc]) return DUNGEON_EXPLORE[loc];
    return "explore";
  }
  // The hub turns mournful while the companion is missing; back to cozy once it returns.
  if (model.world && model.world.flags && model.world.flags.mascotGone) return "hub-gone";
  return "hub";
}

/* ---- crossfade engine ----
   Equal-power crossfade (sin/cos curves) instead of linear: human hearing is
   logarithmic, and an equal-power curve keeps perceived loudness ~constant
   through the crossover so neither track "dips" in the middle. `xfade=true`
   uses sin/cos on the pair; a solo fade-out (mute) uses cos alone. */
function fadeTo(jobs, durationMs, opts = {}) {
  if (fadeTimer) { clearInterval(fadeTimer); fadeTimer = null; }
  const stepMs = 30;
  const steps = Math.max(4, Math.round(durationMs / stepMs));
  const starts = jobs.map((j) => j.el.volume);
  const xfade = !!opts.xfade;
  let i = 0;
  fadeTimer = setInterval(() => {
    i++;
    const k = Math.min(1, i / steps);
    jobs.forEach((j, idx) => {
      if (xfade) {
        // equal-power: outgoing → cos(k·π/2)·start, incoming → sin(k·π/2)·target
        const v = j.to > starts[idx]
          ? Math.sin(k * Math.PI / 2) * j.to
          : Math.cos(k * Math.PI / 2) * starts[idx];
        j.el.volume = clamp01(v);
      } else {
        // single-target fade (mute/unmute): cosine ease so the tail isn't abrupt
        const eased = j.to > starts[idx]
          ? starts[idx] + (j.to - starts[idx]) * (1 - Math.cos(k * Math.PI / 2))
          : starts[idx] * Math.cos(k * Math.PI / 2);
        j.el.volume = clamp01(eased);
      }
    });
    if (i >= steps) {
      clearInterval(fadeTimer); fadeTimer = null;
      jobs.forEach((j) => { if (j.to === 0) { try { j.el.pause(); } catch {} } });
    }
  }, stepMs);
}

/* Crossfade from the foreground element to `trackName` on the other element.
   `fromScene`/`toScene` pick the right duration via FADE_TABLE; an initial
   start-up fade (no scene yet) uses the default. */
function crossfadeTo(trackName, fromScene, toScene) {
  if (!els || !trackName) return;
  const cur = els[activeIdx];
  const next = els[1 - activeIdx];
  next.src = trackUrl(trackName);
  next.loop = true; // a scene's track loops until the scene itself changes
  next.volume = 0;
  try { next.currentTime = 0; } catch {}
  next.play().catch(() => { /* still locked; a later gesture will retry */ });
  const dur = fadeMsFor(fromScene, toScene);
  fadeTo([{ el: next, to: volume }, { el: cur, to: 0 }], dur, { xfade: true });
  activeIdx = 1 - activeIdx;
  curTrack = trackName;
  syncUI(); // refresh the now-playing marquee
}

/* Per-scene rotation: a multi-track scene picks the NEXT track each time it's
   (re)entered, so repeat visits vary — but that track then loops for the whole
   visit. Single-track scenes always return 0. */
const rot = {};
function nextTrackIndex(name, len) {
  if (len <= 1) return 0;
  rot[name] = rot[name] === undefined ? 0 : (rot[name] + 1) % len;
  return rot[name];
}

/* ---- public API ---- */

/** Wire up the audio elements. `syncCb({enabled, volume})` keeps the UI in step. */
export function initMusic(syncCb) {
  onChange = syncCb || null;
  enabled = readEnabled();
  volume = readVolume();

  els = [document.createElement("audio"), document.createElement("audio")];
  for (const a of els) {
    a.preload = "auto";
    a.volume = 0;
    document.body.appendChild(a);
  }

  // Arm on the first user gesture (autoplay policy). Once armed, start the
  // pending scene if music is on.
  const arm = () => {
    if (armed) return;
    armed = true;
    window.removeEventListener("pointerdown", arm);
    window.removeEventListener("keydown", arm);
    if (enabled && scene && playlist.length) crossfadeTo(playlist[plPos], null, scene);
  };
  window.addEventListener("pointerdown", arm);
  window.addEventListener("keydown", arm);

  syncUI();
}

/** Switch to the music for a scene name. No-op if already there. */
export function setScene(name) {
  if (!name || name === scene) return; // already in this scene → keep looping its track
  const prev = scene;
  scene = name;
  playlist = SCENES[name] || [];
  plPos = nextTrackIndex(name, playlist.length); // one track for the whole visit
  if (!enabled || !armed || !playlist.length) return; // remembered; starts when able
  crossfadeTo(playlist[plPos], prev, name);
}

/** Turn music on/off (persisted). */
export function setEnabled(on) {
  enabled = !!on;
  persist();
  if (enabled) {
    if (armed && playlist.length) crossfadeTo(playlist[plPos], null, scene); // crossfadeTo syncs UI
  } else if (els) {
    fadeTo([{ el: els[activeIdx], to: 0 }], 600); // a snappy but smooth mute
    curTrack = null;
  }
  syncUI();
}

export function toggleEnabled() { setEnabled(!enabled); }

/** Set playback volume 0..1 (persisted). */
export function setVolume(v) {
  volume = clamp01(v);
  persist();
  if (enabled && els && fadeTimer === null) els[activeIdx].volume = volume;
  syncUI();
}

export function getMusicState() { return { enabled, volume, track: enabled ? curTrack : null }; }

function syncUI() { if (onChange) onChange({ enabled, volume, track: enabled ? curTrack : null }); }
