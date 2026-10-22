import { decodeHTMLAttribute } from "entities";

// Consume CSS strings, comments, URLs and identifiers as whole tokens so a
// viewport-looking substring in a filename or class never becomes a length.
const CSS_ESCAPE = String.raw`\\(?:[0-9a-f]{1,6}(?:\r\n|[ \t\n\r\f])?|[^\n\r\f])`;
const CSS_NAME = String.raw`(?:[\w\u0080-\uffff-]|${CSS_ESCAPE})+`;
const CSS_NUMBER = String.raw`[+-]?(?:\d*\.\d+|\d+\.?\d*)(?:e[+-]?\d+)?`;
const CSS_STRING = String.raw`"(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\])*'`;
const CSS_TOKEN = new RegExp([
  String.raw`\/\*[\s\S]*?(?:\*\/|$)`,
  CSS_STRING,
  String.raw`url\(\s*(?:${CSS_STRING}|(?:\\[\s\S]|[^)\\])*)\s*\)`,
  `${CSS_NUMBER}(?:${CSS_NAME})?`,
  String.raw`(?:--|-?[a-z_\u0080-\uffff]|${CSS_ESCAPE})(?:${CSS_NAME})?`,
  `#${CSS_NAME}`
].join("|"), "gi");
const VIEWPORT_LENGTH = /^([+-]?(?:\d*\.\d+|\d+\.?\d*)(?:e[+-]?\d+)?)([sld]?v(?:h|b|min|max))$/i;

export function rewriteViewportHeightUnits(css: string) {
  return css.replace(CSS_TOKEN, (token) => {
    const length = VIEWPORT_LENGTH.exec(token);
    if (!length) return token;
    const [, amount, unit] = length;
    const axis = /min$/i.test(unit)
      ? "min(var(--noctua-vh), 1vw)"
      : /max$/i.test(unit)
        ? "max(var(--noctua-vh), 1vw)"
        : "var(--noctua-vh)";
    return `calc(${amount} * ${axis})`;
  });
}

// Preserve markup verbatim: only style blocks and actual style attributes are
// CSS; text, class names, links and data attributes must keep their contents.
// Each tag character fits exactly one branch and an unterminated quote or tag
// runs to the end instead of failing, so a malformed tag cannot backtrack
// exponentially; the attribute pass below does the actual parsing.
export function rewriteHtmlViewportHeightUnits(html: string) {
  return html.replace(
    /<!--[\s\S]*?-->|<style\b[^>]*>[\s\S]*?<\/style\s*>|<[a-z][\w:-]*(?:"[^"]*(?:"|$)|'[^']*(?:'|$)|[^'">])*(?:>|$)/gi,
    (tag) => {
      if (tag.startsWith("<!--")) return tag;
      if (/^<style\b/i.test(tag)) {
        return tag.replace(/(>)([\s\S]*)(<\/style\s*>$)/i, (_, open, css, close) =>
          `${open}${rewriteViewportHeightUnits(css)}${close}`
        );
      }
      return tag.replace(
        /(\s+)([^\s=/>]+)(\s*=\s*)("[^"]*"|'[^']*'|[^\s>]+)/g,
        (attribute, space, name, equals, value: string) => {
          if (name.toLowerCase() !== "style") return attribute;
          const quote = /^["']/.test(value) ? value[0] : "";
          const css = decodeHTMLAttribute(quote ? value.slice(1, -1) : value);
          const rewritten = rewriteViewportHeightUnits(css);
          if (rewritten === css) return attribute;
          const delimiter = quote || '"';
          const escaped = rewritten.replace(/&/g, "&amp;")
            .replace(delimiter === '"' ? /"/g : /'/g, delimiter === '"' ? "&quot;" : "&#39;");
          return `${space}${name}${equals}${delimiter}${escaped}${delimiter}`;
        }
      );
    }
  );
}

export function stripBodyHeightStyles(style: string) {
  // Semicolons inside strings/functions aren't declaration boundaries.
  const boundaries = /\/\*[\s\S]*?(?:\*\/|$)|"(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\])*'|[();]/g;
  let depth = 0;
  let start = 0;
  let output = "";
  const keepDeclaration = (declaration: string) => {
    const withoutComments = declaration.replace(/\/\*[\s\S]*?\*\//g, "");
    return !/^\s*(?:height|min-height|max-height)\s*:/i.test(withoutComments);
  };
  for (const token of style.matchAll(boundaries)) {
    if (token[0] === "(") depth += 1;
    if (token[0] === ")") depth = Math.max(0, depth - 1);
    if (token[0] !== ";" || depth > 0) continue;
    const end = token.index + 1;
    const declaration = style.slice(start, end);
    if (keepDeclaration(declaration)) output += declaration;
    start = end;
  }
  const last = style.slice(start);
  return output + (keepDeclaration(last) ? last : "");
}
