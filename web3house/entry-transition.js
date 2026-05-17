/**
 * Web3House — cinematic entry: zoom into logo door → yellow wash → hub
 */
(function (global) {
  "use strict";

  var SESSION_KEY = "w3h-entered-v1";
  var PERSIST_KEY = "w3h-entered-persist-v1";

  /** Total timeline (ms) */
  var ZOOM_MS = 1800;
  var YELLOW_AT = 1400;
  var HUB_AT = 2000;
  var DONE_AT = 2600;

  var MAX_SCALE = 85;

  var DOOR_U = 0.5;
  var DOOR_V = 0.355;

  var transitioning = false;
  var zoomRaf = 0;

  function prefersReducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function markVisited() {
    try {
      sessionStorage.setItem(SESSION_KEY, "1");
      localStorage.setItem(PERSIST_KEY, "1");
    } catch (e) {
      /* ignore */
    }
  }

  function easeInCubic(t) {
    return t * t * t;
  }

  function cancelZoom() {
    if (zoomRaf) {
      cancelAnimationFrame(zoomRaf);
      zoomRaf = 0;
    }
  }

  function resetEntry(entry) {
    if (!entry) return;
    cancelZoom();
    entry.classList.remove("entry--entering", "entry--passage", "entry--exiting");
    entry.style.removeProperty("--entry-passage-x");
    entry.style.removeProperty("--entry-passage-y");

    var zoom = entry.querySelector(".entry__zoom-target");
    if (zoom) {
      zoom.classList.remove("entry__zoom-running");
      zoom.style.removeProperty("transform");
      zoom.style.removeProperty("filter");
      zoom.style.removeProperty("transform-origin");
    }

    var passage = document.getElementById("entryPassage");
    if (passage) {
      passage.classList.remove("entry__passage--on", "entry__passage--fade");
      passage.style.removeProperty("opacity");
      passage.style.removeProperty("transition");
    }
  }

  function setDoorFocus(entry) {
    var img = entry.querySelector(".entry__logo-img");
    var zoom = entry.querySelector(".entry__zoom-target");
    if (!img || !zoom) return null;

    var ir = img.getBoundingClientRect();
    var zr = zoom.getBoundingClientRect();
    if (ir.width < 1 || zr.width < 1) return null;

    var doorX = ir.left + ir.width * DOOR_U;
    var doorY = ir.top + ir.height * DOOR_V;
    var vw = window.innerWidth || 1;
    var vh = window.innerHeight || 1;

    entry.style.setProperty("--entry-passage-x", ((doorX / vw) * 100).toFixed(2) + "%");
    entry.style.setProperty("--entry-passage-y", ((doorY / vh) * 100).toFixed(2) + "%");

    var ox = ((doorX - zr.left) / zr.width) * 100;
    var oy = ((doorY - zr.top) / zr.height) * 100;
    zoom.style.transformOrigin = ox.toFixed(2) + "% " + oy.toFixed(2) + "%";
    return zoom;
  }

  function runZoom(zoom) {
    cancelZoom();
    var start = 0;

    function frame(ts) {
      if (!start) start = ts;
      var t = Math.min(1, (ts - start) / ZOOM_MS);
      var eased = easeInCubic(t);
      var scale = 1 + eased * (MAX_SCALE - 1);
      var blur = eased * 10;
      var bright = 1 + eased * 0.45;

      zoom.style.transform = "scale(" + scale.toFixed(3) + ")";
      zoom.style.filter = "blur(" + blur.toFixed(2) + "px) brightness(" + bright.toFixed(3) + ")";

      if (t < 1) {
        zoomRaf = requestAnimationFrame(frame);
      } else {
        zoomRaf = 0;
      }
    }

    zoomRaf = requestAnimationFrame(frame);
  }

  function showYellowWash(entry) {
    var passage = document.getElementById("entryPassage");
    if (!passage) return;
    entry.classList.add("entry--passage");
    passage.classList.add("entry__passage--on");
  }

  function fadeYellowAndExit(entry, onDone) {
    var passage = document.getElementById("entryPassage");
    if (passage) {
      passage.classList.add("entry__passage--fade");
    }
    entry.classList.add("entry--exiting");
    document.body.classList.add("entry-done");

    setTimeout(function () {
      resetEntry(entry);
      document.body.classList.remove("entry-transition-active");
      transitioning = false;
      if (onDone) onDone();
    }, 550);
  }

  /**
   * @param {function} onRevealHub
   * @param {{ cinematic?: boolean }} opts — cinematic:true = always full zoom (button click)
   */
  function playEnterTransition(onRevealHub, opts) {
    var entry = document.getElementById("entry");
    var cinematic = !opts || opts.cinematic !== false;

    if (!entry || transitioning) {
      if (onRevealHub) onRevealHub();
      return Promise.resolve();
    }

    if (prefersReducedMotion()) {
      markVisited();
      document.body.classList.add("hub-visible", "hub-active", "entry-done");
      if (onRevealHub) onRevealHub();
      return Promise.resolve();
    }

    /* Non-cinematic only for programmatic shortcuts; button always sends cinematic */
    if (!cinematic) {
      markVisited();
      document.body.classList.add("entry-transition-active", "hub-visible", "hub-active", "entry-done");
      if (onRevealHub) onRevealHub();
      setTimeout(function () {
        document.body.classList.remove("entry-transition-active");
      }, 300);
      return Promise.resolve();
    }

    transitioning = true;
    markVisited();

    document.body.classList.add("entry-transition-active");
    resetEntry(entry);

    var inner = entry.querySelector(".entry__inner");
    if (inner) inner.style.transform = "";

    var zoom = setDoorFocus(entry);
    if (!zoom) {
      transitioning = false;
      if (onRevealHub) onRevealHub();
      document.body.classList.add("hub-visible", "hub-active", "entry-done");
      return Promise.resolve();
    }

    entry.classList.add("entry--entering");
    zoom.classList.add("entry__zoom-running");

    runZoom(zoom);

    return new Promise(function (resolve) {
      setTimeout(function () {
        showYellowWash(entry);
      }, YELLOW_AT);

      setTimeout(function () {
        if (onRevealHub) onRevealHub();
        document.body.classList.add("hub-visible", "hub-active");
      }, HUB_AT);

      setTimeout(function () {
        fadeYellowAndExit(entry, resolve);
      }, DONE_AT);
    });
  }

  function playAmbientSound(id) {
    var el = document.getElementById(id);
    if (!el || el.muted) return;
    try {
      el.currentTime = 0;
      var p = el.play();
      if (p && typeof p.catch === "function") p.catch(function () {});
    } catch (e) {
      /* ignore */
    }
  }

  function initFireflies() {
    var host = document.getElementById("entryFireflies");
    if (!host || prefersReducedMotion()) return;
    for (var i = 0; i < 10; i++) {
      var dot = document.createElement("span");
      dot.className = "entry__firefly";
      dot.style.setProperty("--x", Math.round(8 + Math.random() * 84) + "%");
      dot.style.setProperty("--y", Math.round(10 + Math.random() * 80) + "%");
      dot.style.setProperty("--dur", 4 + Math.random() * 5 + "s");
      dot.style.setProperty("--delay", Math.random() * 4 + "s");
      host.appendChild(dot);
    }
  }

  function initParallax() {
    if (prefersReducedMotion() || window.matchMedia("(pointer: coarse)").matches) return;
    var inner = document.querySelector(".entry__inner");
    if (!inner) return;
    var raf = 0;
    var tx = 0;
    var ty = 0;

    function apply() {
      raf = 0;
      if (document.body.classList.contains("hub-active")) return;
      inner.style.transform = "translate3d(" + tx + "px," + ty + "px,0)";
    }

    window.addEventListener(
      "mousemove",
      function (e) {
        if (document.body.classList.contains("entry-transition-active")) return;
        tx = (e.clientX / window.innerWidth - 0.5) * 8;
        ty = (e.clientY / window.innerHeight - 0.5) * 5;
        if (!raf) raf = requestAnimationFrame(apply);
      },
      { passive: true }
    );
  }

  function init() {
    initFireflies();
    initParallax();
    var enterBtn = document.getElementById("enterBtn");
    if (enterBtn) {
      enterBtn.addEventListener("click", function () {
        playAmbientSound("entryDoorSound");
      });
    }
  }

  global.Web3HouseEntry = {
    init: init,
    playEnterTransition: playEnterTransition,
    markVisited: markVisited,
    prefersReducedMotion: prefersReducedMotion,
  };
})(window);
