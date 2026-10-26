import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/postcss";
import postcss, { type AtRule, type Node, type Root, type Rule } from "postcss";
import { APP_THEME_COLOR } from "@/lib/ui/theme";
import { APP_FONT_STACK } from "@/lib/ui/fonts";
import { DIALOG_LAYERS } from "@/app/components/ui/dialogLayers";

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
// Unlayered :root --layer-* declarations, in source order.
function layerTokens(root: Root) {
  const tokens: Record<string, number> = {};
  root.walkRules((rule) => {
    if (rule.selector !== ":root" || enclosingLayer(rule) !== null) return;
    rule.walkDecls(/^--layer-/, (decl) => { tokens[decl.prop] = Number(decl.value); });
  });
  return tokens;
}

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
    "keeps the layer token ladder, the Radix dialog overlay lift at 9995 and poppers at 9998",
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
      const tokens = layerTokens(root);
      expect(tokens).toEqual({ "--layer-floating": 9990, "--layer-dialog": 9994,
        "--layer-dialog-overlay": 9995, "--layer-popper": 9998, "--layer-drag-ghost": 9999,
        "--layer-status-bar": 10000 });
      // The ladder is strictly ascending, and the JS mirror used for nested
      // dialog arithmetic stays on the same values.
      const order = Object.values(tokens);
      expect(order).toEqual([...order].sort((a, b) => a - b));
      expect(tokens["--layer-dialog"]).toBe(DIALOG_LAYERS.base);
      expect(tokens["--layer-dialog-overlay"]).toBe(DIALOG_LAYERS.settings);
      expect(DIALOG_LAYERS.settings + 2 * DIALOG_LAYERS.step).toBeLessThan(tokens["--layer-popper"]);
      expect(zIndexFor(".rt-BaseDialogOverlay")).toEqual([{ layer: "legacy", value: "var(--layer-dialog-overlay)" }]);
      expect(zIndexFor(".rt-PopperContent")).toEqual([{ layer: "legacy", value: "var(--layer-popper)" }]);
      expect(zIndexFor(".drag-ghost")).toEqual([{ layer: "legacy", value: "var(--layer-drag-ghost)" }]);
      // The band under the iOS status bar covers every other layer.
      expect(zIndexFor("body::before")).toEqual([{ layer: "legacy", value: "var(--layer-status-bar)" }]);
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
      expect([...unlayered].sort()).toEqual([".dark", ".radix-themes", ".shimmer", ":root", ":root[data-ios-standalone]"]);
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
      expect(themeVars.get("--font-sans")).toBe(APP_FONT_STACK);
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
    "uses the platform UI font without loading a webfont",
    async () => {
      const root = await compileGlobals();
      // Radix Themes brings its own local() faces; the app declares none.
      const appFaces: string[] = [];
      root.walkAtRules("font-face", (atRule) => {
        atRule.walkDecls("src", (decl) => {
          if (/url\(/.test(decl.value)) appFaces.push(decl.value);
        });
      });
      expect(appFaces).toEqual([]);
      expect(APP_FONT_STACK).toStartWith("-apple-system, BlinkMacSystemFont,");
    },
    COMPILE_TIMEOUT_MS
  );
});

