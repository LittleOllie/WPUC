const URL_RE = /https?:\/\/[^\s]+/gi;
const HASHTAG_RE = /#[\w\u00C0-\u024F]+/gi;
const MENTION_RE = /@[\w]+/gi;

function tokenizePreserved(text) {
  const tokens = [];
  let remaining = text;
  const patterns = [
    { type: "url", re: URL_RE },
    { type: "hashtag", re: HASHTAG_RE },
    { type: "mention", re: MENTION_RE },
  ];

  while (remaining.length) {
    let earliest = null;
    for (const p of patterns) {
      p.re.lastIndex = 0;
      const m = p.re.exec(remaining);
      if (m && (earliest === null || m.index < earliest.index)) {
        earliest = { type: p.type, index: m.index, value: m[0], len: m[0].length };
      }
    }
    if (!earliest) {
      tokens.push({ type: "text", value: remaining });
      break;
    }
    if (earliest.index > 0) {
      tokens.push({ type: "text", value: remaining.slice(0, earliest.index) });
    }
    tokens.push({ type: earliest.type, value: earliest.value });
    remaining = remaining.slice(earliest.index + earliest.len);
  }
  return tokens;
}

function applyTextStyle(text, styleId, opts = {}) {
  const { keepHashtagsNormal = true, keepMentionsNormal = true } = opts;
  if (!text || styleId === "normal") return text;

  const tokens = tokenizePreserved(text);
  return tokens
    .map((tok) => {
      if (tok.type === "url") return tok.value;
      if (tok.type === "hashtag" && keepHashtagsNormal) return tok.value;
      if (tok.type === "mention" && keepMentionsNormal) return tok.value;
      return window.XPStyler.transformText(tok.value, styleId);
    })
    .join("");
}

function applyInlineSpans(text, baseStyleId, inlineSpans = [], opts = {}) {
  if (!inlineSpans.length) {
    return applyTextStyle(text, baseStyleId, opts);
  }
  const sorted = [...inlineSpans].sort((a, b) => a.start - b.start);
  let out = "";
  let cursor = 0;
  for (const span of sorted) {
    if (span.start > cursor) {
      out += applyTextStyle(text.slice(cursor, span.start), baseStyleId, opts);
    }
    out += applyTextStyle(text.slice(span.start, span.end), span.styleId, opts);
    cursor = span.end;
  }
  if (cursor < text.length) {
    out += applyTextStyle(text.slice(cursor), baseStyleId, opts);
  }
  return out;
}

function buildFromSpans(plainText, spans, opts = {}) {
  if (!plainText) return "";
  return applyInlineSpans(plainText, "normal", spans, opts);
}

function calculateCharacterEstimate(text) {
  return [...text].length;
}

/** Keep spans in sync when the user edits the textarea. */
function remapSpans(oldText, newText, spans) {
  if (oldText === newText) return spans;
  let prefix = 0;
  while (prefix < oldText.length && prefix < newText.length && oldText[prefix] === newText[prefix]) {
    prefix++;
  }
  let oldSuffix = oldText.length;
  let newSuffix = newText.length;
  while (oldSuffix > prefix && newSuffix > prefix && oldText[oldSuffix - 1] === newText[newSuffix - 1]) {
    oldSuffix--;
    newSuffix--;
  }
  const delta = newSuffix - oldSuffix;

  return spans
    .map((s) => {
      let { start, end, styleId } = s;

      if (end < prefix) {
        return { start, end, styleId };
      }
      if (start >= oldSuffix) {
        return { start: start + delta, end: end + delta, styleId };
      }

      if (start > prefix && start < oldSuffix) {
        start = prefix;
      }
      if (end > prefix) {
        end += delta;
      } else if (oldSuffix === prefix && delta > 0 && prefix === end) {
        // Insert right after the span — keep typing in the same style
        end += delta;
      }

      return { start, end, styleId };
    })
    .filter((s) => s.start < s.end && s.end <= newText.length);
}

function getStyleAtIndex(index, spans) {
  for (const span of spans) {
    if (span.start <= index && index < span.end) return span.styleId;
  }
  return "normal";
}

