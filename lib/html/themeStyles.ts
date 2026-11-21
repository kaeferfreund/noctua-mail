import postcss, { type AtRule, type Declaration, type Rule } from "postcss";

export type HtmlColorSchemeOverride = "auto" | "light" | "dark";

// WCAG relative luminance threshold below which a colour is treated as dark:
// #757575 is ~0.18, #666666 is ~0.13, #333333 is ~0.03, #000000 is 0.
const DARK_LUMINANCE_THRESHOLD = 0.18;

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

function parseRgbChannel(token: string) {
  const trimmed = token.trim();
  if (trimmed.endsWith("%")) {
    const num = Number.parseFloat(trimmed.slice(0, -1));
    return Number.isFinite(num) ? (num / 100) * 255 : null;
  }
  const num = Number.parseFloat(trimmed);
  return Number.isFinite(num) ? num : null;
}

function parseAlpha(token: string | undefined) {
  if (!token) return 1;
  const trimmed = token.trim();
  if (trimmed.endsWith("%")) {
    const num = Number.parseFloat(trimmed.slice(0, -1));
    return Number.isFinite(num) ? num / 100 : 1;
  }
  const num = Number.parseFloat(trimmed);
  return Number.isFinite(num) ? num : 1;
}

/**
 * Validates and normalises a CSS colour literal (e.g. from a `<body bgcolor>`
 * attribute) before inserting it into a stylesheet. Rejects syntax tokens and
 * non-colour keywords.
 */
export function sanitizeCssColorValue(value: string): string | null {
  const cleaned = stripImportant(value);
  if (!cleaned || /[{}();:\\<>"']|\/\*/.test(cleaned)) {
    // Allow parentheses only for rgb()/rgba()/hsl()/hsla() below.
    if (!/^(?:rgba?|hsla?)\([^()]+\)$/i.test(cleaned)) return null;
  }
  const lower = cleaned.toLowerCase();
  if (NON_COLOR_KEYWORDS.has(lower)) return null;
  if (/^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(cleaned)) {
    return lower;
  }
  // Legacy HTML attributes sometimes omit the leading '#' (e.g. bgcolor="ffffff").
  if (/^[0-9a-f]{6}$/i.test(cleaned)) {
    return `#${lower}`;
  }
  if (Object.prototype.hasOwnProperty.call(CSS_NAMED_COLORS, lower)) {
    return lower;
  }
  if (/^(?:rgba?|hsla?)\(\s*[\d.,\s%/+-]+\s*\)$/i.test(cleaned)) {
    return parseColorLuminance(cleaned) !== null ? cleaned : null;
  }
  return null;
}

/**
 * Computes the WCAG relative luminance (0..1) of a CSS colour value, or `null`
 * for transparent / non-colour / unrecognised values.
 */
export function parseColorLuminance(value: string): number | null {
  const cleaned = stripImportant(value).toLowerCase();
  if (!cleaned || NON_COLOR_KEYWORDS.has(cleaned)) return null;

  const namedHex = CSS_NAMED_COLORS[cleaned];
  const target = namedHex ?? (/^[0-9a-f]{6}$/.test(cleaned) ? `#${cleaned}` : cleaned);

  const hex = /^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/.exec(target);
  if (hex) {
    const digits = hex[1];
    if (digits.length === 3 || digits.length === 4) {
      const r = Number.parseInt(digits[0] + digits[0], 16);
      const g = Number.parseInt(digits[1] + digits[1], 16);
      const b = Number.parseInt(digits[2] + digits[2], 16);
      const a = digits.length === 4 ? Number.parseInt(digits[3] + digits[3], 16) / 255 : 1;
      return a <= 0.05 ? null : rgbToRelativeLuminance(r, g, b);
    }
    const r = Number.parseInt(digits.slice(0, 2), 16);
    const g = Number.parseInt(digits.slice(2, 4), 16);
    const b = Number.parseInt(digits.slice(4, 6), 16);
    const a = digits.length === 8 ? Number.parseInt(digits.slice(6, 8), 16) / 255 : 1;
    return a <= 0.05 ? null : rgbToRelativeLuminance(r, g, b);
  }

  const rgbMatch = /^rgba?\(\s*([^)]+?)\s*\)$/.exec(target);
  if (rgbMatch) {
    const [channelsPart, slashAlpha] = rgbMatch[1].split("/");
    const parts = channelsPart.trim().split(/[\s,]+/).filter(Boolean);
    if (parts.length < 3) return null;
    const r = parseRgbChannel(parts[0]);
    const g = parseRgbChannel(parts[1]);
    const b = parseRgbChannel(parts[2]);
    if (r === null || g === null || b === null) return null;
    const alpha = parseAlpha(slashAlpha ?? parts[3]);
    return alpha <= 0.05 ? null : rgbToRelativeLuminance(r, g, b);
  }

  const hslMatch = /^hsla?\(\s*([^)]+?)\s*\)$/.exec(target);
  if (hslMatch) {
    const [channelsPart, slashAlpha] = hslMatch[1].split("/");
    const parts = channelsPart.trim().split(/[\s,]+/).filter(Boolean);
    if (parts.length < 3) return null;
    const h = Number.parseFloat(parts[0]);
    const s = Number.parseFloat(parts[1]);
    const l = Number.parseFloat(parts[2]);
    if (!Number.isFinite(h) || !Number.isFinite(s) || !Number.isFinite(l)) return null;
    const alpha = parseAlpha(slashAlpha ?? parts[3]);
    if (alpha <= 0.05) return null;
    const [r, g, b] = hslToRgb(h, s, l);
    return rgbToRelativeLuminance(r, g, b);
  }

  return null;
}

