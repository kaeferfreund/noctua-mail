// Generates the branding proposals: icon SVGs, PNG renders and the standalone
// preview page. Run from the repository root: `bun briefs/branding/build.ts`
// (needs rsvg-convert, the same tool build-scripts/generate_push_icons.sh uses).
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const DIR = "briefs/branding";
const ICON_DIR = join(DIR, "icons");
mkdirSync(ICON_DIR, { recursive: true });

type Variant = {
  id: string;
  title: string;
  note: string;
  from: string;
  to: string;
  /** Gradient vector in objectBoundingBox units. */
  dir: [number, number, number, number];
  /** Envelope box on the 1024 artboard. */
  env: { w: number; h: number; r: number; cy: number };
  /** Depth of the flap apex below the envelope top, as a share of its height. */
  flapDepth: number;
  flapStyle: "line" | "filled";
  lineColor: string;
  bottomFolds?: boolean;
  outline?: string;
  seal?: string;
  shadowOpacity: number;
};

const VARIANTS: Variant[] = [
  {
    id: "v1-klassisch",
    title: "1 · Klassisch",
    note: "Unser Verlauf von oben nach unten, breiter Umschlag, feine graue Klappe.",
    from: "#FFB347",
    to: "#F37335",
    dir: [0, 0, 0, 1],
    env: { w: 660, h: 456, r: 52, cy: 520 },
    flapDepth: 0.56,
    flapStyle: "line",
    lineColor: "#D5D8DF",
    shadowOpacity: 0.28
  },
  {
    id: "v2-diagonal",
    title: "2 · Diagonal",
    note: "Verlauf schräg von links oben, etwas flacherer Umschlag mit angedeuteten Falzen unten.",
    from: "#FFC25E",
    to: "#EF6528",
    dir: [0, 0, 1, 1],
    env: { w: 700, h: 440, r: 48, cy: 520 },
    flapDepth: 0.54,
    flapStyle: "line",
    lineColor: "#D7D9E0",
    bottomFolds: true,
    shadowOpacity: 0.26
  },
  {
    id: "v3-tief",
    title: "3 · Tiefes Orange",
    note: "Dunklerer Verlauf, geschlossene Klappe als eigene Fläche mit weichem Schatten.",
    from: "#F89B3C",
    to: "#D9501C",
    dir: [0, 0, 0, 1],
    env: { w: 640, h: 456, r: 52, cy: 524 },
    flapDepth: 0.58,
    flapStyle: "filled",
    lineColor: "#E3E5EA",
    shadowOpacity: 0.32
  },
  {
    id: "v4-hell",
    title: "4 · Hell mit Kontur",
    note: "Helleres Orange, Umschlag mit zarter Orange-Kontur und orange getönter Klappe.",
    from: "#FFCB74",
    to: "#F68A3E",
    dir: [0, 0, 0, 1],
    env: { w: 660, h: 456, r: 52, cy: 520 },
    flapDepth: 0.56,
    flapStyle: "line",
    lineColor: "#F5B98C",
    outline: "#F3A36B",
    shadowOpacity: 0.22
  },
  {
    id: "v5-siegel",
    title: "5 · Mit Siegel",
    note: "Wie Variante 1, dazu ein kleiner oranger Punkt an der Klappenspitze als Erkennungszeichen.",
    from: "#FFB347",
    to: "#F37335",
    dir: [0, 0, 0, 1],
    env: { w: 660, h: 456, r: 52, cy: 520 },
    flapDepth: 0.56,
    flapStyle: "filled",
    lineColor: "#E1E3E8",
    seal: "#F37335",
    shadowOpacity: 0.28
  }
];

