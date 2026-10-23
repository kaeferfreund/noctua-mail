// TEST-ONLY FIXTURE. Deterministic synthetic HTML-mail corpus from the sanitize
// spike (briefs/perf-html-sanitize/gen-corpus.ts), regenerated in-process instead
// of checking in ~1 MB of HTML. The generator text is unchanged; only the file
// output became a function that resets the PRNG. sanitizeGolden0ac6cfa.json
// pins the SHA-256 of every generated item, so any drift fails the
// differential test.

let seed = 1337;
const rand = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const pick = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)];
const words = "Praxis Termin Rechnung Patient Behandlung Woche Angebot Team Zahnarzt Kontrolle Bitte Danke Rückfrage Unterlagen Freigabe Material Lieferung Fortbildung Kalender Abstimmung neue Ideen entspannten Alltag synthetisch Inhalte".split(" ");
const sentence = (n: number) => Array.from({ length: n }, () => pick(words)).join(" ") + ".";

const outlookHead = `<html xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns:m="http://schemas.microsoft.com/office/2004/12/omml" xmlns="http://www.w3.org/TR/REC-html40"><head><meta http-equiv="Content-Type" content="text/html; charset=utf-8"><meta name="Generator" content="Microsoft Word 15 (filtered medium)"><!--[if !mso]><style>v\\:* {behavior:url(#default#VML);} o\\:* {behavior:url(#default#VML);}</style><![endif]--><style><!--
@font-face {font-family:"Cambria Math"; panose-1:2 4 5 3 5 4 6 3 2 4;}
@font-face {font-family:Calibri; panose-1:2 15 5 2 2 2 4 3 2 4;}
p.MsoNormal, li.MsoNormal, div.MsoNormal {margin:0cm; font-size:11.0pt; font-family:"Calibri",sans-serif; mso-fareast-language:EN-US;}
a:link, span.MsoHyperlink {mso-style-priority:99; color:#0563C1; text-decoration:underline;}
span.E-MailFormatvorlage17 {mso-style-type:personal-compose; font-family:"Calibri",sans-serif; color:windowtext;}
.MsoChpDefault {mso-style-type:export-only; font-family:"Calibri",sans-serif;}
@page WordSection1 {size:612.0pt 792.0pt; margin:70.85pt 70.85pt 2.0cm 70.85pt;}
div.WordSection1 {page:WordSection1;}
--></style><!--[if gte mso 9]><xml><o:shapedefaults v:ext="edit" spidmax="1026" /></xml><![endif]--></head>`;

function outlookParagraph() {
  return `<p class="MsoNormal"><span style="font-size:11.0pt;font-family:&quot;Calibri&quot;,sans-serif;color:#1F497D;mso-fareast-language:DE">${sentence(14)}<o:p></o:p></span></p>\n`;
}
function outlookQuoteHeader(i: number) {
  return `<div><div style="border:none;border-top:solid #E1E1E1 1.0pt;padding:3.0pt 0cm 0cm 0cm"><p class="MsoNormal"><b><span style="font-size:11.0pt;font-family:&quot;Calibri&quot;,sans-serif">Von:</span></b><span style="font-size:11.0pt;font-family:&quot;Calibri&quot;,sans-serif"> Person ${i} &lt;person${i}@example.test&gt; <br><b>Gesendet:</b> Montag, 19. Oktober 2026 10:${String(i % 60).padStart(2, "0")}<br><b>An:</b> demo@monkeydent.test<br><b>Betreff:</b> AW: Termin<o:p></o:p></span></p></div></div>\n`;
}
const signature = `<p class="MsoNormal"><span style="font-size:9.0pt;color:gray">MonkeyDent Praxis · Musterstraße 1 · 12345 Musterstadt</span></p><p class="MsoNormal"><img width="120" height="40" style="width:1.25in;height:.4166in" id="Bild_x0020_1" src="https://cdn.example.test/signature/logo.png" alt="Logo"></p>`;

function outlookMail(targetBytes: number) {
  let body = `<body lang="DE" link="#0563C1" vlink="#954F72" style="word-wrap:break-word"><div class="WordSection1">`;
  let i = 0;
  while (body.length < targetBytes - 900) {
    for (let p = 0; p < 4; p++) body += outlookParagraph();
    body += signature;
    body += outlookQuoteHeader(i++);
  }
  return `${outlookHead}${body}</div></body></html>`;
}

// The shape of the earlier pair measurement (perf-backlog-rerank-r8/parse.ts).
const legacyTable54k = '<html><body><table>' + Array.from({ length: 450 }, (_, i) => `<tr><td style="color:#222;padding:4px">Synthetic row ${i}</td><td><img src="https://example.invalid/p.png">value</td></tr>`).join('') + '</table></body></html>';

function gmailMail(targetBytes: number) {
  let body = '<div dir="ltr">';
  while (body.length < targetBytes - 400) {
    body += `<div>${sentence(18)}</div><div><br></div>`;
    if (rand() < 0.2) body += `<div><a href="https://www.example.test/${Math.floor(rand() * 1e6)}">https://www.example.test/link</a></div>`;
  }
  body += '<div class="gmail_quote"><div dir="ltr" class="gmail_attr">Am Mo., 19. Okt. 2026 schrieb Person:<br></div><blockquote class="gmail_quote" style="margin:0px 0px 0px 0.8ex;border-left:1px solid rgb(204,204,204);padding-left:1ex"><div dir="ltr">' + sentence(30) + '</div></blockquote></div></div>';
  return body;
}

