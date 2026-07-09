/**
 * Unicode text style presets for X/Twitter posts.
 * Characters without a mapping are left unchanged (emojis, punctuation, etc.).
 */

const BOLD = {
  A: 0x1d400, a: 0x1d41a, 0: 0x1d7ce,
};
const ITALIC = {
  A: 0x1d434, a: 0x1d44e, 0: 0x1d7e2,
};
const BOLD_ITALIC = {
  A: 0x1d63c, a: 0x1d656, 0: 0x1d7f6,
};
const MONO = {
  A: 0x1d670, a: 0x1d68a, 0: 0x1d7f6,
};
const DOUBLE = {
  A: 0x1d538, a: 0x1d552, 0: 0x1d7d8,
};
const GOTHIC = {
  A: 0x1d504, a: 0x1d51e,
};
const GOTHIC_BOLD = {
  A: 0x1d56c, a: 0x1d586,
};
const SCRIPT = {
  A: 0x1d49c, a: 0x1d4b6,
};
const SCRIPT_BOLD = {
  A: 0x1d4d0, a: 0x1d4ea,
};
const SANS_BOLD = {
  A: 0x1d5d4, a: 0x1d5ee, 0: 0x1d7ec,
};
const SANS_ITALIC = {
  A: 0x1d608, a: 0x1d622, 0: 0x1d7e2,
};

const ITALIC_EXCEPTIONS = {};

const BOLD_ITALIC_EXCEPTIONS = {};

const UPSIDE_DOWN = {
  a: "\u0250", b: "q", c: "\u0254", d: "p", e: "\u01dd", f: "\u025f", g: "\u0183",
  h: "\u0265", i: "\u0131", j: "\u027e", k: "\u029e", l: "\u028e", m: "\u026f",
  n: "u", o: "o", p: "d", q: "b", r: "\u0279", s: "s", t: "\u0287", u: "n",
  v: "\u028c", w: "\u028d", x: "x", y: "\u028e", z: "\u01dd",
  A: "\u2200", B: "B", C: "\u0186", D: "D", E: "\u018e", F: "\u2131", G: "\u2141",
  H: "H", I: "I", J: "\u0174", K: "K", L: "\u02e5", M: "W", N: "N", O: "O",
  P: "\u0500", Q: "Q", R: "R", S: "S", T: "\u22a5", U: "\u2229", V: "\u039b",
  W: "M", X: "X", Y: "⅄", Z: "Z",
  0: "0", 1: "\u0196", 2: "\u1105", 3: "\u0190", 4: "\u3123", 5: "\u03db",
  6: "9", 7: "\u3125", 8: "8", 9: "6",
  ".": "\u02d9", ",": "'", "?": "\u00bf", "!": "\u00a1", '"': ",,",
  "'": ",", "(": ")", ")": "(", "[": "]", "]": "[", "{": "}", "}": "{",
  "<": ">", ">": "<", "&": "\u214b", _: "\u203e",
};

const BUBBLE_BASE = 0x24b6; // Ⓐ
const BUBBLE_LOWER_BASE = 0x24d0;
const SQUARE_BASE = 0x1f130;
const SMALL_CAPS_MAP = {
  a: "ᴀ", b: "ʙ", c: "ᴄ", d: "ᴅ", e: "ᴇ", f: "ғ", g: "ɢ", h: "ʜ", i: "ɪ",
  j: "ᴊ", k: "ᴋ", l: "ʟ", m: "ᴍ", n: "ɴ", o: "ᴏ", p: "ᴘ", q: "ǫ", r: "ʀ",
  s: "s", t: "ᴛ", u: "ᴜ", v: "ᴠ", w: "ᴡ", x: "x", y: "ʏ", z: "ᴢ",
};

const GLITCH_MARKS = ["\u0300", "\u0301", "\u0308", "\u0315", "\u0336"];

