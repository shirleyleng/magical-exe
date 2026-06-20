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
  // Per-dungeon battle themes (cover both regular fights and that dungeon's boss).
  "combat-forest":     ["Moonlit Bloom Protocol"],
  "combat-harbor":     ["Harbor Tide"],
  "combat-clocktower": ["Moonglass Tower"],
  "combat-secret":     ["Mothlight Box"],
  combat:  ["Star Wand Static"], // generic fallback (hub skirmishes, later dungeons)
  boss:    ["Sailor Hope"],      // boss fights in dungeons without their own theme
  finale:  ["Sailor Hope"],
};

// Which dungeon (world.currentLocation) maps to which battle scene.
const DUNGEON_COMBAT = {
  forest:     "combat-forest",
  harbor:     "combat-harbor",
  clocktower: "combat-clocktower",
  secret:     "combat-secret", // the doubt fight stays in the misted mood
};

const ENABLED_KEY = "magicalexe.music.enabled";
const VOLUME_KEY  = "magicalexe.music.volume";
const FADE_MS = 700;        // crossfade / fade-out duration
const DEFAULT_VOLUME = 0.5; // background-friendly

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
  if (model.world && model.world.flags && model.world.flags.finaleActive) return "finale";
  if (model.mode === "combat" && model.combat) {
    if (model.combat.finale) return "finale";
    // A dungeon with its own battle theme uses it for every fight there (boss included).
    const loc = model.world && model.world.currentLocation;
    if (DUNGEON_COMBAT[loc]) return DUNGEON_COMBAT[loc];
    if (model.combat.enemy && model.combat.enemy.isBoss) return "boss";
    return "combat";
  }
  if (model.mode === "exploration") {
    // The Misted Place: mysterious memory music, but it turns warm the moment the
    // companion is revived there (and stays warm on any later visit).
    if (model.world && model.world.currentLocation === "secret") {
      return model.world.flags && model.world.flags.mascotRecovered ? "reunion" : "misted-place";
    }
    return "explore";
  }
  // The hub turns mournful while the companion is missing; back to cozy once it returns.
  if (model.world && model.world.flags && model.world.flags.mascotGone) return "hub-gone";
  return "hub";
}

/* ---- crossfade engine ---- */
function fadeTo(jobs, onDone) {
  if (fadeTimer) { clearInterval(fadeTimer); fadeTimer = null; }
  const steps = 24;
  const starts = jobs.map((j) => j.el.volume);
  let i = 0;
  fadeTimer = setInterval(() => {
    i++;
    const k = i / steps;
    jobs.forEach((j, idx) => { j.el.volume = clamp01(starts[idx] + (j.to - starts[idx]) * k); });
    if (i >= steps) {
      clearInterval(fadeTimer); fadeTimer = null;
      jobs.forEach((j) => { if (j.to === 0) { try { j.el.pause(); } catch {} } });
      if (onDone) onDone();
    }
  }, FADE_MS / steps);
}

/* Crossfade from the foreground element to `trackName` on the other element. */
function crossfadeTo(trackName) {
  if (!els || !trackName) return;
  const cur = els[activeIdx];
  const next = els[1 - activeIdx];
  next.src = trackUrl(trackName);
  next.loop = true; // a scene's track loops until the scene itself changes
  next.volume = 0;
  try { next.currentTime = 0; } catch {}
  next.play().catch(() => { /* still locked; a later gesture will retry */ });
  fadeTo([{ el: next, to: volume }, { el: cur, to: 0 }]);
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
    if (enabled && scene && playlist.length) crossfadeTo(playlist[plPos]);
  };
  window.addEventListener("pointerdown", arm);
  window.addEventListener("keydown", arm);

  syncUI();
}

/** Switch to the music for a scene name. No-op if already there. */
export function setScene(name) {
  if (!name || name === scene) return; // already in this scene → keep looping its track
  scene = name;
  playlist = SCENES[name] || [];
  plPos = nextTrackIndex(name, playlist.length); // one track for the whole visit
  if (!enabled || !armed || !playlist.length) return; // remembered; starts when able
  crossfadeTo(playlist[plPos]);
}

/** Turn music on/off (persisted). */
export function setEnabled(on) {
  enabled = !!on;
  persist();
  if (enabled) {
    if (armed && playlist.length) crossfadeTo(playlist[plPos]); // crossfadeTo syncs UI
  } else if (els) {
    fadeTo([{ el: els[activeIdx], to: 0 }]);
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
