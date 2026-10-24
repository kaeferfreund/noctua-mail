/**
 * Multi-label public suffixes: a compact excerpt of the Public Suffix List
 * (publicsuffix.org) with the second-level registries of country domains
 * (co.uk, com.au …) and a few shared hosting domains whose subdomains belong
 * to different owners. Under them an organisational domain has three labels.
 * Single-label suffixes (com, de, uk …) need no list.
 */
const MULTI_LABEL_PUBLIC_SUFFIXES = new Set([
  "co.uk", "org.uk", "ac.uk", "gov.uk", "ltd.uk", "plc.uk", "me.uk", "net.uk", "nhs.uk", "sch.uk", "police.uk",
  "com.au", "net.au", "org.au", "edu.au", "gov.au", "asn.au", "id.au",
  "co.nz", "org.nz", "net.nz", "ac.nz", "govt.nz",
  "co.jp", "ne.jp", "or.jp", "ac.jp", "go.jp", "ad.jp", "ed.jp", "gr.jp", "lg.jp",
  "co.kr", "or.kr", "go.kr", "ac.kr", "ne.kr",
  "com.br", "net.br", "org.br", "gov.br", "edu.br",
  "co.za", "org.za", "gov.za", "ac.za", "net.za",
  "co.in", "net.in", "org.in", "gov.in", "ac.in", "firm.in", "gen.in", "ind.in",
  "com.cn", "net.cn", "org.cn", "gov.cn", "edu.cn", "ac.cn",
  "com.hk", "org.hk", "net.hk", "edu.hk", "gov.hk",
  "com.tw", "org.tw", "net.tw", "edu.tw", "gov.tw",
  "com.sg", "org.sg", "net.sg", "edu.sg", "gov.sg",
  "com.my", "org.my", "net.my", "edu.my", "gov.my",
  "com.mx", "org.mx", "gob.mx", "edu.mx", "net.mx",
  "com.ar", "org.ar", "gob.ar", "net.ar",
  "com.tr", "org.tr", "net.tr", "gov.tr", "edu.tr",
  "co.il", "org.il", "ac.il", "gov.il", "net.il",
  "co.at", "or.at", "gv.at", "ac.at",
  "com.es", "org.es", "nom.es", "edu.es", "gob.es",
  "com.pl", "net.pl", "org.pl", "gov.pl",
  "com.ua", "net.ua", "org.ua", "gov.ua",
  "com.gr", "org.gr", "gov.gr", "edu.gr",
  "com.pt", "org.pt", "gov.pt",
  "co.id", "or.id", "ac.id", "go.id",
  "co.th", "or.th", "ac.th", "go.th", "in.th",
  "com.cy", "com.eg", "com.sa", "com.ph", "com.pk", "com.vn", "com.ng", "co.ke",
  "github.io", "gitlab.io", "herokuapp.com", "blogspot.com", "appspot.com", "firebaseapp.com", "web.app", "netlify.app",
  "vercel.app", "pages.dev", "workers.dev", "azurewebsites.net", "cloudfront.net", "s3.amazonaws.com"
]);

/** Number of labels of the public suffix of `parts` (1 or 2). */
export function publicSuffixLabels(parts: readonly string[]) {
  return parts.length >= 2 && MULTI_LABEL_PUBLIC_SUFFIXES.has(parts.slice(-2).join(".")) ? 2 : 1;
}

/** A bare public suffix (`de`, `co.uk`): nobody owns it, so it never identifies a sender. */
export function isPublicSuffix(domain: string) {
  const parts = domain.toLowerCase().split(".").filter(Boolean);
  return parts.length <= publicSuffixLabels(parts);
}