/** Correct alphabets — Unicode math blocks have gaps; offsets alone produce wrong glyphs. */
const SCRIPT_UPPER_CPS = [
  0x1d49c, 0x212c, 0x1d49e, 0x1d4a0, 0x1d4a2, 0x1d4a4, 0x1d4a6, 0x1d4a8, 0x1d4aa, 0x1d4ac,
  0x1d4ae, 0x1d4b0, 0x1d4b2, 0x1d4b4, 0x1d4b6, 0x1d4b8, 0x1d4ba, 0x1d4bc, 0x1d4be, 0x1d4c0,
  0x1d4c2, 0x1d4c4, 0x1d4c6, 0x1d4c8, 0x1d4ca, 0x1d4cc,
];
const SCRIPT_LOWER_BASE = 0x1d4b6;
const GOTHIC_UPPER_CPS = [
  0x1d504, 0x1d505, 0x212d, 0x1d507, 0x1d508, 0x1d509, 0x1d50a, 0x210c, 0x2111, 0x1d50d,
  0x1d50e, 0x1d50f, 0x1d510, 0x1d511, 0x1d512, 0x1d513, 0x1d514, 0x1d515, 0x1d516, 0x1d517,
  0x1d518, 0x1d519, 0x1d51a, 0x1d51b, 0x1d51c, 0x2128,
];
const GOTHIC_LOWER_BASE = 0x1d51e;
const DOUBLE_UPPER_CPS = [
  0x1d538, 0x1d539, 0x2102, 0x1d53b, 0x1d53c, 0x1d53d, 0x1d53e, 0x210d, 0x1d540, 0x1d541,
  0x1d542, 0x1d543, 0x1d544, 0x2115, 0x1d546, 0x2119, 0x211a, 0x211d, 0x1d54a, 0x1d54b,
  0x1d54c, 0x1d54d, 0x1d54e, 0x1d54f, 0x1d550, 0x2124,
];
const DOUBLE_LOWER_BASE = 0x1d552;
const DOUBLE_DIGIT_BASE = 0x1d7d8;

let graphemeSegmenter;

function buildAlphabetFromCodePoints(codePoints) {
  return codePoints.map(function (cp) { return String.fromCodePoint(cp); }).join("");
}

function buildContiguousAlphabet(base, count) {
  var chars = [];
  for (var i = 0; i < count; i++) {
    chars.push(String.fromCodePoint(base + i));
  }
  return chars.join("");
}

const SCRIPT_UPPER = buildAlphabetFromCodePoints(SCRIPT_UPPER_CPS);
const SCRIPT_LOWER = buildContiguousAlphabet(SCRIPT_LOWER_BASE, 26);
const GOTHIC_UPPER = buildAlphabetFromCodePoints(GOTHIC_UPPER_CPS);
const GOTHIC_LOWER = buildContiguousAlphabet(GOTHIC_LOWER_BASE, 26);
const DOUBLE_UPPER = buildAlphabetFromCodePoints(DOUBLE_UPPER_CPS);
const DOUBLE_LOWER = buildContiguousAlphabet(DOUBLE_LOWER_BASE, 26);
const DOUBLE_DIGITS = buildContiguousAlphabet(DOUBLE_DIGIT_BASE, 10);

function splitGraphemes(text) {
  if (!text) return [];
  if (typeof Intl !== "undefined" && Intl.Segmenter) {
    if (!graphemeSegmenter) {
      graphemeSegmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
    }
    return Array.from(graphemeSegmenter.segment(text), function (part) { return part.segment; });
  }
  return Array.from(text);
}

function isEmojiGrapheme(grapheme) {
  return /\p{Extended_Pictographic}/u.test(grapheme);
}

function createAlphabetMapper(upper, lower, digits) {
  var upperChars = Array.from(upper);
  var lowerChars = Array.from(lower);
  var digitChars = digits ? Array.from(digits) : null;
  var map = Object.create(null);
  var i;
  for (i = 0; i < 26; i++) {
    map[String.fromCharCode(65 + i)] = upperChars[i];
    map[String.fromCharCode(97 + i)] = lowerChars[i];
  }
  if (digitChars) {
    for (i = 0; i < 10; i++) {
      map[String(i)] = digitChars[i];
    }
  }
  return function (char) {
    return map[char] || char;
  };
}

