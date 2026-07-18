/**
 * Little Ollie World — Stage 1 homepage interactions
 */
(function () {
  "use strict";

  document.documentElement.classList.add("home-page-root", "home-js");

  /* Prefer deep links (#our-story, #labs, etc.); otherwise open at the top */
  if ("scrollRestoration" in history) {
    history.scrollRestoration = "manual";
  }

  var SECTION_HASHES = {
    home: true,
    family: true,
    stories: true,
    book: true,
    labs: true,
    "our-story": true,
    journey: true,
  };

  var initialHash = (window.location.hash || "").replace(/^#/, "");
  var deepLinkId = SECTION_HASHES[initialHash] ? initialHash : "";

  if (window.location.hash && !deepLinkId) {
    history.replaceState(null, "", window.location.pathname + window.location.search);
  }

  function scrollToTop() {
    window.scrollTo(0, 0);
    if (document.documentElement) document.documentElement.scrollTop = 0;
    if (document.body) document.body.scrollTop = 0;
  }

  function scrollToDeepLink() {
    if (!deepLinkId) {
      scrollToTop();
      return;
    }
    var target = document.getElementById(deepLinkId);
    if (deepLinkId === "our-story") {
      target =
        document.querySelector(".our-story__copy") ||
        document.getElementById("our-story-heading") ||
        target;
    }
    if (!target) {
      scrollToTop();
      return;
    }
    var navEl = document.getElementById("site-nav");
    var navHeight = navEl ? navEl.offsetHeight : 84;
    var top = target.getBoundingClientRect().top + window.scrollY - navHeight - 16;
    window.scrollTo(0, Math.max(0, top));
  }

  if (!deepLinkId) {
    scrollToTop();
    window.addEventListener("load", scrollToTop);
    window.addEventListener("pageshow", function () {
      scrollToTop();
    });
  } else {
    window.addEventListener("load", function () {
      requestAnimationFrame(scrollToDeepLink);
    });
  }

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
      src: "webpageassets/hero-dad-and-ollie.webp",
      critical: true,
    },
    // Optional book glow layer (not used with standing pose art)
    book: {
      src: "webpageassets/hero-open-book.png",
    },
    // Distant hills / scenery (currently using playground)
    hills: {
      src: "webpageassets/playground.jpg",
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
    cardFamily: { src: "webpageassets/stage-family-meet-family.png" },
    cardStories: { src: "webpageassets/BookCover.jpg" },
    cardSchool: { src: "webpageassets/Friendship.jpg" },
    cardLabs: { src: "webpageassets/Creativity.jpg" },
    cardAdventure: { src: "webpageassets/Resilience.jpg" },
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
   *
   * Phone (≤899px): use *_phone.jpg composites (characters baked in, char layer hidden).
   * Browser/desktop (≥900px): layered bg + separate char layers.
   */
  var stageAssets = {
    home: {
      bg: "webpageassets/stage-book-playground.png",
      hideChars: true,
      noFlip: true,
    },
    family: {
      bg: "webpageassets/stage-family-meet-family.png",
      hideChars: true,
    },
    stories: {
      bg: "webpageassets/stage-stories-library.png",
      hideChars: true,
    },
    book: {
      bg: "webpageassets/stage-book-books.png",
      hideChars: true,
    },
    labs: {
      bg: "webpageassets/stage-labs-lo-labs.png",
      hideChars: true,
    },
    journey: {
      bg: "webpageassets/stage-journey-our-journey.png",
      hideChars: true,
    },
  };

  /* Phone uses the same full-scene artwork (composite backgrounds) */
  var phoneStageAssets = {
    home: {
      bg: "webpageassets/stage-book-playground.png",
      hideChars: true,
      noFlip: true,
    },
    family: {
      bg: "webpageassets/stage-family-meet-family.png",
      hideChars: true,
    },
    stories: {
      bg: "webpageassets/stage-stories-library.png",
      hideChars: true,
    },
    book: {
      bg: "webpageassets/stage-book-books.png",
      hideChars: true,
    },
    labs: {
      bg: "webpageassets/stage-labs-lo-labs.png",
      hideChars: true,
    },
    journey: {
      bg: "webpageassets/stage-journey-our-journey.png",
      hideChars: true,
    },
  };

  var phoneStageMedia = window.matchMedia("(max-width: 899px)");

  function isPhoneViewport() {
    return phoneStageMedia.matches;
  }

  function getStageMode() {
    return isPhoneViewport() ? "phone" : "browser";
  }

  function resolveStageAssets(key) {
    var base = stageAssets[key];
    if (!base) return null;
    if (!isPhoneViewport() || !phoneStageAssets[key]) return base;
    var phone = phoneStageAssets[key];
    return {
      bg: phone.bg || base.bg,
      bgFallback: base.bg,
      bgFallback2: base.bgFallback,
      chars: phone.hideChars ? null : base.chars,
      charsFallback: phone.hideChars ? null : base.charsFallback,
      hideChars: !!phone.hideChars,
      noFlip: !!phone.noFlip,
    };
  }

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

      var absoluteSrc = src;
      try {
        absoluteSrc = new URL(src, window.location.href).href;
      } catch (err) {
        /* keep relative src */
      }

      /* Same src already decoded — load event will not fire again */
      if (img.getAttribute("src") === src || img.src === absoluteSrc) {
        if (img.complete && img.naturalWidth > 0) {
          onLoad();
          return;
        }
        if (img.complete && img.naturalWidth === 0) {
          onError();
          return;
        }
      }

      img.src = src;
    }

    tryNext();
  }

  function resetStage(stage) {
    if (!stage) return;
    stage.removeAttribute("data-stage-loaded");
    stage.removeAttribute("data-stage-mode");
    stage.classList.remove("is-phone-composite", "is-bg-loaded", "is-placeholder");

    var bg = stage.querySelector('[data-stage-layer="bg"]');
    var chars = stage.querySelector('[data-stage-layer="chars"]');
    var placeholder = stage.querySelector("[data-stage-placeholder]");

    if (bg) {
      bg.hidden = true;
      bg.removeAttribute("src");
      bg.classList.toggle("lo-stage__bg--flip", stage.getAttribute("data-stage") === "home");
    }

    if (chars) {
      chars.hidden = true;
      chars.removeAttribute("src");
    }

    if (placeholder) placeholder.hidden = false;
  }

  function loadStage(stage) {
    if (!stage) return;
    var mode = getStageMode();
    var loadedMode = stage.getAttribute("data-stage-mode");
    if (stage.getAttribute("data-stage-loaded") === "1" && loadedMode === mode) return;
    if (loadedMode && loadedMode !== mode) resetStage(stage);

    var key = stage.getAttribute("data-stage");
    var assets = resolveStageAssets(key);
    if (!assets) return;
    stage.setAttribute("data-stage-loaded", "1");
    stage.setAttribute("data-stage-mode", mode);

    var bg = stage.querySelector('[data-stage-layer="bg"]');
    var chars = stage.querySelector('[data-stage-layer="chars"]');
    var placeholder = stage.querySelector("[data-stage-placeholder]");
    var pending = 2;
    var anyLoaded = false;

    stage.classList.remove("is-phone-composite");

    if (bg && assets.noFlip) {
      bg.classList.remove("lo-stage__bg--flip");
    } else if (bg && key === "home") {
      bg.classList.add("lo-stage__bg--flip");
    }

    if (assets.hideChars) {
      stage.classList.add("is-phone-composite");
    }

    function finish() {
      pending -= 1;
      if (pending > 0) return;
      stage.classList.toggle("is-bg-loaded", anyLoaded);
      stage.classList.toggle("is-placeholder", !anyLoaded);
      if (placeholder) placeholder.hidden = anyLoaded;
    }

    loadStageImage(
      bg,
      assets.hideChars
        ? [assets.bg].filter(Boolean)
        : [assets.bg, assets.bgFallback, assets.bgFallback2].filter(Boolean),
      function (ok) {
        if (ok) anyLoaded = true;
        finish();
      }
    );

    if (assets.hideChars || !assets.chars) {
      if (chars) {
        chars.hidden = true;
        chars.removeAttribute("src");
      }
      finish();
    } else {
      if (chars) chars.hidden = false;
      loadStageImage(chars, [assets.chars, assets.charsFallback].filter(Boolean), function (ok) {
        if (ok) anyLoaded = true;
        finish();
      });
    }
  }

  function reloadStagesForViewport() {
    var stages = document.querySelectorAll(".lo-stage[data-stage]");
    Array.prototype.forEach.call(stages, function (stage) {
      var loadedMode = stage.getAttribute("data-stage-mode");
      if (!loadedMode || loadedMode === getStageMode()) return;
      resetStage(stage);
      loadStage(stage);
    });
  }

  function initStageScenes() {
    var stages = Array.prototype.slice.call(document.querySelectorAll(".lo-stage[data-stage]"));
    if (!stages.length) return;

    /* Home first — everything else waits until near the viewport (big phone win) */
    stages.forEach(function (stage) {
      if (stage.getAttribute("data-stage") === "home") loadStage(stage);
    });

    if (!("IntersectionObserver" in window)) {
      stages.forEach(loadStage);
      return;
    }

    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          loadStage(entry.target);
          io.unobserve(entry.target);
        });
      },
      { rootMargin: "280px 0px", threshold: 0.01 }
    );

    stages.forEach(function (stage) {
      if (stage.getAttribute("data-stage") === "home") return;
      io.observe(stage);
    });
  }

  initStageScenes();

  var stageViewportTimer;
  function scheduleStageViewportReload() {
    window.clearTimeout(stageViewportTimer);
    stageViewportTimer = window.setTimeout(reloadStagesForViewport, 180);
  }

  if (typeof phoneStageMedia.addEventListener === "function") {
    phoneStageMedia.addEventListener("change", scheduleStageViewportReload);
  } else if (typeof phoneStageMedia.addListener === "function") {
    phoneStageMedia.addListener(scheduleStageViewportReload);
  }
  window.addEventListener("orientationchange", scheduleStageViewportReload);

  /**
   * Our Story artwork — add files under webpageassets/ to light up placeholders.
   * Missing files keep the soft fallback (no broken-image icons).
   */
  var storyAssets = {
    heroCharacters: "webpageassets/story-dad-and-ollie.png",
    beginning: "webpageassets/story-beginning.png",
    learning: "webpageassets/story-learning.png",
    community: "webpageassets/story-community.png",
    books: "webpageassets/story-books.png",
    future: "webpageassets/story-future.png",
  };

  function initStoryArt() {
    document.querySelectorAll("[data-story-art]").forEach(function (slot) {
      var key = slot.getAttribute("data-story-art");
      var src = storyAssets[key];
      var img = slot.querySelector(".our-story__art-img");
      if (!img || !src) return;

      function show() {
        slot.classList.add("is-loaded");
        img.hidden = false;
        img.removeAttribute("hidden");
      }

      function hide() {
        slot.classList.remove("is-loaded");
        img.hidden = true;
        img.removeAttribute("src");
      }

      img.addEventListener("load", show);
      img.addEventListener("error", hide);
      img.src = src;
    });
  }

  initStoryArt();

  /* Our Story — inline chapter panel with sequential play + arrows */
  (function initOurStoryStages() {
    var section = document.querySelector("[data-story-section]");
    var playBtns = Array.prototype.slice.call(document.querySelectorAll("[data-story-play]"));
    var chapters = document.querySelector("[data-story-chapters]");
    var stageContent = document.querySelector("[data-story-stage-content]");
    var stageInner = document.querySelector("[data-story-stage-inner]");
    var stageNav = document.querySelector("[data-story-stage-nav]");
    var prevBtn = document.querySelector("[data-story-prev]");
    var nextBtn = document.querySelector("[data-story-next]");
    var progressEl = document.querySelector("[data-story-progress]");
    if (!section || !chapters || !stageContent || !stageInner) return;

    var cards = Array.prototype.slice.call(chapters.querySelectorAll(".our-story__card"));
    if (!cards.length) return;

    var stageEmoji = stageContent.querySelector("[data-story-stage-emoji]");
    var stageNum = stageContent.querySelector("[data-story-stage-num]");
    var stageTitle = stageContent.querySelector("[data-story-stage-title]");
    var stageCopy = stageContent.querySelector("[data-story-stage-copy]");
    var storyCopyPanel = section.querySelector(".our-story__copy");
    var phoneMq = window.matchMedia("(max-width: 899px)");
    var activeIndex = -1;
    var storyStarted = false;

    function collapseStoryCopy() {
      if (!phoneMq.matches || !storyCopyPanel) return;
      storyCopyPanel.classList.remove("is-open");
      var expandBtn = storyCopyPanel.querySelector(".home-hero__expand");
      if (expandBtn) {
        expandBtn.setAttribute("aria-expanded", "false");
        expandBtn.setAttribute("aria-label", "Show more about this section");
      }
    }

    function storyParagraphs(raw) {
      if (!raw) return "";
      return raw
        .split("|||")
        .map(function (part) {
          return "<p>" + part.trim() + "</p>";
        })
        .join("");
    }

    function updateNav(index) {
      if (progressEl) {
        progressEl.textContent = "Chapter " + (index + 1) + " of " + cards.length;
      }
      if (prevBtn) prevBtn.disabled = index <= 0;
      if (nextBtn) nextBtn.disabled = index >= cards.length - 1;
    }

    function showChapter(index, options) {
      var opts = options || {};
      if (index < 0 || index >= cards.length) return;
      activeIndex = index;
      var card = cards[index];

      cards.forEach(function (c, i) {
        var on = i === index;
        c.setAttribute("aria-selected", on ? "true" : "false");
        c.classList.toggle("is-active", on);
      });

      stageContent.hidden = false;
      if (stageNav) stageNav.hidden = false;
      if (card.id) stageContent.setAttribute("aria-labelledby", card.id);
      section.classList.add("has-stage-open");

      var emojiEl = card.querySelector(".our-story__emoji");
      if (stageEmoji) stageEmoji.textContent = emojiEl ? emojiEl.textContent : "";
      if (stageNum) stageNum.textContent = card.getAttribute("data-story-num") || "";
      if (stageTitle) stageTitle.textContent = card.getAttribute("data-story-title") || "";
      if (stageCopy) stageCopy.innerHTML = storyParagraphs(card.getAttribute("data-story-copy"));

      stageInner.classList.remove("is-visible");
      window.requestAnimationFrame(function () {
        stageInner.classList.add("is-visible");
      });

      updateNav(index);

      if (stageContent.scrollTop) {
        stageContent.scrollTop = 0;
      }

      if (opts.scrollPanel !== false && !phoneMq.matches) {
        stageContent.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
      if (!phoneMq.matches) {
        card.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
      }
    }

    function setPlayButtonsPlaying() {
      playBtns.forEach(function (btn) {
        btn.textContent = "Reading our Story…";
        btn.setAttribute("aria-pressed", "true");
      });
    }

    function startStory(fromIndex) {
      storyStarted = true;
      collapseStoryCopy();
      setPlayButtonsPlaying();
      showChapter(typeof fromIndex === "number" ? fromIndex : 0, { scrollPanel: false });
    }

    function goPrev() {
      if (activeIndex > 0) showChapter(activeIndex - 1);
    }

    function goNext() {
      if (activeIndex < cards.length - 1) showChapter(activeIndex + 1);
    }

    cards.forEach(function (card, index) {
      card.addEventListener("click", function () {
        storyStarted = true;
        collapseStoryCopy();
        if (stageNav) stageNav.hidden = false;
        setPlayButtonsPlaying();
        showChapter(index, { scrollPanel: false });
      });

      card.addEventListener("keydown", function (e) {
        if (e.key === "ArrowRight" || e.key === "ArrowDown") {
          e.preventDefault();
          goNext();
        } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
          e.preventDefault();
          goPrev();
        }
      });
    });

    if (prevBtn) prevBtn.addEventListener("click", goPrev);
    if (nextBtn) nextBtn.addEventListener("click", goNext);

    playBtns.forEach(function (btn) {
      btn.addEventListener("click", function () {
        startStory(0);
      });
    });
  })();

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

      /* Our Story: land on the padded intro panel, not the section sky padding */
      if (id === "#our-story") {
        target =
          document.querySelector(".our-story__copy") ||
          document.getElementById("our-story-heading") ||
          target;
      }

      e.preventDefault();
      var navHeight = nav ? nav.offsetHeight : 0;
      var top = target.getBoundingClientRect().top + window.scrollY - navHeight - 16;

      window.scrollTo({
        top: Math.max(0, top),
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      });

      if (history.replaceState) {
        history.replaceState(null, "", id);
      }

      /* Move focus to the landed section for a11y, without a visible mouse focus ring */
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

  /* Family cards: tap/hover to pop character + show short write-up */
  (function initFamilyCardImages() {
    var stage = document.querySelector(".lo-stage--family");
    if (!stage) return;

    var imgs = stage.querySelectorAll(".journey-card__icon img");
    if (!imgs.length) return;

    function markSharp(img) {
      function reveal() {
        if (img.naturalWidth > 0) img.classList.add("is-sharp");
      }
      if (img.complete) reveal();
      else img.addEventListener("load", reveal, { once: true });
    }

    imgs.forEach(function (img) {
      img.loading = "eager";
      img.removeAttribute("loading");
      markSharp(img);
    });

    function preloadCharacterArt() {
      if (preloadCharacterArt.done) return;
      preloadCharacterArt.done = true;
      ["webpageassets/locharacter.webp", "webpageassets/dadcharacter.webp"].forEach(function (href) {
        var link = document.createElement("link");
        link.rel = "preload";
        link.as = "image";
        link.href = href;
        document.head.appendChild(link);
      });
    }

    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (!entry.isIntersecting) return;
            preloadCharacterArt();
            io.disconnect();
          });
        },
        { rootMargin: "520px 0px", threshold: 0 }
      );
      io.observe(stage);
    } else {
      preloadCharacterArt();
    }

    var stageRect = stage.getBoundingClientRect();
    if (stageRect.top < window.innerHeight + 520) preloadCharacterArt();
  })();

  (function initFamilyCardPop() {
    var stage = document.querySelector(".lo-stage--family");
    var familyCards = stage
      ? stage.querySelectorAll(".journey-card")
      : [];
    var bio = stage && stage.querySelector("[data-family-bio]");
    var bioName = bio && bio.querySelector("[data-family-bio-name]");
    var bioBody = bio && bio.querySelector("[data-family-bio-body]");
    if (!familyCards.length) return;

    function showBio(card) {
      if (!bio || !bioName || !bioBody || !card) return;
      var source = card.querySelector(".family-bio__source");
      var titleEl = card.querySelector(".journey-card__title");
      if (!source || !titleEl) return;
      var who = "ollie";
      if (card.classList.contains("journey-card--dad")) who = "dad";
      else if (card.classList.contains("journey-card--mum")) who = "mum";
      else if (card.classList.contains("journey-card--lily")) who = "lily";
      else if (card.classList.contains("journey-card--jack")) who = "jack";

      bio.classList.remove(
        "family-bio--ollie",
        "family-bio--dad",
        "family-bio--mum",
        "family-bio--lily",
        "family-bio--jack"
      );
      bio.classList.add("family-bio--" + who);
      bioName.textContent = titleEl.textContent.trim();
      bioBody.innerHTML = source.innerHTML;
      bio.hidden = false;
      bio.classList.add("is-visible");
    }

    function hideBio() {
      if (!bio) return;
      bio.classList.remove("is-visible");
      bio.classList.remove(
        "family-bio--ollie",
        "family-bio--dad",
        "family-bio--mum",
        "family-bio--lily",
        "family-bio--jack"
      );
      bio.hidden = true;
      if (bioName) bioName.textContent = "";
      if (bioBody) bioBody.innerHTML = "";
    }

    function clearPopped() {
      familyCards.forEach(function (card) {
        card.classList.remove("is-popped");
      });
    }

    familyCards.forEach(function (card) {
      card.addEventListener("mouseenter", function () {
        if (!window.matchMedia("(min-width: 900px)").matches) return;
        showBio(card);
      });
      card.addEventListener("mouseleave", function () {
        if (!window.matchMedia("(min-width: 900px)").matches) return;
        if (!stage.querySelector(".journey-card:hover, .journey-card:focus-visible")) {
          hideBio();
        }
      });
      card.addEventListener("focus", function () {
        showBio(card);
      });
      card.addEventListener("blur", function () {
        if (!window.matchMedia("(min-width: 900px)").matches) return;
        window.setTimeout(function () {
          if (!stage.querySelector(".journey-card:focus-visible, .journey-card:hover")) {
            hideBio();
          }
        }, 0);
      });

      card.addEventListener("click", function (e) {
        if (window.matchMedia("(min-width: 900px)").matches) return;

        var alreadyPopped = card.classList.contains("is-popped");
        clearPopped();

        if (!alreadyPopped) {
          e.preventDefault();
          card.classList.add("is-popped");
          showBio(card);
        } else {
          hideBio();
        }
      });
    });

    document.addEventListener("click", function (e) {
      if (window.matchMedia("(min-width: 900px)").matches) return;
      if (e.target.closest(".lo-stage--family .journey-card")) return;
      if (e.target.closest("[data-family-bio]")) return;
      clearPopped();
      hideBio();
    });
  })();

  (function initCopyPanels() {
    var panels = document.querySelectorAll("[data-copy-panel]");
    if (!panels.length) return;

    function setOpen(panel, open) {
      var btn = panel.querySelector(".home-hero__expand");
      panel.classList.toggle("is-open", open);
      if (!btn) return;
      btn.setAttribute("aria-expanded", open ? "true" : "false");
      btn.setAttribute(
        "aria-label",
        open ? "Hide section details" : "Show more about this section"
      );
    }

    panels.forEach(function (panel) {
      var btn = panel.querySelector(".home-hero__expand");
      if (!btn) return;

      btn.addEventListener("click", function (event) {
        event.preventDefault();
        var willOpen = !panel.classList.contains("is-open");
        panels.forEach(function (other) {
          if (other !== panel) setOpen(other, false);
        });
        setOpen(panel, willOpen);
      });
    });
  })();

  /* Locked playground frame — no parallax (keeps characters stuck on zoom). */
})();
