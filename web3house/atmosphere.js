/**
 * Web3House — atmosphere, time-of-day, theme, spotlight
 */
(function (global) {
  "use strict";

  var STORAGE_THEME = "w3h-theme";
  var spotlightTimer = null;
  var spotlightIndex = 0;
  var spotlightList = [];

  function esc(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function isNightHour() {
    var h = new Date().getHours();
    return h < 7 || h >= 19;
  }

  function applyTimeOfDay() {
    document.body.classList.remove("w3h-time-day", "w3h-time-night");
    document.body.classList.add(isNightHour() ? "w3h-time-night" : "w3h-time-day");
  }

  function getStoredTheme() {
    try {
      return localStorage.getItem(STORAGE_THEME);
    } catch (e) {
      return null;
    }
  }

  function setStoredTheme(value) {
    try {
      if (value) localStorage.setItem(STORAGE_THEME, value);
      else localStorage.removeItem(STORAGE_THEME);
    } catch (e) {
      /* ignore */
    }
  }

  function applyTheme(mode) {
    var afterHours = mode === "afterhours";
    document.body.classList.toggle("w3h-theme-afterhours", afterHours);
    document.body.classList.toggle("w3h-theme-clubhouse", !afterHours);
    var btn = document.getElementById("themeToggleBtn");
    if (btn) {
      btn.setAttribute("aria-pressed", afterHours ? "true" : "false");
      btn.textContent = afterHours ? "☀️ Daytime" : "🌙 After Hours";
      btn.title = afterHours ? "Switch to daytime Web3House" : "Switch to after-hours lounge";
    }
  }

  function toggleTheme() {
    var next = document.body.classList.contains("w3h-theme-afterhours") ? "clubhouse" : "afterhours";
    setStoredTheme(next);
    applyTheme(next);
  }

  function initTheme() {
    var stored = getStoredTheme();
    applyTheme(stored === "afterhours" ? "afterhours" : "clubhouse");
  }

  function spotlightPool(communities) {
    var featured = communities.filter(function (c) {
      return c.featured;
    });
    return featured.length ? featured : communities.slice();
  }

  function founderSnippet(c) {
    if (c.showcase && c.showcase.founder) {
      var f = c.showcase.founder;
      var m =
        f.message ||
        (f.paragraphs && f.paragraphs.length ? f.paragraphs[0] : "");
      if (m) {
        return m.slice(0, 140) + (m.length > 140 ? "…" : "");
      }
    }
    return (
      "Whether you are brand new or a longtime collector — " +
      c.name +
      " is built as a place to belong, create, and connect."
    );
  }

  function renderSpotlightSlide(c) {
    var logo = c.logo
      ? '<img class="spotlight__logo" src="' + esc(c.logo) + '" alt="" />'
      : '<span class="spotlight__logo-ph">' + esc(c.logoInitials || c.name.charAt(0)) + "</span>";
    var edgeCls = c.logoEdgeFill ? " spotlight__visual--edge" : "";
    var wm = c.logo
      ? ' style="background-image:url(\'' + String(c.logo).replace(/'/g, "%27") + "')\""
      : "";
    return (
      '<article class="spotlight__slide" data-id="' +
      esc(c.id) +
      '">' +
      '<div class="spotlight__wm" aria-hidden="true"' +
      wm +
      "></div>" +
      '<div class="spotlight__inner">' +
      '<div class="spotlight__visual' +
      edgeCls +
      '">' +
      logo +
      "</div>" +
      '<div class="spotlight__copy">' +
      '<p class="spotlight__eyebrow">Featured community</p>' +
      "<h2 class=\"spotlight__name\">" +
      esc(c.name) +
      "</h2>" +
      '<p class="spotlight__tagline">' +
      esc(c.tagline || c.description) +
      "</p>" +
      '<blockquote class="spotlight__quote">“' +
      esc(founderSnippet(c)) +
      "”</blockquote>" +
      '<button type="button" class="btn btn--primary spotlight__cta" data-spotlight-id="' +
      esc(c.id) +
      '">Explore community</button>' +
      "</div>" +
      "</div>" +
      "</article>"
    );
  }

  function showSpotlightSlide(index) {
    var root = document.getElementById("spotlightRoot");
    if (!root || !spotlightList.length) return;
    spotlightIndex = ((index % spotlightList.length) + spotlightList.length) % spotlightList.length;
    var c = spotlightList[spotlightIndex];
    root.innerHTML = renderSpotlightSlide(c);
    var slide = root.querySelector(".spotlight__slide");
    if (slide) {
      requestAnimationFrame(function () {
        slide.classList.add("is-active");
      });
    }
    var dots = document.getElementById("spotlightDots");
    if (dots) {
      dots.querySelectorAll(".spotlight__dot").forEach(function (dot, i) {
        dot.classList.toggle("is-active", i === spotlightIndex);
        dot.setAttribute("aria-selected", i === spotlightIndex ? "true" : "false");
      });
    }
  }

  function bindSpotlightCta(openDetail) {
    var root = document.getElementById("spotlightRoot");
    if (!root || !openDetail) return;
    root.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-spotlight-id]");
      if (btn) openDetail(btn.getAttribute("data-spotlight-id"));
    });
  }

  function renderSpotlightDots() {
    var dots = document.getElementById("spotlightDots");
    if (!dots) return;
    dots.innerHTML = spotlightList
      .map(function (c, i) {
        return (
          '<button type="button" class="spotlight__dot' +
          (i === 0 ? " is-active" : "") +
          '" role="tab" aria-selected="' +
          (i === 0 ? "true" : "false") +
          '" aria-label="Show ' +
          esc(c.name) +
          '"></button>'
        );
      })
      .join("");
    dots.querySelectorAll(".spotlight__dot").forEach(function (dot, i) {
      dot.addEventListener("click", function () {
        showSpotlightSlide(i);
        resetSpotlightTimer();
      });
    });
  }

  function resetSpotlightTimer() {
    if (spotlightTimer) clearInterval(spotlightTimer);
    if (spotlightList.length < 2) return;
    spotlightTimer = setInterval(function () {
      showSpotlightSlide(spotlightIndex + 1);
    }, 9000);
  }

  function initSpotlight(communities, openDetail) {
    spotlightList = spotlightPool(communities);
    if (!spotlightList.length) return;
    showSpotlightSlide(0);
    renderSpotlightDots();
    bindSpotlightCta(openDetail);
    resetSpotlightTimer();
  }

  function renderOrbitTrack(track, items, tier, angleOffset, spinBase) {
    if (!track || !items.length) return;
    var step = 360 / items.length;
    track.innerHTML = items
      .map(function (c, i) {
        var angle = angleOffset + i * step;
        var glow = c.featured ? " entry__orbit-item--glow" : "";
        var logo = c.logo
          ? '<img src="' + esc(c.logo) + '" alt="" loading="lazy" decoding="async" />'
          : '<span class="entry__orbit-ph">' + esc(c.logoInitials || c.name.charAt(0)) + "</span>";
        return (
          '<div class="entry__orbit-item entry__orbit-item--' +
          tier +
          glow +
          '" style="--orbit-angle:' +
          angle +
          "deg;--orbit-delay:" +
          i * 0.55 +
          "s;--spin-duration:" +
          (spinBase + (i % 3) * 6) +
          "s;--orbit-drift:" +
          (i % 2 ? -1 : 1) * (4 + (i % 3)) +
          'px">' +
          '<div class="entry__orbit-item__inner">' +
          logo +
          "</div></div>"
        );
      })
      .join("");
  }

  function initEntryOrbit(communities) {
    var outer = document.getElementById("entryOrbitOuter");
    var mid = document.getElementById("entryOrbitMid");
    var inner = document.getElementById("entryOrbitInner");
    if ((!outer && !mid && !inner) || !communities || !communities.length) return;

    var pool = communities
      .filter(function (c) {
        return c.id !== "little-ollie";
      })
      .slice();

    pool.sort(function (a, b) {
      return (b.featured ? 1 : 0) - (a.featured ? 1 : 0);
    });

    var picked = pool.slice(0, 12);
    if (!picked.length) return;

    var n = picked.length;
    var farN = Math.max(2, Math.ceil(n * 0.35));
    var nearN = Math.max(2, Math.ceil(n * 0.3));
    var midN = Math.max(1, n - farN - nearN);
    if (midN < 1) midN = 1;

    var farItems = picked.slice(0, farN);
    var midItems = picked.slice(farN, farN + midN);
    var nearItems = picked.slice(farN + midN);
    if (!nearItems.length) nearItems = midItems.splice(0, Math.min(2, midItems.length));

    renderOrbitTrack(outer, farItems, "far", 0, 32);
    renderOrbitTrack(mid, midItems.length ? midItems : farItems.slice(0, 2), "mid", 18, 24);
    renderOrbitTrack(inner, nearItems, "near", 8, 18);
  }

  function initEntryParallax() {
    var entry = document.getElementById("entry");
    var orbit = document.getElementById("entryOrbit");
    if (!entry) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    function applyParallax(px, py) {
      entry.style.setProperty("--entry-parallax-x", px + "px");
      entry.style.setProperty("--entry-parallax-y", py + "px");
      if (!orbit) return;
      var rings = orbit.querySelectorAll(".entry__orbit-ring[data-parallax]");
      rings.forEach(function (ring) {
        var depth = parseFloat(ring.getAttribute("data-parallax")) || 0.5;
        ring.style.transform =
          "translate3d(" + px * depth + "px," + py * depth + "px,0)";
      });
    }

    entry.addEventListener(
      "mousemove",
      function (e) {
        var px = ((e.clientX / window.innerWidth) - 0.5) * 16;
        var py = ((e.clientY / window.innerHeight) - 0.5) * 11;
        applyParallax(px, py);
      },
      { passive: true }
    );

    if (window.DeviceOrientationEvent) {
      window.addEventListener(
        "deviceorientation",
        function (e) {
          if (!e.gamma && !e.beta) return;
          var px = Math.max(-12, Math.min(12, (e.gamma || 0) * 0.35));
          var py = Math.max(-8, Math.min(8, ((e.beta || 0) - 45) * 0.12));
          applyParallax(px, py);
        },
        { passive: true }
      );
    }
  }

  function init(ctx) {
    document.body.classList.add("w3h-theme-clubhouse");
    applyTimeOfDay();
    initTheme();
    setInterval(applyTimeOfDay, 60000);

    if (ctx && ctx.communities) {
      initEntryOrbit(ctx.communities);
    }
    initEntryParallax();

    var themeBtn = document.getElementById("themeToggleBtn");
    if (themeBtn) themeBtn.addEventListener("click", toggleTheme);

    global.Web3HouseNewToWeb3?.mountHubAccordion?.();

    if (ctx && ctx.communities && ctx.openDetail) {
      initSpotlight(ctx.communities, ctx.openDetail);
    }

    var recommendLink = document.getElementById("footerRecommendLink");
    if (recommendLink && ctx && ctx.openRecommend) {
      recommendLink.addEventListener("click", function (e) {
        e.preventDefault();
        ctx.openRecommend();
      });
    }
  }

  global.Web3HouseAtmosphere = {
    init: init,
    applyTimeOfDay: applyTimeOfDay,
    applyTheme: applyTheme,
  };
})(window);