function addAlphabetToReverseMap(map, upper, lower, digits, force) {
  var upperChars = Array.from(upper);
  var lowerChars = Array.from(lower);
  var digitChars = digits ? Array.from(digits) : null;
  var i;
  for (i = 0; i < 26; i++) {
    var plainL = String.fromCharCode(97 + i);
    if (map[lowerChars[i]] === undefined || force) map[lowerChars[i]] = plainL;
  }
  for (i = 0; i < 26; i++) {
    var plainU = String.fromCharCode(65 + i);
    if (map[upperChars[i]] === undefined) map[upperChars[i]] = plainU;
  }
  if (digitChars) {
    for (i = 0; i < 10; i++) {
      if (map[digitChars[i]] === undefined || force) map[digitChars[i]] = String(i);
    }
  }
}

function mapAlphaNum(char, table, exceptions = {}) {
  if (exceptions[char]) return exceptions[char];
  const code = char.charCodeAt(0);
  if (code >= 65 && code <= 90 && table.A) {
    return String.fromCodePoint(table.A + (code - 65));
  }
  if (code >= 97 && code <= 122 && table.a) {
    return String.fromCodePoint(table.a + (code - 97));
  }
  if (code >= 48 && code <= 57 && table[0]) {
    return String.fromCodePoint(table[0] + (code - 48));
  }
  return char;
}

function toFullwidth(char) {
  const code = char.charCodeAt(0);
  if (code === 32) return "\u3000";
  if (code >= 33 && code <= 126) return String.fromCodePoint(code + 0xfee0);
  return char;
}

function toBubble(char) {
  const code = char.charCodeAt(0);
  if (code >= 65 && code <= 90) return String.fromCodePoint(BUBBLE_BASE + (code - 65));
  if (code >= 97 && code <= 122) return String.fromCodePoint(BUBBLE_LOWER_BASE + (code - 97));
  return char;
}

function toSquare(char) {
  const code = char.charCodeAt(0);
  if (code >= 65 && code <= 90) return String.fromCodePoint(SQUARE_BASE + (code - 65));
  return char;
}

function toSmallCaps(char) {
  if (SMALL_CAPS_MAP[char]) return SMALL_CAPS_MAP[char];
  if (char >= "A" && char <= "Z") return char;
  return char;
}

function toUppercase(char) {
  if (char >= "a" && char <= "z") return char.toUpperCase();
  return char;
}

function toUpsideDown(char) {
  return UPSIDE_DOWN[char] ?? char;
}

function applyGlitch(char, index) {
  if (/\s/.test(char)) return char;
  if (index % 4 === 0) {
    return char + GLITCH_MARKS[index % GLITCH_MARKS.length];
  }
  return char;
}

function applyUnderline(char) {
  if (/\s/.test(char)) return char;
  return char + "\u0332";
}

function applyStrikethrough(char) {
  if (/\s/.test(char)) return char;
  return char + "\u0336";
}

const STYLE_TRANSFORMERS = {
  normal: (char) => char,
  bold: (char) => mapAlphaNum(char, BOLD),
  italic: (char) => mapAlphaNum(char, ITALIC, ITALIC_EXCEPTIONS),
  boldItalic: (char) => mapAlphaNum(char, BOLD_ITALIC, BOLD_ITALIC_EXCEPTIONS),
  monospace: (char) => mapAlphaNum(char, MONO),
  smallCaps: (char) => toSmallCaps(char),
  uppercase: (char) => toUppercase(char),
  fullwidth: (char) => toFullwidth(char),
  gothic: createAlphabetMapper(GOTHIC_UPPER, GOTHIC_LOWER),
  gothicBold: (char) => mapAlphaNum(char, GOTHIC_BOLD),
  script: createAlphabetMapper(SCRIPT_UPPER, SCRIPT_LOWER),
  scriptBold: (char) => mapAlphaNum(char, SCRIPT_BOLD),
  sansItalic: (char) => mapAlphaNum(char, SANS_ITALIC),
  doubleStruck: createAlphabetMapper(DOUBLE_UPPER, DOUBLE_LOWER, DOUBLE_DIGITS),
  bubble: (char) => toBubble(char),
  square: (char) => toSquare(char),
  strikethrough: (char) => applyStrikethrough(char),
  underline: (char) => applyUnderline(char),
  rounded: (char) => mapAlphaNum(char, SANS_BOLD),
  littleOllie: (char) => mapAlphaNum(char, BOLD),
};

