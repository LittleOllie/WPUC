/**
 * X Post Styler — paste, highlight, style in place, copy.
 */
(function () {
  "use strict";

  var XP = window.XPStyler;
  if (!XP) {
    console.error("X Post Styler: failed to load utilities.");
    return;
  }

  var STYLE_CATEGORIES = XP.STYLE_CATEGORIES;
  var normalizeToPlain = XP.normalizeToPlain;
  var applyTextStyle = XP.applyTextStyle;
  var getStyleLabel = XP.getStyleLabel;
  var calculateCharacterEstimate = XP.calculateCharacterEstimate;
  var EXAMPLE_POST = XP.EXAMPLE_POST;
  var buildStyledDocument = XP.buildStyledDocument;
  var remapSpans = XP.remapSpans;
  var applySpanStyle = XP.applySpanStyle;
  var styledRangeToPlain = XP.styledRangeToPlain;
  var inferPlainCursorAfterEdit = XP.inferPlainCursorAfterEdit;
  var plainRangeToStyled = XP.plainRangeToStyled;

  var STYLE_SAMPLE = "Aa Bb";
  var PREVIEW_MAX = 36;

  var toastTimer = null;
  var selectionTimer = null;
  var isRefreshing = false;
  var isComposing = false;

  var state = {
    plainText: "",
    spans: [],
    styledToPlain: [],
    text: "",
    plainOriginal: "",
    savedSelection: null,
    settings: { keepHashtagsNormal: true, keepMentionsNormal: true },
  };

  function $(id) {
    return document.getElementById(id);
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function getOpts() {
    return {
      keepHashtagsNormal: state.settings.keepHashtagsNormal,
      keepMentionsNormal: state.settings.keepMentionsNormal,
    };
  }

  function showToast(msg) {
    var el = $("xps-toast");
    if (!el) return;
    el.textContent = msg;
    el.hidden = false;
    el.classList.add("xps-toast--show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      el.classList.remove("xps-toast--show");
      setTimeout(function () { el.hidden = true; }, 300);
    }, 2400);
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(function () { return true; }).catch(function () {
        return fallbackCopy(text);
      });
    }
    return Promise.resolve(fallbackCopy(text));
  }

  function fallbackCopy(text) {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "0";
    ta.style.left = "0";
    ta.style.width = "2em";
    ta.style.height = "2em";
    ta.style.padding = "0";
    ta.style.border = "none";
    ta.style.outline = "none";
    ta.style.boxShadow = "none";
    ta.style.background = "transparent";
    ta.style.opacity = "0";
    ta.style.fontSize = "16px";
    document.body.appendChild(ta);
    ta.focus({ preventScroll: true });
    ta.select();
    ta.setSelectionRange(0, text.length);
    var ok = false;
    try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
    document.body.removeChild(ta);
    return ok;
  }

  function truncate(str, max) {
    if (str.length <= max) return str;
    return str.slice(0, max - 1) + "…";
  }

  function updateCounter() {
    var counter = $("xps-char-count");
    if (!counter) return;
    var count = calculateCharacterEstimate(state.text || "");
    counter.textContent = count + " / 280";
    counter.classList.remove("xps-counter--calm", "xps-counter--close", "xps-counter--warn");
    if (count <= 240) counter.classList.add("xps-counter--calm");
    else if (count <= 280) counter.classList.add("xps-counter--close");
    else counter.classList.add("xps-counter--warn");
  }

  function restoreTextareaSelection(input, sStart, sEnd) {
    requestAnimationFrame(function () {
      try {
        input.focus({ preventScroll: true });
        input.setSelectionRange(sStart, sEnd);
      } catch (e) { /* iOS may reject in edge cases */ }
      isRefreshing = false;
    });
  }

  function refreshTextareaFromState(plainCursor, plainSelEnd) {
    var input = $("xps-input");
    if (!input) return;

    isRefreshing = true;
    var doc = buildStyledDocument(state.plainText, state.spans, getOpts());
    state.text = doc.styled;
    state.styledToPlain = doc.styledToPlain;
    input.value = doc.styled;

    if (typeof plainCursor === "number") {
      var range = plainRangeToStyled(doc.styledToPlain, plainCursor, plainSelEnd || plainCursor);
      restoreTextareaSelection(input, range.sStart, range.sEnd);
    } else {
      isRefreshing = false;
    }

    updateCounter();
  }

  function setPlainContent(plainText, spans, plainCursor, plainSelEnd) {
    state.plainText = plainText || "";
    state.spans = spans || [];
    if (!state.plainOriginal && state.plainText) {
      state.plainOriginal = state.plainText;
    }
    refreshTextareaFromState(plainCursor, plainSelEnd);
  }

  function getPlainSelection() {
    var input = $("xps-input");
    if (!input || input.selectionEnd <= input.selectionStart) return null;
    return styledRangeToPlain(
      state.styledToPlain,
      input.selectionStart,
      input.selectionEnd,
      state.plainText.length
    );
  }

  function hideToolbar() {
    var toolbar = $("xps-toolbar");
    var idle = $("xps-toolbar-idle");
    if (toolbar) toolbar.hidden = true;
    if (idle) idle.hidden = false;
  }

  function scrollToolbarIntoView() {
    var toolbar = $("xps-toolbar");
    if (!toolbar || toolbar.hidden) return;
    requestAnimationFrame(function () {
      toolbar.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
  }

  function saveSelectionFromInput() {
    var sel = getPlainSelection();
    if (sel && sel.pEnd > sel.pStart) {
      state.savedSelection = { pStart: sel.pStart, pEnd: sel.pEnd };
    }
  }

  function getActiveSelection() {
    var sel = getPlainSelection();
    if (sel && sel.pEnd > sel.pStart) return sel;
    if (state.savedSelection && state.savedSelection.pEnd > state.savedSelection.pStart) {
      return state.savedSelection;
    }
    return null;
  }

  function scheduleSelectionUI() {
    clearTimeout(selectionTimer);
    selectionTimer = setTimeout(updateSelectionUI, 60);
  }

  function getSelectedPlainText() {
    var sel = getActiveSelection();
    if (!sel) return "";
    return state.plainText.slice(sel.pStart, sel.pEnd);
  }

  function renderStyleGrid() {
    var grid = $("xps-style-grid");
    if (!grid) return;

    var selectedPlain = getSelectedPlainText().replace(/\n/g, " ");
    var previewBase = selectedPlain.length ? truncate(selectedPlain, PREVIEW_MAX) : STYLE_SAMPLE;

    var html = "";
    for (var c = 0; c < STYLE_CATEGORIES.length; c++) {
      var cat = STYLE_CATEGORIES[c];
      html += '<div class="xps-style-group">';
      html += '<p class="xps-style-cat">' + escapeHtml(cat.label) + "</p>";
      for (var s = 0; s < cat.styles.length; s++) {
        var style = cat.styles[s];
        var sample = style.id === "normal"
          ? previewBase
          : applyTextStyle(previewBase, style.id, getOpts());
        var extraClass = style.id === "normal" ? " xps-style-row--normal" : "";
        html +=
          '<button type="button" class="xps-style-row' + extraClass + '" data-style="' + style.id + '" role="option">' +
          '<span class="xps-style-row__label">' + escapeHtml(style.label) + "</span>" +
          '<span class="xps-style-row__sample" aria-hidden="true">' + escapeHtml(sample) + "</span>" +
          "</button>";
      }
      html += "</div>";
    }
    grid.innerHTML = html;
  }

  function updateSelectionUI() {
    var input = $("xps-input");
    var toolbar = $("xps-toolbar");
    var idle = $("xps-toolbar-idle");
    var label = $("xps-selection-text");
    if (!input || !toolbar) return;

    var start = input.selectionStart;
    var end = input.selectionEnd;
    var hasSelection = end > start;

    if (hasSelection) {
      var selected = state.text.slice(start, end);
      saveSelectionFromInput();
      toolbar.hidden = false;
      if (idle) idle.hidden = true;
      if (label) label.textContent = '"' + truncate(selected.replace(/\n/g, " "), 40) + '"';
      renderStyleGrid();
      scrollToolbarIntoView();
    } else if (!state.savedSelection) {
      hideToolbar();
    }
  }

  function applyStyleToSelection(styleId) {
    var input = $("xps-input");
    if (!input) return;

    var sel = getActiveSelection();
    if (!sel || sel.pEnd <= sel.pStart) {
      showToast("Highlight some text first ✨");
      return;
    }

    state.spans = applySpanStyle(state.spans, sel.pStart, sel.pEnd, styleId);
    state.savedSelection = null;
    refreshTextareaFromState(sel.pEnd, sel.pEnd);
    hideToolbar();

    if (styleId === "normal") {
      showToast("Back to normal text ✨");
    } else {
      showToast("Applied " + getStyleLabel(styleId) + " ✨");
    }
  }

  function onTextInput() {
    if (isRefreshing || isComposing) return;

    var input = $("xps-input");
    if (!input) return;

    var oldPlain = state.plainText;

    // No styles yet — keep the textarea as-is (1:1 plain text, no cursor juggling)
    if (!state.spans.length) {
      state.plainText = input.value;
      state.text = input.value;
      state.styledToPlain = [];
      for (var i = 0; i < state.plainText.length; i++) {
        state.styledToPlain.push(i);
      }
      if (!state.plainOriginal && state.plainText) {
        state.plainOriginal = state.plainText;
      }
      state.savedSelection = null;
      updateCounter();
      return;
    }

    var styledCursor = input.selectionStart;
    var newPlain = normalizeToPlain(input.value);
    var plainCursor = inferPlainCursorAfterEdit(
      oldPlain,
      newPlain,
      state.styledToPlain,
      styledCursor
    );

    state.spans = remapSpans(oldPlain, newPlain, state.spans);
    state.plainText = newPlain;

    if (!state.plainOriginal && state.plainText) {
      state.plainOriginal = state.plainText;
    }

    refreshTextareaFromState(plainCursor, plainCursor);
    scheduleSelectionUI();
  }

  function preventStyleGridBlur(e) {
    if (e.target.closest("[data-style]")) {
      e.preventDefault();
    }
  }

  function bindEvents() {
    var input = $("xps-input");

    if (input) {
      input.addEventListener("input", onTextInput);
      input.addEventListener("select", scheduleSelectionUI);
      input.addEventListener("mouseup", scheduleSelectionUI);
      input.addEventListener("touchend", scheduleSelectionUI);
      input.addEventListener("keyup", function (e) {
        if (e.shiftKey || e.key === "Shift" || (e.key && e.key.indexOf("Arrow") === 0)) {
          scheduleSelectionUI();
        }
      });
      input.addEventListener("compositionstart", function () {
        isComposing = true;
      });
      input.addEventListener("compositionend", function () {
        isComposing = false;
        onTextInput();
      });
      input.addEventListener("blur", function () {
        clearTimeout(selectionTimer);
        setTimeout(function () {
          var active = document.activeElement;
          if (active && active.closest && active.closest("#xps-style-grid")) return;
          if (active && active.closest && active.closest("#xps-toolbar")) return;
          state.savedSelection = null;
          hideToolbar();
        }, 180);
      });
    }

    document.addEventListener("selectionchange", function () {
      var input = $("xps-input");
      if (input && document.activeElement === input) {
        scheduleSelectionUI();
      }
    });

    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", function () {
        var toolbar = $("xps-toolbar");
        if (toolbar && !toolbar.hidden) scrollToolbarIntoView();
      });
    }

    var grid = $("xps-style-grid");
    if (grid) {
      grid.addEventListener("mousedown", preventStyleGridBlur);
      grid.addEventListener("pointerdown", preventStyleGridBlur);
      grid.addEventListener("click", function (e) {
        var btn = e.target.closest("[data-style]");
        if (!btn) return;
        applyStyleToSelection(btn.getAttribute("data-style"));
      });
    }

    var exampleBtn = $("xps-example");
    if (exampleBtn) {
      exampleBtn.addEventListener("click", function () {
        state.plainOriginal = EXAMPLE_POST;
        state.savedSelection = null;
        setPlainContent(EXAMPLE_POST, []);
        showToast("Example pasted ✨");
      });
    }

    var clearBtn = $("xps-clear");
    if (clearBtn) {
      clearBtn.addEventListener("click", function () {
        state.plainOriginal = "";
        state.savedSelection = null;
        setPlainContent("", []);
        hideToolbar();
        showToast("Cleared");
      });
    }

    var resetBtn = $("xps-reset-styles");
    if (resetBtn) {
      resetBtn.addEventListener("click", function () {
        if (!state.plainOriginal) {
          showToast("Nothing to reset");
          return;
        }
        setPlainContent(state.plainOriginal, []);
        state.savedSelection = null;
        hideToolbar();
        showToast("Styles reset ✨");
      });
    }

    var copyBtn = $("xps-copy-styled");
    if (copyBtn) {
      copyBtn.addEventListener("click", function () {
        if (!state.text) {
          showToast("Nothing to copy yet");
          return;
        }
        copyText(state.text).then(function (ok) {
          showToast(ok ? "Copied! Ready to paste into X ✨" : "Copy failed — try again");
        });
      });
    }

    var keepHash = $("xps-keep-hashtags");
    if (keepHash) {
      keepHash.addEventListener("change", function (e) {
        state.settings.keepHashtagsNormal = e.target.checked;
        refreshTextareaFromState();
        updateSelectionUI();
      });
    }

    var keepMention = $("xps-keep-mentions");
    if (keepMention) {
      keepMention.addEventListener("change", function (e) {
        state.settings.keepMentionsNormal = e.target.checked;
        refreshTextareaFromState();
        updateSelectionUI();
      });
    }
  }

  function init() {
    renderStyleGrid();
    bindEvents();

    if (XP.clearDraft) XP.clearDraft();

    updateCounter();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
