/**
 * Book reader utilities — paths, spread logic, image loading, analytics hooks
 */
(function (global) {
  "use strict";

  var LoBookReader = (global.LoBookReader = global.LoBookReader || {});

  LoBookReader.utils = {
    MOBILE_BREAKPOINT: 768,
    SPREAD_BREAKPOINT: 900,
    TURN_MS: 580,
    FADE_MS: 220,

    prefersReducedMotion: function () {
      return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    },

    isMobileLayout: function () {
      return window.innerWidth < LoBookReader.utils.SPREAD_BREAKPOINT;
    },

    useSinglePageSpread: function () {
      return LoBookReader.utils.isPhonePortrait();
    },

    isPhoneLayout: function () {
      return window.matchMedia("(max-width: 899px)").matches;
    },

    isPhonePortrait: function () {
      return (
        LoBookReader.utils.isPhoneLayout() &&
        window.matchMedia("(orientation: portrait)").matches
      );
    },

    isPhoneLandscape: function () {
      return (
        LoBookReader.utils.isPhoneLayout() &&
        window.matchMedia("(orientation: landscape)").matches
      );
    },

    resolveUrl: function (manifestBase, relativePath) {
      if (!relativePath) return "";
      if (/^https?:\/\//.test(relativePath) || relativePath.startsWith("data:")) {
        return relativePath;
      }
      return new URL(relativePath, manifestBase).href;
    },

    getManifestBase: function (manifestUrl) {
      return new URL("./", new URL(manifestUrl, window.location.href)).href;
    },

    getPageSrc: function (page, manifestBase, mobile) {
      if (!page) return "";
      var rel = mobile && page.mobileSrc ? page.mobileSrc : page.src;
      return LoBookReader.utils.resolveUrl(manifestBase, rel);
    },

    getSpreadLayout: function (manifest) {
      return (manifest && manifest.spreadLayout) || "standard";
    },

    hasSeparateCover: function (manifest) {
      return !!(manifest && manifest.coverSeparate);
    },

    getSpreadCount: function (state) {
      var count = state.pageCount;
      if (state.spreadLayout === "first-right") {
        return 1 + Math.ceil(Math.max(count - 1, 0) / 2);
      }
      return Math.max(1, Math.ceil(count / 2));
    },

    getMaxReadIndex: function (state) {
      if (state.mobile) return Math.max(state.pageCount - 1, 0);
      return Math.max(LoBookReader.utils.getSpreadCount(state) - 1, 0);
    },

    getFirstReadIndex: function (state) {
      if (state.spreadLayout === "first-right") return 0;
      return state.hasSeparateCover ? 0 : 1;
    },

    /** Map a page array index to desktop spread index */
    pageIndexToSpreadIndex: function (pageIndex, state) {
      if (state.mobile) return pageIndex;
      if (state.spreadLayout === "first-right") {
        if (pageIndex <= 0) return 0;
        return 1 + Math.floor((pageIndex - 1) / 2);
      }
      if (state.hasSeparateCover) return pageIndex;
      return pageIndex % 2 === 0 ? pageIndex : pageIndex - 1;
    },

    /** Primary page index for thumbnails/progress when on a spread */
    spreadIndexToPageIndex: function (spreadIndex, state) {
      if (state.spreadLayout === "first-right") {
        if (spreadIndex <= 0) return 0;
        return 1 + (spreadIndex - 1) * 2;
      }
      return spreadIndex;
    },

    getSpreadIndices: function (state) {
      var pages = state.pages;
      var count = state.pageCount;

      if (state.mobile) {
        var single = state.readIndex;
        return {
          left: null,
          right: null,
          single: single,
          leftPage: null,
          rightPage: pages[single] || null,
        };
      }

      if (state.spreadLayout === "first-right") {
        var spread = state.readIndex;
        if (spread <= 0) {
          return { left: null, right: 0, single: null, leftPage: null, rightPage: pages[0] || null };
        }
        var leftIdx = 1 + (spread - 1) * 2;
        var rightIdx = leftIdx + 1;
        return {
          left: leftIdx < count ? leftIdx : null,
          right: rightIdx < count ? rightIdx : null,
          single: null,
          leftPage: leftIdx < count ? pages[leftIdx] : null,
          rightPage: rightIdx < count ? pages[rightIdx] : null,
        };
      }

      var left = state.readIndex;
      var right = left + 1;
      return {
        left: left,
        right: right < count ? right : null,
        single: null,
        leftPage: pages[left] || null,
        rightPage: right < count ? pages[right] : null,
      };
    },

    canGoNext: function (state) {
      if (!state.isOpen) return true;
      return state.readIndex < LoBookReader.utils.getMaxReadIndex(state);
    },

    canGoPrev: function (state) {
      if (!state.isOpen) return false;
      return state.readIndex > LoBookReader.utils.getFirstReadIndex(state);
    },

    nextIndex: function (state) {
      return Math.min(state.readIndex + 1, LoBookReader.utils.getMaxReadIndex(state));
    },

    prevIndex: function (state) {
      return Math.max(state.readIndex - 1, LoBookReader.utils.getFirstReadIndex(state));
    },

    isAtEnd: function (state) {
      if (!state.isOpen) return false;
      return state.readIndex >= LoBookReader.utils.getMaxReadIndex(state);
    },

    /** Final spread with one page only — show cover-sized single page */
    isLastSingleSpread: function (state) {
      if (state.mobile || !state.isOpen) return false;
      if (state.readIndex !== LoBookReader.utils.getMaxReadIndex(state)) return false;
      var spread = LoBookReader.utils.getSpreadIndices(state);
      var hasLeft = !!spread.leftPage;
      var hasRight = !!spread.rightPage;
      return (hasLeft && !hasRight) || (!hasLeft && hasRight);
    },

    getPrimaryPageIndex: function (state) {
      var spread = LoBookReader.utils.getSpreadIndices(state);
      if (state.mobile) return state.readIndex;
      if (spread.left !== null && spread.left !== undefined) return spread.left;
      if (spread.right !== null && spread.right !== undefined) return spread.right;
      return 0;
    },

    pageLabel: function (state) {
      var spread = LoBookReader.utils.getSpreadIndices(state);
      var total = state.pageCount;

      if (state.mobile) {
        var page = state.pages[state.readIndex];
        if (!page) return "";
        return "Page " + page.number + " of " + total;
      }

      if (state.spreadLayout === "first-right" && state.readIndex === 0 && spread.rightPage) {
        return "Page " + spread.rightPage.number + " of " + total;
      }

      if (spread.leftPage && spread.rightPage) {
        return "Pages " + spread.leftPage.number + "–" + spread.rightPage.number + " of " + total;
      }
      if (spread.leftPage) {
        return "Page " + spread.leftPage.number + " of " + total;
      }
      if (spread.rightPage) {
        return "Page " + spread.rightPage.number + " of " + total;
      }
      return "";
    },

    progressRatio: function (state) {
      if (!state.isOpen) return 0;
      var max = LoBookReader.utils.getMaxReadIndex(state);
      var start = LoBookReader.utils.getFirstReadIndex(state);
      if (max <= start) return 1;
      return Math.min(1, Math.max(0, (state.readIndex - start) / (max - start)));
    },

    syncReadIndexOnResize: function (state, wasMobile) {
      if (wasMobile === state.mobile) return;
      var pageIdx = wasMobile
        ? state.readIndex
        : LoBookReader.utils.spreadIndexToPageIndex(state.readIndex, state);
      state.readIndex = state.mobile
        ? pageIdx
        : LoBookReader.utils.pageIndexToSpreadIndex(pageIdx, state);
    },

    emit: function (eventName, detail) {
      var hooks = global.LoBookAnalytics;
      if (hooks && typeof hooks[eventName] === "function") {
        hooks[eventName](detail);
      }
      document.dispatchEvent(
        new CustomEvent("lo-book:" + eventName.replace(/^on/, "").toLowerCase(), { detail: detail })
      );
    },

    loadImage: function (src) {
      return new Promise(function (resolve, reject) {
        var img = new Image();
        img.decoding = "async";
        img.onload = function () {
          resolve(img);
        };
        img.onerror = function () {
          reject(new Error("Failed to load " + src));
        };
        img.src = src;
      });
    },

    preloadAround: function (manifest, manifestBase, indices, mobile, cache) {
      var utils = LoBookReader.utils;
      indices.forEach(function (idx) {
        if (idx < 0 || idx >= manifest.pages.length) return;
        var page = manifest.pages[idx];
        var src = utils.getPageSrc(page, manifestBase, mobile);
        if (!src || cache[src]) return;
        cache[src] = utils.loadImage(src).catch(function () {
          cache[src] = null;
          return null;
        });
      });
    },
  };
})(window);