const STYLE_CATEGORIES = [
  {
    id: "clean",
    label: "Clean",
    styles: [
      { id: "normal", label: "Normal" },
      { id: "uppercase", label: "All Caps" },
      { id: "bold", label: "Bold" },
      { id: "italic", label: "Italic" },
      { id: "sansItalic", label: "Sans Italic" },
      { id: "rounded", label: "Sans Bold" },
      { id: "monospace", label: "Monospace" },
      { id: "smallCaps", label: "Small Caps" },
      { id: "fullwidth", label: "Fullwidth" },
    ],
  },
  {
    id: "fancy",
    label: "Fancy",
    styles: [
      { id: "gothic", label: "Fraktur" },
      { id: "gothicBold", label: "Fraktur Bold" },
      { id: "script", label: "Script" },
      { id: "scriptBold", label: "Script Bold" },
      { id: "doubleStruck", label: "Double Struck" },
      { id: "bubble", label: "Circled" },
    ],
  },
  {
    id: "effects",
    label: "Effects",
    styles: [
      { id: "underline", label: "Underline" },
      { id: "strikethrough", label: "Strikethrough" },
    ],
  },
  {
    id: "brand",
    label: "Brand",
    styles: [
      { id: "littleOllie", label: "Little Ollie" },
    ],
  },
];

const ALL_STYLES = STYLE_CATEGORIES.flatMap((c) => c.styles);

function getStyleLabel(styleId) {
  return ALL_STYLES.find((s) => s.id === styleId)?.label ?? styleId;
}

function isReadableWarningStyle() {
  return false;
}

/**
 * @param {string} text
 * @param {string} styleId
 */
function transformText(text, styleId) {
  const fn = STYLE_TRANSFORMERS[styleId] ?? STYLE_TRANSFORMERS.normal;
  return splitGraphemes(text).map(function (grapheme, gi) {
    if (isEmojiGrapheme(grapheme)) return grapheme;
    return Array.from(grapheme).map(function (c, ci) { return fn(c, gi + ci); }).join("");
  }).join("");
}

/** Build reverse map from forward transforms — avoids wrong letter mappings */
function buildReverseCharMap() {
  const map = Object.create(null);
  const plainChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

  const tableDefs = [
    { table: BOLD, exceptions: {} },
    { table: ITALIC, exceptions: ITALIC_EXCEPTIONS },
    { table: BOLD_ITALIC, exceptions: BOLD_ITALIC_EXCEPTIONS },
    { table: MONO, exceptions: {} },
    { table: GOTHIC_BOLD, exceptions: {} },
    { table: SCRIPT_BOLD, exceptions: {} },
    { table: SANS_BOLD, exceptions: {} },
    { table: SANS_ITALIC, exceptions: {} },
  ];

  for (const def of tableDefs) {
    for (const char of plainChars) {
      const styled = mapAlphaNum(char, def.table, def.exceptions);
      if (styled !== char && map[styled] === undefined) {
        map[styled] = char;
      }
    }
  }

  for (let i = 0; i < 26; i++) {
    const circledU = String.fromCodePoint(BUBBLE_BASE + i);
    const circledL = String.fromCodePoint(BUBBLE_LOWER_BASE + i);
    const squaredU = String.fromCodePoint(SQUARE_BASE + i);
    if (map[circledU] === undefined) map[circledU] = String.fromCharCode(65 + i);
    if (map[circledL] === undefined) map[circledL] = String.fromCharCode(97 + i);
    if (map[squaredU] === undefined) map[squaredU] = String.fromCharCode(65 + i);
  }

  for (const [plain, styled] of Object.entries(SMALL_CAPS_MAP)) {
    if (map[styled] === undefined) map[styled] = plain;
  }

  addAlphabetToReverseMap(map, SCRIPT_UPPER, SCRIPT_LOWER, null, true);
  addAlphabetToReverseMap(map, GOTHIC_UPPER, GOTHIC_LOWER, null, true);
  addAlphabetToReverseMap(map, DOUBLE_UPPER, DOUBLE_LOWER, DOUBLE_DIGITS, true);

  return map;
}

