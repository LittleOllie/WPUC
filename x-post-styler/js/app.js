/**
 * X Post Styler — paste, highlight, style in place, copy.
 * Row-based editor: one line number + textarea per line (always aligned).
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
  var plainRangeToStyled = XP.plainRangeToStyled;
  var parseStyledDocument = XP.parseStyledDocument;

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
    selectionMode: "text",
    selectedLines: [],
    swipeLine: -1,
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
    var compact = $("xps-char-count-compact");
    var count = calculateCharacterEstimate(state.text || "");
    var text = count + " / 280";
    var level = "xps-counter--calm";
    if (count > 280) level = "xps-counter--warn";
    else if (count > 240) level = "xps-counter--close";

    if (counter) {
      counter.textContent = text;
      counter.classList.remove("xps-counter--calm", "xps-counter--close", "xps-counter--warn");
      counter.classList.add(level);
    }
    if (compact) {
      compact.textContent = text;
      compact.classList.remove("xps-counter--calm", "xps-counter--close", "xps-counter--warn");
      compact.classList.add(level);
    }
  }

  function isMobileLayout() {
    return window.matchMedia("(max-width: 480px)").matches;
  }

  function setEditingMode(editing) {
    document.body.classList.toggle("xps-editing", editing && isMobileLayout());
    var bar = $("xps-editing-bar");
    if (bar) bar.hidden = !(editing && isMobileLayout());
  }

  function exitEditingMode() {
    var active = document.activeElement;
    if (active && active.classList && active.classList.contains("xps-line-input")) {
      active.blur();
    }
    setEditingMode(false);
  }

  function getLineRanges(plainText) {
    var lines = [];
    var start = 0;
    var text = plainText || "";
    for (var i = 0; i <= text.length; i++) {
      if (i === text.length || text.charAt(i) === "\n") {
        lines.push({ index: lines.length, start: start, end: i });
        start = i + 1;
      }
    }
    if (!lines.length) {
      lines.push({ index: 0, start: 0, end: 0 });
    }
    return lines;
  }

  function getLineStyledToPlain(lineRange, styledToPlain) {
    var len = lineRange.end - lineRange.start;
    if (!styledToPlain.length) {
      var arr = [];
      for (var i = 0; i < len; i++) arr.push(i);
      return arr;
    }
    var sRange = plainRangeToStyled(styledToPlain, lineRange.start, lineRange.end);
    var slice = styledToPlain.slice(sRange.sStart, sRange.sEnd);
    var out = [];
    for (var j = 0; j < slice.length; j++) {
      out.push(slice[j] - lineRange.start);
    }
    return out;
  }

  function splitStyledByPlainLines(plainText, styled, styledToPlain) {
    var lines = [];
    var lineStart = 0;
    if (!plainText) return [""];
    for (var p = 0; p <= plainText.length; p++) {
      if (p === plainText.length || plainText.charAt(p) === "\n") {
        var sRange = plainRangeToStyled(styledToPlain, lineStart, p);
        lines.push(styled.slice(sRange.sStart, sRange.sEnd));
        lineStart = p + 1;
      }
    }
    return lines.length ? lines : [""];
  }

  function autoResizeLine(ta) {
    ta.style.height = "auto";
    ta.style.height = ta.scrollHeight + "px";
  }

  function buildRowHtml(lineIdx) {
    var placeholder = lineIdx === 0 ? ' placeholder="Paste your X post here…"' : "";
    return (
      '<div class="xps-line-row" data-line="' + lineIdx + '">' +
      '<button type="button" class="xps-line-btn" data-line="' + lineIdx + '" aria-label="Select line ' + (lineIdx + 1) + '">' + (lineIdx + 1) + "</button>" +
      '<textarea class="xps-line-input" rows="1" data-line="' + lineIdx + '"' + placeholder + "></textarea>" +
      "</div>"
    );
  }

  function ensureLineRows() {
    var container = $("xps-lines");
    if (!container) return;
    var lineRanges = getLineRanges(state.plainText);
    var existing = container.querySelectorAll(".xps-line-row");

    if (existing.length !== lineRanges.length) {
      var html = "";
      for (var i = 0; i < lineRanges.length; i++) {
        html += buildRowHtml(i);
      }
      container.innerHTML = html;
    } else {
      for (var j = 0; j < lineRanges.length; j++) {
        var row = existing[j];
        var btn = row.querySelector(".xps-line-btn");
        if (btn) {
          btn.textContent = String(j + 1);
          btn.setAttribute("data-line", String(j));
          btn.setAttribute("aria-label", "Select line " + (j + 1));
        }
        var input = row.querySelector(".xps-line-input");
        if (input) input.setAttribute("data-line", String(j));
        row.setAttribute("data-line", String(j));
      }
    }
  }

  function updateRowSelectionClasses() {
    var container = $("xps-lines");
    if (!container) return;
    var lineRanges = getLineRanges(state.plainText);
    var rows = container.querySelectorAll(".xps-line-row");

    for (var i = 0; i < rows.length; i++) {
      var selected = state.selectedLines.indexOf(i) >= 0;
      var swipe = state.swipeLine === i;
      var empty = !lineRanges[i] || lineRanges[i].end <= lineRanges[i].start;

      rows[i].classList.toggle("xps-line-row--selected", selected);
      rows[i].classList.toggle("xps-line-row--swipe", swipe && selected);

      var btn = rows[i].querySelector(".xps-line-btn");
      if (btn) {
        btn.classList.toggle("xps-line-btn--selected", selected);
        btn.classList.toggle("xps-line-btn--empty", empty);
        btn.disabled = empty;
      }
    }
    state.swipeLine = -1;
  }

  function focusLineInput(lineIdx, plainCursor, plainSelEnd) {
    var container = $("xps-lines");
    if (!container) return;
    var ta = container.querySelector('.xps-line-input[data-line="' + lineIdx + '"]');
    if (!ta) return;

    requestAnimationFrame(function () {
      try {
        ta.focus({ preventScroll: true });
        if (typeof plainCursor === "number") {
          var lineRanges = getLineRanges(state.plainText);
          var lr = lineRanges[lineIdx];
          if (lr) {
            var lineMap = getLineStyledToPlain(lr, state.styledToPlain);
            var range = plainRangeToStyled(
              lineMap,
              plainCursor - lr.start,
              (typeof plainSelEnd === "number" ? plainSelEnd : plainCursor) - lr.start
            );
            ta.setSelectionRange(range.sStart, range.sEnd);
          }
        }
      } catch (e) { /* iOS edge cases */ }
      isRefreshing = false;
    });
  }

  function refreshFromState(focusLineIdx, plainCursor, plainSelEnd) {
    var container = $("xps-lines");
    if (!container) return;

    isRefreshing = true;
    var doc = buildStyledDocument(state.plainText, state.spans, getOpts());
    state.text = doc.styled;
    state.styledToPlain = doc.styledToPlain;

    ensureLineRows();
    var styledLines = splitStyledByPlainLines(state.plainText, doc.styled, doc.styledToPlain);
    var inputs = container.querySelectorAll(".xps-line-input");

    for (var i = 0; i < inputs.length; i++) {
      inputs[i].value = styledLines[i] || "";
      autoResizeLine(inputs[i]);
    }

    updateRowSelectionClasses();
    updateCounter();

    if (typeof focusLineIdx === "number") {
      focusLineInput(focusLineIdx, plainCursor, plainSelEnd);
    } else {
      isRefreshing = false;
    }
  }

  function flattenInputLines(inputs) {
    var lines = [];
    for (var i = 0; i < inputs.length; i++) {
      var parts = inputs[i].value.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
      for (var j = 0; j < parts.length; j++) {
        lines.push(parts[j]);
      }
    }
    return lines;
  }

  function linesToPlainAndSpans(lines) {
    var plainLines = [];
    var spans = [];
    var offset = 0;

    for (var i = 0; i < lines.length; i++) {
      var parsed = parseStyledDocument(lines[i]);
      plainLines.push(parsed.plainText);
      for (var s = 0; s < parsed.spans.length; s++) {
        var sp = parsed.spans[s];
        spans.push({
          start: offset + sp.start,
          end: offset + sp.end,
          styleId: sp.styleId,
        });
      }
      offset += parsed.plainText.length;
      if (i < lines.length - 1) offset += 1;
    }

    return { plainText: plainLines.join("\n"), spans: spans };
  }

  function applyImportedContent(parsed, focusLineIdx) {
    state.plainText = parsed.plainText;
    state.spans = parsed.spans;
    state.plainOriginal = parsed.plainText;
    state.savedSelection = null;
    clearLineSelection();
    refreshFromState(typeof focusLineIdx === "number" ? focusLineIdx : 0);
    showToast(parsed.spans.length ? "Pasted with styles ✨" : "Pasted ✨");
  }

  function syncPlainFromRows(changedLineIdx) {
    var container = $("xps-lines");
    if (!container) return;

    var inputs = container.querySelectorAll(".xps-line-input");
    var built = linesToPlainAndSpans(flattenInputLines(inputs));

    state.plainText = built.plainText;
    state.spans = built.spans;

    if (!state.plainOriginal && state.plainText) {
      state.plainOriginal = state.plainText;
    }

    refreshFromState(changedLineIdx);
  }

  function insertLineAfter(lineIdx, styledCursorStart, styledCursorEnd) {
    var lineRanges = getLineRanges(state.plainText);
    var lr = lineRanges[lineIdx];
    if (!lr) return;

    var linePlain = state.plainText.slice(lr.start, lr.end);
    var lineMap = getLineStyledToPlain(lr, state.styledToPlain);
    var local = styledRangeToPlain(lineMap, styledCursorStart, styledCursorEnd, linePlain.length);

    var before = linePlain.slice(0, local.pStart);
    var after = linePlain.slice(local.pEnd);
    var lines = state.plainText.split("\n");
    lines[lineIdx] = before;
    lines.splice(lineIdx + 1, 0, after);

    var oldPlain = state.plainText;
    state.plainText = lines.join("\n");
    state.spans = remapSpans(oldPlain, state.plainText, state.spans);
    clearLineSelection();
    refreshFromState(lineIdx + 1, lineRanges[lineIdx].start + local.pStart, lineRanges[lineIdx].start + local.pStart);
  }

  function mergeLineWithPrevious(lineIdx) {
    if (lineIdx <= 0) return;
    var lines = state.plainText.split("\n");
    var cursor = lines[lineIdx - 1].length;
    lines[lineIdx - 1] += lines[lineIdx];
    lines.splice(lineIdx, 1);

    var oldPlain = state.plainText;
    state.plainText = lines.join("\n");
    state.spans = remapSpans(oldPlain, state.plainText, state.spans);

    var lineRanges = getLineRanges(state.plainText);
    var focusPos = lineRanges[lineIdx - 1] ? lineRanges[lineIdx - 1].start + cursor : cursor;
    refreshFromState(lineIdx - 1, focusPos, focusPos);
  }

  function mergeLineWithNext(lineIdx) {
    var lines = state.plainText.split("\n");
    if (lineIdx >= lines.length - 1) return;
    var cursor = lines[lineIdx].length;
    lines[lineIdx] += lines[lineIdx + 1];
    lines.splice(lineIdx + 1, 1);

    var oldPlain = state.plainText;
    state.plainText = lines.join("\n");
    state.spans = remapSpans(oldPlain, state.plainText, state.spans);

    var lineRanges = getLineRanges(state.plainText);
    var focusPos = lineRanges[lineIdx] ? lineRanges[lineIdx].start + cursor : cursor;
    refreshFromState(lineIdx, focusPos, focusPos);
  }

  function getRangesFromSelectedLines(indices) {
    var lineRanges = getLineRanges(state.plainText);
    var ranges = [];
    var sorted = indices.slice().sort(function (a, b) { return a - b; });
    for (var i = 0; i < sorted.length; i++) {
      var line = lineRanges[sorted[i]];
      if (line && line.end > line.start) {
        ranges.push({ pStart: line.start, pEnd: line.end });
      }
    }
    return ranges;
  }

  function updateSavedSelectionFromLines() {
    var ranges = getRangesFromSelectedLines(state.selectedLines);
    if (!ranges.length) {
      state.savedSelection = null;
      return;
    }
    state.savedSelection = {
      pStart: ranges[0].pStart,
      pEnd: ranges[ranges.length - 1].pEnd,
      ranges: ranges,
    };
  }

  function getActiveSelectionRanges() {
    if (state.selectionMode === "lines" && state.selectedLines.length) {
      return getRangesFromSelectedLines(state.selectedLines);
    }
    var sel = getActiveSelection();
    if (sel && sel.pEnd > sel.pStart) {
      return [{ pStart: sel.pStart, pEnd: sel.pEnd }];
    }
    if (state.savedSelection && state.savedSelection.ranges && state.savedSelection.ranges.length) {
      return state.savedSelection.ranges;
    }
    if (state.savedSelection && state.savedSelection.pEnd > state.savedSelection.pStart) {
      return [{ pStart: state.savedSelection.pStart, pEnd: state.savedSelection.pEnd }];
    }
    return [];
  }

  function clearLineSelection() {
    state.selectedLines = [];
    if (state.selectionMode === "lines") {
      state.selectionMode = "text";
    }
    updateRowSelectionClasses();
  }

  function showSelectionToolbar(labelText, shouldScroll) {
    var toolbar = $("xps-toolbar");
    var idle = $("xps-toolbar-idle");
    var label = $("xps-selection-text");
    if (toolbar) toolbar.hidden = false;
    if (idle) idle.hidden = true;
    if (label) label.textContent = labelText;
    renderStyleGrid();
    if (shouldScroll !== false) scrollToolbarIntoView();
  }

  function toggleLineSelection(lineIndex, shiftKey) {
    var lines = getLineRanges(state.plainText);
    if (lineIndex < 0 || lineIndex >= lines.length) return;
    if (lines[lineIndex].end <= lines[lineIndex].start) return;

    var alreadyOn = state.selectedLines.indexOf(lineIndex) >= 0;
    state.selectionMode = "lines";

    if (shiftKey && state.selectedLines.length) {
      var anchor = state.selectedLines[state.selectedLines.length - 1];
      var from = Math.min(anchor, lineIndex);
      var to = Math.max(anchor, lineIndex);
      state.selectedLines = [];
      for (var j = from; j <= to; j++) {
        if (lines[j].end > lines[j].start) state.selectedLines.push(j);
      }
      state.swipeLine = lineIndex;
    } else {
      var pos = state.selectedLines.indexOf(lineIndex);
      if (pos >= 0) {
        state.selectedLines.splice(pos, 1);
      } else {
        state.selectedLines.push(lineIndex);
        state.swipeLine = lineIndex;
      }
      state.selectedLines.sort(function (a, b) { return a - b; });
    }

    if (alreadyOn && state.selectedLines.indexOf(lineIndex) < 0) {
      state.swipeLine = -1;
    }

    updateSavedSelectionFromLines();
    updateRowSelectionClasses();

    if (state.selectedLines.length) {
      var preview = getSelectedPlainText().replace(/\n/g, " ");
      showSelectionToolbar('"' + truncate(preview, 40) + '"', false);
    } else {
      state.savedSelection = null;
      hideToolbar();
    }
  }

  function restoreSelectionAfterStyle() {
    if (state.selectionMode === "lines" && state.selectedLines.length) {
      updateRowSelectionClasses();
      return;
    }

    var ranges = getActiveSelectionRanges();
    if (!ranges.length) return;

    var pStart = ranges[0].pStart;
    var pEnd = ranges[ranges.length - 1].pEnd;
    state.savedSelection = { pStart: pStart, pEnd: pEnd, ranges: ranges };

    var lineRanges = getLineRanges(state.plainText);
    var focusLine = 0;
    for (var i = 0; i < lineRanges.length; i++) {
      if (pStart >= lineRanges[i].start && pStart <= lineRanges[i].end) {
        focusLine = i;
        break;
      }
    }
    focusLineInput(focusLine, pStart, pEnd);
  }

  function setPlainContent(plainText, spans) {
    state.plainText = plainText || "";
    state.spans = spans || [];
    if (!state.plainOriginal && state.plainText) {
      state.plainOriginal = state.plainText;
    }
    refreshFromState();
  }

  function getPlainSelection() {
    var active = document.activeElement;
    if (!active || !active.classList || !active.classList.contains("xps-line-input")) return null;
    if (active.selectionEnd <= active.selectionStart) return null;

    var lineIdx = parseInt(active.getAttribute("data-line"), 10);
    var lineRanges = getLineRanges(state.plainText);
    var lr = lineRanges[lineIdx];
    if (!lr) return null;

    var lineMap = getLineStyledToPlain(lr, state.styledToPlain);
    var local = styledRangeToPlain(lineMap, active.selectionStart, active.selectionEnd, lr.end - lr.start);
    return { pStart: lr.start + local.pStart, pEnd: lr.start + local.pEnd };
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
      state.savedSelection = {
        pStart: sel.pStart,
        pEnd: sel.pEnd,
        ranges: [{ pStart: sel.pStart, pEnd: sel.pEnd }],
      };
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
    var ranges = getActiveSelectionRanges();
    if (!ranges.length) return "";
    var parts = [];
    for (var i = 0; i < ranges.length; i++) {
      parts.push(state.plainText.slice(ranges[i].pStart, ranges[i].pEnd));
    }
    return parts.join("\n");
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
    var active = document.activeElement;
    var isLineInput = active && active.classList && active.classList.contains("xps-line-input");

    if (isLineInput && active.selectionEnd > active.selectionStart) {
      state.selectionMode = "text";
      clearLineSelection();
      var lineIdx = parseInt(active.getAttribute("data-line"), 10);
      var selected = active.value.slice(active.selectionStart, active.selectionEnd);
      saveSelectionFromInput();
      showSelectionToolbar('"' + truncate(selected.replace(/\n/g, " "), 40) + '"');
      return;
    }

    if (state.selectionMode === "lines" && state.selectedLines.length) {
      var linePreview = getSelectedPlainText().replace(/\n/g, " ");
      showSelectionToolbar('"' + truncate(linePreview, 40) + '"', false);
      return;
    }

    if (state.savedSelection && state.savedSelection.pEnd > state.savedSelection.pStart) {
      var savedPreview = state.plainText.slice(state.savedSelection.pStart, state.savedSelection.pEnd);
      showSelectionToolbar('"' + truncate(savedPreview.replace(/\n/g, " "), 40) + '"');
      return;
    }

    hideToolbar();
  }

  function applyStyleToSelection(styleId) {
    var ranges = getActiveSelectionRanges();
    if (!ranges.length) {
      showToast("Highlight some text first ✨");
      return;
    }

    for (var i = 0; i < ranges.length; i++) {
      var r = ranges[i];
      if (r.pEnd > r.pStart) {
        state.spans = applySpanStyle(state.spans, r.pStart, r.pEnd, styleId);
      }
    }

    state.savedSelection = {
      pStart: ranges[0].pStart,
      pEnd: ranges[ranges.length - 1].pEnd,
      ranges: ranges,
    };

    refreshFromState();
    restoreSelectionAfterStyle();

    var preview = getSelectedPlainText().replace(/\n/g, " ");
    showSelectionToolbar('"' + truncate(preview, 40) + '"', state.selectionMode !== "lines");

    if (styleId === "normal") {
      showToast("Back to normal text ✨");
    } else {
      showToast("Applied " + getStyleLabel(styleId) + " — try another style ✨");
    }
  }

  function onLineInput(e) {
    if (isRefreshing || isComposing) return;
    var lineIdx = parseInt(e.target.getAttribute("data-line"), 10);
    clearLineSelection();
    state.savedSelection = null;
    syncPlainFromRows(lineIdx);
    scheduleSelectionUI();
  }

  function mergePasteIntoDocument(beforeEnd, afterStart, pasted) {
    var beforePlain = state.plainText.slice(0, beforeEnd);
    var afterPlain = state.plainText.slice(afterStart);
    var inserted = parseStyledDocument(pasted);

    var keptBefore = state.spans.filter(function (s) { return s.end <= beforeEnd; });
    var keptAfter = state.spans
      .filter(function (s) { return s.start >= afterStart; })
      .map(function (s) {
        var shift = beforePlain.length + inserted.plainText.length - afterStart;
        return {
          start: s.start + shift,
          end: s.end + shift,
          styleId: s.styleId,
        };
      });
    var insertedSpans = inserted.spans.map(function (s) {
      return {
        start: s.start + beforePlain.length,
        end: s.end + beforePlain.length,
        styleId: s.styleId,
      };
    });

    return {
      plainText: beforePlain + inserted.plainText + afterPlain,
      spans: keptBefore.concat(insertedSpans).concat(keptAfter),
    };
  }

  function onLinePaste(e) {
    var pasted = e.clipboardData && (e.clipboardData.getData("text/plain") || e.clipboardData.getData("text"));
    if (!pasted) return;

    pasted = pasted.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    var ta = e.target;
    var lineIdx = parseInt(ta.getAttribute("data-line"), 10);
    var hasNewlines = pasted.indexOf("\n") >= 0;
    var isFullReplace = ta.selectionStart === 0 && ta.selectionEnd === ta.value.length;
    var isEmptyDoc = !state.plainText && state.spans.length === 0;

    if (!hasNewlines && !isFullReplace) return;

    e.preventDefault();

    if (hasNewlines && (isEmptyDoc || isFullReplace)) {
      applyImportedContent(parseStyledDocument(pasted), 0);
      return;
    }

    var lineRanges = getLineRanges(state.plainText);
    var lr = lineRanges[lineIdx];
    if (!lr) return;

    var lineMap = getLineStyledToPlain(lr, state.styledToPlain);
    var local = styledRangeToPlain(lineMap, ta.selectionStart, ta.selectionEnd, lr.end - lr.start);
    var beforeEnd = lr.start + local.pStart;
    var afterStart = lr.start + local.pEnd;
    var merged = mergePasteIntoDocument(beforeEnd, afterStart, pasted);
    applyImportedContent(merged, lineIdx + pasted.split("\n").length - 1);
  }

  function onLineKeydown(e) {
    var ta = e.target;
    var lineIdx = parseInt(ta.getAttribute("data-line"), 10);

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      insertLineAfter(lineIdx, ta.selectionStart, ta.selectionEnd);
      return;
    }

    if (e.key === "Backspace" && ta.selectionStart === 0 && ta.selectionEnd === 0 && lineIdx > 0) {
      e.preventDefault();
      mergeLineWithPrevious(lineIdx);
      return;
    }

    if (e.key === "Delete" && ta.selectionStart === ta.value.length && ta.selectionEnd === ta.value.length) {
      var lineRanges = getLineRanges(state.plainText);
      if (lineIdx < lineRanges.length - 1) {
        e.preventDefault();
        mergeLineWithNext(lineIdx);
      }
    }
  }

  function preventToolbarBlur(e) {
    if (e.target.closest("[data-style]") || e.target.closest(".xps-line-btn")) {
      e.preventDefault();
    }
  }

  function openInfoDialog() {
    var dialog = $("xps-info-dialog");
    var btn = $("xps-info-btn");
    if (!dialog) return;
    dialog.hidden = false;
    document.body.classList.add("xps-info-open");
    if (btn) btn.setAttribute("aria-expanded", "true");
    var closeBtn = $("xps-info-close");
    if (closeBtn) closeBtn.focus({ preventScroll: true });
  }

  function closeInfoDialog() {
    var dialog = $("xps-info-dialog");
    var btn = $("xps-info-btn");
    if (!dialog) return;
    dialog.hidden = true;
    document.body.classList.remove("xps-info-open");
    if (btn) {
      btn.setAttribute("aria-expanded", "false");
      btn.focus({ preventScroll: true });
    }
  }

  function bindInfoDialog() {
    var btn = $("xps-info-btn");
    var dialog = $("xps-info-dialog");
    var closeBtn = $("xps-info-close");
    if (!btn || !dialog) return;

    btn.addEventListener("click", function () {
      if (dialog.hidden) openInfoDialog();
      else closeInfoDialog();
    });

    if (closeBtn) {
      closeBtn.addEventListener("click", closeInfoDialog);
    }

    dialog.querySelectorAll("[data-close-info]").forEach(function (el) {
      el.addEventListener("click", closeInfoDialog);
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && dialog && !dialog.hidden) {
        e.preventDefault();
        closeInfoDialog();
      }
    });
  }

  function bindEvents() {
    var linesContainer = $("xps-lines");

    if (linesContainer) {
      linesContainer.addEventListener("focusin", function (e) {
        if (!e.target.classList.contains("xps-line-input")) return;
        if (isMobileLayout()) {
          setEditingMode(true);
          requestAnimationFrame(function () {
            e.target.scrollIntoView({ block: "center", behavior: "smooth" });
          });
        }
      });

      linesContainer.addEventListener("input", function (e) {
        if (e.target.classList.contains("xps-line-input")) {
          autoResizeLine(e.target);
          onLineInput(e);
        }
      });

      linesContainer.addEventListener("keydown", function (e) {
        if (e.target.classList.contains("xps-line-input")) {
          onLineKeydown(e);
        }
      });

      linesContainer.addEventListener("paste", function (e) {
        if (e.target.classList.contains("xps-line-input")) {
          onLinePaste(e);
        }
      });

      linesContainer.addEventListener("select", function (e) {
        if (e.target.classList.contains("xps-line-input")) scheduleSelectionUI();
      });

      linesContainer.addEventListener("mouseup", function (e) {
        if (e.target.classList.contains("xps-line-input")) scheduleSelectionUI();
      });

      linesContainer.addEventListener("touchend", function (e) {
        if (e.target.classList.contains("xps-line-input")) scheduleSelectionUI();
      });

      linesContainer.addEventListener("keyup", function (e) {
        if (!e.target.classList.contains("xps-line-input")) return;
        if (e.shiftKey || e.key === "Shift" || (e.key && e.key.indexOf("Arrow") === 0)) {
          scheduleSelectionUI();
        }
      });

      linesContainer.addEventListener("compositionstart", function (e) {
        if (e.target.classList.contains("xps-line-input")) isComposing = true;
      });

      linesContainer.addEventListener("compositionend", function (e) {
        if (!e.target.classList.contains("xps-line-input")) return;
        isComposing = false;
        onLineInput(e);
      });

      linesContainer.addEventListener("blur", function (e) {
        if (!e.target.classList.contains("xps-line-input")) return;
        clearTimeout(selectionTimer);
        setTimeout(function () {
          var active = document.activeElement;
          if (active && active.closest && active.closest("#xps-style-grid")) return;
          if (active && active.closest && active.closest("#xps-toolbar")) return;
          if (active && active.closest && active.closest(".xps-line-btn")) return;
          if (active && active.id === "xps-done-editing") return;
          if (active && active.classList && active.classList.contains("xps-line-input")) return;
          state.savedSelection = null;
          clearLineSelection();
          hideToolbar();
          if (isMobileLayout()) setEditingMode(false);
        }, 180);
      }, true);

      linesContainer.addEventListener("mousedown", preventToolbarBlur);
      linesContainer.addEventListener("pointerdown", function (e) {
        var btn = e.target.closest(".xps-line-btn");
        if (btn) {
          e.preventDefault();
        } else {
          preventToolbarBlur(e);
        }
      });

      linesContainer.addEventListener("click", function (e) {
        var btn = e.target.closest(".xps-line-btn");
        if (!btn || btn.disabled) return;
        toggleLineSelection(parseInt(btn.getAttribute("data-line"), 10), e.shiftKey);
      });
    }

    var doneBtn = $("xps-done-editing");
    if (doneBtn) {
      doneBtn.addEventListener("click", function () {
        exitEditingMode();
      });
    }

    window.addEventListener("resize", function () {
      if (!isMobileLayout()) setEditingMode(false);
      var inputs = $("xps-lines");
      if (inputs) {
        inputs.querySelectorAll(".xps-line-input").forEach(autoResizeLine);
      }
    });

    document.addEventListener("selectionchange", function () {
      var active = document.activeElement;
      if (active && active.classList && active.classList.contains("xps-line-input")) {
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
      grid.addEventListener("mousedown", preventToolbarBlur);
      grid.addEventListener("pointerdown", preventToolbarBlur);
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
        clearLineSelection();
        setPlainContent(EXAMPLE_POST, []);
        showToast("Example pasted ✨");
      });
    }

    var clearBtn = $("xps-clear");
    if (clearBtn) {
      clearBtn.addEventListener("click", function () {
        state.plainOriginal = "";
        state.savedSelection = null;
        clearLineSelection();
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
        clearLineSelection();
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
        refreshFromState();
        updateSelectionUI();
      });
    }

    var keepMention = $("xps-keep-mentions");
    if (keepMention) {
      keepMention.addEventListener("change", function (e) {
        state.settings.keepMentionsNormal = e.target.checked;
        refreshFromState();
        updateSelectionUI();
      });
    }
  }

  function init() {
    renderStyleGrid();
    refreshFromState();
    bindEvents();
    bindInfoDialog();

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () {
        var container = $("xps-lines");
        if (container) {
          container.querySelectorAll(".xps-line-input").forEach(autoResizeLine);
        }
      });
    }

    if (XP.clearDraft) XP.clearDraft();
    updateCounter();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
