(function () {
  "use strict";

  var content = window.LoClubContent;
  if (!content) return;

  document.documentElement.classList.add("home-page-root", "home-js");

  if ("scrollRestoration" in history) {
    history.scrollRestoration = "manual";
  }

  var SECTION_HASHES = {
    "club-home": true,
    "club-explore": true,
    "club-library": true,
    "club-activities": true,
    "club-games": true,
    "club-news": true,
    "club-membership": true,
  };

  var initialHash = (window.location.hash || "").replace(/^#/, "");
  var deepLinkId = SECTION_HASHES[initialHash] ? initialHash : "";

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
    if (!target) {
      scrollToTop();
      return;
    }
    var navEl = document.getElementById("site-nav");
    var navHeight = navEl ? navEl.offsetHeight : 84;
    var top = target.getBoundingClientRect().top + window.scrollY - navHeight;
    window.scrollTo(0, Math.max(0, top));
  }

  if (!deepLinkId) {
    scrollToTop();
    window.addEventListener("load", scrollToTop);
    window.addEventListener("pageshow", scrollToTop);
  } else {
    window.addEventListener("load", function () {
      requestAnimationFrame(scrollToDeepLink);
    });
  }

  var nav = document.getElementById("site-nav");
  var navToggle = document.getElementById("nav-toggle");
  var navLinks = document.getElementById("nav-links");
  var navBackdrop = document.getElementById("nav-backdrop");
  var toast = document.getElementById("club-toast");
  var footerYear = document.getElementById("footer-year");
  var body = document.body;

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

  if (navToggle && navLinks) {
    navToggle.addEventListener("click", function () {
      setMenuOpen(!nav.classList.contains("is-open"));
    });
    navLinks.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        setMenuOpen(false);
      });
    });
    if (navBackdrop) {
      navBackdrop.addEventListener("click", function () {
        setMenuOpen(false);
      });
    }
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && nav.classList.contains("is-open")) {
        setMenuOpen(false);
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
      var lastSection = sections[sections.length - 1];

      sections.forEach(function (section) {
        var rect = section.getBoundingClientRect();
        if (rect.bottom <= 0 || rect.top >= window.innerHeight) return;
        var dist = Math.abs(rect.top - marker);
        if (dist < bestDist) {
          bestDist = dist;
          bestId = section.id;
        }
      });

      if (lastSection) {
        var scrollBottom = window.scrollY + window.innerHeight;
        var docHeight = document.documentElement.scrollHeight;
        if (docHeight - scrollBottom < 120) {
          bestId = lastSection.id;
        }
      }

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

    window.addEventListener("hashchange", function () {
      var hashId = (window.location.hash || "").replace(/^#/, "");
      if (hashId && linkMap[hashId]) setActive(hashId);
      else updateFromScroll();
    });

    var hashId = (window.location.hash || "").replace(/^#/, "");
    if (hashId && linkMap[hashId]) setActive(hashId);
    else updateFromScroll();
  })();

  function showToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.hidden = false;
    toast.classList.add("is-visible");
    window.clearTimeout(showToast._timer);
    showToast._timer = window.setTimeout(function () {
      toast.classList.remove("is-visible");
      window.setTimeout(function () {
        toast.hidden = true;
      }, 280);
    }, 3400);
  }

  document.addEventListener("click", function (e) {
    var trigger = e.target.closest("[data-coming-soon]");
    if (!trigger) return;
    e.preventDefault();
    var message =
      trigger.getAttribute("data-coming-soon") ||
      "This part of the Club is still being built. Check back soon!";
    showToast(message);
  });

  function renderCards(containerId, items, renderItem) {
    var root = document.getElementById(containerId);
    if (!root) return;
    root.innerHTML = items.map(renderItem).join("");
  }

  renderCards("club-rooms-grid", content.rooms, function (room) {
    return (
      '<article class="club-room-card club-room-card--' +
      room.tone +
      '">' +
      '<div class="club-room-card__visual" aria-hidden="true">' +
      '<span class="club-room-card__icon">' +
      room.icon +
      "</span>" +
      '<img src="../assets/little-ollie-club/icons/' +
      room.id +
      '-room-placeholder.svg" alt="" class="club-room-card__placeholder" loading="lazy" decoding="async" />' +
      "</div>" +
      '<h3 class="club-room-card__title">' +
      room.title +
      "</h3>" +
      '<p class="club-room-card__desc">' +
      room.description +
      "</p>" +
      '<a class="home-btn home-btn--ghost home-btn--small" href="' +
      room.href +
      '">' +
      room.cta +
      "</a>" +
      "</article>"
    );
  });

  renderCards("club-activities-grid", content.activities, function (item) {
    return (
      '<article class="club-tile-card">' +
      '<div class="club-tile-card__icon" aria-hidden="true">' +
      item.icon +
      "</div>" +
      '<h3 class="club-tile-card__title">' +
      item.title +
      "</h3>" +
      '<p class="club-tile-card__desc">' +
      item.description +
      "</p>" +
      '<span class="club-badge club-badge--soft">' +
      item.status +
      "</span>" +
      '<button type="button" class="home-btn home-btn--secondary home-btn--small home-btn--soon" data-coming-soon="This activity is coming soon to the Little Ollie Club.">' +
      "Activity Coming Soon" +
      "</button>" +
      "</article>"
    );
  });

  renderCards("club-games-grid", content.games, function (item) {
    var featured = item.featured ? " club-game-card--featured" : "";
    return (
      '<article class="club-game-card' +
      featured +
      '">' +
      '<div class="club-game-card__icon" aria-hidden="true">' +
      item.icon +
      "</div>" +
      '<h3 class="club-game-card__title">' +
      item.title +
      "</h3>" +
      '<p class="club-game-card__desc">' +
      item.description +
      "</p>" +
      '<span class="club-badge">' +
      item.status +
      "</span>" +
      '<button type="button" class="home-btn home-btn--secondary home-btn--small home-btn--soon" data-coming-soon="This game is still in development for the Little Ollie Club.">' +
      (item.featured ? "In Development" : "Coming Soon") +
      "</button>" +
      "</article>"
    );
  });

  renderCards("club-updates-grid", content.updates, function (item) {
    return (
      '<article class="club-update-card">' +
      '<p class="club-update-card__tag">' +
      item.tag +
      "</p>" +
      '<h3 class="club-update-card__title">' +
      item.title +
      "</h3>" +
      '<p class="club-update-card__copy">' +
      item.copy +
      "</p>" +
      "</article>"
    );
  });

  renderCards("club-trust-grid", content.trustCards, function (item) {
    return (
      '<article class="club-trust-card">' +
      '<div class="club-trust-card__icon" aria-hidden="true">' +
      item.icon +
      "</div>" +
      '<h3 class="club-trust-card__title">' +
      item.title +
      "</h3>" +
      '<p class="club-trust-card__copy">' +
      item.copy +
      "</p>" +
      "</article>"
    );
  });

  function formatBookCopy(text) {
    if (!text) return "";
    return text.replace(
      /spark inside/gi,
      '<span class="club-book-spotlight__spark">spark inside</span>'
    );
  }

  function formatBookTitle(title) {
    if (!title) return "";
    return title.replace(
      /\bSpark\b/g,
      '<span class="home-hero__title-accent">Spark</span>'
    );
  }

  function renderSpotlightHtml(book) {
    var tags = (book.tags || [])
      .map(function (tag) {
        return '<span class="club-tag">' + tag + "</span>";
      })
      .join("");
    var tagsHtml = tags
      ? '<div class="club-tags" aria-label="Book features">' + tags + "</div>"
      : "";

    var actions = "";
    if (book.readerUrl) {
      actions +=
        '<a class="home-btn home-btn--primary" href="' +
        book.readerUrl +
        '">Read the Book</a>';
    } else {
      actions +=
        '<button type="button" class="home-btn home-btn--secondary home-btn--soon" data-coming-soon="This book is coming soon to the Club library.">Read the Book</button>';
    }
    actions +=
      '<button type="button" class="home-btn home-btn--secondary" data-open-book-preview data-book-slug="' +
      book.slug +
      '">About This Book</button>';
    if (book.amazonUrl) {
      actions +=
        '<a class="home-btn home-btn--ghost" data-buy-book href="' +
        book.amazonUrl +
        '" rel="noopener noreferrer" target="_blank">Buy the Book</a>';
    }

    return (
      '<article class="club-book-spotlight club-book-spotlight--hero club-book-spotlight--' +
      (book.statusType || "soon") +
      '" data-book-spotlight data-book-slug="' +
      book.slug +
      '" role="group" aria-label="' +
      book.title +
      '">' +
      '<span class="club-book-spotlight__badge">' +
      book.status +
      "</span>" +
      '<div class="club-book-spotlight__cover-stage">' +
      '<img src="' +
      book.cover +
      '" alt="Cover of ' +
      book.title +
      '" width="480" height="480" loading="lazy" decoding="async" />' +
      '<span class="club-book-spotlight__glow" aria-hidden="true"></span>' +
      "</div>" +
      '<div class="club-book-spotlight__about">' +
      '<p class="club-book-spotlight__eyebrow">' +
      (book.eyebrow ||
        (book.readerUrl
          ? "Ready to read in the Club library"
          : "On the Little Ollie shelf soon")) +
      "</p>" +
      '<h3 class="club-book-spotlight__title">' +
      formatBookTitle(book.title) +
      "</h3>" +
      '<div class="club-book-spotlight__about-body">' +
      (book.descriptionLead
        ? '<p class="club-book-spotlight__lead">' + formatBookCopy(book.descriptionLead) + "</p>"
        : "") +
      (book.description ? '<p class="club-book-spotlight__description">' + formatBookCopy(book.description) + "</p>" : "") +
      (book.about ? '<p class="club-book-spotlight__about-extra">' + formatBookCopy(book.about) + "</p>" : "") +
      tagsHtml +
      "</div>" +
      "</div>" +
      '<div class="club-book-spotlight__actions club-btn-row">' +
      actions +
      "</div>" +
      "</article>"
    );
  }

  function updatePreviewModal(book) {
    var previewTags = document.getElementById("club-book-preview-tags");
    var previewTitle = document.getElementById("club-book-preview-title");
    var previewCover = document.querySelector(".club-book-preview__cover-wrap img");
    var previewStory = document.getElementById("club-book-preview-story");
    var previewBadge = document.querySelector(".club-book-preview__badge");
    var openBookLink = document.getElementById("club-open-book-link");
    var previewBuy = document.getElementById("club-preview-buy-book");

    if (previewTags) {
      previewTags.innerHTML = (book.tags || [])
        .map(function (tag) {
          return '<span class="club-tag">' + tag + "</span>";
        })
        .join("");
      previewTags.hidden = !(book.tags && book.tags.length);
    }
    if (previewTitle) previewTitle.innerHTML = formatBookTitle(book.title);
    if (previewCover) {
      previewCover.src = book.cover;
      previewCover.alt = "Cover of " + book.title;
    }
    if (previewStory) {
      var storyParts = [];
      if (book.descriptionLead) {
        storyParts.push(
          '<p class="club-book-preview__lead">' + formatBookCopy(book.descriptionLead) + "</p>"
        );
      }
      if (book.about) {
        storyParts.push("<p>" + formatBookCopy(book.about) + "</p>");
      }
      if (book.aboutExtended) {
        book.aboutExtended.split("\n\n").forEach(function (paragraph) {
          storyParts.push("<p>" + formatBookCopy(paragraph) + "</p>");
        });
      } else if (book.description) {
        storyParts.push("<p>" + formatBookCopy(book.description) + "</p>");
      }
      previewStory.innerHTML = storyParts.join("");
    }
    if (previewBadge) previewBadge.textContent = book.status;
    if (openBookLink) {
      if (book.readerUrl) {
        openBookLink.href = book.readerUrl;
        openBookLink.hidden = false;
        openBookLink.textContent = "Open Book";
      } else {
        openBookLink.hidden = true;
      }
    }
    if (previewBuy) {
      if (book.amazonUrl) {
        previewBuy.href = book.amazonUrl;
        previewBuy.hidden = false;
      } else {
        previewBuy.hidden = true;
      }
    }
  }

  (function initLibraryLayout() {
    var layout = document.getElementById("club-library-layout");
    var main = document.getElementById("club-library-main");
    var comingSoonTrack = document.getElementById("club-library-coming-soon-track");
    if (!layout || !main || !comingSoonTrack) return;

    var toneToCard = {
      peach: "journey-card--labs",
      aqua: "journey-card--stories",
      rose: "journey-card--family",
      leaf: "journey-card--school",
      sand: "journey-card--adventure",
    };
    var revealDelays = ["", " reveal--delay", " reveal--delay-2", " reveal--delay", " reveal--delay-2"];

    var featuredBooks = (content.librarySpotlights || []).slice();
    var upcomingBooks = (content.futureBooks || []).map(function (book, index) {
      return {
        slug: book.slug || "future-book-" + (index + 1),
        title: book.title,
        description:
          book.description ||
          "A new Little Ollie story is being created for the Club library.",
        cover:
          book.cover ||
          "../assets/little-ollie-club/library/future-book-" +
            (index + 1) +
            "-placeholder.svg",
        status: book.status,
        statusType: "soon",
        tone: book.tone,
      };
    });

    var featured = featuredBooks[0];
    if (featured) {
      main.innerHTML = renderSpotlightHtml(featured);
      updatePreviewModal(featured);
    }

    comingSoonTrack.innerHTML = upcomingBooks
      .slice(0, 5)
      .map(function (book, index) {
        var cardClass = toneToCard[book.tone] || "journey-card--stories";
        var message =
          book.description || "This book is coming soon to the Club library.";
        return (
          '<li class="journey-cards__item reveal is-visible' +
          (revealDelays[index] || "") +
          '">' +
          '<button type="button" class="journey-card ' +
          cardClass +
          ' journey-card--soon" data-coming-soon="' +
          message.replace(/"/g, "&quot;") +
          '">' +
          '<span class="journey-card__icon is-loaded">' +
          '<img src="' +
          book.cover +
          '" alt="" width="96" height="96" loading="lazy" decoding="async" />' +
          "</span>" +
          '<span class="journey-card__text">' +
          '<span class="journey-card__title">' +
          book.title +
          "</span>" +
          '<span class="journey-card__desc">' +
          book.status +
          "</span>" +
          "</span>" +
          '<span class="journey-card__arrow" aria-hidden="true">→</span>' +
          "</button>" +
          "</li>"
        );
      })
      .join("");
  })();

  (function initBookPreview() {
    var preview = document.getElementById("club-book-preview");
    if (!preview) return;

    var lastFocus = null;

    function openPreview() {
      lastFocus = document.activeElement;
      preview.hidden = false;
      document.body.classList.add("club-book-preview-open");
      document.dispatchEvent(new CustomEvent("club-library-pause"));
      var closeBtn = preview.querySelector(".club-book-preview__close");
      if (closeBtn) closeBtn.focus();
    }

    function closePreview() {
      preview.hidden = true;
      document.body.classList.remove("club-book-preview-open");
      document.dispatchEvent(new CustomEvent("club-library-resume"));
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }

    document.addEventListener("click", function (e) {
      if (e.target.closest("[data-open-book-preview]")) {
        e.preventDefault();
        openPreview();
      }
    });

    preview.querySelectorAll("[data-close-book-preview]").forEach(function (el) {
      el.addEventListener("click", closePreview);
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !preview.hidden) closePreview();
    });
  })();

  document.querySelectorAll("[data-club-bg]").forEach(function (img) {
    var stage = img.closest(".lo-stage");
    if (!stage) return;

    function markLoaded() {
      stage.classList.add("is-bg-loaded");
      img.hidden = false;
    }

    if (img.complete && img.naturalWidth > 0) {
      markLoaded();
      return;
    }

    img.addEventListener("load", markLoaded);
    img.addEventListener("error", function () {
      stage.classList.add("is-placeholder");
    });
  });

  document.querySelectorAll(".lo-stage").forEach(function (stage) {
    var bg = stage.querySelector(".lo-stage__bg[data-club-bg]");
    if (bg && !bg.getAttribute("src")) {
      stage.classList.add("is-placeholder");
    } else if (!bg || (bg.hidden && !stage.classList.contains("is-bg-loaded"))) {
      if (!stage.classList.contains("is-bg-loaded")) {
        stage.classList.add("is-placeholder");
      }
    }
  });

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

  var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!reducedMotion && "IntersectionObserver" in window) {
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -5% 0px" }
    );
    document.querySelectorAll(".reveal").forEach(function (el) {
      observer.observe(el);
    });
  } else {
    document.querySelectorAll(".reveal").forEach(function (el) {
      el.classList.add("is-visible");
    });
  }
})();
