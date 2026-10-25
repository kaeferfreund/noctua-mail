// Radix iris-9, shared with the shell primary token (white contrast 5.37:1).
export const APP_THEME_COLOR = "#5b5bd6";

// Browser/OS bar colour per colour scheme (meta theme-color), which also fills
// the opaque iOS home-screen status bar. It is the colour of the top bar on
// phones, --background (the shell header sits on the sidebar inset), as hex:
// iOS reads only hex/rgb there. lib/ui/theme.test.ts derives both from the
// tokens in app/globals.css; ThemeColorSync reads the live token at runtime.
export const APP_BAR_COLORS = { light: "#ffffff", dark: "#0a0a0a" } as const;

/** The token the phone's top bar (and so theme-color) uses. */
export const APP_BAR_TOKEN = "--background";

const hex2 = (value: number) => Math.round(Math.min(1, Math.max(0, value)) * 255).toString(16).padStart(2, "0");

/** sRGB gamma encoding of a linear channel. */
const encode = (value: number) => value <= 0.0031308 ? 12.92 * value : 1.055 * Math.pow(value, 1 / 2.4) - 0.055;

function oklchToHex(lightness: number, chroma: number, hueDegrees: number) {
  const hue = (hueDegrees * Math.PI) / 180;
  const a = chroma * Math.cos(hue);
  const b = chroma * Math.sin(hue);
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return "#" + [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s
  ].map(channel => hex2(encode(channel))).join("");
}

/**
 * A CSS colour of the forms the theme tokens use (#rgb, #rrggbb, rgb(),
 * oklch()) as lowercase #rrggbb; null for anything else (theme-color on iOS
 * takes no oklch).
 */
export function cssColorToHex(value: string): string | null {
  const color = value.trim().toLowerCase();
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/.exec(color);
  if (short) return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`;
  if (/^#[0-9a-f]{6}$/.test(color)) return color;
  const rgb = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/.exec(color);
  if (rgb) return "#" + rgb.slice(1, 4).map(channel => hex2(Number(channel) / 255)).join("");
  const oklch = /^oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)(?:deg)?\s*(?:\/[^)]*)?\)$/.exec(color);
  if (oklch) {
    const lightness = Number(oklch[1]) / (oklch[2] ? 100 : 1);
    return oklchToHex(lightness, Number(oklch[3]), Number(oklch[4]));
  }
  return null;
}
