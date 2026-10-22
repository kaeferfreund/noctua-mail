import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/postcss";
import postcss, { type AtRule, type Node, type Root, type Rule } from "postcss";
import { APP_THEME_COLOR } from "@/lib/ui/theme";
import { APP_FONT_FAMILY, APP_FONT_URL } from "@/lib/ui/fonts";

// Compiles app/globals.css the way `next build` does (postcss.config.mjs) and
// checks the cascade-layer contract from doc/TEAM-INBOX.md §7.1.

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const globalsPath = path.join(repoRoot, "app", "globals.css");
const LAYER_ORDER = ["theme", "base", "radix", "legacy", "components", "utilities"];
// Tailwind declares its own `properties` layer (fallbacks for registered
// custom properties) ahead of everything else; it only sets custom properties.
const TAILWIND_PROPERTIES_LAYER = "properties";
const COMPILE_TIMEOUT_MS = 60_000;

let compiledPromise: Promise<Root> | null = null;
function compileGlobals() {
  compiledPromise ??= (async () => {
    const source = readFileSync(globalsPath, "utf8");
    const result = await postcss([tailwindcss({ base: repoRoot })]).process(source, {
      from: globalsPath
    });
    return postcss.parse(result.css);
  })();
  return compiledPromise;
}

function isAtRule(node: Node): node is AtRule {
  return node.type === "atrule";
}

function ancestors(node: Node) {
  const result: Node[] = [];
  for (let parent = node.parent; parent && parent.type !== "root"; parent = parent.parent) {
    result.push(parent);
  }
  return result;
}

// Dotted name of the layer(s) a node sits in, or null when unlayered.
function enclosingLayer(node: Node): string | null {
  const names = ancestors(node)
    .filter((parent) => isAtRule(parent) && parent.name === "layer")
    .map((parent) => (parent as AtRule).params)
    .reverse();
  return names.length ? names.join(".") : null;
}

// Keyframe steps and nested rules (`&:hover` inside a utility) are scoped by
// their parent and are not selectors of their own.
function isScopedByParent(rule: Rule) {
  return ancestors(rule).some(
    (parent) => parent.type === "rule" || (isAtRule(parent) && parent.name.endsWith("keyframes"))
  );
}

function rulesWithSelector(root: Root, selector: string) {
  const rules: Rule[] = [];
  root.walkRules((rule) => {
    if (rule.selectors.includes(selector)) rules.push(rule);
  });
  return rules;
}

// Cascade-layer order as the browser derives it: first appearance of each
// top-level layer name, in statements and blocks alike.
function effectiveLayerOrder(root: Root) {
  const order: string[] = [];
  root.walkAtRules("layer", (atRule) => {
    if (enclosingLayer(atRule) !== null) return;
    for (const name of atRule.params.split(",").map((part) => part.trim())) {
      if (name && !order.includes(name)) order.push(name);
    }
  });
  return order;
}

function listSourceFiles(dir: string) {
  return readdirSync(path.join(repoRoot, dir), { recursive: true, encoding: "utf8" })
    .filter((file) => /\.(css|ts|tsx)$/.test(file))
    .map((file) => path.join(dir, file));
}

