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
    cardFamily: { src: "webpageassets/family.jpg" },
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
      bg: "webpageassets/BrowserPlayground.png",
      hideChars: true,
      noFlip: true,
    },
    family: {
      bg: "webpageassets/BrowserMeetthefamily.jpg",
      hideChars: true,
    },
    stories: {
      bg: "webpageassets/BrowserLibrary.jpg",
      hideChars: true,
    },
    book: {
      bg: "webpageassets/BrowserBook.jpg",
      hideChars: true,
    },
    labs: {
      bg: "webpageassets/BrowserLab.jpg",
      hideChars: true,
    },
    journey: {
      bg: "webpageassets/journeypage.jpg",
      bgFallback: "webpageassets/journey.jpg",
    },
  };

  /* Phone-only full-scene backgrounds (named to match each page) */
  var phoneStageAssets = {
    home: {
      bg: "webpageassets/playground_phone.jpg",
      hideChars: true,
      noFlip: true,
    },
    family: {
      bg: "webpageassets/family_phone.jpg",
      hideChars: true,
    },
    stories: {
      bg: "webpageassets/library_phone.jpg",
      hideChars: true,
    },
    book: {
      bg: "webpageassets/book_phone.jpg",
      hideChars: true,
    },
    labs: {
      bg: "webpageassets/lab_phone.jpg",
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

  /* Hover/focus a bottom chapter tile → expand beside the intro text box */
  (function initStoryDock() {
    var section = document.querySelector("[data-story-section]");
    var copy = section && section.querySelector(".our-story__copy");
    var dock = section && section.querySelector("[data-story-dock]");
    var chapters = section && section.querySelector("[data-story-chapters]");
    if (!section || !copy || !dock || !chapters) return;

    var cards = Array.prototype.slice.call(chapters.querySelectorAll(".our-story__card"));
    if (!cards.length) return;

    var hint = dock.querySelector("[data-story-dock-hint]");
    var panel = dock.querySelector("[data-story-dock-panel]");
    var media = dock.querySelector("[data-story-dock-media]");
    var img = dock.querySelector("[data-story-dock-img]");
    var emoji = dock.querySelector("[data-story-dock-emoji]");
    var num = dock.querySelector("[data-story-dock-num]");
    var title = dock.querySelector("[data-story-dock-title]");
    var body = dock.querySelector("[data-story-dock-copy]");
    var activeKey = "";
    var leaveTimer = null;

    function syncDockHeight() {
      if (window.matchMedia("(max-width: 899px)").matches) {
        dock.style.minHeight = "";
        return;
      }
      dock.style.minHeight = copy.offsetHeight + "px";
    }

    function loadDockArt(key) {
      if (!img || !media) return;
      var src = storyAssets[key];
      media.classList.remove("is-loaded");
      img.hidden = true;
      img.removeAttribute("src");
      if (!src) return;

      function show() {
        media.classList.add("is-loaded");
        img.hidden = false;
      }

      function hide() {
        media.classList.remove("is-loaded");
        img.hidden = true;
        img.removeAttribute("src");
      }

      img.onload = show;
      img.onerror = hide;
      img.src = src;
    }

    function showChapter(card) {
      if (!card || section.classList.contains("is-presenting")) return;
      var key = card.getAttribute("data-story-chapter") || "";
      activeKey = key;

      cards.forEach(function (c) {
        c.classList.toggle("is-docked", c === card);
      });

      var emojiEl = card.querySelector(".our-story__emoji");
      if (emoji) emoji.textContent = emojiEl ? emojiEl.textContent : "✨";
      if (num) num.textContent = card.getAttribute("data-story-num") || "";
      if (title) title.textContent = card.getAttribute("data-story-title") || "";
      if (body) body.textContent = card.getAttribute("data-story-copy") || "";

      if (hint) hint.hidden = true;
      if (panel) {
        panel.hidden = false;
        /* restart slide-up */
        panel.style.transition = "none";
        panel.style.transform = "translateY(1.25rem)";
        panel.style.opacity = "0";
        void panel.offsetWidth;
        panel.style.transition = "";
        panel.style.transform = "";
        panel.style.opacity = "";
      }
      dock.classList.add("is-active");
      loadDockArt(key);
      syncDockHeight();
    }

    function clearDock() {
      activeKey = "";
      cards.forEach(function (c) {
        c.classList.remove("is-docked");
      });
      dock.classList.remove("is-active");
      if (panel) panel.hidden = true;
      if (hint) hint.hidden = false;
      if (media) media.classList.remove("is-loaded");
      if (img) {
        img.hidden = true;
        img.removeAttribute("src");
      }
    }

    cards.forEach(function (card) {
      card.setAttribute("tabindex", "0");
      card.setAttribute("role", "button");
      card.setAttribute(
        "aria-label",
        (card.getAttribute("data-story-title") || "Chapter") + " — show details"
      );

      card.addEventListener("pointerenter", function () {
        if (leaveTimer) {
          window.clearTimeout(leaveTimer);
          leaveTimer = null;
        }
        showChapter(card);
      });

      card.addEventListener("focus", function () {
        showChapter(card);
      });

      card.addEventListener("click", function () {
        showChapter(card);
      });

      card.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          showChapter(card);
        }
      });
    });

    chapters.addEventListener("pointerleave", function () {
      leaveTimer = window.setTimeout(function () {
        if (!section.classList.contains("is-presenting")) clearDock();
      }, 180);
    });

    window.addEventListener("resize", syncDockHeight);
    if ("ResizeObserver" in window) {
      new ResizeObserver(syncDockHeight).observe(copy);
    }
    syncDockHeight();
  })();

  /* Our Story chapter presentation — each chapter rises to center, expands, then returns */
  (function initStoryPresentation() {
    var section = document.querySelector("[data-story-section]");
    var playBtn = document.querySelector("[data-story-play]");
    var chapters = document.querySelector("[data-story-chapters]");
    var theater = document.querySelector("[data-story-theater]");
    var feature = document.querySelector("[data-story-feature]");
    if (!section || !playBtn || !chapters || !theater || !feature) return;

    var cards = Array.prototype.slice.call(chapters.querySelectorAll(".our-story__card"));
    if (!cards.length) return;

    var stageBar = section.querySelector("[data-story-stage-bar]");
    var stageLabel = section.querySelector("[data-story-stage-label]");
    var dotsWrap = section.querySelector("[data-story-dots]");
    var skipBtn = section.querySelector("[data-story-skip]");
    var featureEmoji = feature.querySelector("[data-story-feature-emoji]");
    var featureNum = feature.querySelector("[data-story-feature-num]");
    var featureTitle = feature.querySelector("[data-story-feature-title]");
    var featureCopy = feature.querySelector("[data-story-feature-copy]");
    var backdrop = theater.querySelector("[data-story-backdrop]");

    var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var timer = null;
    var index = 0;
    var playing = false;
    var HOLD_MS = reduced ? 2200 : 4800;
    var EXIT_MS = reduced ? 200 : 650;

    function clearTimer() {
      if (timer) {
        window.clearTimeout(timer);
        timer = null;
      }
    }

    function setDots(i) {
      if (!dotsWrap) return;
      Array.prototype.forEach.call(dotsWrap.children, function (dot, dotIndex) {
        dot.classList.toggle("is-active", dotIndex === i);
        dot.setAttribute("aria-current", dotIndex === i ? "true" : "false");
      });
    }

    function fillFeature(card) {
      var emojiEl = card.querySelector(".our-story__emoji");
      if (featureEmoji) featureEmoji.textContent = emojiEl ? emojiEl.textContent : "";
      if (featureNum) featureNum.textContent = card.getAttribute("data-story-num") || "";
      if (featureTitle) featureTitle.textContent = card.getAttribute("data-story-title") || "";
      if (featureCopy) featureCopy.textContent = card.getAttribute("data-story-copy") || "";
    }

    function highlightTile(i) {
      cards.forEach(function (card, cardIndex) {
        card.classList.toggle("is-spotlight", cardIndex === i);
      });
      setDots(i);
      if (stageLabel) {
        stageLabel.textContent = "Chapter " + (i + 1) + " of " + cards.length;
      }
    }

    function openTheater() {
      theater.hidden = false;
      section.classList.add("is-presenting");
      chapters.classList.add("is-presenting");
      chapters.classList.remove("is-complete");
      document.body.classList.add("our-story-lock");
      requestAnimationFrame(function () {
        theater.classList.add("is-open");
      });
    }

    function closeTheater() {
      theater.classList.remove("is-open");
      feature.classList.remove("is-in", "is-out");
      window.setTimeout(function () {
        theater.hidden = true;
      }, reduced ? 0 : 400);
      document.body.classList.remove("our-story-lock");
      section.classList.remove("is-presenting");
    }

    function finish() {
      playing = false;
      clearTimer();
      feature.classList.remove("is-in");
      feature.classList.add("is-out");
      cards.forEach(function (card) {
        card.classList.remove("is-spotlight");
      });
      window.setTimeout(function () {
        closeTheater();
        chapters.classList.remove("is-presenting");
        chapters.classList.add("is-complete");
        if (stageBar) stageBar.hidden = true;
        if (skipBtn) skipBtn.hidden = true;
        playBtn.textContent = "See Our Journey Again";
        playBtn.disabled = false;
        playBtn.setAttribute("aria-pressed", "false");
      }, EXIT_MS);
    }

    function showChapter(i, then) {
      index = i;
      var card = cards[i];
      highlightTile(i);
      fillFeature(card);
      feature.classList.remove("is-out", "is-in");

      /* Force reflow so enter animation restarts */
      void feature.offsetWidth;
      feature.classList.add("is-in");

      clearTimer();
      timer = window.setTimeout(function () {
        feature.classList.remove("is-in");
        feature.classList.add("is-out");
        timer = window.setTimeout(function () {
          if (typeof then === "function") then();
        }, EXIT_MS);
      }, HOLD_MS);
    }

    function playFrom(startIndex) {
      clearTimer();
      playing = true;
      index = startIndex || 0;
      if (stageBar) stageBar.hidden = false;
      if (skipBtn) skipBtn.hidden = false;
      playBtn.textContent = "Playing…";
      playBtn.disabled = true;
      playBtn.setAttribute("aria-pressed", "true");

      /* Stay on the current view — present chapters in-place over this section */
      openTheater();

      function next() {
        if (!playing) return;
        if (index >= cards.length - 1) {
          finish();
          return;
        }
        showChapter(index + 1, next);
      }

      window.setTimeout(function () {
        showChapter(index, next);
      }, reduced ? 50 : 280);
    }

    if (dotsWrap) {
      cards.forEach(function (_card, i) {
        var dot = document.createElement("button");
        dot.type = "button";
        dot.className = "our-story__dot";
        dot.setAttribute("aria-label", "Show chapter " + (i + 1));
        dot.addEventListener("click", function () {
          if (!playing) {
            playFrom(i);
            return;
          }
          clearTimer();
          showChapter(i, function next() {
            if (index >= cards.length - 1) finish();
            else showChapter(index + 1, next);
          });
        });
        dotsWrap.appendChild(dot);
      });
    }

    playBtn.addEventListener("click", function () {
      if (playing) return;
      playFrom(0);
    });

    if (skipBtn) {
      skipBtn.addEventListener("click", function () {
        if (!playing) return;
        finish();
      });
    }

    if (backdrop) {
      backdrop.addEventListener("click", function () {
        if (!playing) return;
        finish();
      });
    }

    document.addEventListener("keydown", function (e) {
      if (!playing) return;
      if (e.key === "Escape") finish();
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
  (function initFamilyCardPop() {
    var stage = document.querySelector(".lo-stage--family");
    var familyCards = stage
      ? stage.querySelectorAll(".journey-card")
      : [];
    var bio = stage && stage.querySelector("[data-family-bio]");
    var bioName = bio && bio.querySelector("[data-family-bio-name]");
    var bioCopy = bio && bio.querySelector("[data-family-bio-copy]");
    if (!familyCards.length) return;

    function cardMeta(card) {
      var titleEl = card.querySelector(".journey-card__title");
      var descEl = card.querySelector(".journey-card__desc");
      return {
        name: titleEl ? titleEl.textContent.trim() : "",
        copy: descEl ? descEl.textContent.trim() : "",
      };
    }

    function showBio(card) {
      if (!bio || !bioName || !bioCopy || !card) return;
      var meta = cardMeta(card);
      if (!meta.name || !meta.copy) return;
      var who = "ollie";
      if (card.classList.contains("journey-card--dad")) who = "dad";
      else if (card.classList.contains("journey-card--mum")) who = "mum";
      else if (card.classList.contains("journey-card--lily")) who = "lily";
      else if (card.classList.contains("journey-card--jack")) who = "jack";
      else if (card.classList.contains("journey-card--ollie")) who = "ollie";

      bio.classList.remove(
        "family-bio--ollie",
        "family-bio--dad",
        "family-bio--mum",
        "family-bio--lily",
        "family-bio--jack"
      );
      bio.classList.add("family-bio--" + who);
      bioName.textContent = meta.name;
      bioCopy.textContent = meta.copy;
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
      if (bioCopy) bioCopy.textContent = "";
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
