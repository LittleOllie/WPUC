/**
 * Little Ollie World — Stage 1 homepage interactions
 */
(function () {
  "use strict";

  document.documentElement.classList.add("home-page-root", "home-js");

  /* Always open at the top on refresh / revisit (disable browser scroll restore) */
  if ("scrollRestoration" in history) {
    history.scrollRestoration = "manual";
  }

  function scrollToTop() {
    window.scrollTo(0, 0);
    if (document.documentElement) document.documentElement.scrollTop = 0;
    if (document.body) document.body.scrollTop = 0;
  }

  if (window.location.hash) {
    history.replaceState(null, "", window.location.pathname + window.location.search);
  }

  scrollToTop();
  window.addEventListener("load", scrollToTop);
  window.addEventListener("pageshow", function () {
    scrollToTop();
  });

  /**
   * Central hero asset map — replace files in webpageassets/ to update the scene.
   * Paths are relative to the site root (index.html).
   * Missing files are hidden gracefully (no broken-image icons).
   *
   * Optional interim fallbacks keep the layout readable until final art lands.
   */
  var heroAssets = {
    // Dad + Ollie standing together (main visual focus)
    characters: {
      src: "webpageassets/hero-dad-and-ollie.png",
      critical: true,
    },
    // Optional book glow layer (not used with standing pose art)
    book: {
      src: "webpageassets/hero-open-book.png",
    },
    // Distant hills / scenery (currently using playground.png)
    hills: {
      src: "webpageassets/playground.png",
      critical: true,
    },
    // Foreground grass / flowers / near clouds
    foreground: {
      src: "webpageassets/hero-foreground.png",
    },
    // Magical objects (optional — hidden if missing)
    magicRocket: { src: "webpageassets/magic-rocket.png" },
    magicMusic: { src: "webpageassets/magic-music-note.png" },
    magicPalette: { src: "webpageassets/magic-palette.png" },
    magicBulb: { src: "webpageassets/magic-lightbulb.png" },
    magicStar: { src: "webpageassets/magic-star.png" },
    magicPlane: { src: "webpageassets/magic-paper-plane.png" },
    // Journey cards
    cardFamily: { src: "webpageassets/family.jpeg" },
    cardStories: { src: "webpageassets/BookCover.jpg" },
    cardSchool: { src: "webpageassets/Friendship.png" },
    cardLabs: { src: "webpageassets/Creativity.png" },
    cardAdventure: { src: "webpageassets/Resilience.png" },
  };

  function hideHeroImage(img) {
    if (!img) return;
    img.hidden = true;
    img.removeAttribute("src");
    img.classList.add("is-missing");

    var layer = img.closest(".hero-scene__layer");
    if (layer) {
      layer.classList.remove("is-loaded");
    }

    var backdrop = img.closest(".home-hero__backdrop, .home-hero-world");
    if (backdrop) {
      backdrop.classList.remove("is-loaded");
    }

    var cardIcon = img.closest(".journey-card__icon");
    if (cardIcon) {
      cardIcon.classList.remove("is-loaded");
    }
  }

  function showHeroImage(img) {
    if (!img) return;
    img.removeAttribute("hidden");
    img.hidden = false;
    img.classList.remove("is-missing");

    var layer = img.closest(".hero-scene__layer");
    if (layer) {
      layer.classList.add("is-loaded");
    }

    var backdrop = img.closest(".home-hero__backdrop, .home-hero-world");
    if (backdrop) {
      backdrop.classList.add("is-loaded");
    }

    var cardIcon = img.closest(".journey-card__icon");
    if (cardIcon) {
      cardIcon.classList.add("is-loaded");
    }
  }

  function loadHeroImage(img, primarySrc, fallbackSrc) {
    if (!img || !primarySrc) {
      hideHeroImage(img);
      return;
    }

    var triedFallback = false;

    function onError() {
      if (fallbackSrc && !triedFallback) {
        triedFallback = true;
        img.src = fallbackSrc;
        return;
      }
      img.removeEventListener("load", onLoad);
      img.removeEventListener("error", onError);
      hideHeroImage(img);
    }

    function onLoad() {
      img.removeEventListener("load", onLoad);
      img.removeEventListener("error", onError);
      showHeroImage(img);
    }

    img.addEventListener("load", onLoad);
    img.addEventListener("error", onError);
    img.decoding = "async";
    img.loading = "eager";
    img.removeAttribute("loading");
    img.src = primarySrc;
  }

  function initHeroAssets() {
    var deferred = [];

    document.querySelectorAll("[data-hero-asset]").forEach(function (img) {
      var key = img.getAttribute("data-hero-asset");
      var entry = heroAssets[key];
      if (!entry || !entry.src) {
        hideHeroImage(img);
        return;
      }

      if (entry.critical) {
        loadHeroImage(img, entry.src, entry.fallback || null);
      } else {
        deferred.push({ img: img, entry: entry });
      }
    });

    function loadDeferred() {
      deferred.forEach(function (item) {
        loadHeroImage(item.img, item.entry.src, item.entry.fallback || null);
      });
    }

    if (!deferred.length) return;

    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(loadDeferred, { timeout: 2200 });
    } else {
      window.setTimeout(loadDeferred, 900);
    }
  }

  initHeroAssets();

  /**
   * Per-stage layered art — drop files into webpageassets/ using these names.
   * bg = full-bleed background, chars = transparent character layer on the right.
   * Fallbacks keep the layout working until final art arrives.
   */
  var stageAssets = {
    home: {
      bg: "webpageassets/playground.png",
      chars: "webpageassets/hero-dad-and-ollie.png",
    },
    family: {
      bg: "webpageassets/picnic-background-family.png",
      bgFallback: "webpageassets/family.jpeg",
      chars: "webpageassets/meet-the-family.png",
    },
    stories: {
      bg: "webpageassets/library.png",
      bgFallback: "webpageassets/websiteBG.png",
      chars: "webpageassets/library-ollie-lily.png",
    },
    book: {
      bg: "webpageassets/books-bg.png",
      chars: "webpageassets/lobookhold.png",
    },
    labs: {
      bg: "webpageassets/labplayground.png",
      bgFallback: "webpageassets/websiteComputerBG.png",
      chars: "webpageassets/dadolliesamlab.png",
    },
    journey: {
      bg: "webpageassets/journeypage.png",
      bgFallback: "webpageassets/journey.png",
    },
  };

  function loadStageImage(img, sources, onDone) {
    if (!img || !sources || !sources.length) {
      if (img) {
        img.hidden = true;
        img.removeAttribute("src");
      }
      onDone(false);
      return;
    }

    var index = 0;

    function tryNext() {
      if (index >= sources.length) {
        img.hidden = true;
        img.removeAttribute("src");
        onDone(false);
        return;
      }

      var src = sources[index++];
      if (!src) {
        tryNext();
        return;
      }

      function onLoad() {
        cleanup();
        img.removeAttribute("hidden");
        img.hidden = false;
        onDone(true);
      }

      function onError() {
        cleanup();
        tryNext();
      }

      function cleanup() {
        img.removeEventListener("load", onLoad);
        img.removeEventListener("error", onError);
      }

      img.addEventListener("load", onLoad);
      img.addEventListener("error", onError);
      /* lazy + hidden never fetches — force eager when we manage the load */
      img.loading = "eager";
      img.removeAttribute("loading");
      img.src = src;
    }

    tryNext();
  }

  function initStageScenes() {
    document.querySelectorAll(".lo-stage[data-stage]").forEach(function (stage) {
      var key = stage.getAttribute("data-stage");
      var assets = stageAssets[key];
      if (!assets) return;

      var bg = stage.querySelector('[data-stage-layer="bg"]');
      var chars = stage.querySelector('[data-stage-layer="chars"]');
      var placeholder = stage.querySelector("[data-stage-placeholder]");
      var pending = 2;
      var anyLoaded = false;

      function finish() {
        pending -= 1;
        if (pending > 0) return;
        stage.classList.toggle("is-bg-loaded", anyLoaded);
        stage.classList.toggle("is-placeholder", !anyLoaded);
        if (placeholder) placeholder.hidden = anyLoaded;
      }

      loadStageImage(
        bg,
        [assets.bg, assets.bgFallback, assets.bgFallback2].filter(Boolean),
        function (ok) {
          if (ok) anyLoaded = true;
          finish();
        }
      );

      loadStageImage(chars, [assets.chars, assets.charsFallback].filter(Boolean), function (ok) {
        if (ok) anyLoaded = true;
        finish();
      });
    });
  }

  initStageScenes();

  var nav = document.getElementById("site-nav");
  var navToggle = document.getElementById("nav-toggle");
  var navLinks = document.getElementById("nav-links");
  var navBackdrop = document.getElementById("nav-backdrop");
  var body = document.body;
  var footerYear = document.getElementById("footer-year");

  if (footerYear) {
    footerYear.textContent = String(new Date().getFullYear());
  }

  function setMenuOpen(open) {
    if (!nav || !navToggle) return;

    nav.classList.toggle("is-open", open);
    navToggle.setAttribute("aria-expanded", open ? "true" : "false");
    navToggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    body.classList.toggle("menu-open", open);

    if (navBackdrop) {
      navBackdrop.hidden = !open;
      navBackdrop.setAttribute("aria-hidden", open ? "false" : "true");
    }
  }

  function closeMenu() {
    setMenuOpen(false);
  }

  if (navToggle && navLinks) {
    navToggle.addEventListener("click", function () {
      setMenuOpen(!nav.classList.contains("is-open"));
    });

    navLinks.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        closeMenu();
      });
    });

    if (navBackdrop) {
      navBackdrop.addEventListener("click", closeMenu);
    }

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && nav.classList.contains("is-open")) {
        closeMenu();
        navToggle.focus();
      }
    });
  }

  var scrollThreshold = 24;

  function onScroll() {
    if (!nav) return;
    nav.classList.toggle("is-scrolled", window.scrollY > scrollThreshold);
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* Active section indicator in the main nav */
  (function initNavSectionSpy() {
    if (!navLinks) return;

    var navLinkEls = navLinks.querySelectorAll(".home-nav__link[href^='#']");
    if (!navLinkEls.length) return;

    var linkMap = {};
    var sections = [];

    navLinkEls.forEach(function (link) {
      var id = link.getAttribute("href").slice(1);
      if (!id) return;
      var section = document.getElementById(id);
      if (!section) return;
      linkMap[id] = link;
      sections.push(section);
    });

    if (!sections.length) return;

    function setActive(id) {
      Object.keys(linkMap).forEach(function (sectionId) {
        var link = linkMap[sectionId];
        var active = sectionId === id;
        link.classList.toggle("is-active", active);
        if (active) link.setAttribute("aria-current", "location");
        else link.removeAttribute("aria-current");
      });
    }

    function updateFromScroll() {
      var marker = window.innerHeight * 0.38;
      var bestId = sections[0].id;
      var bestDist = Infinity;

      sections.forEach(function (section) {
        var rect = section.getBoundingClientRect();
        if (rect.bottom <= 0 || rect.top >= window.innerHeight) return;
        var dist = Math.abs(rect.top - marker);
        if (dist < bestDist) {
          bestDist = dist;
          bestId = section.id;
        }
      });

      setActive(bestId);
    }

    var ticking = false;
    function onScrollOrResize() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(function () {
        ticking = false;
        updateFromScroll();
      });
    }

    window.addEventListener("scroll", onScrollOrResize, { passive: true });
    window.addEventListener("resize", onScrollOrResize, { passive: true });

    navLinkEls.forEach(function (link) {
      link.addEventListener("click", function () {
        var id = link.getAttribute("href").slice(1);
        if (id && linkMap[id]) setActive(id);
      });
    });

    var hashId = (window.location.hash || "").replace(/^#/, "");
    if (hashId && linkMap[hashId]) setActive(hashId);
    else updateFromScroll();
  })();

  document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
    anchor.addEventListener("click", function (e) {
      var id = anchor.getAttribute("href");
      if (!id || id === "#") return;

      var target = document.querySelector(id);
      if (!target) return;

      e.preventDefault();
      var navHeight = nav ? nav.offsetHeight : 0;
      var top = target.getBoundingClientRect().top + window.scrollY - navHeight - 12;

      window.scrollTo({
        top: Math.max(0, top),
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      });

      if (history.replaceState) {
        history.replaceState(null, "", id);
      }

      target.setAttribute("tabindex", "-1");
      target.focus({ preventScroll: true });
    });
  });

  document.querySelectorAll(".home-asset-slot").forEach(function (slot) {
    var img = slot.querySelector(".home-asset-img");
    var fallback = slot.querySelector(".home-asset-fallback");
    if (!img || !fallback) return;

    function showImage() {
      slot.classList.add("is-loaded");
      img.hidden = false;
      fallback.hidden = true;
    }

    function showFallback() {
      slot.classList.remove("is-loaded");
      img.hidden = true;
      fallback.hidden = false;
    }

    if (img.complete) {
      if (img.naturalWidth > 0) showImage();
      else showFallback();
    } else {
      img.addEventListener("load", showImage);
      img.addEventListener("error", showFallback);
    }
  });

  if ("IntersectionObserver" in window && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    var revealObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            revealObserver.unobserve(entry.target);
          }
        });
      },
      { root: null, rootMargin: "0px 0px -8% 0px", threshold: 0.12 }
    );

    document.querySelectorAll(".reveal").forEach(function (el) {
      revealObserver.observe(el);
    });
  } else {
    document.querySelectorAll(".reveal").forEach(function (el) {
      el.classList.add("is-visible");
    });
  }

  /* Family cards: tap to pop character up on touch devices */
  (function initFamilyCardPop() {
    var familyCards = document.querySelectorAll(".lo-stage--family .journey-card");
    if (!familyCards.length) return;

    familyCards.forEach(function (card) {
      card.addEventListener("click", function (e) {
        if (window.matchMedia("(min-width: 900px)").matches) return;

        var alreadyPopped = card.classList.contains("is-popped");
        familyCards.forEach(function (other) {
          other.classList.remove("is-popped");
        });

        if (!alreadyPopped) {
          e.preventDefault();
          card.classList.add("is-popped");
        }
      });
    });

    document.addEventListener("click", function (e) {
      if (window.matchMedia("(min-width: 900px)").matches) return;
      if (e.target.closest(".lo-stage--family .journey-card")) return;
      familyCards.forEach(function (card) {
        card.classList.remove("is-popped");
      });
    });
  })();

  /* Locked playground frame — no parallax (keeps characters stuck on zoom). */
})();