const REVERSE_CHAR_MAP = buildReverseCharMap();

function reverseFullwidth(char) {
  const code = char.charCodeAt(0);
  if (code === 0x3000) return " ";
  if (code >= 0xff01 && code <= 0xff5e) {
    return String.fromCharCode(code - 0xfee0);
  }
  return null;
}

/**
 * Convert styled Unicode back to plain text so a new style can be applied.
 * Preserves all spaces — word gaps must not be removed.
 * @param {string} text
 */
function normalizeToPlain(text) {
  if (!text) return text;

  return splitGraphemes(text).map(function (grapheme) {
    if (isEmojiGrapheme(grapheme)) return grapheme;

    var cleaned = grapheme.normalize("NFD").replace(/\p{M}/gu, "");
    var out = "";
    var chars = Array.from(cleaned);
    for (var i = 0; i < chars.length; i++) {
      var char = chars[i];
      if (REVERSE_CHAR_MAP[char]) {
        out += REVERSE_CHAR_MAP[char];
      } else {
        var fw = reverseFullwidth(char);
        out += fw !== null ? fw : char;
      }
    }
    return out;
  }).join("");
}

const STYLED_CHAR_LOOKUP = buildStyledCharLookup();

function buildStyledCharLookup() {
  const lookup = Object.create(null);
  const plainChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const styleIds = Object.keys(STYLE_TRANSFORMERS).filter(function (id) {
    return id !== "normal" && id !== "littleOllie";
  });

  for (let s = 0; s < styleIds.length; s++) {
    const styleId = styleIds[s];
    for (let i = 0; i < plainChars.length; i++) {
      const plain = plainChars.charAt(i);
      const styled = transformText(plain, styleId);
      if (styled !== plain && lookup[styled] === undefined) {
        lookup[styled] = { plain: plain, styleId: styleId };
      }
    }
  }
  return lookup;
}

function mergeAdjacentSpans(spans) {
  if (!spans.length) return spans;
  const sorted = spans.slice().sort(function (a, b) { return a.start - b.start; });
  const out = [{ start: sorted[0].start, end: sorted[0].end, styleId: sorted[0].styleId }];
  for (let i = 1; i < sorted.length; i++) {
    const prev = out[out.length - 1];
    const cur = sorted[i];
    if (cur.styleId === prev.styleId && cur.start <= prev.end) {
      prev.end = Math.max(prev.end, cur.end);
    } else {
      out.push({ start: cur.start, end: cur.end, styleId: cur.styleId });
    }
  }
  return out;
}

/**
 * Import pasted/typed styled Unicode into plain text + span ranges.
 * @param {string} text
 */
function parseStyledDocument(text) {
  if (!text) return { plainText: "", spans: [] };

  const graphemes = splitGraphemes(text);
  let plainText = "";
  const spanParts = [];

  for (let g = 0; g < graphemes.length; g++) {
    const grapheme = graphemes[g];
    const plainStart = plainText.length;
    let plainChunk = grapheme;
    let styleId = "normal";

    if (isEmojiGrapheme(grapheme)) {
      plainChunk = grapheme;
    } else if (STYLED_CHAR_LOOKUP[grapheme]) {
      plainChunk = STYLED_CHAR_LOOKUP[grapheme].plain;
      styleId = STYLED_CHAR_LOOKUP[grapheme].styleId;
    } else {
      const denormed = normalizeToPlain(grapheme);
      if (denormed !== grapheme) {
        plainChunk = denormed;
      }
    }

    plainText += plainChunk;
    if (styleId !== "normal" && plainText.length > plainStart) {
      spanParts.push({ start: plainStart, end: plainText.length, styleId: styleId });
    }
  }

  return { plainText: plainText, spans: mergeAdjacentSpans(spanParts) };
}

Object.assign(window.XPStyler = window.XPStyler || {}, {
  STYLE_CATEGORIES,
  ALL_STYLES,
  getStyleLabel,
  isReadableWarningStyle,
  transformText,
  normalizeToPlain,
  parseStyledDocument,
  splitGraphemes,
  isEmojiGrapheme,
});