/** Build styled textarea content and a per-code-unit map back to plain indices. */
function buildStyledDocument(plainText, spans, opts = {}) {
  if (!plainText) {
    return { styled: "", styledToPlain: [] };
  }

  const splitGraphemes = window.XPStyler.splitGraphemes;
  const isEmojiGrapheme = window.XPStyler.isEmojiGrapheme;
  const graphemes = splitGraphemes ? splitGraphemes(plainText) : Array.from(plainText);

  let styled = "";
  const styledToPlain = [];
  let plainIdx = 0;

  for (const grapheme of graphemes) {
    const styleId = getStyleAtIndex(plainIdx, spans);
    const out = isEmojiGrapheme && isEmojiGrapheme(grapheme)
      ? grapheme
      : applyTextStyle(grapheme, styleId, opts);

    const graphemeLen = grapheme.length;
    for (let i = 0; i < out.length; i++) {
      const mappedPlainIdx = graphemeLen === out.length
        ? plainIdx + i
        : plainIdx + Math.min(i, graphemeLen - 1);
      styledToPlain.push(mappedPlainIdx);
    }
    styled += out;
    plainIdx += graphemeLen;
  }

  return { styled, styledToPlain };
}

function styledIndexToPlain(styledToPlain, styledIdx, plainLength) {
  if (!styledToPlain.length) return Math.min(styledIdx, plainLength);
  if (styledIdx <= 0) return 0;
  if (styledIdx >= styledToPlain.length) {
    return Math.min(styledToPlain[styledToPlain.length - 1] + 1, plainLength);
  }
  return styledToPlain[styledIdx];
}

function styledRangeToPlain(styledToPlain, sStart, sEnd, plainLength) {
  const pStart = styledIndexToPlain(styledToPlain, sStart, plainLength);
  const pEnd = styledIndexToPlain(styledToPlain, sEnd, plainLength);
  return { pStart, pEnd: Math.max(pStart, pEnd) };
}

/** Infer plain-text cursor after an edit using a diff (reliable for typing). */
function inferPlainCursorAfterEdit(oldPlain, newPlain, styledToPlain, styledCursor) {
  let prefix = 0;
  while (prefix < oldPlain.length && prefix < newPlain.length && oldPlain[prefix] === newPlain[prefix]) {
    prefix++;
  }
  let oldSuffix = oldPlain.length;
  let newSuffix = newPlain.length;
  while (oldSuffix > prefix && newSuffix > prefix && oldPlain[oldSuffix - 1] === newPlain[newSuffix - 1]) {
    oldSuffix--;
    newSuffix--;
  }
  const delta = newSuffix - oldSuffix;

  if (delta > 0 && oldSuffix === prefix) {
    return newSuffix;
  }
  if (delta < 0 && newSuffix === prefix) {
    return prefix;
  }

  return styledIndexToPlain(styledToPlain, styledCursor, newPlain.length);
}

function plainIndexToStyled(styledToPlain, plainIdx) {
  if (!styledToPlain.length) return plainIdx;
  const idx = styledToPlain.indexOf(plainIdx);
  if (idx >= 0) return idx;
  for (let i = styledToPlain.length - 1; i >= 0; i--) {
    if (styledToPlain[i] < plainIdx) return i + 1;
  }
  return 0;
}

function plainRangeToStyled(styledToPlain, pStart, pEnd) {
  const sStart = plainIndexToStyled(styledToPlain, pStart);
  let sEnd = sStart;
  if (pEnd > pStart && styledToPlain.length) {
    const lastPlain = pEnd - 1;
    const lastIdx = styledToPlain.lastIndexOf(lastPlain);
    sEnd = lastIdx >= 0 ? lastIdx + 1 : sStart;
  } else if (!styledToPlain.length) {
    sEnd = pEnd;
  }
  return { sStart, sEnd };
}

/** Apply style to a highlighted range; replaces any overlapping spans. */
function applySpanStyle(spans, start, end, styleId) {
  if (start >= end) return spans;
  if (styleId === "normal") {
    return spans.filter((s) => s.end <= start || s.start >= end);
  }
  const kept = spans.filter((s) => s.end <= start || s.start >= end);
  kept.push({ start, end, styleId });
  return kept.sort((a, b) => a.start - b.start);
}

function removeSpan(spans, index) {
  return spans.filter((_, i) => i !== index);
}

const EXAMPLE_POST = `Big little announcement 💛

Little Ollie started in Web3, and Web3 will always be part of the journey.

But as the LO world keeps growing, we're also building something much bigger across Web2 too.

We're not choosing one path.

We're building in both.

#LittleOllie #Web3 #Web2`;

Object.assign(window.XPStyler = window.XPStyler || {}, {
  applyTextStyle,
  applyInlineSpans,
  buildFromSpans,
  buildStyledDocument,
  calculateCharacterEstimate,
  remapSpans,
  applySpanStyle,
  removeSpan,
  styledIndexToPlain,
  styledRangeToPlain,
  inferPlainCursorAfterEdit,
  plainIndexToStyled,
  plainRangeToStyled,
  EXAMPLE_POST,
});
