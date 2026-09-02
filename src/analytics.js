/* ============================================================
   MAGICAL.EXE — analytics.js
   Thin Mixpanel wrapper. Loaded lazily; never breaks gameplay.

   Design contract (mirrors ai.js):
     - Failure is silent. A blocked CDN, missing token, or opt-out
       all degrade to a no-op. No analytics call ever throws.
     - Opt-out is honoured before the SDK even loads. We persist
       the flag in localStorage so it survives a reload.
     - Calls made before the CDN finishes downloading are queued
       and flushed on init — boot-time events never race the SDK.

   The Mixpanel project token is read from CONFIG.analytics.mixpanelToken.
   Leave the placeholder ("YOUR_MIXPANEL_TOKEN") to disable tracking
   entirely; the game then runs identically with no network calls.
   ============================================================ */

import { CONFIG } from "../config.js";

const OPTOUT_KEY = "magicalexe.analytics.optout";
// Mixpanel's official CDN. The snippet below creates a stub `mixpanel` global
// that queues calls; once this script loads, it replays them onto the real SDK.
const SDK_URL = "https://cdn.mxpnl.com/libs/mixpanel-2-latest.min.js";

let _enabled = false;        // SDK loaded + init succeeded
let _initPromise = null;     // single-flight loader
const _queue = [];           // events queued while the SDK was loading

/* Install Mixpanel's stub global. Lifted verbatim from their docs — it creates
   `window.mixpanel` as a queueing proxy so `track()` calls made before the real
   SDK lands aren't lost. Once the SDK loads it replays the queue and replaces
   itself. We still keep our own _queue as belt-and-suspenders for the case where
   the SDK never loads at all (blocked CDN). Idempotent: bails if already set up. */
function installStub() {
  if (window.mixpanel && window.mixpanel.__SV) return;
  (function (c, a) {
    if (!a.__SV) {
      var b = window;
      window.mixpanel = a;
      a._i = [];
      a.init = function (b, d, g) {
        function c(b, i) {
          var a = i.split(".");
          2 == a.length && (b = b[a[0]], i = a[1]);
          b[i] = function () { b.push([i].concat(Array.prototype.slice.call(arguments, 0))); };
        }
        var e = a;
        "undefined" !== typeof g ? e = a[g] = [] : g = "mixpanel";
        e.people = e.people || [];
        e.toString = function (b) {
          var a = "mixpanel";
          "mixpanel" !== g && (a += "." + g);
          b || (a += " (stub)");
          return a;
        };
        e.people.toString = function () { return e.toString(1) + ".people (stub)"; };
        var l = ("disable time_event track track_pageview track_links track_forms track_with_groups " +
          "add_group set_group remove_group register register_once alias unregister identify name_tag " +
          "set_config reset opt_in_tracking opt_out_tracking has_opted_in_tracking has_opted_out_tracking " +
          "clear_opt_in_out_tracking start_batch_senders people.set people.set_once people.unset " +
          "people.increment people.append people.union people.track_charge people.clear_charges " +
          "people.delete_user people.remove").split(" ");
        for (var h = 0; h < l.length; h++) c(e, l[h]);
        a._i.push([b, d, g]);
      };
      a.__SV = 1.2;
    }
  })(document, window.mixpanel || []);
}

function tokenConfigured() {
  const t = CONFIG.analytics && CONFIG.analytics.mixpanelToken;
  return !!(t && !String(t).includes("YOUR_"));
}

/** Has the player opted out of analytics? Read from localStorage so the
    decision survives reloads (private mode: defaults to opted-in). */
export function isOptedOut() {
  try { return localStorage.getItem(OPTOUT_KEY) === "1"; } catch { return false; }
}

/** Toggle opt-out. Persists the flag and, if Mixpanel is already loaded,
    flips its in-memory opt state too so the change takes effect immediately. */
export function setOptOut(flag) {
  const off = !!flag;
  try { localStorage.setItem(OPTOUT_KEY, off ? "1" : "0"); } catch { /* private mode */ }
  const mp = window.mixpanel;
  if (mp && typeof mp.opt_out_tracking === "function") {
    if (off) mp.opt_out_tracking();
    else mp.opt_in_tracking();
  }
  if (!off && !_enabled) loadSdk(); // opting back in mid-session loads the SDK
}

function loadSdk() {
  if (_initPromise) return _initPromise;
  if (!tokenConfigured() || isOptedOut()) {
    _initPromise = Promise.resolve(false);
    return _initPromise;
  }
  _initPromise = new Promise((resolve) => {
    // Install the stub and call init() BEFORE the SDK lands — calls (init,
    // register, track) queue onto the stub and replay once the real script runs.
    installStub();
    try {
      window.mixpanel.init(CONFIG.analytics.mixpanelToken, {
        track_pageview: false,
        persistence: "localStorage",
        api_host: "https://api-js.mixpanel.com",
      });
      const sp = (CONFIG.analytics && CONFIG.analytics.superProps) || {};
      window.mixpanel.register({
        app: "magical-exe",
        appVersion: (CONFIG.meta && CONFIG.meta.buildStamp) || "dev",
        ...sp,
      });
    } catch (e) {
      console.warn("[analytics] stub init failed:", e);
    }

    const s = document.createElement("script");
    s.async = true;
    s.src = SDK_URL;
    s.onload = () => {
      _enabled = true;
      // Flush our own queue too — covers track() calls that happened before
      // installStub ran (e.g. session_start fires synchronously during boot).
      const mp = window.mixpanel;
      for (const [event, props] of _queue) {
        try { mp.track(event, props); } catch { /* swallow */ }
      }
      _queue.length = 0;
      resolve(true);
    };
    s.onerror = (e) => {
      console.warn("[analytics] sdk load failed:", e);
      resolve(false);
    };
    document.head.appendChild(s);
  });
  return _initPromise;
}

/** Kick off SDK load (no-op if disabled / opted-out). Safe to call multiple times. */
export function initAnalytics() {
  loadSdk();
}

/** Record an event. Queues if the SDK isn't ready yet; drops silently otherwise.
    `props` should be a flat object of scalars — Mixpanel handles the rest. */
export function track(event, props = {}) {
  if (isOptedOut() || !tokenConfigured()) return;
  if (_enabled && window.mixpanel) {
    try { window.mixpanel.track(event, props); } catch { /* swallow */ }
  } else {
    _queue.push([event, props]);
    if (_queue.length > 200) _queue.shift(); // bound the queue if the SDK never loads
  }
}

/** Attach a stable identifier (e.g. the save slot name) to subsequent events.
    Mixpanel's auto-generated distinct_id stays primary; this just aliases. */
export function identify(id) {
  if (isOptedOut() || !_enabled || !window.mixpanel) return;
  try { window.mixpanel.identify(String(id)); } catch { /* swallow */ }
}
