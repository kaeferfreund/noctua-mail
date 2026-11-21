import postcss, { type AtRule, type Declaration, type Node, type Rule } from "postcss";

export type HtmlColorSchemeOverride = "auto" | "light" | "dark";

// WCAG relative luminance threshold below which a colour is treated as dark:
// #757575 is ~0.18, #666666 is ~0.13, #333333 is ~0.03, #000000 is 0.
const DARK_LUMINANCE_THRESHOLD = 0.18;
const LIGHT_TEXT_LUMINANCE_THRESHOLD = 0.5;
const OPAQUE_BG_MIN_ALPHA = 0.45;
const VISIBLE_TEXT_MIN_ALPHA = 0.2;

const STRICT_NUMBER = /^[+-]?(?:\d+\.?\d*|\.\d+)$/;
const STRICT_PERCENT = /^[+-]?(?:\d+\.?\d*|\.\d+)%$/;
const STRICT_ANGLE = /^([+-]?(?:\d+\.?\d*|\.\d+))(deg|rad|grad|turn)?$/i;

const NON_COLOR_KEYWORDS = new Set([
  "transparent",
  "none",
  "inherit",
  "initial",
  "unset",
  "revert",
  "revert-layer",
  "currentcolor",
  "auto"
]);

// Standard CSS Color 4 named colours -> hex.
const CSS_NAMED_COLORS: Record<string, string> = {
  aliceblue: "#f0f8ff", antiquewhite: "#faebd7", aqua: "#00ffff", aquamarine: "#7fffd4",
  azure: "#f0ffff", beige: "#f5f5dc", bisque: "#ffe4c4", black: "#000000",
  blanchedalmond: "#ffebcd", blue: "#0000ff", blueviolet: "#8a2be2", brown: "#a52a2a",
  burlywood: "#deb887", cadetblue: "#5f9ea0", chartreuse: "#7fff00", chocolate: "#d2691e",
  coral: "#ff7f50", cornflowerblue: "#6495ed", cornsilk: "#fff8dc", crimson: "#dc143c",
  cyan: "#00ffff", darkblue: "#00008b", darkcyan: "#008b8b", darkgoldenrod: "#b8860b",
  darkgray: "#a9a9a9", darkgreen: "#006400", darkgrey: "#a9a9a9", darkkhaki: "#bdb76b",
  darkmagenta: "#8b008b", darkolivegreen: "#556b2f", darkorange: "#ff8c00", darkorchid: "#9932cc",
  darkred: "#8b0000", darksalmon: "#e9967a", darkseagreen: "#8fbc8f", darkslateblue: "#483d8b",
  darkslategray: "#2f4f4f", darkslategrey: "#2f4f4f", darkturquoise: "#00ced1", darkviolet: "#9400d3",
  deeppink: "#ff1493", deepskyblue: "#00bfff", dimgray: "#696969", dimgrey: "#696969",
  dodgerblue: "#1e90ff", firebrick: "#b22222", floralwhite: "#fffaf0", forestgreen: "#228b22",
  fuchsia: "#ff00ff", gainsboro: "#dcdcdc", ghostwhite: "#f8f8ff", gold: "#ffd700",
  goldenrod: "#daa520", gray: "#808080", green: "#008000", greenyellow: "#adff2f",
  grey: "#808080", honeydew: "#f0fff0", hotpink: "#ff69b4", indianred: "#cd5c5c",
  indigo: "#4b0082", ivory: "#fffff0", khaki: "#f0e68c", lavender: "#e6e6fa",
  lavenderblush: "#fff0f5", lawngreen: "#7cfc00", lemonchiffon: "#fffacd", lightblue: "#add8e6",
  lightcoral: "#f08080", lightcyan: "#e0ffff", lightgoldenrodyellow: "#fafad2", lightgray: "#d3d3d3",
  lightgreen: "#90ee90", lightgrey: "#d3d3d3", lightpink: "#ffb6c1", lightsalmon: "#ffa07a",
  lightseagreen: "#20b2aa", lightskyblue: "#87cefa", lightslategray: "#778899", lightslategrey: "#778899",
  lightsteelblue: "#b0c4de", lightyellow: "#ffffe0", lime: "#00ff00", limegreen: "#32cd32",
  linen: "#faf0e6", magenta: "#ff00ff", maroon: "#800000", mediumaquamarine: "#66cdaa",
  mediumblue: "#0000cd", mediumorchid: "#ba55d3", mediumpurple: "#9370db", mediumseagreen: "#3cb371",
  mediumslateblue: "#7b68ee", mediumspringgreen: "#00fa9a", mediumturquoise: "#48d1cc", mediumvioletred: "#c71585",
  midnightblue: "#191970", mintcream: "#f5fffa", mistyrose: "#ffe4e1", moccasin: "#ffe4b5",
  navajowhite: "#ffdead", navy: "#000080", oldlace: "#fdf5e6", olive: "#808000",
  olivedrab: "#6b8e23", orange: "#ffa500", orangered: "#ff4500", orchid: "#da70d6",
  palegoldenrod: "#eee8aa", palegreen: "#98fb98", paleturquoise: "#afeeee", palevioletred: "#db7093",
  papayawhip: "#ffefd5", peachpuff: "#ffdab9", peru: "#cd853f", pink: "#ffc0cb",
  plum: "#dda0dd", powderblue: "#b0e0e6", purple: "#800080", rebeccapurple: "#663399",
  red: "#ff0000", rosybrown: "#bc8f8f", royalblue: "#4169e1", saddlebrown: "#8b4513",
  salmon: "#fa8072", sandybrown: "#f4a460", seagreen: "#2e8b57", seashell: "#fff5ee",
  sienna: "#a0522d", silver: "#c0c0c0", skyblue: "#87ceeb", slateblue: "#6a5acd",
  slategray: "#708090", slategrey: "#708090", snow: "#fffafa", springgreen: "#00ff7f",
  steelblue: "#4682b4", tan: "#d2b48c", teal: "#008080", thistle: "#d8bfd8",
  tomato: "#ff6347", turquoise: "#40e0d0", violet: "#ee82ee", wheat: "#f5deb3",
  white: "#ffffff", whitesmoke: "#f5f5f5", yellow: "#ffff00", yellowgreen: "#9acd32"
};

