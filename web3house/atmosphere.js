/**
 * Web3House — atmosphere, time-of-day, theme, spotlight
 */
(function (global) {
  "use strict";

  var STORAGE_THEME = "w3h-theme";
  var spotlightTimer = null;
  var spotlightIndex = 0;
  var spotlightList = [];

  var HUB_WEB3_TOPICS = [
    {
      icon: "✨",
      title: "What is an NFT?",
      body: "Digital collectibles that can unlock art, games, events, and friendships online — like a trading card, but on the internet.",
    },
    {
      icon: "🔑",
      title: "What is a wallet?",
      body: "Your personal keyring for Web3. You choose when to connect — it is not a bank account.",
    },
    {
      icon: "🛡️",
      title: "Staying safe",
      body: "Never share your secret phrase. Real teams will not DM you first asking for money.",
    },
    {
      icon: "🔗",
      title: "Official links only",
      body: "Use buttons on community pages as your source of truth — bookmark sites yourself.",
    },
    {
      icon: "🌱",
      title: "Joining communities",
      body: "Follow official socials, read announcements, and say hello when you are ready. No expert badge required.",
    },
  ];

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
      btn.textContent = afterHours ? "☀️ Clubhouse" : "🌙 After Hours";
      btn.title = afterHours ? "Switch to daytime clubhouse" : "Switch to after-hours lounge";
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
    if (c.showcase && c.showcase.founder && c.showcase.founder.message) {
      var m = c.showcase.founder.message;
      return m.slice(0, 140) + (m.length > 140 ? "…" : "");
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
      '<div class="spotlight__visual">' +
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

  function renderHubWeb3() {
    var grid = document.getElementById("hubWeb3Grid");
    if (!grid) return;
    grid.innerHTML = HUB_WEB3_TOPICS.map(function (topic) {
      return (
        '<article class="hub-web3-card">' +
        '<span class="hub-web3-card__icon" aria-hidden="true">' +
        topic.icon +
        "</span>" +
        "<h3>" +
        esc(topic.title) +
        "</h3>" +
        "<p>" +
        esc(topic.body) +
        "</p>" +
        "</article>"
      );
    }).join("");
  }

  function initEntryOrbit(communities) {
    var track = document.getElementById("entryOrbitTrack");
    if (!track || !communities || !communities.length) return;

    var pool = communities
      .filter(function (c) {
        return c.id !== "little-ollie";
      })
      .slice();

    pool.sort(function (a, b) {
      return (b.featured ? 1 : 0) - (a.featured ? 1 : 0);
    });

    var items = pool.slice(0, 8);
    if (!items.length) return;

    var step = 360 / items.length;
    track.innerHTML = items
      .map(function (c, i) {
        var angle = i * step;
        var logo = c.logo
          ? '<img src="' + esc(c.logo) + '" alt="" loading="lazy" decoding="async" />'
          : '<span class="entry__orbit-ph">' + esc(c.logoInitials || c.name.charAt(0)) + "</span>";
        return (
          '<div class="entry__orbit-item" style="--orbit-angle:' +
          angle +
          "deg;--orbit-delay:" +
          i * 0.35 +
          "s;--spin-duration:" +
          (18 + (i % 4) * 4) +
          's">' +
          '<div class="entry__orbit-item__inner">' +
          logo +
          "</div></div>"
        );
      })
      .join("");
  }

  function initEntryParallax() {
    var entry = document.getElementById("entry");
    if (!entry) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (window.matchMedia("(max-width: 900px)").matches) return;

    entry.addEventListener(
      "mousemove",
      function (e) {
        var x = ((e.clientX / window.innerWidth) - 0.5) * 14;
        var y = ((e.clientY / window.innerHeight) - 0.5) * 10;
        entry.style.setProperty("--entry-parallax-x", x + "px");
        entry.style.setProperty("--entry-parallax-y", y + "px");
      },
      { passive: true }
    );
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

    renderHubWeb3();

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