export function isDarkColor(value: string): boolean {
  const luminance = parseColorLuminance(value);
  return luminance !== null && luminance < DARK_LUMINANCE_THRESHOLD;
}

/**
 * Extracts all colour tokens from a `background` or `background-color` value,
 * handling shorthand declarations like `url(x.png) #f4f4f4 no-repeat`.
 */
function extractBackgroundColorLuminances(value: string): number[] {
  const cleaned = stripImportant(value);
  if (!cleaned) return [];
  const direct = parseColorLuminance(cleaned);
  if (direct !== null) return [direct];

  // Strip url(...) so filenames do not look like colour keywords.
  const withoutUrls = cleaned.replace(/url\s*\([^)]*\)/gi, " ");
  const tokens = withoutUrls.match(/(?:rgba?|hsla?)\([^)]+\)|#[0-9a-f]{3,8}\b|\b[a-z]{3,24}\b/gi) ?? [];
  const luminances: number[] = [];
  for (const token of tokens) {
    const luminance = parseColorLuminance(token);
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
          // `html[data-theme="dark"] > body` cannot stay a direct-child combinator
          // for `.noctua-email-content`, which sits inside wrapper divs.
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

function rewriteSelectorForTheme(
  selector: string,
  theme: "dark" | "light",
  contentClass: string
): string[] {
  const trimmed = selector.trim();
  if (!trimmed) return [];
  const themeRoot = `html[data-theme="${theme}"]`;
  const leadingRoot = /^(?:html|:root)(?=$|[\s>+~.#[:])/i.exec(trimmed);
  const prefixed = leadingRoot
    ? `${themeRoot}${trimmed.slice(leadingRoot[0].length)}`
    : `${themeRoot} ${trimmed}`;

  const results = [prefixed];
  const mirrored = mirrorBodySelector(prefixed, contentClass, true);
  if (mirrored && mirrored !== prefixed) {
    results.push(mirrored);
  }
  return results;
}

const PREFERS_COLOR_SCHEME_FEATURE = /\(\s*prefers-color-scheme\s*:\s*(dark|light)\s*\)/gi;

function evaluateMediaQueryForTheme(
  query: string,
  theme: "dark" | "light"
): { kind: "untouched" | "drop" | "match"; remaining: string; scheme?: "dark" | "light" } {
  const matches = [...query.matchAll(PREFERS_COLOR_SCHEME_FEATURE)];
  if (matches.length === 0) return { kind: "untouched", remaining: query };

  const schemes = matches.map((m) => m[1].toLowerCase() as "dark" | "light");
  const isNegated = /^\s*not\s+/i.test(query);

  // Every prefers-color-scheme feature in an AND-conjunction must agree with the active theme.
  const satisfied = isNegated
    ? !schemes.every((scheme) => scheme === theme)
    : schemes.every((scheme) => scheme === theme);

  const primaryScheme = schemes[0];
  if (!satisfied) {
    return { kind: "drop", remaining: "", scheme: primaryScheme };
  }

  // Strip the satisfied prefers-color-scheme clauses and clean dangling `and` / bare media types.
  let remaining = query.replace(PREFERS_COLOR_SCHEME_FEATURE, "");
  remaining = remaining
    .replace(/\band\s+and\b/gi, "and")
    .replace(/^\s*(?:(?:only\s+)?(?:all|screen)\s+)?and\s+/i, (prefix) =>
      /\bscreen\b/i.test(prefix) ? "screen and " : ""
    )
    .replace(/\s+and\s*$/i, "")
    .replace(/^\s*not\s*$/i, "")
    .trim();

  if (/^(?:only\s+)?(?:all|screen)$/i.test(remaining)) {
    remaining = "";
  }
  return { kind: "match", remaining, scheme: primaryScheme };
}

const VISUAL_THEME_DECLARATION = /^(?:color|background(?:-.*)?|border(?:-.*)?|outline(?:-.*)?|fill|stroke|opacity|filter|color-scheme|--.+)$/i;

function hasVisualDeclarations(container: AtRule): boolean {
  let found = false;
  container.walkDecls((decl) => {
    if (VISUAL_THEME_DECLARATION.test(decl.prop.trim())) {
      found = true;
      return false;
    }
    return undefined;
  });
  return found;
}

function rewriteRulesInContainer(
  container: AtRule,
  theme: "dark" | "light",
  contentClass: string
) {
  container.walkRules((rule: Rule) => {
    // Do not touch @keyframes stop selectors (`from`, `to`, `50%`).
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

export type RewrittenEmailStyles = {
  baseCss: string;
  themeCss: string;
  hasDarkSchemeRules: boolean;
  hasLightSchemeRules: boolean;
};

/**
 * Rewrites sender CSS for Noctua's iframe theme:
 * - Parses `@media (prefers-color-scheme: dark|light)` via PostCSS regardless
 *   of whitespace (`prefers-color-scheme:dark`) or combined conditions
 *   (`(prefers-color-scheme: dark) and (max-width: 600px)`).
 * - Maps `html` / `:root` onto `html[data-theme="..."]` instead of invalid
 *   descendant selectors.
 * - Mirrors `body` rules onto `.${contentClass}` so dark-mode overrides beat
 *   the email's copied `<body style="background-color: #fff">` and match
 *   `body.class` / `body#id` / `body > ...`.
 */
export function rewriteEmailStylesForTheme(
  css: string,
  theme: "dark" | "light",
  contentClass: string
): RewrittenEmailStyles {
  if (!css.trim()) {
    return { baseCss: css, themeCss: "", hasDarkSchemeRules: false, hasLightSchemeRules: false };
  }

  let root: postcss.Root;
  try {
    root = postcss.parse(css);
  } catch {
    return { baseCss: css, themeCss: "", hasDarkSchemeRules: false, hasLightSchemeRules: false };
  }

  let hasDarkSchemeRules = false;
  let hasLightSchemeRules = false;
  const themeChunks: string[] = [];

  root.walkAtRules(/^media$/i, (atRule: AtRule) => {
    const queries = splitTopLevelCommas(atRule.params);
    const untouchedQueries: string[] = [];
    const matchedRemainders: string[] = [];
    let sawDark = false;
    let sawLight = false;
    let touched = false;

    for (const query of queries) {
      const result = evaluateMediaQueryForTheme(query, theme);
      if (result.scheme === "dark") sawDark = true;
      if (result.scheme === "light") sawLight = true;
      if (result.kind === "untouched") {
        untouchedQueries.push(query);
      } else {
        touched = true;
        if (result.kind === "match") {
          matchedRemainders.push(result.remaining);
        }
      }
    }

    if (!touched) return;

    const visual = hasVisualDeclarations(atRule);
    if (visual && sawDark) hasDarkSchemeRules = true;
    if (visual && sawLight) hasLightSchemeRules = true;

    if (matchedRemainders.length > 0) {
      const cloned = atRule.clone();
      rewriteRulesInContainer(cloned, theme, contentClass);
      const unconditional = matchedRemainders.some((part) => part === "");
      if (unconditional) {
        const inner = cloned.nodes?.map((node) => node.toString()).join("\n") ?? "";
        if (inner.trim()) themeChunks.push(inner);
      } else {
        cloned.params = matchedRemainders.join(", ");
        themeChunks.push(cloned.toString());
      }
    }

    if (untouchedQueries.length > 0) {
      atRule.params = untouchedQueries.join(", ");
    } else {
      atRule.remove();
    }
  });

  mirrorQualifiedBodySelectorsInBase(root, contentClass);

  return {
    baseCss: root.toString(),
    themeCss: themeChunks.join("\n"),
    hasDarkSchemeRules,
    hasLightSchemeRules
  };
}

export type EmailColorAnalysis = {
  hasExplicitColor: boolean;
  hasLightOwnBackground: boolean;
  hasDarkOwnBackground: boolean;
  hasDarkOwnText: boolean;
};

function isAnchorOnlySelector(selector: string): boolean {
  const parts = splitTopLevelCommas(selector);
  return parts.length > 0 && parts.every((part) => /^a(?=$|[:.#[])/i.test(part.trim()));
}

function inspectStyleDeclarations(
  decls: Declaration[],
  isAnchorOnly: boolean,
  analysis: EmailColorAnalysis
) {
  for (const decl of decls) {
    const prop = decl.prop.trim().toLowerCase();
    const value = decl.value.trim();
    if (!value) continue;

    if (prop === "color") {
      const luminance = parseColorLuminance(value);
      if (luminance !== null) {
        analysis.hasExplicitColor = true;
        if (!isAnchorOnly && luminance < DARK_LUMINANCE_THRESHOLD) {
          analysis.hasDarkOwnText = true;
        }
      } else if (!NON_COLOR_KEYWORDS.has(stripImportant(value).toLowerCase())) {
        analysis.hasExplicitColor = true;
      }
      continue;
    }

    if (prop === "background" || prop === "background-color") {
      const cleaned = stripImportant(value).toLowerCase();
      if (NON_COLOR_KEYWORDS.has(cleaned)) continue;
      const luminances = extractBackgroundColorLuminances(value);
      for (const luminance of luminances) {
        if (luminance < DARK_LUMINANCE_THRESHOLD) analysis.hasDarkOwnBackground = true;
        else analysis.hasLightOwnBackground = true;
      }
    }
  }
}

/**
 * Inspects only `<style>` blocks (excluding `prefers-color-scheme` blocks) and
 * HTML tag attributes — never visible prose — to determine what colours and
 * backgrounds the sender's base markup declares.
 */
export function analyzeEmailColorScheme(
  cleanedHtml: string,
  bodyBgcolor = ""
): EmailColorAnalysis {
  const analysis: EmailColorAnalysis = {
    hasExplicitColor: false,
    hasLightOwnBackground: false,
    hasDarkOwnBackground: false,
    hasDarkOwnText: false
  };

  if (bodyBgcolor) {
    const bodyBgLuminance = parseColorLuminance(bodyBgcolor);
    if (bodyBgLuminance !== null) {
      if (bodyBgLuminance < DARK_LUMINANCE_THRESHOLD) analysis.hasDarkOwnBackground = true;
      else analysis.hasLightOwnBackground = true;
    }
  }

  // 1. Inspect <style> blocks (excluding prefers-color-scheme media blocks so
  //    dark-mode overrides do not masquerade as base light/dark colours).
  for (const match of cleanedHtml.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) {
    const css = match[1];
    if (!css.trim()) continue;
    try {
      const root = postcss.parse(css);
      root.walkAtRules(/^media$/i, (atRule) => {
        if (/prefers-color-scheme/i.test(atRule.params)) atRule.remove();
      });
      root.walkRules((rule) => {
        const decls: Declaration[] = [];
        rule.each((node) => {
          if (node.type === "decl") decls.push(node);
        });
        inspectStyleDeclarations(decls, isAnchorOnlySelector(rule.selector), analysis);
      });
    } catch {
      // Malformed CSS blocks are ignored here; inline tags below still run.
    }
  }

  // 2. Inspect HTML opening tags only (never visible text nodes).
  const withoutStyles = cleanedHtml.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "");
  const tags = withoutStyles.match(/<[a-z][\w:-]*(?:"[^"]*"|'[^']*'|[^'">])*>/gi) ?? [];
  for (const tag of tags) {
    const tagName = /^<([a-z][\w:-]*)/i.exec(tag)?.[1]?.toLowerCase() ?? "";
    const isAnchor = tagName === "a";

    const bgcolorMatch = /\bbgcolor\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(tag);
    if (bgcolorMatch) {
      const raw = (bgcolorMatch[1] ?? bgcolorMatch[2] ?? bgcolorMatch[3] ?? "").trim();
      if (raw && !NON_COLOR_KEYWORDS.has(raw.toLowerCase())) {
        const luminance = parseColorLuminance(raw);
        if (luminance !== null && luminance < DARK_LUMINANCE_THRESHOLD) {
          analysis.hasDarkOwnBackground = true;
        } else {
          analysis.hasLightOwnBackground = true;
        }
      }
    }

    // Legacy HTML `background="paper.png"` attribute.
    if (/\bbackground\s*=/i.test(tag)) {
      analysis.hasLightOwnBackground = true;
    }

    // Legacy `<font color="#222">` attribute.
    if (tagName === "font") {
      const colorAttr = /\bcolor\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(tag);
      const raw = (colorAttr?.[1] ?? colorAttr?.[2] ?? colorAttr?.[3] ?? "").trim();
      if (raw && !NON_COLOR_KEYWORDS.has(raw.toLowerCase())) {
        analysis.hasExplicitColor = true;
        const luminance = parseColorLuminance(raw);
        if (luminance !== null && luminance < DARK_LUMINANCE_THRESHOLD) {
          analysis.hasDarkOwnText = true;
        }
      }
    }

    const styleMatch = /\bstyle\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(tag);
    const inlineCss = styleMatch?.[1] ?? styleMatch?.[2] ?? "";
    if (inlineCss.trim()) {
      try {
        const inlineRoot = postcss.parse(`x{${inlineCss}}`);
        const decls: Declaration[] = [];
        inlineRoot.walkDecls((decl) => {
          decls.push(decl);
        });
        inspectStyleDeclarations(decls, isAnchor, analysis);
      } catch {
        // Ignore unparseable inline style snippets.
      }
    }
  }

  return analysis;
}