function stripImportant(value: string) {
  return value.replace(/\s*!important\s*$/i, "").trim();
}

function rgbToRelativeLuminance(r: number, g: number, b: number) {
  const linear = (channel: number) => {
    const s = Math.min(255, Math.max(0, channel)) / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

function hslToRgb(h: number, sPercent: number, lPercent: number): [number, number, number] {
  const hue = ((h % 360) + 360) % 360;
  const s = Math.min(100, Math.max(0, sPercent)) / 100;
  const l = Math.min(100, Math.max(0, lPercent)) / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (hue < 60) [r, g, b] = [c, x, 0];
  else if (hue < 120) [r, g, b] = [x, c, 0];
  else if (hue < 180) [r, g, b] = [0, c, x];
  else if (hue < 240) [r, g, b] = [0, x, c];
  else if (hue < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

function parseStrictRgbChannel(token: string): number | null {
  const trimmed = token.trim();
  if (STRICT_PERCENT.test(trimmed)) {
    const num = Number(trimmed.slice(0, -1));
    return Number.isFinite(num) ? (num / 100) * 255 : null;
  }
  if (STRICT_NUMBER.test(trimmed)) {
    const num = Number(trimmed);
    return Number.isFinite(num) ? num : null;
  }
  return null;
}

function parseStrictPercent(token: string): number | null {
  const trimmed = token.trim();
  if (!STRICT_PERCENT.test(trimmed)) return null;
  const num = Number(trimmed.slice(0, -1));
  return Number.isFinite(num) ? num : null;
}

function parseStrictHueDegrees(token: string): number | null {
  const match = STRICT_ANGLE.exec(token.trim());
  if (!match) return null;
  const num = Number(match[1]);
  if (!Number.isFinite(num)) return null;
  const unit = (match[2] ?? "deg").toLowerCase();
  if (unit === "deg") return num;
  if (unit === "turn") return num * 360;
  if (unit === "grad") return num * 0.9;
  if (unit === "rad") return (num * 180) / Math.PI;
  return null;
}

function parseStrictAlpha(token: string | undefined): number | null {
  if (token === undefined) return 1;
  const trimmed = token.trim();
  if (STRICT_PERCENT.test(trimmed)) {
    const num = Number(trimmed.slice(0, -1));
    return Number.isFinite(num) ? Math.min(1, Math.max(0, num / 100)) : null;
  }
  if (STRICT_NUMBER.test(trimmed)) {
    const num = Number(trimmed);
    return Number.isFinite(num) ? Math.min(1, Math.max(0, num)) : null;
  }
  return null;
}

function splitFunctionalArgs(body: string): { channels: string[]; alpha: string | undefined } | null {
  const slashParts = body.split("/");
  if (slashParts.length > 2) return null;
  const channelsPart = slashParts[0].trim();
  const slashAlpha = slashParts[1]?.trim();
  if (slashParts.length === 2 && !slashAlpha) return null;

  if (channelsPart.includes(",")) {
    // Legacy comma syntax cannot mix with `/` alpha.
    if (slashParts.length === 2) return null;
    const raw = channelsPart.split(",");
    if (raw.some((part) => !part.trim())) return null;
    const parts = raw.map((part) => part.trim());
    if (parts.length !== 3 && parts.length !== 4) return null;
    return { channels: parts.slice(0, 3), alpha: parts[3] };
  }

  const parts = channelsPart.split(/\s+/).filter(Boolean);
  if (parts.length !== 3) return null;
  return { channels: parts, alpha: slashAlpha };
}

function parseColorRgba(value: string): { r: number; g: number; b: number; a: number } | null {
  const cleaned = stripImportant(value).toLowerCase();
  if (!cleaned || NON_COLOR_KEYWORDS.has(cleaned)) return null;

  const namedHex = Object.prototype.hasOwnProperty.call(CSS_NAMED_COLORS, cleaned)
    ? CSS_NAMED_COLORS[cleaned]
    : undefined;
  const target = namedHex ?? (/^[0-9a-f]{6}$/.test(cleaned) ? `#${cleaned}` : cleaned);

  const hex = /^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/.exec(target);
  if (hex) {
    const digits = hex[1];
    if (digits.length === 3 || digits.length === 4) {
      return {
        r: Number.parseInt(digits[0] + digits[0], 16),
        g: Number.parseInt(digits[1] + digits[1], 16),
        b: Number.parseInt(digits[2] + digits[2], 16),
        a: digits.length === 4 ? Number.parseInt(digits[3] + digits[3], 16) / 255 : 1
      };
    }
    return {
      r: Number.parseInt(digits.slice(0, 2), 16),
      g: Number.parseInt(digits.slice(2, 4), 16),
      b: Number.parseInt(digits.slice(4, 6), 16),
      a: digits.length === 8 ? Number.parseInt(digits.slice(6, 8), 16) / 255 : 1
    };
  }

  const rgbMatch = /^rgba?\(\s*([^()]+?)\s*\)$/.exec(target);
  if (rgbMatch) {
    const parsed = splitFunctionalArgs(rgbMatch[1]);
    if (!parsed) return null;
    const r = parseStrictRgbChannel(parsed.channels[0]);
    const g = parseStrictRgbChannel(parsed.channels[1]);
    const b = parseStrictRgbChannel(parsed.channels[2]);
    const a = parseStrictAlpha(parsed.alpha);
    if (r === null || g === null || b === null || a === null) return null;
    return { r, g, b, a };
  }

  const hslMatch = /^hsla?\(\s*([^()]+?)\s*\)$/.exec(target);
  if (hslMatch) {
    const parsed = splitFunctionalArgs(hslMatch[1]);
    if (!parsed) return null;
    const h = parseStrictHueDegrees(parsed.channels[0]);
    const s = parseStrictPercent(parsed.channels[1]);
    const l = parseStrictPercent(parsed.channels[2]);
    const a = parseStrictAlpha(parsed.alpha);
    if (h === null || s === null || l === null || a === null) return null;
    const [r, g, b] = hslToRgb(h, s, l);
    return { r, g, b, a };
  }

  return null;
}

/**
 * Validates and normalises an opaque CSS colour literal (e.g. from a
 * `<body bgcolor>` attribute) before inserting it into a stylesheet. Rejects
 * syntax tokens, transparent colours and malformed functional expressions.
 */
export function sanitizeCssColorValue(value: string): string | null {
  const cleaned = stripImportant(value);
  if (!cleaned || /[{}();:\\<>"']|\/\*/.test(cleaned)) {
    if (!/^(?:rgba?|hsla?)\([^()]+\)$/i.test(cleaned)) return null;
  }
  const lower = cleaned.toLowerCase();
  if (NON_COLOR_KEYWORDS.has(lower)) return null;

  const rgba = parseColorRgba(cleaned);
  if (!rgba || rgba.a < OPAQUE_BG_MIN_ALPHA) return null;

  if (/^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(cleaned)) {
    return lower;
  }
  if (/^[0-9a-f]{6}$/i.test(cleaned)) {
    return `#${lower}`;
  }
  if (Object.prototype.hasOwnProperty.call(CSS_NAMED_COLORS, lower)) {
    return lower;
  }
  if (/^(?:rgba?|hsla?)\(\s*[\da-z.,\s%/+-]+\s*\)$/i.test(cleaned)) {
    return cleaned;
  }
  return null;
}

/**
 * Computes the WCAG relative luminance (0..1) of a CSS colour value, or `null`
 * for transparent / non-colour / unrecognised values.
 */
export function parseColorLuminance(value: string, minAlpha = 0.05): number | null {
  const rgba = parseColorRgba(value);
  if (!rgba || rgba.a <= minAlpha) return null;
  return rgbToRelativeLuminance(rgba.r, rgba.g, rgba.b);
}

export function isDarkColor(value: string): boolean {
  const luminance = parseColorLuminance(value);
  return luminance !== null && luminance < DARK_LUMINANCE_THRESHOLD;
}

function stripCssFunctions(input: string, names: RegExp): string {
  let out = "";
  let i = 0;
  while (i < input.length) {
    const rest = input.slice(i);
    const match = names.exec(rest);
    if (match && match.index === 0) {
      let depth = 1;
      let j = i + match[0].length;
      while (j < input.length && depth > 0) {
        if (input[j] === "(") depth += 1;
        else if (input[j] === ")") depth -= 1;
        j += 1;
      }
      out += " ";
      i = j;
      continue;
    }
    out += input[i];
    i += 1;
  }
  return out;
}

function resolveCustomProperties(value: string, customProps: Map<string, string>, depth = 0): string {
  if (depth > 4 || !value.includes("var(")) return value;
  let out = "";
  let i = 0;
  while (i < value.length) {
    const match = /^var\s*\(/i.exec(value.slice(i));
    if (!match) {
      out += value[i];
      i += 1;
      continue;
    }
    let parens = 1;
    let j = i + match[0].length;
    while (j < value.length && parens > 0) {
      if (value[j] === "(") parens += 1;
      else if (value[j] === ")") parens -= 1;
      j += 1;
    }
    const inner = value.slice(i + match[0].length, j - 1);
    const commaIndex = (() => {
      let d = 0;
      for (let k = 0; k < inner.length; k += 1) {
        if (inner[k] === "(") d += 1;
        else if (inner[k] === ")") d = Math.max(0, d - 1);
        else if (inner[k] === "," && d === 0) return k;
      }
      return -1;
    })();
    const propName = (commaIndex >= 0 ? inner.slice(0, commaIndex) : inner).trim();
    const fallback = commaIndex >= 0 ? inner.slice(commaIndex + 1).trim() : "";
    const resolved = customProps.get(propName);
    if (resolved !== undefined) {
      out += resolveCustomProperties(resolved, customProps, depth + 1);
    } else if (fallback) {
      out += resolveCustomProperties(fallback, customProps, depth + 1);
    } else {
      out += value.slice(i, j);
    }
    i = j;
  }
  return out;
}

/**
 * Extracts opaque colour luminances from a `background` or `background-color`
 * value, resolving base custom properties and stripping `url(...)` / unresolved
 * `var(...)` so filenames and variable names never masquerade as colour words.
 */
function extractBackgroundColorLuminances(value: string, customProps: Map<string, string>): number[] {
  const resolved = stripImportant(resolveCustomProperties(value, customProps));
  if (!resolved) return [];
  const direct = parseColorLuminance(resolved, OPAQUE_BG_MIN_ALPHA);
  if (direct !== null) return [direct];

  const stripped = stripCssFunctions(resolved, /^(?:url|var)\s*\(/i);
  const tokens = stripped.match(/(?:rgba?|hsla?)\([^()]+\)|#[0-9a-f]{3,8}\b|\b[a-z]{3,24}\b/gi) ?? [];
  const luminances: number[] = [];
  for (const token of tokens) {
    const luminance = parseColorLuminance(token, OPAQUE_BG_MIN_ALPHA);
    if (luminance !== null) luminances.push(luminance);
  }
  return luminances;
}

function splitTopLevelCommas(input: string): string[] {
  const parts: string[] = [];
  let depthParen = 0;
  let depthBracket = 0;
  let quote: string | null = null;
  let start = 0;
  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    if (quote) {
      if (ch === "\\" && i + 1 < input.length) {
        i += 1;
      } else if (ch === quote) {
        quote = null;
      }
      continue;
    }
    if (ch === '"' || ch === "'") quote = ch;
    else if (ch === "(") depthParen += 1;
    else if (ch === ")") depthParen = Math.max(0, depthParen - 1);
    else if (ch === "[") depthBracket += 1;
    else if (ch === "]") depthBracket = Math.max(0, depthBracket - 1);
    else if (ch === "," && depthParen === 0 && depthBracket === 0) {
      parts.push(input.slice(start, i).trim());
      start = i + 1;
    }
  }
  parts.push(input.slice(start).trim());
  return parts.filter(Boolean);
}

/**
 * Finds the `body` type selector outside brackets/strings/parens and builds a
 * matching selector targeting `.${contentClass}` where Noctua mounts the email
 * body's attributes and inline styles.
 */
function mirrorBodySelector(
  selector: string,
  contentClass: string,
  includeBareSubject: boolean
): string | null {
  let depthBracket = 0;
  let depthParen = 0;
  let quote: string | null = null;
  let out = "";
  let changed = false;
  let i = 0;

  while (i < selector.length) {
    const ch = selector[i];
    if (quote) {
      out += ch;
      if (ch === "\\" && i + 1 < selector.length) {
        i += 1;
        out += selector[i];
      } else if (ch === quote) {
        quote = null;
      }
      i += 1;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      out += ch;
      i += 1;
      continue;
    }
    if (ch === "[") depthBracket += 1;
    else if (ch === "]") depthBracket = Math.max(0, depthBracket - 1);
    else if (ch === "(") depthParen += 1;
    else if (ch === ")") depthParen = Math.max(0, depthParen - 1);

    if (depthBracket === 0 && depthParen === 0) {
      const slice = selector.slice(i);
      const bodyMatch = /^body(?=$|[\s>+~.#[:])/i.exec(slice);
      const prev = i > 0 ? selector[i - 1] : "";
      const isTypeToken = bodyMatch !== null && (!prev || /[\s>+~,]/.test(prev));
      if (isTypeToken) {
        const afterIndex = i + 4;
        const rest = selector.slice(afterIndex);
        const trimmedRest = rest.trimStart();
        const isSubject = trimmedRest.length === 0;
        const hasQualifier = /^[.#[:]/.test(rest);
        const hasChildCombinator = trimmedRest.startsWith(">");
        if (hasQualifier || hasChildCombinator || (includeBareSubject && isSubject)) {
          out = out.replace(/\s*>\s*$/, " ");
          out += `.${contentClass}`;
          changed = true;
          i = afterIndex;
          continue;
        }
      }
    }

    out += ch;
    i += 1;
  }

  return changed ? out.trim() : null;
}

const ALREADY_THEME_PREFIXED = /^(?::where\(html\[data-theme=|html:where\(\[data-theme=|:root:where\(\[data-theme=)/i;

function rewriteSelectorForTheme(
  selector: string,
  theme: "dark" | "light",
  contentClass: string
): string[] {
  const trimmed = selector.trim();
  if (!trimmed) return [];
  if (ALREADY_THEME_PREFIXED.test(trimmed)) return [trimmed];

  // Zero-specificity `:where(...)` preserves the sender's exact cascade and
  // specificity order relative to sibling rules in the same stylesheet.
  let prefixed: string;
  if (/^html(?=$|[\s>+~.#[:])/i.test(trimmed)) {
    prefixed = `html:where([data-theme="${theme}"])${trimmed.slice(4)}`;
  } else if (/^:root(?=$|[\s>+~.#[:])/i.test(trimmed)) {
    prefixed = `:root:where([data-theme="${theme}"])${trimmed.slice(5)}`;
  } else {
    prefixed = `:where(html[data-theme="${theme}"]) ${trimmed}`;
  }

  const results = [prefixed];
  const mirrored = mirrorBodySelector(prefixed, contentClass, true);
  if (mirrored && mirrored !== prefixed) {
    results.push(mirrored);
  }
  return results;
}

const PREFERS_COLOR_SCHEME_FEATURE = /\(\s*prefers-color-scheme\s*:\s*(dark|light)\s*\)/gi;

function splitTopLevelOr(input: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    if (ch === "(") depth += 1;
    else if (ch === ")") depth = Math.max(0, depth - 1);
    else if (depth === 0) {
      const match = /^\s+or\s+/i.exec(input.slice(i));
      if (match) {
        parts.push(input.slice(start, i).trim());
        i += match[0].length - 1;
        start = i + 1;
      }
    }
  }
  parts.push(input.slice(start).trim());
  return parts.filter(Boolean);
}

type MediaEval = {
  kind: "untouched" | "drop" | "match";
  remaining: string;
  targetsDark: boolean;
  targetsLight: boolean;
  isPrintOnly: boolean;
};

function stripLeadingPrefix(query: string): string {
  return query
    .replace(/\band\s+and\b/gi, "and")
    .replace(/^\s*(?:(?:only|not)\s+)?(?:(?:all|screen)\s+)?and\s+/i, (prefix) => {
      const hasNot = /\bnot\b/i.test(prefix);
      const hasScreen = /\bscreen\b/i.test(prefix);
      if (hasNot) return hasScreen ? "not screen and " : "not all and ";
      return hasScreen ? "screen and " : "";
    })
    .replace(/\s+and\s*$/i, "")
    .replace(/^\s*(?:only|not)\s*$/i, "")
    .trim();
}

function evaluateSimpleMediaQuery(query: string, theme: "dark" | "light"): MediaEval {
  const matches = [...query.matchAll(PREFERS_COLOR_SCHEME_FEATURE)];
  const isPrintOnly = /^\s*(?:only\s+)?print\b/i.test(query);
  if (matches.length === 0) {
    return { kind: "untouched", remaining: query, targetsDark: false, targetsLight: false, isPrintOnly };
  }

  const schemes = matches.map((m) => m[1].toLowerCase() as "dark" | "light");
  const hasDarkFeature = schemes.includes("dark");
  const hasLightFeature = schemes.includes("light");
  const isContradictory = hasDarkFeature && hasLightFeature;
  const isNegated = /^\s*not\s+/i.test(query);

  // Strip prefers-color-scheme features to inspect whether any other condition remains.
  const withoutPcs = query
    .replace(PREFERS_COLOR_SCHEME_FEATURE, "")
    .replace(/\band\s+and\b/gi, "and")
    .replace(/\s+and\s*$/i, "")
    .replace(/^\s*(?:only|not)\s+(?:all|screen)\s+and\s+/i, (p) =>
      /\bnot\b/i.test(p) ? (/\bscreen\b/i.test(p) ? "not screen and " : "not all and ") : (/\bscreen\b/i.test(p) ? "screen and " : "")
    )
    .replace(/^\s*(?:all|screen)\s+and\s+/i, (p) => (/\bscreen\b/i.test(p) ? "screen and " : ""))
    .replace(/^\s*and\s+/i, "")
    .trim();

  const hasOtherConditions = !/^(?:(?:only|not)\s+)?(?:all|screen)?$/i.test(withoutPcs);

  if (isNegated) {
    // `not (A and B)`:
    // - If the colour-scheme clause is FALSE for `theme` (or contradictory),
    //   then the entire negated query is TRUE unconditionally (for screen/all).
    // - If the colour-scheme clause is TRUE for `theme`:
    //   - With no other conditions (`not all and (prefers-color-scheme: dark)`),
    //     the negated query is FALSE -> drop.
    //   - With other conditions (`not all and (prefers-color-scheme: dark) and (max-width: 600px)`),
    //     it reduces to `not all and (max-width: 600px)`.
    const pcsMatchesTheme = !isContradictory && schemes.every((s) => s === theme);
    const targetsDark = !isPrintOnly && (isContradictory || hasLightFeature);
    const targetsLight = !isPrintOnly && (isContradictory || hasDarkFeature);
    if (!pcsMatchesTheme) {
      if (isPrintOnly) {
        return { kind: "match", remaining: "not print", targetsDark, targetsLight, isPrintOnly };
      }
      return { kind: "match", remaining: "", targetsDark, targetsLight, isPrintOnly: false };
    }
    if (!hasOtherConditions) {
      return { kind: "drop", remaining: "", targetsDark, targetsLight, isPrintOnly };
    }
    return {
      kind: "match",
      remaining: stripLeadingPrefix(withoutPcs),
      targetsDark,
      targetsLight,
      isPrintOnly
    };
  }

  // Positive conjunction: `all and (prefers-color-scheme: dark) and ...`
  const targetsDark = !isPrintOnly && !isContradictory && hasDarkFeature;
  const targetsLight = !isPrintOnly && !isContradictory && hasLightFeature;
  if (isContradictory || !schemes.every((s) => s === theme)) {
    return { kind: "drop", remaining: "", targetsDark, targetsLight, isPrintOnly };
  }

  let remaining = stripLeadingPrefix(withoutPcs);
  if (/^(?:only\s+)?(?:all|screen)$/i.test(remaining)) {
    remaining = "";
  }
  return { kind: "match", remaining, targetsDark, targetsLight, isPrintOnly };
}

function evaluateMediaQueryForTheme(query: string, theme: "dark" | "light"): MediaEval {
  const orBranches = splitTopLevelOr(query);
  if (orBranches.length === 1) {
    return evaluateSimpleMediaQuery(query, theme);
  }
  let targetsDark = false;
  let targetsLight = false;
  let anyTouched = false;
  const kept: string[] = [];
  for (const branch of orBranches) {
    const res = evaluateSimpleMediaQuery(branch, theme);
    if (res.targetsDark) targetsDark = true;
    if (res.targetsLight) targetsLight = true;
    if (res.kind === "untouched") {
      kept.push(res.remaining);
    } else {
      anyTouched = true;
      if (res.kind === "match") {
        if (res.remaining === "") {
          return { kind: "match", remaining: "", targetsDark, targetsLight, isPrintOnly: false };
        }
        kept.push(res.remaining);
      }
    }
  }
  if (!anyTouched) {
    return { kind: "untouched", remaining: query, targetsDark: false, targetsLight: false, isPrintOnly: false };
  }
  if (kept.length === 0) {
    return { kind: "drop", remaining: "", targetsDark, targetsLight, isPrintOnly: false };
  }
  return { kind: "match", remaining: kept.join(" or "), targetsDark, targetsLight, isPrintOnly: false };
}

function isRootTargetSelector(selector: string): boolean {
  return splitTopLevelCommas(selector).some((part) => {
    const cleaned = part
      .trim()
      .replace(/^:where\([^)]*\)\s*/i, "")
      .replace(/^(?:html|:root):where\([^)]*\)/i, "html")
      .trim();
    return /^(?:html|:root|body)(?=$|[.#[:])|^(?:html|:root)\s*(?:>\s*)?body(?=$|[.#[:])|^\.noctua-email-content(?=$|[.#[:])/i.test(
      cleaned
    );
  });
}

function inspectDarkRuleSupport(container: AtRule): { hasColorOrBg: boolean; overridesRootBg: boolean } {
  let hasColorOrBg = false;
  let overridesRootBg = false;
  container.walkRules((rule: Rule) => {
    if (rule.parent?.type === "atrule" && /keyframes$/i.test((rule.parent as AtRule).name)) return;
    const isRoot = isRootTargetSelector(rule.selector);
    rule.each((node) => {
      if (node.type !== "decl") return;
      const prop = node.prop.trim().toLowerCase();
      if (prop === "color" || prop === "background" || prop === "background-color") {
        hasColorOrBg = true;
        if (isRoot && (prop === "background" || prop === "background-color")) {
          overridesRootBg = true;
        }
      }
    });
  });
  return { hasColorOrBg, overridesRootBg };
}

function hasConstrainingAncestorAtRule(node: Node): boolean {
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (parent.type !== "atrule") continue;
    const at = parent as AtRule;
    if (/^media$/i.test(at.name)) {
      const p = at.params.trim();
      if (p && !/^(?:only\s+)?(?:all|screen)$/i.test(p)) return true;
    } else if (/^(?:container|supports)$/i.test(at.name)) {
      return true;
    }
  }
  return false;
}

function rewriteRulesInContainer(
  container: AtRule,
  theme: "dark" | "light",
  contentClass: string
) {
  container.walkRules((rule: Rule) => {
    // Skip @keyframes stops (`from`, `to`, `50%`) and CSS Nesting child rules
    // (whose parent is already a Rule and therefore already theme-prefixed).
    if (rule.parent?.type === "rule") return;
    if (rule.parent?.type === "atrule" && /keyframes$/i.test((rule.parent as AtRule).name)) {
      return;
    }
    const selectors = splitTopLevelCommas(rule.selector);
    const rewritten: string[] = [];
    for (const selector of selectors) {
      for (const next of rewriteSelectorForTheme(selector, theme, contentClass)) {
        if (!rewritten.includes(next)) rewritten.push(next);
      }
    }
    if (rewritten.length > 0) {
      rule.selector = rewritten.join(", ");
    }
  });
}

function mirrorQualifiedBodySelectorsInBase(root: postcss.Root, contentClass: string) {
  root.walkRules((rule: Rule) => {
    if (rule.parent?.type === "rule") return;
    if (rule.parent?.type === "atrule" && /keyframes$/i.test((rule.parent as AtRule).name)) {
      return;
    }
    const selectors = splitTopLevelCommas(rule.selector);
    let updated = false;
    const nextSelectors: string[] = [];
    for (const selector of selectors) {
      nextSelectors.push(selector);
      const mirrored = mirrorBodySelector(selector, contentClass, false);
      if (mirrored && mirrored !== selector && !nextSelectors.includes(mirrored)) {
        nextSelectors.push(mirrored);
        updated = true;
      }
    }
    if (updated) {
      rule.selector = nextSelectors.join(", ");
    }
  });
}

function pruneEmptyAtRules(root: postcss.Root) {
  let removed = true;
  while (removed) {
    removed = false;
    root.walkAtRules((atRule) => {
      if (atRule.nodes && atRule.nodes.every((child) => child.type === "comment")) {
        atRule.remove();
        removed = true;
      }
    });
  }
}

export type RewrittenEmailStyles = {
  css: string;
  hasDarkSchemeRules: boolean;
  hasDarkRootBackgroundOverride: boolean;
  hasAnyLightMediaQuery: boolean;
};

/**
 * Rewrites sender CSS in-place for Noctua's iframe theme:
 * - Evaluates `@media (prefers-color-scheme: dark|light)` in-place via PostCSS
 *   so enclosing `@media`, `@supports`, `@layer` and cascade order stay intact.
 * - Uses zero-specificity `:where(html[data-theme="..."])` so rewritten rules
 *   keep the sender's original specificity against sibling rules.
 * - Maps `html`/`:root` onto `html:where(...)`/`:root:where(...)` and mirrors
 *   `body` rules onto `.${contentClass}` so dark-mode overrides beat copied
 *   `<body style="background-color: #fff">` and match `body.class` / `body#id`.
 */
export function rewriteEmailStylesForTheme(
  css: string,
  theme: "dark" | "light",
  contentClass: string
): RewrittenEmailStyles {
  if (!css.trim()) {
    return {
      css,
      hasDarkSchemeRules: false,
      hasDarkRootBackgroundOverride: false,
      hasAnyLightMediaQuery: false
    };
  }

  let root: postcss.Root;
  try {
    root = postcss.parse(css);
  } catch {
    return {
      css,
      hasDarkSchemeRules: false,
      hasDarkRootBackgroundOverride: false,
      hasAnyLightMediaQuery: false
    };
  }

  let hasDarkSchemeRules = false;
  let hasDarkRootBackgroundOverride = false;
  let hasAnyLightMediaQuery = false;

  // Collect media rules first and process bottom-up so nested @media blocks
  // are evaluated inside their parent conditions cleanly.
  const mediaRules: AtRule[] = [];
  root.walkAtRules(/^media$/i, (atRule) => {
    mediaRules.push(atRule);
  });

  for (let idx = mediaRules.length - 1; idx >= 0; idx -= 1) {
    const atRule = mediaRules[idx];
    if (!atRule.parent) continue;

    const queries = splitTopLevelCommas(atRule.params);
    const untouchedQueries: string[] = [];
    const matchedRemainders: string[] = [];
    let anyTouched = false;
    let unconditionalDarkTarget = false;
    let sawLightTarget = false;

    for (const query of queries) {
      const result = evaluateMediaQueryForTheme(query, theme);
      if (result.targetsLight) sawLightTarget = true;
      if (result.kind === "untouched") {
        untouchedQueries.push(query);
      } else {
        anyTouched = true;
        if (result.targetsDark && !result.isPrintOnly && result.remaining === "") {
          unconditionalDarkTarget = true;
        }
        if (result.kind === "match") {
          matchedRemainders.push(result.remaining);
        }
      }
    }

    if (!anyTouched) continue;
    if (sawLightTarget) hasAnyLightMediaQuery = true;

    const constrainedByAncestor = hasConstrainingAncestorAtRule(atRule);
    if (unconditionalDarkTarget && !constrainedByAncestor) {
      const support = inspectDarkRuleSupport(atRule);
      if (support.hasColorOrBg) hasDarkSchemeRules = true;
      if (support.overridesRootBg) hasDarkRootBackgroundOverride = true;
    }

    if (matchedRemainders.length > 0) {
      const matchedClone = atRule.clone();
      rewriteRulesInContainer(matchedClone, theme, contentClass);
      const unconditional = matchedRemainders.some((part) => part === "");
      if (unconditional) {
        if (matchedClone.nodes && matchedClone.nodes.length > 0) {
          atRule.before(matchedClone.nodes);
        }
      } else {
        matchedClone.params = matchedRemainders.join(", ");
        atRule.before(matchedClone);
      }
    }

    if (untouchedQueries.length > 0) {
      atRule.params = untouchedQueries.join(", ");
    } else {
      atRule.remove();
    }
  }

  pruneEmptyAtRules(root);
  mirrorQualifiedBodySelectorsInBase(root, contentClass);

  return {
    css: root.toString(),
    hasDarkSchemeRules,
    hasDarkRootBackgroundOverride,
    hasAnyLightMediaQuery
  };
}

export type EmailColorAnalysis = {
  hasExplicitColor: boolean;
  hasRootTextColor: boolean;
  hasRootDarkBackground: boolean;
  hasRootLightBackground: boolean;
  hasLightOwnBackground: boolean;
  hasDarkOwnBackground: boolean;
  hasDarkOwnText: boolean;
  hasLightOwnText: boolean;
};

function isAnchorOnlySelector(selector: string): boolean {
  const parts = splitTopLevelCommas(selector);
  if (parts.length === 0) return false;
  return parts.every((part) => {
    // Check the subject (rightmost compound selector after combinators).
    const trimmed = part.trim();
    let depthBracket = 0;
    let depthParen = 0;
    let lastCombinator = -1;
    for (let i = 0; i < trimmed.length; i += 1) {
      const ch = trimmed[i];
      if (ch === "[") depthBracket += 1;
      else if (ch === "]") depthBracket = Math.max(0, depthBracket - 1);
      else if (ch === "(") depthParen += 1;
      else if (ch === ")") depthParen = Math.max(0, depthParen - 1);
      else if (depthBracket === 0 && depthParen === 0 && /[\s>+~]/.test(ch)) {
        lastCombinator = i;
      }
    }
    const subject = trimmed.slice(lastCombinator + 1).trim();
    return /^a(?=$|[:.#[])/i.test(subject);
  });
}

function inspectStyleDeclarations(
  decls: Declaration[],
  options: {
    isAnchorOnly: boolean;
    isRoot: boolean;
    isConditionalMedia: boolean;
    customProps: Map<string, string>;
  },
  analysis: EmailColorAnalysis
) {
  for (const decl of decls) {
    const prop = decl.prop.trim().toLowerCase();
    const value = decl.value.trim();
    if (!value) continue;

    if (prop === "color") {
      const resolved = resolveCustomProperties(value, options.customProps);
      const luminance = parseColorLuminance(resolved, VISIBLE_TEXT_MIN_ALPHA);
      if (luminance !== null) {
        analysis.hasExplicitColor = true;
        if (options.isRoot) analysis.hasRootTextColor = true;
        if (!options.isAnchorOnly && !options.isConditionalMedia) {
          if (luminance < DARK_LUMINANCE_THRESHOLD) analysis.hasDarkOwnText = true;
          else if (luminance >= LIGHT_TEXT_LUMINANCE_THRESHOLD) analysis.hasLightOwnText = true;
        }
      } else if (!NON_COLOR_KEYWORDS.has(stripImportant(resolved).toLowerCase())) {
        analysis.hasExplicitColor = true;
        if (options.isRoot) analysis.hasRootTextColor = true;
      }
      continue;
    }

    if (prop === "background" || prop === "background-color") {
      if (options.isConditionalMedia) continue;
      const cleaned = stripImportant(value).toLowerCase();
      if (NON_COLOR_KEYWORDS.has(cleaned)) continue;
      const luminances = extractBackgroundColorLuminances(value, options.customProps);
      for (const luminance of luminances) {
        if (luminance < DARK_LUMINANCE_THRESHOLD) {
          analysis.hasDarkOwnBackground = true;
          if (options.isRoot) analysis.hasRootDarkBackground = true;
        } else {
          analysis.hasLightOwnBackground = true;
          if (options.isRoot) analysis.hasRootLightBackground = true;
        }
      }
    }
  }
}

/**
 * Linear-time HTML opening-tag scanner (no regex backtracking) that skips
 * HTML comments and `<style>` / `<script>` raw-text elements, returning exact
 * lower-cased tag names and attribute maps.
 */
function scanHtmlOpeningTags(
  html: string,
  onTag: (tagName: string, attrs: Map<string, string>) => void
) {
  const len = html.length;
  let i = 0;

  while (i < len) {
    const lt = html.indexOf("<", i);
    if (lt === -1) break;
    i = lt;

    // Skip HTML comments `<!-- ... -->`.
    if (html.startsWith("<!--", i)) {
      const end = html.indexOf("-->", i + 4);
      i = end === -1 ? len : end + 3;
      continue;
    }

    // Skip closing tags, declarations and processing instructions.
    const nextChar = html[i + 1] ?? "";
    if (!/[a-z]/i.test(nextChar)) {
      i += 1;
      continue;
    }

    let j = i + 1;
    while (j < len && /[\w:-]/.test(html[j])) j += 1;
    const tagName = html.slice(i + 1, j).toLowerCase();

    const attrs = new Map<string, string>();
    while (j < len) {
      while (j < len && /[\s/]/.test(html[j])) j += 1;
      if (j >= len) break;
      if (html[j] === ">") {
        j += 1;
        break;
      }
      const attrStart = j;
      while (j < len && !/[\s=/>]/.test(html[j])) j += 1;
      const attrName = html.slice(attrStart, j).toLowerCase();
      if (!attrName) {
        j += 1;
        continue;
      }
      while (j < len && /\s/.test(html[j])) j += 1;
      let attrValue = "";
      if (j < len && html[j] === "=") {
        j += 1;
        while (j < len && /\s/.test(html[j])) j += 1;
        if (j < len && (html[j] === '"' || html[j] === "'")) {
          const quote = html[j];
          j += 1;
          const valStart = j;
          const closeQuote = html.indexOf(quote, j);
          if (closeQuote === -1) {
            attrValue = html.slice(valStart);
            j = len;
          } else {
            attrValue = html.slice(valStart, closeQuote);
            j = closeQuote + 1;
          }
        } else {
          const valStart = j;
          while (j < len && !/[\s>]/.test(html[j])) j += 1;
          attrValue = html.slice(valStart, j);
        }
      }
      if (!attrs.has(attrName)) attrs.set(attrName, attrValue);
    }

    onTag(tagName, attrs);
    i = j;

    // Skip raw-text contents of <style> and <script>.
    if (tagName === "style" || tagName === "script") {
      const closeRe = new RegExp(`</${tagName}\\s*>`, "i");
      const closeMatch = closeRe.exec(html.slice(i));
      i = closeMatch ? i + closeMatch.index + closeMatch[0].length : len;
    }
  }
}

/**
 * Inspects `<style>` blocks (excluding `prefers-color-scheme` and `print`
 * media blocks) and HTML opening tags in linear time — never visible prose or
 * HTML comments — to determine the sender's base colour palette.
 */
export function analyzeEmailColorScheme(
  html: string,
  bodyBgcolor = ""
): EmailColorAnalysis {
  const analysis: EmailColorAnalysis = {
    hasExplicitColor: false,
    hasRootTextColor: false,
    hasRootDarkBackground: false,
    hasRootLightBackground: false,
    hasLightOwnBackground: false,
    hasDarkOwnBackground: false,
    hasDarkOwnText: false,
    hasLightOwnText: false
  };

  if (bodyBgcolor) {
    const bodyBgLuminance = parseColorLuminance(bodyBgcolor, OPAQUE_BG_MIN_ALPHA);
    if (bodyBgLuminance !== null) {
      if (bodyBgLuminance < DARK_LUMINANCE_THRESHOLD) {
        analysis.hasDarkOwnBackground = true;
        analysis.hasRootDarkBackground = true;
      } else {
        analysis.hasLightOwnBackground = true;
        analysis.hasRootLightBackground = true;
      }
    }
  }

  const customProps = new Map<string, string>();
  const parsedRoots: postcss.Root[] = [];

  // 1. Parse <style> blocks (excluding prefers-color-scheme and print blocks)
  //    and gather top-level CSS custom properties first.
  for (const match of html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) {
    const css = match[1];
    if (!css.trim()) continue;
    try {
      const root = postcss.parse(css);
      root.walkAtRules(/^media$/i, (atRule) => {
        if (/prefers-color-scheme/i.test(atRule.params) || /^\s*(?:only\s+)?print\b/i.test(atRule.params)) {
          atRule.remove();
        }
      });
      root.walkRules((rule) => {
        if (!isRootTargetSelector(rule.selector) && rule.selector.trim() !== "*") return;
        if (hasConstrainingAncestorAtRule(rule)) return;
        rule.each((node) => {
          if (node.type === "decl" && node.prop.trim().startsWith("--")) {
            customProps.set(node.prop.trim(), node.value.trim());
          }
        });
      });
      parsedRoots.push(root);
    } catch {
      // Malformed CSS blocks are ignored here; inline tags below still run.
    }
  }

  for (const root of parsedRoots) {
    root.walkRules((rule) => {
      if (rule.parent?.type === "atrule" && /keyframes$/i.test((rule.parent as AtRule).name)) return;
      const decls: Declaration[] = [];
      rule.each((node) => {
        if (node.type === "decl") decls.push(node);
      });
      if (decls.length === 0) return;
      inspectStyleDeclarations(
        decls,
        {
          isAnchorOnly: isAnchorOnlySelector(rule.selector),
          isRoot: isRootTargetSelector(rule.selector),
          isConditionalMedia: hasConstrainingAncestorAtRule(rule),
          customProps
        },
        analysis
      );
    });
  }

  // 2. Scan HTML opening tags linearly, memoizing repeated inline style strings.
  const inlineDeclCache = new Map<string, Declaration[]>();
  scanHtmlOpeningTags(html, (tagName, attrs) => {
    const isAnchor = tagName === "a";
    const isRoot = tagName === "body" || tagName === "html";

    const bgcolor = attrs.get("bgcolor")?.trim();
    if (bgcolor && !NON_COLOR_KEYWORDS.has(bgcolor.toLowerCase())) {
      const luminance = parseColorLuminance(bgcolor, OPAQUE_BG_MIN_ALPHA);
      if (luminance !== null) {
        if (luminance < DARK_LUMINANCE_THRESHOLD) {
          analysis.hasDarkOwnBackground = true;
          if (isRoot) analysis.hasRootDarkBackground = true;
        } else {
          analysis.hasLightOwnBackground = true;
          if (isRoot) analysis.hasRootLightBackground = true;
        }
      }
    }

    // Legacy HTML `background="paper.png"` attribute.
    if (attrs.has("background")) {
      const bgAttr = attrs.get("background")?.trim() ?? "";
      if (bgAttr) {
        analysis.hasLightOwnBackground = true;
        if (isRoot) analysis.hasRootLightBackground = true;
      }
    }

    // Legacy `<font color="#222">` attribute.
    if (tagName === "font") {
      const colorAttr = attrs.get("color")?.trim();
      if (colorAttr && !NON_COLOR_KEYWORDS.has(colorAttr.toLowerCase())) {
        analysis.hasExplicitColor = true;
        const luminance = parseColorLuminance(colorAttr, VISIBLE_TEXT_MIN_ALPHA);
        if (luminance !== null) {
          if (luminance < DARK_LUMINANCE_THRESHOLD) analysis.hasDarkOwnText = true;
          else if (luminance >= LIGHT_TEXT_LUMINANCE_THRESHOLD) analysis.hasLightOwnText = true;
        }
      }
    }

    const inlineCss = attrs.get("style")?.trim();
    if (inlineCss) {
      let decls = inlineDeclCache.get(inlineCss);
      if (!decls) {
        decls = [];
        try {
          const inlineRoot = postcss.parse(`x{${inlineCss}}`);
          inlineRoot.walkDecls((decl) => {
            decls!.push(decl);
          });
        } catch {
          // Ignore unparseable inline style snippets.
        }
        inlineDeclCache.set(inlineCss, decls);
      }
      if (decls.length > 0) {
        inspectStyleDeclarations(
          decls,
          { isAnchorOnly: isAnchor, isRoot, isConditionalMedia: false, customProps },
          analysis
        );
      }
    }
  });

  return analysis;
}