describe("app chrome typography", () => {
  test(
    "routes Radix and native controls through the sans and mono tokens",
    async () => {
      const root = await compileGlobals();
      const themeVars = new Map<string, string>();
      root.walkDecls((decl) => {
        if (decl.prop.startsWith("--") && enclosingLayer(decl) === "theme") themeVars.set(decl.prop, decl.value);
      });
      expect(themeVars.get("--font-mono")).toStartWith("ui-monospace,");
      // One step above Tailwind's defaults: 12 / 13 / 15 (body) / 17px.
      expect(themeVars.get("--text-2xs")).toBe("0.75rem");
      expect(themeVars.get("--text-xs")).toBe("0.8125rem");
      expect(themeVars.get("--text-sm")).toBe("0.9375rem");
      expect(themeVars.get("--text-base")).toBe("1.0625rem");
      expect(themeVars.get("--tracking-caps")).toBe("0.06em");

      const radix = new Map<string, string>();
      for (const rule of rulesWithSelector(root, ".radix-themes")) {
        if (enclosingLayer(rule) === null) rule.walkDecls((decl) => { radix.set(decl.prop, decl.value); });
      }
      // Radix defaults: system UI font, Times for <Em>/<Quote>, Menlo for <Code>.
      expect(radix.get("--default-font-family")).toBe("var(--font-sans)");
      expect(radix.get("--em-font-family")).toBe("var(--font-sans)");
      expect(radix.get("--quote-font-family")).toBe("var(--font-sans)");
      expect(radix.get("--code-font-family")).toBe("var(--font-mono)");
      // Radix text sizes 1-3 follow the same step as --text-xs/sm/base.
      expect(radix.get("--font-size-1")).toBe("calc(13px * var(--scaling))");
      expect(radix.get("--font-size-2")).toBe("calc(15px * var(--scaling))");
      expect(radix.get("--font-size-3")).toBe("calc(17px * var(--scaling))");

      // Tailwind runs without preflight: native controls must inherit the
      // family, and the body must not add tracking that only portalled menus
      // (outside .radix-themes) would inherit.
      const legacy = (selector: string, prop: string) =>
        rulesWithSelector(root, selector)
          .filter((rule) => enclosingLayer(rule) === "legacy")
          .flatMap((rule) => rule.nodes.filter((node) => node.type === "decl" && node.prop === prop))
          .map((decl) => (decl as { value: string }).value);
      for (const control of ["button", "input", "select", "textarea"]) {
        expect(legacy(control, "font-family")).toContain("inherit");
      }
      expect(legacy("body", "font-family")).toEqual(["var(--font-sans)"]);
      expect(legacy("body", "letter-spacing")).toEqual([]);
    },
    COMPILE_TIMEOUT_MS
  );

  test("app code names fonts only through the tokens", () => {
    // The e-mail iframe (HtmlMessage) and SVG images rendered outside the
    // document (logo route, sender icons) cannot load the app's font face,
    // and neither can the HTML of sent markdown mails (markdownEmail).
    const exempt = new Set([
      path.join("app", "globals.test.ts"),
      path.join("app", "components", "HtmlMessage.tsx"),
      path.join("app", "icons", "logo.svg", "route.ts"),
      path.join("lib", "markdownEmail.ts"),
      path.join("lib", "senderIcons.ts"),
      path.join("lib", "ui", "fonts.ts")
    ]);
    // Synthetic mail fixtures are e-mail HTML, which renders in the iframe too.
    const exemptDirs = [path.join("lib", "testFixtures") + path.sep];
    const allowed = /^(var\(--font-(sans|mono)\)|inherit)(\s*!important)?$/;
    const offending: string[] = [];
    for (const file of [...listSourceFiles("app"), ...listSourceFiles("lib")]) {
      if (exempt.has(file) || file.endsWith(".test.ts") || file.endsWith(".test.tsx")) continue;
      if (exemptDirs.some((dir) => file.startsWith(dir))) continue;
      const source = readFileSync(path.join(repoRoot, file), "utf8");
      const values = [
        ...source.matchAll(/(?:font-family|fontFamily)\s*:\s*["'`]?([^;"'`}\n]+)/g)
      ].map((match) => match[1].trim().replace(/,$/, ""));
      for (const value of values) {
        if (!allowed.test(value)) offending.push(`${file}: ${value}`);
      }
    }
    expect(offending).toEqual([]);
  });
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


// WCAG relative luminance for the installed sRGB Radix scales. For a neutral
// OKLCH surface, relative luminance is L^3 (no chroma conversion needed).
function hexLuminance(hex: string) {
  const channels = [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255);
  return channels.reduce((sum, c, i) => sum + [0.2126, 0.7152, 0.0722][i] *
    (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4), 0);
}
function contrast(a: number, b: number) {
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

describe("shell accessibility regressions", () => {
  test("caps the search popover to Radix available height without shrinking filter groups", async () => {
    const root = await compileGlobals();
    const source = readFileSync(path.join(repoRoot, "app/components/shell/ShellSearch.tsx"), "utf8");
    // Check emitted CSS as well as the consumer: a misspelled Tailwind class
    // would leave a DOM class present while the browser still overflows.
    expect(source).toContain("max-h-(--radix-popover-content-available-height)");
    expect(source).toContain("overflow-y-auto");
    expect(source).toContain('className="m-0 min-w-0 shrink-0 border-0 p-0"');
    const maxHeights: string[] = [];
    root.walkDecls("max-height", (decl) => { maxHeights.push(decl.value); });
    expect(maxHeights).toContain("var(--radix-popover-content-available-height)");
  }, COMPILE_TIMEOUT_MS);

  test("uses opaque focus indicators with at least 3:1 contrast on both themes", async () => {
    const root = await compileGlobals();
    const radix = readFileSync(path.join(repoRoot, "node_modules/@radix-ui/themes/styles.css"), "utf8");
    const scale = (token: string, dark: boolean) => {
      const colors = [...radix.matchAll(new RegExp(`${token}: (#[0-9a-f]+);`, "g"))];
      return hexLuminance(colors[dark ? 1 : 0][1]);
    };
    for (const [selector, token, dark] of [[":root", "--iris-9", false], [".dark", "--iris-11", true]] as const) {
      const values = new Map<string, string>();
      for (const rule of rulesWithSelector(root, selector).filter((rule) => enclosingLayer(rule) === null)) {
        rule.walkDecls((decl) => { values.set(decl.prop, decl.value); });
      }
      expect(values.get("--ring")).toBe(`var(${token})`);
      expect(values.get("--sidebar-ring")).toBe("var(--ring)");
      const surfaces = dark
        ? [0.145 ** 3, 0.205 ** 3, scale("--gray-4", true), scale("--gray-5", true), scale("--iris-4", true)]
        : [1, scale("--gray-2", false), scale("--gray-3", false), scale("--gray-4", false), scale("--iris-3", false)];
      for (const surface of surfaces) {
        expect(contrast(scale(token, dark), surface)).toBeGreaterThanOrEqual(3);
        expect(contrast(scale("--red-9", dark), surface)).toBeGreaterThanOrEqual(3);
      }
    }
    const bridges = rulesWithSelector(root, ".radix-themes [data-accent-color]");
    expect(bridges).toHaveLength(1);
    expect(bridges[0].nodes.some((node) => node.type === "decl" && node.prop === "--focus-8" && node.value === "var(--ring)")).toBe(true);
    const softFocus = rulesWithSelector(root, ".radix-themes .rt-BaseButton:where(:focus-visible)");
    expect(softFocus).toHaveLength(1);
    expect(softFocus[0].nodes.some((node) => node.type === "decl" && node.prop === "outline-color" && node.value === "var(--ring)")).toBe(true);
    // A translucent utility would silently undercut the measured token ratios.
    for (const file of listSourceFiles("app/components/ui")) {
      expect(readFileSync(path.join(repoRoot, file), "utf8")).not.toMatch(/ring-(?:(?:sidebar-)?ring|destructive)\//);
    }
  }, COMPILE_TIMEOUT_MS);

  test("dims Topics once through muted-foreground with at least 4.5:1 contrast", async () => {
    const folderCss = postcss.parse(readFileSync(path.join(repoRoot, "app/components/mailclient/folder/FolderTree.module.css"), "utf8"));
    const topicsCss = postcss.parse(readFileSync(path.join(repoRoot, "app/components/mailclient/folder/TopicsSidebarSection.module.css"), "utf8"));
    const title = rulesWithSelector(folderCss, ".panelTitle")[0];
    const declarations = new Map<string, string>();
    title.walkDecls((decl) => { declarations.set(decl.prop, decl.value); });
    expect(declarations.get("color")).toBe("var(--muted-foreground)");
    expect(declarations.has("opacity")).toBe(false);
    for (const rule of rulesWithSelector(topicsCss, ".headerBtn")) {
      const opacity: string[] = [];
      rule.walkDecls("opacity", (decl) => { opacity.push(decl.value); });
      expect(opacity).toEqual([]);
    }
    const radix = readFileSync(path.join(repoRoot, "node_modules/@radix-ui/themes/styles.css"), "utf8");
    const grays = (step: number) => [...radix.matchAll(new RegExp(`--gray-${step}: (#[0-9a-f]+);`, "g"))].map((match) => hexLuminance(match[1]));
    expect(contrast(grays(11)[0], grays(2)[0])).toBeGreaterThanOrEqual(4.5);
    expect(contrast(grays(11)[1], 0.205 ** 3)).toBeGreaterThanOrEqual(4.5);
    expect((await compileGlobals()).toString()).toContain("--muted-foreground: var(--gray-11)");
  }, COMPILE_TIMEOUT_MS);

  test("keeps retained secondary surface buttons neutral in light, dark and hover states", async () => {
    const root = await compileGlobals();
    for (const selector of [
      "[data-shell] :where(.rt-Button.rt-variant-surface, .rt-IconButton.rt-variant-surface)",
      "[data-shell] :where(.rt-Button.rt-variant-surface:hover, .rt-IconButton.rt-variant-surface:hover)",
      ".dark [data-shell] :where(.rt-Button.rt-variant-surface, .rt-IconButton.rt-variant-surface)",
      ".dark [data-shell] :where(.rt-Button.rt-variant-surface:hover, .rt-IconButton.rt-variant-surface:hover)"
    ]) {
      const rules = rulesWithSelector(root, selector);
      expect(rules).toHaveLength(1);
      expect(enclosingLayer(rules[0])).toBe("legacy");
      const declarations: string[] = [];
      rules[0].walkDecls((decl) => { declarations.push(decl.value); });
      expect(declarations.length).toBeGreaterThanOrEqual(2);
      for (const value of declarations) expect(value).toContain("var(--gray-");
    }
  }, COMPILE_TIMEOUT_MS);

  test("removes dead auth selectors including the retired floating error", async () => {
    const root = await compileGlobals();
    const dead = /^\.auth-(?:overlay|modal|header|close|form|grid|error)(?![\w-])/;
    const selectors: string[] = [];
    root.walkRules((rule) => { selectors.push(...rule.selectors); });
    expect(selectors.filter((selector) => dead.test(selector))).toEqual([]);
    expect(rulesWithSelector(root, ".auth-error-floating")).toHaveLength(0);
  }, COMPILE_TIMEOUT_MS);
});
