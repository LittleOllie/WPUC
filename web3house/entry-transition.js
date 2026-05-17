/**
 * Web3House — cinematic entry: zoom into logo door → yellow wash → hub
 * iOS-safe: animationend + rAF failsafe (setTimeout can stall during heavy CSS zoom)
 */
(function (global) {
  "use strict";

  var SESSION_KEY = "w3h-entered-v1";
  var PERSIST_KEY = "w3h-entered-persist-v1";

  var ZOOM_MS = 1800;
  var YELLOW_MS_TOUCH = 320;
  var YELLOW_MS_DESKTOP = 480;
  var FAILSAFE_MS_TOUCH = 2600;
  var FAILSAFE_MS_DESKTOP = 3600;

  var DOOR_U = 0.5;
  var DOOR_V = 0.355;

  var transitioning = false;
  var transitionDone = false;
  var hubRevealed = false;
  var failsafeRaf = 0;

  function prefersReducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function isTouchDevice() {
    return (
      window.matchMedia("(pointer: coarse)").matches ||
      /iPhone|iPad|iPod|Android/i.test(navigator.userAgent || "")
    );
  }

  function markVisited() {
    try {
      sessionStorage.setItem(SESSION_KEY, "1");
      localStorage.setItem(PERSIST_KEY, "1");
    } catch (e) {
      /* ignore */
    }
  }

  function cancelFailsafe() {
    if (failsafeRaf) {
      cancelAnimationFrame(failsafeRaf);
      failsafeRaf = 0;
    }
  }

  function scrollPageToTop() {
    try {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    } catch (e) {
      window.scrollTo(0, 0);
    }
    if (document.documentElement) document.documentElement.scrollTop = 0;
    if (document.body) document.body.scrollTop = 0;
  }

  function resetEntry(entry) {
    if (!entry) return;
    entry.classList.remove(
      "entry--entering",
      "entry--entering-touch",
      "entry--passage",
      "entry--exiting"
    );
    entry.style.removeProperty("display");
    entry.removeAttribute("aria-hidden");
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
      passage.style.removeProperty("visibility");
      passage.style.removeProperty("pointer-events");
      passage.style.removeProperty("transition");
      passage.style.removeProperty("display");
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

  function hidePassage() {
    var passage = document.getElementById("entryPassage");
    if (!passage) return;
    passage.classList.remove("entry__passage--on");
    passage.classList.add("entry__passage--fade");
    passage.style.opacity = "0";
    passage.style.visibility = "hidden";
    passage.style.pointerEvents = "none";
    passage.style.display = "none";
  }

  function hideEntry(entry) {
    if (!entry) return;
    entry.classList.add("entry--exiting");
    entry.style.display = "none";
    entry.setAttribute("aria-hidden", "true");
  }

  function revealHub(onRevealHub) {
    if (hubRevealed) return;
    hubRevealed = true;
    document.body.classList.add("hub-visible", "hub-active");

    var hub = document.getElementById("hub");
    var atmosphere = document.querySelector(".hub-atmosphere");
    if (hub) {
      hub.style.opacity = "1";
      hub.style.transform = "translate3d(0, 0, 0)";
    }
    if (atmosphere) {
      atmosphere.style.opacity = "1";
      atmosphere.style.display = "";
    }

    scrollPageToTop();

    if (onRevealHub) {
      try {
        onRevealHub();
      } catch (err) {
        console.error("[Web3House] enterHub failed:", err);
      }
    }
  }

  function completeToHub(entry, onRevealHub, resolve) {
    if (transitionDone) {
      if (resolve) resolve();
      return;
    }
    transitionDone = true;
    transitioning = false;
    cancelFailsafe();

    hidePassage();
    hideEntry(entry);
    revealHub(onRevealHub);

    document.body.classList.add("entry-done");
    document.body.classList.remove("entry-transition-active");
    scrollPageToTop();

    requestAnimationFrame(function () {
      resetEntry(entry);

      var hub = document.getElementById("hub");
      var atmosphere = document.querySelector(".hub-atmosphere");
      if (hub) {
        hub.style.removeProperty("opacity");
        hub.style.removeProperty("transform");
      }
      if (atmosphere) {
        atmosphere.style.removeProperty("opacity");
        atmosphere.style.removeProperty("display");
      }

      hubRevealed = false;

      var enterBtn = document.getElementById("enterBtn");
      if (enterBtn) enterBtn.disabled = false;

      if (resolve) resolve();
    });
  }

  function showYellowWash(entry) {
    var passage = document.getElementById("entryPassage");
    if (!passage) return;
    entry.classList.add("entry--passage");
    passage.style.removeProperty("display");
    passage.style.opacity = "";
    passage.style.visibility = "";
    passage.classList.add("entry__passage--on");
  }

  function startFailsafe(entry, onRevealHub, resolve, ms) {
    var started = performance.now();

    function tick() {
      if (transitionDone) return;
      if (performance.now() - started >= ms) {
        completeToHub(entry, onRevealHub, resolve);
        return;
      }
      failsafeRaf = requestAnimationFrame(tick);
    }

    failsafeRaf = requestAnimationFrame(tick);
  }

  function bindZoomEnd(entry, zoom, onRevealHub, resolve) {
    var touch = isTouchDevice();
    var yellowMs = touch ? YELLOW_MS_TOUCH : YELLOW_MS_DESKTOP;
    var yellowTimer = 0;
    var finished = false;

    function afterYellow() {
      if (finished) return;
      finished = true;
      if (yellowTimer) clearTimeout(yellowTimer);
      completeToHub(entry, onRevealHub, resolve);
    }

    function onZoomEnd(ev) {
      if (ev && ev.target !== zoom) return;
      zoom.removeEventListener("animationend", onZoomEnd);
      zoom.removeEventListener("webkitAnimationEnd", onZoomEnd);

      showYellowWash(entry);
      hideEntry(entry);
      revealHub(onRevealHub);

      yellowTimer = setTimeout(afterYellow, yellowMs);
    }

    zoom.addEventListener("animationend", onZoomEnd);
    zoom.addEventListener("webkitAnimationEnd", onZoomEnd);

    setTimeout(function () {
      if (finished || transitionDone) return;
      onZoomEnd(null);
    }, ZOOM_MS + 120);
  }

  function playEnterTransition(onRevealHub, opts) {
    var entry = document.getElementById("entry");
    var cinematic = !opts || opts.cinematic !== false;

    if (!entry || transitioning) {
      if (onRevealHub) {
        try {
          onRevealHub();
        } catch (e) {
          /* ignore */
        }
      }
      return Promise.resolve();
    }

    if (prefersReducedMotion()) {
      markVisited();
      document.body.classList.add("hub-visible", "hub-active", "entry-done");
      hideEntry(entry);
      if (onRevealHub) {
        try {
          onRevealHub();
        } catch (e) {
          /* ignore */
        }
      }
      scrollPageToTop();
      return Promise.resolve();
    }

    if (!cinematic) {
      markVisited();
      document.body.classList.add("entry-transition-active", "hub-visible", "hub-active", "entry-done");
      hideEntry(entry);
      if (onRevealHub) {
        try {
          onRevealHub();
        } catch (e) {
          /* ignore */
        }
      }
      scrollPageToTop();
      setTimeout(function () {
        document.body.classList.remove("entry-transition-active");
      }, 300);
      return Promise.resolve();
    }

    transitioning = true;
    transitionDone = false;
    hubRevealed = false;
    markVisited();
    cancelFailsafe();

    if (global.Web3HouseEntryHero && global.Web3HouseEntryHero.stop) {
      global.Web3HouseEntryHero.stop();
    }

    document.body.classList.add("entry-transition-active");
    resetEntry(entry);

    var inner = entry.querySelector(".entry__inner");
    if (inner) inner.style.transform = "";

    var zoom = setDoorFocus(entry);
    if (!zoom) {
      return new Promise(function (resolve) {
        completeToHub(entry, onRevealHub, resolve);
      });
    }

    entry.classList.add("entry--entering");
    if (isTouchDevice()) {
      entry.classList.add("entry--entering-touch");
    }
    zoom.classList.add("entry__zoom-running");

    return new Promise(function (resolve) {
      var failsafeMs = isTouchDevice() ? FAILSAFE_MS_TOUCH : FAILSAFE_MS_DESKTOP;
      bindZoomEnd(entry, zoom, onRevealHub, resolve);
      startFailsafe(entry, onRevealHub, resolve, failsafeMs);
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
    if (prefersReducedMotion() || isTouchDevice()) return;
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
    scrollPageToTop: scrollPageToTop,
    markVisited: markVisited,
    prefersReducedMotion: prefersReducedMotion,
  };
})(window);
