/* ============================================================
   MAGICAL.EXE — viewport.js
   Mobile viewport + on-screen-keyboard plumbing.

   Phones disagree about what an open keyboard does to the page:
     - iOS Safari keeps the layout viewport (and 100dvh) at full height and
       instead SCROLLS the page up, so a "full-height" app has its titlebar
       shoved off-screen and its input line hidden under the keyboard.
     - Android Chrome, by default, only shrinks the *visual* viewport, so
       100dvh is likewise wrong (index.html asks for interactive-widget=
       resizes-content, which fixes Chrome — but not every browser honours it).

   So we stop trusting dvh and publish the real height ourselves:
     --app-h   the visual viewport height, in px
   The mobile layout sizes the whole app off that, and body is position:fixed
   so nothing can scroll out from under the player. When the keyboard is up we
   also flag `body.kb-open`, which lets the CSS trade decorative chrome (the
   mascot band, the example prompt, the Ko-fi pill) for scrollback room.
   ============================================================ */

/** Touch-ish device? Used to suppress desktop-only focus-stealing. */
export function isCoarsePointer() {
  return !!(window.matchMedia && window.matchMedia("(pointer: coarse)").matches);
}

/* The layout only reads --app-h below this width (matches the CSS breakpoint). */
const MOBILE_MAX = 720;
/* A visual-viewport shortfall this big can only be an on-screen keyboard. */
const KB_MIN_PX = 120;

/**
 * Publish --app-h and keep body.kb-open in sync with the on-screen keyboard.
 * @param {object} opts
 * @param {HTMLInputElement} opts.input  command field — whether it holds focus
 *   is the second keyboard signal (browsers that resize the layout viewport
 *   leave no visual-viewport shortfall to measure).
 * @param {() => void} opts.onChange  called after each settled resize, so the
 *   scrollback can re-pin itself to the bottom.
 */
export function initViewport({ input, onChange } = {}) {
  const vv = window.visualViewport;
  const notify = onChange || (() => {});
  let pending = 0;

  function apply() {
    pending = 0;
    const h = Math.round(vv ? vv.height : window.innerHeight);
    document.documentElement.style.setProperty("--app-h", `${h}px`);

    const mobile = window.innerWidth <= MOBILE_MAX;

    // Keyboard up if the visual viewport lost real estate, or (for browsers
    // that resize the layout viewport instead) if we're focused on a phone.
    // Read activeElement rather than latching a flag on focus/blur: hiding the
    // input line (a selection menu takes it over) drops focus without always
    // firing blur, and that must still count as "keyboard gone".
    const shortfall = window.innerHeight - h;
    const typing = !!input && document.activeElement === input;
    const kb = shortfall > KB_MIN_PX || (typing && isCoarsePointer());
    document.body.classList.toggle("kb-open", mobile && kb);

    // iOS scrolls the document to reveal the focused field. The mobile app is
    // fixed and unscrollable, so that scroll is pure damage — undo it.
    if (mobile && (window.scrollY !== 0 || (vv && vv.offsetTop !== 0))) window.scrollTo(0, 0);

    notify();
  }

  /* Coalesce the burst of events a keyboard animation fires. setTimeout, not
     rAF: rAF stalls in a backgrounded tab, so a pending frame that never ran
     would wedge the debounce shut for the rest of the session. */
  function schedule() {
    if (pending) return;
    pending = setTimeout(apply, 16);
  }

  if (vv) {
    vv.addEventListener("resize", schedule);
    vv.addEventListener("scroll", schedule);
  }
  window.addEventListener("resize", schedule);
  window.addEventListener("orientationchange", schedule);

  if (input) {
    input.addEventListener("focus", schedule);
    input.addEventListener("blur", schedule);
  }
  // A menu hiding the input line steals focus without a blur event on some
  // browsers — re-check whenever focus lands anywhere else in the document.
  document.addEventListener("focusout", schedule);

  apply();
}