describe("app/globals.css cascade layers", () => {
  test(
    "declares theme, base, radix, legacy, components, utilities in that order",
    async () => {
      const root = await compileGlobals();
      const order = effectiveLayerOrder(root);
      expect(order.filter((name) => name !== TAILWIND_PROPERTIES_LAYER)).toEqual(LAYER_ORDER);
      root.walkRules((rule) => {
        if (enclosingLayer(rule) !== TAILWIND_PROPERTIES_LAYER) return;
        rule.walkDecls((decl) => {
          expect(decl.prop.startsWith("--")).toBe(true);
        });
      });
    },
    COMPILE_TIMEOUT_MS
  );

  test(
    "keeps the Radix dialog overlay lift at z-index 9995 and poppers at 9998",
    async () => {
      const root = await compileGlobals();
      const zIndexFor = (selector: string) =>
        rulesWithSelector(root, selector).flatMap((rule) => {
          const values: Array<{ layer: string | null; value: string }> = [];
          rule.walkDecls("z-index", (decl) => {
            values.push({ layer: enclosingLayer(rule), value: decl.value });
          });
          return values;
        });
      expect(zIndexFor(".rt-BaseDialogOverlay")).toEqual([{ layer: "legacy", value: "9995" }]);
      expect(zIndexFor(".rt-PopperContent")).toEqual([{ layer: "legacy", value: "9998" }]);
      // Radix Themes itself is layered below legacy, so the lift wins.
      expect(rulesWithSelector(root, ".rt-BaseDialogOverlay").map(enclosingLayer)).toContain(
        "radix"
      );
    },
    COMPILE_TIMEOUT_MS
  );

  test(
    "loads no preflight and keeps element selectors out of the shared layers",
    async () => {
      const root = await compileGlobals();
      const offending: string[] = [];
      root.walkRules((rule) => {
        if (isScopedByParent(rule)) return;
        const layer = enclosingLayer(rule);
        // Radix Themes and the upstream legacy rules are imported as they were.
        if (layer === "radix" || layer === "legacy" || layer === TAILWIND_PROPERTIES_LAYER) return;
        for (const selector of rule.selectors) {
          if (!/^[.:[]/.test(selector.trim())) offending.push(`${layer ?? "unlayered"}: ${selector}`);
        }
      });
      expect(offending).toEqual([]);

      const baseSelectors: string[] = [];
      root.walkRules((rule) => {
        if (enclosingLayer(rule) === "base") baseSelectors.push(...rule.selectors);
      });
      // The base layer only holds the reset scoped to the new shell and the
      // shadcn elements; nothing reaches the editor or markdown surfaces.
      expect(baseSelectors.length).toBeGreaterThan(0);
      expect(baseSelectors.filter((selector) => !/\[data-(shell|slot)\]/.test(selector))).toEqual(
        []
      );
    },
    COMPILE_TIMEOUT_MS
  );

  test(
    "leaves only the token blocks unlayered",
    async () => {
      const root = await compileGlobals();
      const unlayered = new Set<string>();
      root.walkRules((rule) => {
        if (!isScopedByParent(rule) && enclosingLayer(rule) === null) {
          unlayered.add(rule.selector);
        }
      });
      // .shimmer comes from shadcn/tailwind.css (reduced-motion override).
      expect([...unlayered].sort()).toEqual([".dark", ".radix-themes", ".shimmer", ":root"]);
    },
    COMPILE_TIMEOUT_MS
  );

  test(
    "emits the font and radius theme variables CSS modules depend on",
    async () => {
      const root = await compileGlobals();
      const themeVars = new Map<string, string>();
      root.walkDecls((decl) => {
        if (decl.prop.startsWith("--") && enclosingLayer(decl) === "theme") {
          themeVars.set(decl.prop, decl.value);
        }
      });
      expect(themeVars.get("--font-sans")).toStartWith(`"${APP_FONT_FAMILY}"`);
      expect(themeVars.get("--radius-sm")).toBe("calc(var(--radius) - 4px)");
      expect(themeVars.get("--radius-md")).toBe("calc(var(--radius) - 2px)");
      expect(themeVars.get("--radius-lg")).toBe("var(--radius)");

      const legacyRadius: string[] = [];
      root.walkDecls(/^--radius-(sm|md|lg)$/, (decl) => {
        if (enclosingLayer(decl) !== "theme") legacyRadius.push(decl.prop);
      });
      expect(legacyRadius).toEqual([]);
    },
    COMPILE_TIMEOUT_MS
  );

  test(
    "declares the vendored Inter face that HtmlMessage injects",
    async () => {
      const root = await compileGlobals();
      const faces: Array<Record<string, string>> = [];
      root.walkAtRules("font-face", (atRule) => {
        const face: Record<string, string> = {};
        atRule.walkDecls((decl) => {
          face[decl.prop] = decl.value;
        });
        faces.push(face);
      });
      // Radix Themes brings its own local() faces; the app declares one.
      const appFaces = faces.filter((face) => face["font-family"] === `"${APP_FONT_FAMILY}"`);
      expect(appFaces).toHaveLength(1);
      expect(appFaces[0].src).toBe(`url("${APP_FONT_URL}") format("woff2")`);

      const font = readFileSync(path.join(repoRoot, "public", APP_FONT_URL));
      expect(font.subarray(0, 4).toString("latin1")).toBe("wOF2");
    },
    COMPILE_TIMEOUT_MS
  );
});

describe("legacy token codemod", () => {
  // Upstream code reads var(--muted) as a text colour and var(--accent) as the
  // link colour. Both names now carry their shadcn meaning (background fills),
  // so merged upstream code must be rewritten to --muted-foreground / --link.
  // Code that wants the shadcn fills outside app/components/ui uses the
  // Tailwind classes or var(--color-muted) / var(--color-accent). The Radix
  // scale steps --accent-N / --accent-aN are unaffected.
  test("no legacy surface reads var(--muted) or var(--accent)", () => {
    const offending: string[] = [];
    const generatedUi = path.join("app", "components", "ui") + path.sep;
    for (const file of [...listSourceFiles("app"), ...listSourceFiles("lib")]) {
      if (file === path.join("app", "globals.test.ts") || file.startsWith(generatedUi)) continue;
      const lines = readFileSync(path.join(repoRoot, file), "utf8").split("\n");
      lines.forEach((line, index) => {
        // The @theme mapping in globals.css is the one legitimate reader.
        if (/var\(--(muted|accent)\s*[,)]/.test(line) && !/^\s*--color-(muted|accent):/.test(line)) {
          offending.push(`${file}:${index + 1}`);
        }
      });
    }
    expect(offending).toEqual([]);
  });
});

describe("shell palette", () => {
  test("uses neutral surfaces and an accessible iris primary", async () => {
    const root = await compileGlobals();
    const tokens = (selector: string) => {
      const values = new Map<string, string>();
      for (const rule of rulesWithSelector(root, selector)) {
        if (enclosingLayer(rule) !== null) continue;
        rule.walkDecls((decl) => { values.set(decl.prop, decl.value); });
      }
      return values;
    };
    const light = tokens(":root");
    expect(light.get("--background")).toBe("#fff");
    expect(light.get("--card")).toBe("#fff");
    expect(light.get("--primary")).toBe("var(--iris-9)");
    expect(light.get("--border")).toBe("var(--gray-6)");
    expect(light.get("--sidebar")).toBe("var(--gray-2)");
    expect(tokens(".dark").get("--border")).toBe("rgb(255 255 255 / 10%)");
    const radixSource = readFileSync(path.join(repoRoot, "node_modules/@radix-ui/themes/styles.css"), "utf8");
    expect(radixSource.match(/--iris-9: (#[0-9a-f]+);/)?.[1]).toBe(APP_THEME_COLOR);
    const channels = [1, 3, 5].map((offset) => parseInt(APP_THEME_COLOR.slice(offset, offset + 2), 16) / 255);
    const luminance = channels.reduce((sum, c, i) => sum + [0.2126, 0.7152, 0.0722][i] *
      (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4), 0);
    expect(1.05 / (luminance + 0.05)).toBeGreaterThanOrEqual(4.5);
  }, COMPILE_TIMEOUT_MS);
});
