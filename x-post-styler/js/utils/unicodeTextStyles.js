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
  gothic: (char) => mapAlphaNum(char, GOTHIC),
  gothicBold: (char) => mapAlphaNum(char, GOTHIC_BOLD),
  script: (char) => mapAlphaNum(char, SCRIPT),
  scriptBold: (char) => mapAlphaNum(char, SCRIPT_BOLD),
  sansItalic: (char) => mapAlphaNum(char, SANS_ITALIC),
  doubleStruck: (char) => mapAlphaNum(char, DOUBLE),
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
  return [...text].map((c, i) => fn(c, i)).join("");
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
    { table: DOUBLE, exceptions: {} },
    { table: GOTHIC, exceptions: {} },
    { table: GOTHIC_BOLD, exceptions: {} },
    { table: SCRIPT, exceptions: {} },
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

  const cleaned = text.normalize("NFD").replace(/\p{M}/gu, "");

  return [...cleaned].map(function (char) {
    if (REVERSE_CHAR_MAP[char]) return REVERSE_CHAR_MAP[char];
    const fw = reverseFullwidth(char);
    if (fw) return fw;
    return char;
  }).join("");
}

Object.assign(window.XPStyler = window.XPStyler || {}, {
  STYLE_CATEGORIES,
  ALL_STYLES,
  getStyleLabel,
  isReadableWarningStyle,
  transformText,
  normalizeToPlain,
});