function iconSvg(v: Variant) {
  const { w, h, r, cy } = v.env;
  const x0 = 512 - w / 2;
  const y0 = cy - h / 2;
  const x1 = x0 + w;
  const y1 = y0 + h;
  const apexY = y0 + h * v.flapDepth;
  // Flap edges start a little inside the rounded corners and meet in a
  // softened apex, which keeps the drawing calm at 60 px.
  const inset = r * 0.55;
  const ax = 512;
  const soft = 46;
  const slope = (apexY - y0) / (ax - x0);
  const leftBefore = { x: ax - soft, y: apexY - soft * slope };
  const rightBefore = { x: ax + soft, y: apexY - soft * slope };
  const flapLine =
    `M ${x0 + inset} ${y0 + inset * slope} L ${leftBefore.x} ${leftBefore.y} ` +
    `Q ${ax} ${apexY + 8} ${rightBefore.x} ${rightBefore.y} L ${x1 - inset} ${y0 + inset * slope}`;
  const flapFill = `${flapLine} L ${x1} ${y0} L ${x0} ${y0} Z`;
  const [gx1, gy1, gx2, gy2] = v.dir;

  const folds = v.bottomFolds
    ? `<path d="M ${x0 + inset} ${y1 - inset * 0.8} L ${ax - 120} ${apexY + 40} M ${x1 - inset} ${y1 - inset * 0.8} L ${ax + 120} ${apexY + 40}" fill="none" stroke="${v.lineColor}" stroke-width="10" stroke-linecap="round" opacity="0.55"/>`
    : "";

  const flap =
    v.flapStyle === "filled"
      ? `<path d="${flapFill}" fill="url(#flap)" filter="url(#flapShadow)"/>
    <path d="${flapLine}" fill="none" stroke="${v.lineColor}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>`
      : `<path d="${flapLine}" fill="none" stroke="${v.lineColor}" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/>`;

  const seal = v.seal
    ? `<circle cx="${ax}" cy="${apexY - 6}" r="40" fill="${v.seal}"/>
    <circle cx="${ax}" cy="${apexY - 6}" r="27" fill="none" stroke="#FFFFFF" stroke-opacity="0.7" stroke-width="6"/>`
    : "";

  const outline = v.outline
    ? `<rect x="${x0 + 5}" y="${y0 + 5}" width="${w - 10}" height="${h - 10}" rx="${r - 5}" fill="none" stroke="${v.outline}" stroke-width="10"/>`
    : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <!-- Noctua branding proposal ${v.id}: original envelope drawing, full-bleed (iOS applies its own mask). -->
  <defs>
    <linearGradient id="bg" x1="${gx1}" y1="${gy1}" x2="${gx2}" y2="${gy2}">
      <stop offset="0" stop-color="${v.from}"/>
      <stop offset="1" stop-color="${v.to}"/>
    </linearGradient>
    <linearGradient id="paper" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#FFFFFF"/>
      <stop offset="1" stop-color="#F3F4F7"/>
    </linearGradient>
    <linearGradient id="flap" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#FFFFFF"/>
      <stop offset="1" stop-color="#F7F8FA"/>
    </linearGradient>
    <clipPath id="envClip">
      <rect x="${x0}" y="${y0}" width="${w}" height="${h}" rx="${r}"/>
    </clipPath>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="150%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="22"/>
      <feOffset dy="18" result="blur"/>
      <feFlood flood-color="#7A2E00" flood-opacity="${v.shadowOpacity}"/>
      <feComposite in2="blur" operator="in"/>
      <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="flapShadow" x="-10%" y="-10%" width="120%" height="140%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="9"/>
      <feOffset dy="8" result="blur"/>
      <feFlood flood-color="#2B3240" flood-opacity="0.16"/>
      <feComposite in2="blur" operator="in"/>
      <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <rect width="1024" height="1024" fill="url(#bg)"/>
  <rect x="${x0}" y="${y0}" width="${w}" height="${h}" rx="${r}" fill="url(#paper)" filter="url(#shadow)"/>
  <g clip-path="url(#envClip)">
    ${folds}
    ${flap}
    ${seal}
  </g>
  ${outline}
</svg>
`;
}

const pngs: Record<string, Record<number, string>> = {};
for (const v of VARIANTS) {
  const svgPath = join(ICON_DIR, `${v.id}.svg`);
  writeFileSync(svgPath, iconSvg(v));
  pngs[v.id] = {};
  for (const size of [180, 512]) {
    const out = join(ICON_DIR, `${v.id}-${size}.png`);
    const proc = Bun.spawnSync(["rsvg-convert", "-w", String(size), "-h", String(size), svgPath, "-o", out]);
    if (proc.exitCode !== 0) throw new Error(`rsvg-convert failed for ${out}: ${proc.stderr}`);
    pngs[v.id][size] = `data:image/png;base64,${readFileSync(out).toString("base64")}`;
  }
}

type Name = { name: string; top?: boolean };
const NAMES: Name[] = [
  { name: "Hauspost", top: true },
  { name: "Postkontor", top: true },
  { name: "ProMail", top: true },
  { name: "Mailstube" },
  { name: "MailHaus" },
  { name: "Postbote" },
  { name: "Briefkasten" },
  { name: "Postfach" }
];

const NOTIFICATIONS = [
  { title: "Kanzlei Beispiel", body: "Rückfrage zum Vertragsentwurf – können wir morgen kurz telefonieren?" },
  { title: "Paketdienst", body: "Ihre Sendung wird heute zwischen 14 und 16 Uhr zugestellt." },
  { title: "Anna Muster", body: "Fotos vom Wochenende sind im Anhang 📎" }
];

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const v1 = VARIANTS[0].id;

const variantRows = VARIANTS.map(
  (v) => `
  <article class="variant">
    <h3>${esc(v.title)}</h3>
    <p>${esc(v.note)}</p>
    <div class="swatches">
      ${["light", "dark"]
        .map(
          (bg) => `<div class="swatch ${bg}">${[60, 120, 180]
            .map(
              (s) =>
                `<figure><img class="ios" src="${pngs[v.id][s > 120 ? 512 : 180]}" width="${s}" height="${s}" alt="${esc(v.title)} ${s}px"><figcaption>${s} px</figcaption></figure>`
            )
            .join("")}</div>`
        )
        .join("")}
    </div>
  </article>`
).join("");

const tiles = NAMES.map(
  (n) => `<div class="tile"><img class="ios" src="${pngs[v1][180]}" width="62" height="62" alt=""><span>${esc(n.name)}</span></div>`
).join("");

const notifications = NAMES.filter((n) => n.top)
  .map(
    (n, i) => `
    <div class="notif">
      <img class="ios small" src="${pngs[v1][180]}" width="38" height="38" alt="">
      <div class="nbody">
        <div class="nhead"><strong>${esc(NOTIFICATIONS[i].title)}</strong><time>jetzt</time></div>
        <div class="ntext">${esc(NOTIFICATIONS[i].body)}</div>
        <div class="nfrom">von ${esc(n.name)}</div>
      </div>
    </div>`
  )
  .join("");

const html = `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>App-Name und Icon – Vorschläge</title>
<style>
  :root { --ink:#1d1d1f; --muted:#6e6e73; font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; color: var(--ink); }
  body { margin: 0; background: #f5f5f7; }
  main { max-width: 1080px; margin: 0 auto; padding: 32px 20px 64px; }
  h1 { font-size: 28px; margin: 0 0 4px; }
  h2 { font-size: 20px; margin: 40px 0 12px; }
  h3 { font-size: 16px; margin: 0 0 4px; }
  p { margin: 0 0 12px; color: var(--muted); line-height: 1.45; }
  img.ios { border-radius: 22.37%; display: block; }
  img.ios.small { border-radius: 9px; }
  .variant { background: #fff; border-radius: 16px; padding: 18px; margin-bottom: 16px; box-shadow: 0 1px 2px rgba(0,0,0,.06); }
  .swatches { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .swatch { display: flex; align-items: flex-end; gap: 20px; padding: 18px; border-radius: 12px; flex-wrap: wrap; }
  .swatch.light { background: #f2f2f7; }
  .swatch.dark { background: #1c1c1e; color: #d1d1d6; }
  figure { margin: 0; text-align: center; }
  figcaption { font-size: 11px; margin-top: 6px; opacity: .7; }
  .phones { display: flex; gap: 28px; flex-wrap: wrap; align-items: flex-start; }
  .phone { width: 390px; max-width: 100%; border-radius: 48px; padding: 14px; background: #111; box-shadow: 0 18px 40px rgba(0,0,0,.25); }
  .screen { border-radius: 36px; overflow: hidden; padding: 64px 22px 40px; min-height: 360px; background: linear-gradient(160deg, #3a4a6b 0%, #6b5b8a 45%, #c77d5a 100%); }
  .screen.notifs { background: linear-gradient(180deg, #23304a 0%, #49507a 100%); min-height: 0; padding-top: 40px; }
  .clock { text-align: center; color: #fff; font-size: 64px; font-weight: 300; margin-bottom: 20px; letter-spacing: -1px; }
  .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 26px 0; justify-items: center; }
  .tile { width: 74px; display: flex; flex-direction: column; align-items: center; }
  .tile span { margin-top: 5px; color: #fff; font-size: 11.5px; max-width: 74px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-shadow: 0 1px 2px rgba(0,0,0,.35); }
  .notif { display: flex; gap: 10px; align-items: flex-start; background: rgba(245,245,247,.78); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border-radius: 22px; padding: 12px 14px; margin-bottom: 10px; }
  .nbody { flex: 1; min-width: 0; font-size: 14px; line-height: 1.3; }
  .nhead { display: flex; justify-content: space-between; gap: 8px; }
  .nhead time { color: #6e6e73; font-size: 12px; }
  .ntext { color: #1d1d1f; }
  .nfrom { color: #6e6e73; font-size: 12.5px; margin-top: 2px; }
  @media (max-width: 720px) { .swatches { grid-template-columns: 1fr; } }
</style>
</head>
<body>
<main>
  <h1>App-Name und Icon – Vorschläge</h1>
  <p>Weißer Umschlag nach dem Vorbild von Apple Mail (eigene Zeichnung) auf unserem Orange. Die Ecken rundet iOS selbst ab; hier ist das nachgestellt.</p>

  <h2>Icon-Varianten</h2>
  ${variantRows}

  <h2>Home-Bildschirm (Variante 1)</h2>
  <p>iOS kürzt Namen unter dem Icon ab etwa 11–12 Zeichen mit „…“.</p>
  <div class="phones">
    <div class="phone"><div class="screen"><div class="clock">9:41</div><div class="grid">${tiles}</div></div></div>
  </div>

  <h2>Mitteilung „von &lt;Name&gt;“ (Top 3)</h2>
  <div class="phones">
    <div class="phone"><div class="screen notifs">${notifications}</div></div>
  </div>
</main>
</body>
</html>
`;

writeFileSync(join(DIR, "proposals.html"), html);
console.log(`Wrote ${VARIANTS.length} icon variants and ${join(DIR, "proposals.html")}`);