const newsletterStyle = `<style type="text/css">
body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}
table,td{mso-table-lspace:0pt;mso-table-rspace:0pt}
img{-ms-interpolation-mode:bicubic;border:0;height:auto;line-height:100%;outline:none;text-decoration:none}
@import url("https://fonts.example.test/css?family=Open+Sans");
@font-face{font-family:'Open Sans';src:url(https://fonts.example.test/os.woff2) format('woff2')}
.hero{background-image:url('https://cdn.example.test/hero-bg.jpg');background-size:cover}
@media only screen and (max-width:600px){.mobile-full{width:100%!important;max-width:100%!important}.mobile-hide{display:none!important}.mobile-pad{padding:10px!important}.stack-column,.stack-column-center{display:block!important;width:100%!important;max-width:100%!important;direction:ltr!important}}
@media (prefers-color-scheme:dark){.dark-bg{background:#111!important}.dark-text{color:#eee!important}}
</style>`;

function newsletterBlock(i: number) {
  const img = `https://cdn.example.test/nl/2026-10/img-${i}.jpg`;
  return `<tr><td class="mobile-pad" style="padding:20px 30px;background-color:#ffffff" bgcolor="#ffffff">
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"><tr>
<td class="stack-column" width="50%" valign="top" style="padding:0 10px 0 0">
<a href="https://click.example.test/track?u=${i}&amp;id=abc${i}" target="_blank"><img src="${img}" srcset="${img} 1x, https://cdn.example.test/nl/2026-10/img-${i}@2x.jpg 2x" width="260" height="160" alt="Artikel ${i}" style="display:block;width:100%;max-width:260px;height:auto;border-radius:6px" border="0"></a></td>
<td class="stack-column" width="50%" valign="top" style="padding:0 0 0 10px;font-family:'Open Sans',Arial,sans-serif;font-size:15px;line-height:22px;color:#333333">
<h2 style="margin:0 0 10px;font-size:20px;line-height:26px;color:#1a1a1a;font-weight:700">${sentence(5)}</h2>
<p style="margin:0 0 12px">${sentence(28)}</p>
<table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td class="button-td" style="border-radius:4px;background:#1847d5" bgcolor="#1847d5">
<a class="button-a" href="https://click.example.test/track?u=${i}&amp;cta=1" style="background:#1847d5;border:15px solid #1847d5;font-family:sans-serif;font-size:13px;line-height:1.1;text-align:center;text-decoration:none;display:block;border-radius:4px;font-weight:bold;color:#ffffff">Weiterlesen</a></td></tr></table>
</td></tr></table></td></tr>
<tr><td style="padding:0 30px"><table role="presentation" width="100%"><tr><td style="border-top:1px solid #e5e5e5;font-size:1px;line-height:1px;height:1px">&nbsp;</td></tr></table></td></tr>\n`;
}

function newsletter(targetBytes: number) {
  const head = `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd"><html xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office"><head><meta http-equiv="Content-Type" content="text/html; charset=UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><meta name="x-apple-disable-message-reformatting"><title>MonkeyDent Praxispost</title><!--[if mso]><style>*{font-family:Arial,sans-serif!important}</style><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->${newsletterStyle}</head>`;
  let rows = "";
  let i = 0;
  while ((head.length + rows.length) < targetBytes - 2500) rows += newsletterBlock(i++);
  const body = `<body width="100%" style="margin:0;padding:0!important;mso-line-height-rule:exactly;background-color:#f1f1f1" class="dark-bg"><center style="width:100%;background-color:#f1f1f1">
<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;font-family:sans-serif">Vorschautext ${sentence(8)}</div>
<!--[if mso | IE]><table role="presentation" border="0" cellpadding="0" cellspacing="0" width="600" align="center"><tr><td><![endif]-->
<div style="max-width:600px;margin:0 auto" class="email-container">
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:auto">
<tr><td class="hero" style="padding:40px 30px;text-align:center;background-image:url(https://cdn.example.test/hero.jpg)" background="https://cdn.example.test/hero.jpg"><img src="https://cdn.example.test/logo.png" width="180" height="50" alt="MonkeyDent" style="height:auto;display:block;margin:0 auto"></td></tr>
${rows}
<tr><td style="padding:20px;font-family:sans-serif;font-size:12px;line-height:18px;text-align:center;color:#888888"><p>Sie erhalten diese E-Mail, weil Sie sich angemeldet haben. <a href="https://click.example.test/unsubscribe?u=1" style="color:#888888;text-decoration:underline">Abmelden</a></p><img src="https://open.example.test/pixel.gif?u=1" width="1" height="1" alt="" style="display:block;border:0"></td></tr>
</table></div>
<!--[if mso | IE]></td></tr></table><![endif]-->
</center></body></html>`;
  return head + body;
}

/** Name → HTML, in generation order (the items share one PRNG stream). */
export function generateSanitizeCorpus(): Record<string, string> {
  seed = 1337;
  return {
    "gmail-5k": gmailMail(5 * 1024),
    "outlook-5k": outlookMail(5 * 1024),
    "outlook-54k": outlookMail(54 * 1024),
    "legacy-table-54k": legacyTable54k,
    "newsletter-120k": newsletter(120 * 1024),
    "outlook-300k": outlookMail(300 * 1024),
    "newsletter-300k": newsletter(300 * 1024),
    // Every inline style unique, so a CSS memo gets no repeat hits within a pass.
    "newsletter-unique-120k": newsletter(120 * 1024).replace(/style="/g, () => `style="padding-top:${Math.floor(rand() * 1e9)}px;`)
  };
}
