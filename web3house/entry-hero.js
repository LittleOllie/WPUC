/**
 * Web3House — landing hero rotating copy
 */
(function (global) {
  "use strict";

  var ROTATOR_LINES = [
    "Discover hand-picked Web3 communities.",
    "Find your next favorite project.",
    "Explore the culture behind the NFTs.",
    "Meet the communities shaping internet culture.",
    "No wallet required to browse.",
    "Built for curious explorers.",
    "Verified links. Real communities.",
    "Step into the world behind the art.",
    "More than floor prices.",
    "Find people who share your vibe.",
  ];

  var INTERVAL_MS = 4000;

  var timer = 0;
  var index = 0;
  var lines = [];
  var lineA = null;
  var lineB = null;
  var useA = true;

  function prefersReducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i];
      a[i] = a[j];
      a[j] = t;
    }
    return a;
  }

  function activeEl() {
    return useA ? lineA : lineB;
  }

  function hiddenEl() {
    return useA ? lineB : lineA;
  }

  function setVisible(el, on) {
    if (!el) return;
    el.classList.toggle("is-visible", on);
    if (on) {
      el.removeAttribute("aria-hidden");
    } else {
      el.setAttribute("aria-hidden", "true");
    }
  }

  function showLine(text) {
    var next = hiddenEl();
    var current = activeEl();
    if (!next || !current) return;

    next.textContent = text;
    setVisible(next, true);
    setVisible(current, false);
    useA = !useA;
  }

  function tick() {
    index = (index + 1) % lines.length;
    showLine(lines[index]);
  }

  function startRotation() {
    if (timer || lines.length < 2) return;
    timer = window.setInterval(tick, INTERVAL_MS);
  }

  function stopRotation() {
    if (timer) {
      window.clearInterval(timer);
      timer = 0;
    }
  }

  function init() {
    lineA = document.getElementById("entryRotatorA");
    lineB = document.getElementById("entryRotatorB");
    if (!lineA || !lineB) return;

    lines = shuffle(ROTATOR_LINES);
    index = 0;

    lineA.textContent = lines[0];
    lineB.textContent = lines[1] || lines[0];

    setVisible(lineA, true);
    setVisible(lineB, false);

    if (prefersReducedMotion()) {
      lineB.setAttribute("aria-hidden", "true");
      return;
    }

    startRotation();

    document.addEventListener("visibilitychange", function () {
      if (document.hidden) {
        stopRotation();
      } else {
        startRotation();
      }
    });
  }

  global.Web3HouseEntryHero = {
    init: init,
    stop: stopRotation,
  };
})(window);
