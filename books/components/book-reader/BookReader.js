/**
 * Little Ollie Book Reader — main controller
 */
(function (global) {
  "use strict";

  var LoBookReader = (global.LoBookReader = global.LoBookReader || {});
  var utils = LoBookReader.utils;

  function BookReader(container, options) {
    this.container = container;
    this.options = options || {};
    this.manifest = null;
    this.manifestBase = "";
    this.state = {
      isOpen: false,
      readIndex: 0,
      pageCount: 0,
      pages: [],
      spreadLayout: "standard",
      hasSeparateCover: false,
      mobile: utils.useSinglePageSpread(),
      turning: false,
      finished: false,
      settings: {
        transitions: !utils.prefersReducedMotion(),
        fit: "page",
        dimness: 0.42,
      },
    };
    this.imageCache = {};
    this.leftPage = null;
    this.rightPage = null;
    this.thumbsDrawer = null;
    this._bindResize = this._onResize.bind(this);
    this._chromeHeights = null;
    this._layoutLocked = false;
  }

  BookReader.prototype.init = function () {
    var self = this;
    this._buildShell();
    this.stage.showLoading(true);

    return this._loadManifest()
      .then(function () {
        return self._prepareCover();
      })
      .then(function () {
        self.stage.showLoading(false);
        self._bindEvents();
        self._applyBookLayout(true);
        self._render();
        window.addEventListener("resize", self._bindResize);
        window.addEventListener("orientationchange", self._bindResize);
        utils.emit("onBookOpened", { slug: self.manifest.slug, title: self.manifest.title });
      })
      .catch(function (err) {
        self.stage.showLoading(false);
        this.container.innerHTML =
          '<div class="book-reader__fatal"><p>Could not open this book right now.</p><p>' +
          (err.message || "Please try again later.") +
          '</p><a class="home-btn home-btn--primary" href="' +
          (self.options.libraryUrl || "../../index.html#club-library") +
          '">Back to Library</a></div>';
      }.bind(this));
  };

  BookReader.prototype._buildShell = function () {
    this.container.classList.add("book-reader");
    this.container.innerHTML = "";

    var settings = document.createElement("details");
    settings.className = "book-reader__settings";
    settings.innerHTML =
      "<summary>Reading settings</summary>" +
      '<label><input type="checkbox" data-setting="transitions" checked> Page transitions</label>' +
      '<label>Background dimness <input type="range" min="20" max="70" value="42" data-setting="dimness"></label>';

    this.header = LoBookReader.ReaderHeader.create(this.container, this.options);
    this.stage = LoBookReader.BookStage.create(this.container);
    this.controls = LoBookReader.ReaderControls.create(this.container);
    this.progress = LoBookReader.ReaderProgress.create(this.container);
    this.endScreen = LoBookReader.ReaderEndScreen.create(this.container, this.options);
    this.container.appendChild(settings);
    this.settingsPanel = settings;

    this.thumbsDrawer = document.createElement("aside");
    this.thumbsDrawer.id = "book-thumbs-drawer";
    this.thumbsDrawer.className = "book-reader__thumbs";
    this.thumbsDrawer.hidden = true;
    this.thumbsDrawer.innerHTML =
      '<div class="book-reader__thumbs-head"><h2>Pages</h2><button type="button" class="home-btn home-btn--secondary home-btn--small" data-thumbs-close>Close</button></div><div class="book-reader__thumbs-grid"></div>';
    this.container.appendChild(this.thumbsDrawer);
    this.thumbsGrid = this.thumbsDrawer.querySelector(".book-reader__thumbs-grid");

    this.rotatePrompt = document.createElement("div");
    this.rotatePrompt.className = "book-reader__rotate-prompt";
    this.rotatePrompt.hidden = true;
    this.rotatePrompt.innerHTML =
      '<div class="book-reader__rotate-card" role="dialog" aria-modal="true" aria-labelledby="book-rotate-title">' +
      '<span class="book-reader__rotate-icon" aria-hidden="true">↻</span>' +
      '<h2 id="book-rotate-title">Turn your device sideways</h2>' +
      "<p>Little Ollie books read best in landscape on phones. Rotate your device to continue reading.</p>" +
      "</div>";
    this.container.appendChild(this.rotatePrompt);
  };

  BookReader.prototype._loadManifest = function () {
    var self = this;
    var url = this.options.manifestUrl;
    return fetch(url)
      .then(function (res) {
        if (!res.ok) throw new Error("Manifest not found");
        return res.json();
      })
      .then(function (json) {
        self.manifest = json;
        self.manifestBase = utils.getManifestBase(url);
        self.state.pages = json.pages || [];
        self.state.pageCount = json.pageCount || self.state.pages.length;
        self.state.spreadLayout = utils.getSpreadLayout(json);
        self.state.hasSeparateCover = utils.hasSeparateCover(json);
        self.header.setTitle(json.title);
        self.container.style.setProperty("--book-dimness", String(self.state.settings.dimness));
        if (!self.options.amazonUrl && json.amazonUrl) {
          self.options.amazonUrl = json.amazonUrl;
        }
        if (json.amazonUrl && !self.header.el.querySelector(".book-reader__buy-btn")) {
          var buyLink = document.createElement("a");
          buyLink.className = "home-nav__link book-reader__buy-btn";
          buyLink.href = json.amazonUrl;
          buyLink.rel = "noopener noreferrer";
          buyLink.target = "_blank";
          buyLink.textContent = "Buy the Book";
          self.header.closeBtn.parentElement.insertBefore(buyLink, self.header.closeBtn);
        }
        if (json.amazonUrl && self.endScreen.el && !self.endScreen.el.querySelector('[data-end-action="buy"]')) {
          var endBuy = document.createElement("a");
          endBuy.className = "home-btn home-btn--ghost";
          endBuy.setAttribute("data-end-action", "buy");
          endBuy.href = json.amazonUrl;
          endBuy.rel = "noopener noreferrer";
          endBuy.target = "_blank";
          endBuy.textContent = "Buy the Book";
          var activities = self.endScreen.el.querySelector('[data-end-action="activities"]');
          if (activities) {
            self.endScreen.el.querySelector(".book-reader__end-actions").insertBefore(endBuy, activities);
          }
        }
        self._buildThumbnails();
      });
  };

  BookReader.prototype._prepareCover = function () {
    var coverSrc = utils.resolveUrl(this.manifestBase, this.manifest.coverSrc);
    if (!coverSrc && this.state.pages[0]) {
      coverSrc = utils.getPageSrc(this.state.pages[0], this.manifestBase, false);
    }
    var coverAlt = this.manifest.title;
    this.stage.cover.setCover(coverSrc, coverAlt);
    var self = this;
    return utils.loadImage(coverSrc).then(function (img) {
      if (img && img.naturalWidth && img.naturalHeight) {
        self._coverAspect = img.naturalWidth / img.naturalHeight;
      }
      return img;
    });
  };

  BookReader.prototype._mountPages = function () {
    if (!this.leftPage) {
      this.leftPage = LoBookReader.BookPage.create({ index: 0, extraClass: "book-page--left" });
      this.rightPage = LoBookReader.BookPage.create({ index: 1, extraClass: "book-page--right" });
      this.stage.spread.leftSlot.appendChild(this.leftPage.el);
      this.stage.spread.rightSlot.appendChild(this.rightPage.el);
      var self = this;
      [this.leftPage, this.rightPage].forEach(function (page) {
        page.retryBtn.addEventListener("click", function () {
          var idx = Number(page.el.dataset.pageIndex);
          if (!isNaN(idx)) self._loadPageInto(page, idx);
        });
      });
    }
  };

  BookReader.prototype._loadPageInto = function (pageView, index) {
    var page = this.state.pages[index];
    if (!page || !pageView) return Promise.resolve();
    pageView.showPage();
    pageView.hideUnderlay();
    var src = utils.getPageSrc(page, this.manifestBase, this.state.mobile);
    pageView.setSrc(src);
    pageView.el.dataset.pageIndex = String(index);
    pageView.img.alt = page.alt || "";
    return utils
      .loadImage(src)
      .then(function () {
        pageView.markLoaded();
      })
      .catch(function () {
        pageView.markError();
      });
  };

  BookReader.prototype._loadUnderlayInto = function (pageView, index) {
    var page = this.state.pages[index];
    if (!page || !pageView) return Promise.resolve();

    if (index === null || index === undefined) {
      pageView.hideUnderlay();
      return Promise.resolve();
    }

    var src = utils.getPageSrc(page, this.manifestBase, false);
    pageView.setUnderlay(src, page.alt || "");
    return utils.loadImage(src).catch(function () {
      return null;
    });
  };

  BookReader.prototype._prepareTurnUnderlay = function (newIndex) {
    var self = this;

    if (this.state.mobile || !this.leftPage || !this.rightPage) {
      return Promise.resolve();
    }

    var nextState = {
      isOpen: this.state.isOpen,
      readIndex: newIndex,
      pageCount: this.state.pageCount,
      pages: this.state.pages,
      spreadLayout: this.state.spreadLayout,
      hasSeparateCover: this.state.hasSeparateCover,
      mobile: false,
    };
    var spread = utils.getSpreadIndices(nextState);
    var jobs = [];

    if (spread.leftPage) {
      jobs.push(this._loadUnderlayInto(this.leftPage, spread.left));
    } else if (this.state.spreadLayout === "first-right") {
      this.leftPage.showUnderlayBlank();
    } else {
      this.leftPage.hideUnderlay();
    }

    if (spread.rightPage) {
      jobs.push(this._loadUnderlayInto(this.rightPage, spread.right));
    } else {
      this.rightPage.hideUnderlay();
    }

    return Promise.all(jobs);
  };

  BookReader.prototype._clearTurnUnderlay = function () {
    if (this.leftPage) this.leftPage.hideUnderlay();
    if (this.rightPage) this.rightPage.hideUnderlay();
  };

  BookReader.prototype._startPageTurn = function (spreadEl, direction) {
    spreadEl.classList.remove("is-turn-forward", "is-turn-back", "is-reduced-motion");
    void spreadEl.offsetWidth;
    spreadEl.classList.add(direction === "next" ? "is-turn-forward" : "is-turn-back");
  };

  BookReader.prototype._renderSpread = function () {
    var spread = utils.getSpreadIndices(this.state);
    var lastSingle = utils.isLastSingleSpread(this.state);
    this.leftPage.el.hidden = true;
    this.rightPage.el.hidden = true;

    if (this.state.mobile) {
      this.leftPage.el.hidden = false;
      if (spread.single !== null && spread.single !== undefined) {
        this._loadPageInto(this.leftPage, spread.single);
      }
      return;
    }

    this.stage.spread.el.classList.toggle("is-first-right", this.state.spreadLayout === "first-right");
    this.stage.spread.el.classList.toggle(
      "is-first-spread",
      this.state.spreadLayout === "first-right" && this.state.readIndex === 0 && !lastSingle
    );

    if (lastSingle) {
      this.leftPage.el.hidden = false;
      if (spread.leftPage) {
        this._loadPageInto(this.leftPage, spread.left);
      } else if (spread.rightPage) {
        this._loadPageInto(this.leftPage, spread.right);
      }
      return;
    }

    if (spread.leftPage) {
      this.leftPage.el.hidden = false;
      this._loadPageInto(this.leftPage, spread.left);
    } else if (spread.rightPage || this.state.spreadLayout === "first-right") {
      this.leftPage.el.hidden = false;
      this.leftPage.showBlank();
    }

    if (spread.rightPage) {
      this.rightPage.el.hidden = false;
      this._loadPageInto(this.rightPage, spread.right);
    } else if (spread.leftPage) {
      this.rightPage.el.hidden = false;
      this.rightPage.showBlank();
    }
  };

  BookReader.prototype._render = function () {
    if (this.state.finished) {
      this.stage.cover.hide();
      this.stage.spread.hide();
      this.controls.el.hidden = true;
      this.progress.el.hidden = true;
      this.endScreen.show();
      return;
    }

    this.endScreen.hide();
    this.controls.el.hidden = false;
    this.progress.el.hidden = false;

    if (!this.state.isOpen) {
      this.stage.cover.show();
      this.stage.spread.hide();
      this.controls.el.hidden = true;
      this.progress.el.hidden = true;
      this.controls.setDisabled("prev", true);
      this.controls.setDisabled("next", false);
      this.progress.update("Front cover", 0);
      this.progress.announce("Front cover. Press the cover to start reading.");
      this.container.classList.remove("is-book-open");
      return;
    }

    this.container.classList.add("is-book-open");
    this.stage.cover.hide();
    this.stage.spread.show();
    this.state.mobile = utils.useSinglePageSpread();
    var lastSingle = utils.isLastSingleSpread(this.state);
    this.stage.spread.setSingleMode(this.state.mobile || lastSingle);
    this.stage.spread.setLastSpread(lastSingle);
    this._mountPages();
    this._renderSpread();

    var label = utils.pageLabel(this.state);
    this.progress.update(label, utils.progressRatio(this.state));
    this.progress.announce("Now viewing " + label);

    this.controls.setDisabled("prev", !utils.canGoPrev(this.state));
    this.controls.setDisabled("next", !utils.canGoNext(this.state));

    this._highlightThumb(utils.getPrimaryPageIndex(this.state));
    this._preloadNeighbors();
  };

  BookReader.prototype._preloadNeighbors = function () {
    var spread = utils.getSpreadIndices(this.state);
    var indices = [spread.left, spread.right, spread.single, utils.nextIndex(this.state), utils.prevIndex(this.state)];
    if (this.state.mobile) {
      indices = [this.state.readIndex - 1, this.state.readIndex, this.state.readIndex + 1, this.state.readIndex + 2];
    } else if (this.state.spreadLayout === "first-right") {
      var nextSpread = utils.getSpreadIndices(Object.assign({}, this.state, { readIndex: this.state.readIndex + 1 }));
      var prevSpread = utils.getSpreadIndices(Object.assign({}, this.state, { readIndex: this.state.readIndex - 1 }));
      indices = [spread.left, spread.right, nextSpread.left, nextSpread.right, prevSpread.left, prevSpread.right];
    }
    utils.preloadAround(this.manifest, this.manifestBase, indices, this.state.mobile, this.imageCache);
  };

  BookReader.prototype.openBook = function () {
    var self = this;
    if (this.state.isOpen || this.state.turning) return;
    this.state.turning = true;
    this.stage.cover.setOpen(true);

    var finish = function () {
      self.state.isOpen = true;
      self.state.readIndex = utils.getFirstReadIndex(self.state);
      self.state.turning = false;
      self.stage.cover.hide();
      self._cacheChromeHeights();
      self._applyBookLayout(true);
      self._layoutLocked = true;
      self._render();
      var pageNum = (self.state.pages[self.state.readIndex] || {}).number || 1;
      utils.emit("onReadingStarted", { slug: self.manifest.slug, page: pageNum });
    };

    if (this.state.settings.transitions) {
      window.setTimeout(finish, 520);
    } else {
      finish();
    }
  };

  BookReader.prototype._turnTo = function (newIndex, direction) {
    var self = this;
    if (this.state.turning) return;

    if (!this.state.isOpen) {
      this.openBook();
      return;
    }

    if (newIndex === this.state.readIndex) {
      if (direction === "next" && utils.isAtEnd(this.state)) {
        this._finishBook();
      }
      return;
    }

    this.state.turning = true;
    var spreadEl = this.stage.spread.el;
    var turnMs = this.state.settings.transitions ? utils.TURN_MS : utils.FADE_MS;

    var runTurn = function () {
      self._startPageTurn(spreadEl, direction);
      window.setTimeout(apply, turnMs);
    };

    var apply = function () {
      self.state.readIndex = newIndex;
      self.state.turning = false;
      spreadEl.classList.remove("is-turn-forward", "is-turn-back", "is-reduced-motion");
      self._clearTurnUnderlay();
      self._render();
      utils.emit("onPageChanged", {
        slug: self.manifest.slug,
        index: utils.getPrimaryPageIndex(self.state),
        number: (self.state.pages[utils.getPrimaryPageIndex(self.state)] || {}).number,
      });
    };

    if (!this.state.settings.transitions) {
      spreadEl.classList.add("is-reduced-motion");
    }

    this._prepareTurnUnderlay(newIndex).then(runTurn).catch(runTurn);
  };

  BookReader.prototype.next = function () {
    if (!this.state.isOpen) {
      this.openBook();
      return;
    }
    if (utils.isAtEnd(this.state)) {
      this._finishBook();
      return;
    }
    this._turnTo(utils.nextIndex(this.state), "next");
  };

  BookReader.prototype.prev = function () {
    if (!this.state.isOpen) return;
    if (!utils.canGoPrev(this.state)) return;
    this._turnTo(utils.prevIndex(this.state), "back");
  };

  BookReader.prototype._finishBook = function () {
    this.state.finished = true;
    this._render();
    utils.emit("onBookCompleted", { slug: this.manifest.slug, title: this.manifest.title });
  };

  BookReader.prototype.readAgain = function () {
    this.state.finished = false;
    this.state.isOpen = false;
    this.state.readIndex = 0;
    this._layoutLocked = false;
    this._chromeHeights = null;
    this.stage.cover.show();
    this.stage.cover.el.classList.remove("is-opening");
    this._applyBookLayout(true);
    this._render();
    utils.emit("onReadAgain", { slug: this.manifest.slug });
  };

  BookReader.prototype.goToPage = function (index) {
    if (index < 0) return;
    this.state.isOpen = true;
    this.state.finished = false;
    this.state.readIndex = this.state.mobile
      ? index
      : utils.pageIndexToSpreadIndex(index, this.state);
    if (!this._layoutLocked) {
      this._cacheChromeHeights();
      this._applyBookLayout(true);
      this._layoutLocked = true;
    }
    this._render();
    this._closeThumbs();
  };

  BookReader.prototype._buildThumbnails = function () {
    var self = this;
    this.thumbsGrid.innerHTML = "";
    this.state.pages.forEach(function (page, index) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "book-reader__thumb";
      btn.dataset.index = String(index);
      btn.setAttribute("aria-label", "Go to page " + page.number);
      var img = document.createElement("img");
      img.loading = "lazy";
      img.alt = "";
      img.src = utils.getPageSrc(page, self.manifestBase, true);
      btn.appendChild(img);
      btn.addEventListener("click", function () {
        self.goToPage(index);
      });
      self.thumbsGrid.appendChild(btn);
    });
  };

  BookReader.prototype._highlightThumb = function (index) {
    this.thumbsGrid.querySelectorAll(".book-reader__thumb").forEach(function (btn) {
      btn.classList.toggle("is-current", Number(btn.dataset.index) === index);
    });
  };

  BookReader.prototype._toggleThumbs = function () {
    var open = this.thumbsDrawer.hidden;
    this.thumbsDrawer.hidden = !open;
    this.header.pagesBtn.setAttribute("aria-expanded", open ? "true" : "false");
  };

  BookReader.prototype._closeThumbs = function () {
    this.thumbsDrawer.hidden = true;
    this.header.pagesBtn.setAttribute("aria-expanded", "false");
  };

  BookReader.prototype._isMaximized = function () {
    return (
      this.container.classList.contains("is-fullscreen") ||
      this.container.classList.contains("is-immersive")
    );
  };

  BookReader.prototype._tryLockLandscape = function () {
    if (!utils.isPhoneLayout()) return;
    if (screen.orientation && typeof screen.orientation.lock === "function") {
      screen.orientation.lock("landscape").catch(function () {});
    }
  };

  BookReader.prototype._unlockOrientation = function () {
    if (screen.orientation && typeof screen.orientation.unlock === "function") {
      try {
        screen.orientation.unlock();
      } catch (err) {
        /* ignore */
      }
    }
  };

  BookReader.prototype._enterImmersive = function () {
    this.container.classList.add("is-immersive");
    document.body.classList.add("book-reader-immersive-open");
    this.header.setFullscreenLabel(true);
    this._tryLockLandscape();
    this._applyBookLayout(true);
  };

  BookReader.prototype._exitMaximized = function () {
    if (document.fullscreenElement === this.container) {
      document.exitFullscreen();
    }
    this.container.classList.remove("is-immersive", "is-fullscreen");
    document.body.classList.remove("book-reader-immersive-open");
    this.header.setFullscreenLabel(false);
    this._unlockOrientation();
    this._applyBookLayout(true);
  };

  BookReader.prototype._cacheChromeHeights = function () {
    this._chromeHeights = {
      nav: this.header.el ? this.header.el.offsetHeight : 84,
      controls: this.controls.el.offsetHeight || 48,
      progress: this.progress.el.offsetHeight || 44,
    };
  };

  BookReader.prototype._applyBookLayout = function (force) {
    if (this._layoutLocked && !force) return;

    var maximized = this._isMaximized();
    var coverAspect = this._coverAspect || 915 / 887;
    var spine = 12;
    var sidePad = maximized ? 16 : 24;
    var maxWidth = window.innerWidth - sidePad * 2;
    var chrome = this._chromeHeights || {
      nav: this.header.el ? this.header.el.offsetHeight : 84,
      controls: 48,
      progress: 44,
    };
    var readingChrome = chrome.nav + chrome.controls + chrome.progress + (maximized ? 16 : 32);
    var available = Math.max(240, window.innerHeight - readingChrome);
    var pageWidth;
    var pageHeight;

    if (this.state.mobile) {
      pageWidth = maxWidth;
      pageHeight = pageWidth / coverAspect;
      if (pageHeight > available * 0.92) {
        pageHeight = available * 0.92;
        pageWidth = pageHeight * coverAspect;
      }
    } else {
      pageWidth = (maxWidth - spine) / 2;
      pageHeight = pageWidth / coverAspect;

      if (pageHeight > available * 0.92) {
        pageHeight = available * 0.92;
        pageWidth = pageHeight * coverAspect;
      }

      if (pageWidth * 2 + spine > maxWidth) {
        pageWidth = (maxWidth - spine) / 2;
        pageHeight = pageWidth / coverAspect;
      }
    }

    this.container.style.setProperty("--book-cover-width", Math.round(pageWidth) + "px");
    this.container.style.setProperty("--book-cover-height", Math.round(pageHeight) + "px");
    this.container.style.setProperty("--book-page-width", Math.round(pageWidth) + "px");
    this.container.style.setProperty("--book-page-height", Math.round(pageHeight) + "px");
    this.container.style.setProperty("--book-page-max-h", Math.round(pageHeight) + "px");
    this.container.style.setProperty("--book-spine-width", spine + "px");

    var phonePortrait = utils.isPhonePortrait();
    this.container.classList.toggle("is-phone-portrait", phonePortrait);
    this.container.classList.toggle("is-phone-landscape", utils.isPhoneLandscape());
    this.container.classList.toggle("is-reading-blocked", phonePortrait);
    if (this.rotatePrompt) {
      this.rotatePrompt.hidden = !phonePortrait;
    }
  };

  BookReader.prototype._syncMaximizedState = function () {
    var active = document.fullscreenElement === this.container;
    this.container.classList.toggle("is-fullscreen", active);
    if (!active && !this.container.classList.contains("is-immersive")) {
      this.header.setFullscreenLabel(false);
      this._unlockOrientation();
    } else {
      this.header.setFullscreenLabel(true);
    }
    this._applyBookLayout(true);
  };

  BookReader.prototype._toggleFullscreen = function () {
    var self = this;
    var root = this.container;

    if (utils.isPhonePortrait()) {
      if (this.rotatePrompt) this.rotatePrompt.hidden = false;
      return;
    }

    if (this._isMaximized()) {
      this._exitMaximized();
      return;
    }

    if (document.fullscreenEnabled && root.requestFullscreen) {
      root
        .requestFullscreen()
        .then(function () {
          self._tryLockLandscape();
          self._syncMaximizedState();
        })
        .catch(function () {
          self._enterImmersive();
        });
    } else {
      this._enterImmersive();
    }
  };

  BookReader.prototype._onResize = function () {
    var wasMobile = this.state.mobile;
    this.state.mobile = utils.useSinglePageSpread();
    this._chromeHeights = null;
    if (wasMobile !== this.state.mobile && this.state.isOpen) {
      utils.syncReadIndexOnResize(this.state, wasMobile);
      this._render();
    }
    if (this.state.isOpen) {
      this._cacheChromeHeights();
    }
    this._applyBookLayout(true);
  };

  BookReader.prototype._bindEvents = function () {
    var self = this;

    this.stage.cover.front.addEventListener("click", function () {
      self.openBook();
    });
    this.stage.cover.startBtn.addEventListener("click", function () {
      self.openBook();
    });
    this.controls.next.addEventListener("click", function () {
      self.next();
    });
    this.controls.prev.addEventListener("click", function () {
      self.prev();
    });
    this.endScreen.againBtn.addEventListener("click", function () {
      self.readAgain();
    });
    this.header.pagesBtn.addEventListener("click", function () {
      self._toggleThumbs();
    });
    this.thumbsDrawer.querySelector("[data-thumbs-close]").addEventListener("click", function () {
      self._closeThumbs();
    });

    this.settingsPanel.querySelector('[data-setting="transitions"]').addEventListener("change", function (e) {
      self.state.settings.transitions = e.target.checked && !utils.prefersReducedMotion();
    });
    this.settingsPanel.querySelector('[data-setting="dimness"]').addEventListener("input", function (e) {
      self.state.settings.dimness = Number(e.target.value) / 100;
      self.container.style.setProperty("--book-dimness", String(self.state.settings.dimness));
    });

    document.addEventListener("keydown", function (e) {
      if (!self.container.isConnected) return;
      if (e.target.closest("input, textarea, select, summary")) return;
      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        self.next();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        self.prev();
      } else if (e.key === "Escape" && self._isMaximized()) {
        self._exitMaximized();
      }
    });

    var touchStartX = 0;
    this.stage.el.addEventListener(
      "touchstart",
      function (e) {
        touchStartX = e.changedTouches[0].clientX;
      },
      { passive: true }
    );
    this.stage.el.addEventListener(
      "touchend",
      function (e) {
        var dx = e.changedTouches[0].clientX - touchStartX;
        if (Math.abs(dx) < 40) return;
        if (dx < 0) self.next();
        else self.prev();
      },
      { passive: true }
    );
  };

  LoBookReader.init = function (selector, options) {
    var el = typeof selector === "string" ? document.querySelector(selector) : selector;
    if (!el) return null;
    var reader = new BookReader(el, options);
    reader.init();
    return reader;
  };
})(window);
