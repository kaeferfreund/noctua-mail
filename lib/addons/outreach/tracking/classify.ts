import type { TrackingClientType, TrackingEventType } from "../types";

const clients: ReadonlyArray<readonly [RegExp, string, TrackingClientType, boolean?]> = [
  [/googleimageproxy/i, "Gmail Image Proxy", "proxy"],
  [/yahoo(?:mail)?(?:[ /_-]?image)?[ /_-]?proxy|yahoo[ /_-]?mail.*proxy/i, "Yahoo Mail Image Proxy", "proxy"],
  [/applemailprivacy|apple mail privacy|^Mozilla\/5\.0$/i, "Apple Mail Privacy Protection", "proxy", true],
  [/safelinks|microsoft url protection/i, "Microsoft Safe Links", "bot", true],
  [/proofpoint|urldefense/i, "Proofpoint", "bot", true],
  [/mimecast/i, "Mimecast", "bot", true],
  [/barracuda/i, "Barracuda", "bot", true],
  [/messagelabs|symantec cloud/i, "Symantec", "bot", true],
  [/urlscan|googlebot|bingbot|duckduckbot|facebookexternalhit|slackbot|discordbot|crawler|linkchecker|headlesschrome|\bscanner\b/i, "Scanner or crawler", "bot", true],
  [/thunderbird/i, "Thunderbird", "mail-client"],
  [/outlook|microsoft office/i, "Outlook", "mail-client"],
  [/apple ?mail/i, "Apple Mail", "mail-client"],
  [/samsungbrowser/i, "Samsung Internet", "mobile"],
  [/edg(?:e|a|ios)?\//i, "Edge", "browser"],
  [/firefox|fxios/i, "Firefox", "browser"],
  [/chrome|crios/i, "Chrome", "browser"],
  [/safari/i, "Safari", "browser"]
];

const systems: ReadonlyArray<readonly [RegExp, string]> = [
  [/android/i, "Android"],
  [/iphone|ipad|ipod|\biOS\b/i, "iOS"],
  [/windows/i, "Windows"],
  [/macintosh|mac os/i, "macOS"],
  [/\bcros\b/i, "ChromeOS"],
  [/linux/i, "Linux"]
];

export function classifyTrackingClient(
  userAgent: string | null, type: TrackingEventType, at: number, sentAt: number | null, method?: unknown
): { clientName: string | null; clientOs: string | null; clientType: TrackingClientType; machine: boolean } {
  const ua = userAgent?.trim() ?? "";
  const engagement = type === "open" || type === "click";
  const match = clients.find(([pattern]) => pattern.test(ua));
  const clientOs = systems.find(([pattern]) => pattern.test(ua))?.[1] ?? null;
  let clientType = match?.[2] ?? "unknown";
  if (clientType === "browser" && (clientOs === "Android" || clientOs === "iOS")) clientType = "mobile";
  const humanOpenProxy = type === "open" && clientType === "proxy" && !match?.[3];
  const early = sentAt !== null && at >= sentAt && at - sentAt <= 5_000;

  return {
    clientName: match?.[1] ?? null, clientOs, clientType,
    machine: engagement && (method === "HEAD" || Boolean(match?.[3]) || (early && !humanOpenProxy))
  };
}
