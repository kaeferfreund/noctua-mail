/** Entirely invented demo correspondence; no real patients or suppliers. */
export type SeedMessage = { folder: string; source: Buffer; flags: string[]; date: Date };
export type SeedOptions = { count?: number };
export const demoUser = "demo@demo-praxis.test";
export const demoPass = "demo";
const encoded = (text: string) => `=?UTF-8?B?${Buffer.from(text).toString("base64")}?=`;
const base64 = (text: string | Buffer) => Buffer.from(text).toString("base64").match(/.{1,76}/g)?.join("\r\n") ?? "";

const TINY_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=";

// A tiny valid one-page PDF, with byte offsets computed rather than a fake .pdf blob.
function invoicePdf(label = "Demo-Praxis - SYNTHETIC invoice EUR 128.00", lines = 12) {
  const stream =
    `BT /F1 18 Tf 40 550 Td (${label}) Tj ` +
    Array.from(
      { length: lines },
      (_, i) => `0 -24 Td (Demo item ${i + 1}: practice materials - synthetic example only) Tj `
    ).join("") +
    "ET";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 700 600] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, i) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${i + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 6\n0000000000 65535 f \n${offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`)
    .join("")}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf);
}

export type MessageKind =
  | "invoice"
  | "newsletter"
  | "calendar"
  | "calendar-cancel"
  | "dark-html"
  | "light-html"
  | "dark-bg-html"
  | "large-report"
  | "png-attachment";

export type MessageInput = {
  id: string;
  subject: string;
  from?: string;
  to?: string;
  text?: string;
  date?: Date;
  references?: string[];
  kind?: MessageKind;
  authResults?: "pass" | "fail";
  extraHeaders?: string[];
};

function extractEmail(headerValue: string) {
  const match = /<([^>]+)>/.exec(headerValue);
  return (match?.[1] ?? headerValue).trim().toLowerCase();
}

export function makeMessage(input: MessageInput): Buffer {
  const date = input.date ?? new Date();
  const boundary = `fixture-${input.id.replace(/[^a-z0-9]/gi, "-")}`;
  const refs = input.references ?? [];
  const from = input.from ?? '"Mira Beispiel" <mira.beispiel@example.test>';
  const fromEmail = extractEmail(from);
  const fromDomain = fromEmail.split("@")[1] ?? "example.test";
  const authHeader =
    input.authResults === "pass"
      ? `Authentication-Results: mx.demo-praxis.test; dkim=pass header.d=${fromDomain}; spf=pass smtp.mailfrom=${fromEmail}; dmarc=pass`
      : input.authResults === "fail"
        ? `Authentication-Results: mx.demo-praxis.test; spf=softfail smtp.mailfrom=${fromEmail}; dmarc=fail`
        : null;
  const headers = [
    `Date: ${date.toUTCString()}`,
    `Message-ID: <${input.id}@demo-praxis.test>`,
    `From: ${from}`,
    `To: ${input.to ?? '"Demo-Praxis Team" <demo@demo-praxis.test>'}`,
    `Subject: ${encoded(input.subject)}`,
    "MIME-Version: 1.0",
    "X-Fixture: synthetic",
    ...(authHeader ? [authHeader] : []),
    ...(input.extraHeaders ?? []),
    ...(refs.length
      ? [`In-Reply-To: <${refs.at(-1)}@demo-praxis.test>`, `References: ${refs.map((id) => `<${id}@demo-praxis.test>`).join(" ")}`]
      : [])
  ];
  const text =
    input.text ??
    "Guten Tag,\n\nwir möchten einen Termin zur Kontrolle vereinbaren. Passt Dienstag um 10 Uhr?\n\nViele Grüße\nMira Beispiel\n\n[Synthetische Demo-Nachricht]";
  const plain = `Content-Type: text/plain; charset=utf-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${base64(text)}\r\n`;
  if (!input.kind) {
    return Buffer.from(
      [...headers, "Content-Type: text/plain; charset=utf-8", "Content-Transfer-Encoding: base64", "", base64(text), ""].join("\r\n")
    );
  }
  const part = (content: string) => `--${boundary}\r\n${content}`;
  let body = part(plain);
  if (input.kind === "invoice") {
    body += part(
      `Content-Type: application/pdf; name="Rechnung-Demo.pdf"\r\nContent-Disposition: attachment; filename="Rechnung-Demo.pdf"\r\nContent-Transfer-Encoding: base64\r\n\r\n${base64(invoicePdf())}\r\n`
    );
  }
  if (input.kind === "png-attachment") {
    body += part(
      `Content-Type: image/png; name="Praxis-Entwurf.png"\r\nContent-Disposition: attachment; filename="Praxis-Entwurf.png"\r\nContent-Transfer-Encoding: base64\r\n\r\n${TINY_PNG_BASE64}\r\n`
    );
  }
  if (input.kind === "large-report") {
    const bigPdf = invoicePdf(`Demo-Praxis - Synthetischer Quartalsbericht ${input.id}`, 900);
    body += part(
      `Content-Type: application/pdf; name="Quartalsbericht-${input.id}.pdf"\r\nContent-Disposition: attachment; filename="Quartalsbericht-${input.id}.pdf"\r\nContent-Transfer-Encoding: base64\r\n\r\n${base64(bigPdf)}\r\n`
    );
  }
  if (input.kind === "newsletter") {
    const alternative = `${boundary}-alt`;
    // Nested 1.1 / 1.2 sections exercise the same part addressing as real mail.
    body = part(
      `Content-Type: multipart/alternative; boundary="${alternative}"\r\n\r\n--${alternative}\r\n${plain}--${alternative}\r\nContent-Type: text/html; charset=utf-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${base64('<html><body style="font-family:sans-serif"><h1>Demo-Praxis Praxispost</h1><img src="cid:demo-logo" alt="Demo Logo"><p>Neue Ideen für einen entspannten Praxisalltag.</p><p>Alle Inhalte sind synthetisch.</p></body></html>')}\r\n--${alternative}--\r\n`
    );
    body += part(
      `Content-Type: image/png; name=demo-logo.png\r\nContent-Disposition: inline; filename=demo-logo.png\r\nContent-ID: <demo-logo>\r\nContent-Transfer-Encoding: base64\r\n\r\n${TINY_PNG_BASE64}\r\n`
    );
    headers.push("List-Unsubscribe: <mailto:unsubscribe@praxispost.example.test>");
  }
  if (input.kind === "dark-html") {
    const html = [
      "<!doctype html><html><head><style>",
      "@media (prefers-color-scheme: dark) {",
      "  html, body { background-color: #111111 !important; }",
      "  body, p, td, th, span { color: #ededed !important; }",
      "  h1, h2 { color: #ffffff !important; }",
      "  a { color: #4da3ff !important; }",
      "}",
      "</style></head>",
      '<body style="background-color:rgb(255,255,255);color:rgb(23,23,23);padding:16px;font-family:sans-serif">',
      `<h1>${input.subject}</h1>`,
      `<p>${text.replace(/\n+/g, "</p><p>")}</p>`,
      '<img src="https://images.example.test/banner-demo.png" width="320" height="60" alt="Synthetisches Banner">',
      '<p><a href="https://status.cloudstatus.example.test/report">Bericht im Portal öffnen</a></p>',
      "</body></html>"
    ].join("\n");
    return Buffer.from(
      [
        ...headers,
        `Content-Type: multipart/alternative; boundary="${boundary}"`,
        "",
        part(plain) +
          part(`Content-Type: text/html; charset=utf-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${base64(html)}\r\n`) +
          `--${boundary}--\r\n`
      ].join("\r\n")
    );
  }
  if (input.kind === "light-html") {
    const html = `<html><body><div style="color:#242424;font-family:sans-serif;max-width:620px"><h2>${input.subject}</h2><p>${text.replace(/\n+/g, "</p><p>")}</p></div></body></html>`;
    return Buffer.from(
      [
        ...headers,
        `Content-Type: multipart/alternative; boundary="${boundary}"`,
        "",
        part(plain) +
          part(`Content-Type: text/html; charset=utf-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${base64(html)}\r\n`) +
          `--${boundary}--\r\n`
      ].join("\r\n")
    );
  }
  if (input.kind === "dark-bg-html") {
    const html = `<html><body bgcolor="#111111"><div style="padding:16px;font-family:sans-serif"><h2 style="color:#ffffff">${input.subject}</h2><p style="color:#e5e5e5">${text.replace(/\n+/g, "</p><p style=\"color:#e5e5e5\">")}</p><p><a href="https://verlag-demo.example.test/ausgabe">Zur synthetischen Ausgabe</a></p></div></body></html>`;
    headers.push("List-Unsubscribe: <mailto:unsubscribe@verlag-demo.example.test>");
    return Buffer.from(
      [
        ...headers,
        `Content-Type: multipart/alternative; boundary="${boundary}"`,
        "",
        part(plain) +
          part(`Content-Type: text/html; charset=utf-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${base64(html)}\r\n`) +
          `--${boundary}--\r\n`
      ].join("\r\n")
    );
  }
  if (input.kind === "calendar" || input.kind === "calendar-cancel") {
    const method = input.kind === "calendar-cancel" ? "CANCEL" : "REQUEST";
    const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
    const start = new Date(date.getTime() + 7 * 86400000);
    const calendar = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Demo-Praxis//Synthetic Fixture//DE",
      `METHOD:${method}`,
      "BEGIN:VEVENT",
      `UID:${input.id}@demo-praxis.test`,
      `DTSTAMP:${stamp(date)}`,
      `DTSTART:${stamp(start)}`,
      `DTEND:${stamp(new Date(start.getTime() + 1800000))}`,
      `SUMMARY:${input.subject}`,
      `ORGANIZER:mailto:${fromEmail}`,
      "ATTENDEE;RSVP=TRUE:mailto:demo@demo-praxis.test",
      ...(method === "CANCEL" ? ["STATUS:CANCELLED"] : []),
      "END:VEVENT",
      "END:VCALENDAR",
      ""
    ].join("\r\n");
    body += part(
      `Content-Type: text/calendar; charset=utf-8; method=${method}; name="termin.ics"\r\nContent-Disposition: attachment; filename="termin.ics"\r\nContent-Transfer-Encoding: base64\r\n\r\n${base64(calendar)}\r\n`
    );
  }
  return Buffer.from(
    [...headers, `Content-Type: multipart/${input.kind === "newsletter" ? "related" : "mixed"}; boundary="${boundary}"`, "", body + `--${boundary}--\r\n`].join("\r\n")
  );
}

const EXTENDED_SENDERS: ReadonlyArray<{ name: string; email: string; auth: "pass" | "fail" }> = [
  { name: "Dentalbedarf Musterwolke", email: "rechnung@musterwolke.example.test", auth: "pass" },
  { name: "Praxispost Musterblatt", email: "redaktion@praxispost.example.test", auth: "pass" },
  { name: "NordLabor Diagnostik", email: "befunde@nordlabor.example.test", auth: "pass" },
  { name: "MedTech Service Demo", email: "wartung@medtech-demo.example.test", auth: "pass" },
  { name: "Steuerkanzlei Muster & Partner", email: "mandant@kanzlei-muster.example.test", auth: "pass" },
  { name: "CloudStatus Benachrichtigung", email: "alerts@cloudstatus.example.test", auth: "pass" },
  { name: "Bürobedarf Süd Demo", email: "bestellung@buero-sued.example.test", auth: "pass" },
  { name: "TerminPortal Online", email: "buchung@terminportal.example.test", auth: "pass" },
  { name: "Linden-Apotheke Demo", email: "rezept@apotheke-demo.example.test", auth: "pass" },
  { name: "Akademie Fortbildung Demo", email: "kurse@fortbildung-demo.example.test", auth: "pass" },
  { name: "IT-Service Praxisnetz", email: "support@it-service-demo.example.test", auth: "pass" },
  { name: "Fachverlag Medizin Demo", email: "magazin@verlag-demo.example.test", auth: "pass" },
  { name: "Mira Beispiel", email: "mira.beispiel@example.test", auth: "pass" },
  { name: "Nora Muster", email: "nora.muster@example.test", auth: "pass" },
  { name: "Jona Testperson", email: "jona.testperson@example.test", auth: "fail" },
  { name: "Elin Platzhalter", email: "elin.platzhalter@example.test", auth: "pass" },
  { name: "Sam Beispiel", email: "sam.beispiel@example.test", auth: "fail" },
  { name: "Luca Muster", email: "luca.muster@example.test", auth: "pass" }
];

const EXTENDED_TOPICS = [
  "Wöchentliche Nutzungsübersicht Demo-Portal",
  "Wartungstermin Behandlungseinheit Raum 2",
  "Laborauftrag und Abholzeit für Donnerstag",
  "Monatsauswertung Buchhaltung und Belege",
  "Neue Terminbuchung über das Online-Portal",
  "Bestellbestätigung Verbrauchsmaterial Praxis",
  "Einladung zur Fortbildung Hygiene 2026",
  "Rückfrage zur Rezeptausstellung",
  "Statusbericht Praxisnetz und Datensicherung",
  "Umbau Empfangsbereich: Farb- und Lichtkonzept",
  "Lieferschein Einmalhandschuhe und Desinfektion",
  "Quartalsbericht Auslastung und Kennzahlen",
  "Absage und Ersatztermin Teambesprechung",
  "Website-Relaunch: Entwurf Startseite prüfen",
  "Rückmeldung zum Heil- und Kostenplan",
  "Anfrage Kontrolltermin für nächste Woche",
  "Update Praxissoftware Version 4.8 verfügbar",
  "Fachmagazin Ausgabe Herbst — Praxistipps",
  "Jahresabrechnung Energie und Praxismiete",
  "Telefonanlage: neue Ansage für Feiertage",
  "Bewerbung als Assistenz (synthetisch)",
  "Rückfrage zu Abrechnungsziffern",
  "Lieferverzögerung bei Laborartikel 402",
  "Checkliste Urlaubsvertretung Sommer"
];

const EXTENDED_BODIES = [
  "im Anhang senden wir Ihnen die aktualisierte Übersicht für den laufenden Monat. Bitte prüfen Sie die aufgeführten Positionen und geben Sie uns kurz Rückmeldung.",
  "wir haben den angefragten Termin in unserem System vorgemerkt. Sollte sich kurzfristig etwas ändern, können Sie einfach direkt auf diese Nachricht antworten.",
  "die geplante Wartung dauert voraussichtlich 45 Minuten und kann außerhalb der regulären Sprechzeiten erfolgen. Bitte bestätigen Sie das vorgeschlagene Zeitfenster.",
  "vielen Dank für die schnelle Übermittlung der Unterlagen. Wir haben alles vollständig erhalten und melden uns nach der Durchsicht bis Ende der Woche.",
  "für die nächste Abstimmung haben wir drei offene Punkte zusammengefasst: Zeitplan, Materialliste und Freigabe der Entwürfe.",
  "hier kommt Ihre regelmäßige Zusammenfassung mit allen synthetischen Kennzahlen, offenen Aufgaben und Hinweisen für das Praxisteam."
];

function appendExtendedMessages(
  result: SeedMessage[],
  name: string,
  today: number,
  random: () => number,
  targetCount: number
) {
  let seq = 0;
  const pickDate = (dayOffset: number, stepMinutes: number) =>
    new Date(today - dayOffset * 86400000 + stepMinutes * 60000 + Math.floor(random() * 180000));

  // Distribute dates over ~365 days, denser in the most recent 14 days.
  const spanDay = (index: number, total: number) => {
    if (index < 24) return Math.floor((index / 24) * 14);
    const ratio = (index - 24) / Math.max(1, total - 24);
    return Math.min(364, 14 + Math.floor(ratio * 350));
  };

  // Reserve space for Archive, Drafts, Trash, Junk and custom folders.
  const folderQuotas: ReadonlyArray<{ folder: string; count: number }> = [
    { folder: "Archive", count: 40 },
    { folder: "Drafts", count: 5 },
    { folder: "Trash", count: 12 },
    { folder: "Junk", count: 10 },
    { folder: "Projekte/Website", count: 7 },
    { folder: "Projekte/Praxisumbau", count: 8 },
    { folder: "Buchhaltung/2026", count: 10 },
    { folder: "Lieferanten", count: 7 }
  ];
  const reservedForSideFolders = folderQuotas.reduce((sum, item) => sum + item.count, 0);
  const targetForMainThreads = Math.max(result.length, targetCount - reservedForSideFolders);

  const threadLengths = [1, 2, 3, 4, 2, 5, 1, 3, 2, 6, 1, 2, 4, 3, 7, 2];
  const kinds: ReadonlyArray<MessageKind | undefined> = [
    "dark-html",
    "invoice",
    "light-html",
    "newsletter",
    "calendar",
    undefined,
    "dark-bg-html",
    "png-attachment",
    "light-html",
    undefined,
    "invoice",
    "dark-html",
    "calendar-cancel",
    undefined,
    "large-report",
    undefined
  ];

  let threadIndex = 0;
  while (result.length < targetForMainThreads) {
    const sender = EXTENDED_SENDERS[threadIndex % EXTENDED_SENDERS.length];
    const correspondent = `"${sender.name}" <${sender.email}>`;
    const baseTopic = EXTENDED_TOPICS[threadIndex % EXTENDED_TOPICS.length];
    const topic = `${baseTopic} (#${101 + threadIndex})`;
    const desiredLen = threadLengths[threadIndex % threadLengths.length];
    const baseDay = spanDay(threadIndex, 130);
    const firstKind = kinds[threadIndex % kinds.length];
    const references: string[] = [];

    for (let step = 0; step < desiredLen && result.length < targetForMainThreads; step += 1) {
      const id = `${name}-ext-t${threadIndex}-m${step}-${seq++}`;
      const isReplyFromTeam = step > 0 && step % 2 === 1;
      const dayOffset = Math.max(0, baseDay - Math.min(step, 3));
      const date = pickDate(dayOffset, step * 42);
      const member = (threadIndex + step) % 2 === 0 ? "Alex Beispiel" : "Toni Muster";
      const bodyLine = EXTENDED_BODIES[(threadIndex + step) % EXTENDED_BODIES.length];

      if (isReplyFromTeam) {
        const text = `Hallo ${sender.name},\n\nvielen Dank für Ihre Nachricht zu „${topic}“. ${bodyLine}\n\nBeste Grüße\n${member}\nDemo-Praxis (synthetisch)`;
        result.push({
          folder: "Sent",
          date,
          flags: ["\\Seen"],
          source: makeMessage({
            id,
            subject: `Re: ${topic}`,
            from: `"${member} | Demo-Praxis" <${demoUser}>`,
            to: correspondent,
            date,
            references: [...references],
            text,
            authResults: "pass"
          })
        });
      } else {
        const isLast = step === desiredLen - 1;
        const unread = isLast && threadIndex % 4 === 0 && dayOffset < 21;
        const flagged = isLast && threadIndex % 9 === 0;
        const answered = !isLast && desiredLen > 1;
        const flags = [
          unread ? "" : "\\Seen",
          flagged ? "\\Flagged" : "",
          answered ? "\\Answered" : ""
        ].filter(Boolean);
        const text =
          step === 0
            ? `Guten Tag Demo-Praxis,\n\n${bodyLine}\n\nViele Grüße\n${sender.name}\n[Synthetische Demo-Nachricht]`
            : `Guten Tag,\n\ndanke für die schnelle Rückmeldung zu „${topic}“. Wir stimmen dem Vorschlag zu.\n\nViele Grüße\n${sender.name}\n[Synthetische Demo-Nachricht]`;
        result.push({
          folder: "INBOX",
          date,
          flags,
          source: makeMessage({
            id,
            subject: `${step > 0 ? "Re: " : ""}${topic}`,
            from: correspondent,
            date,
            references: [...references],
            kind: step === 0 ? firstKind : undefined,
            text,
            authResults: sender.auth
          })
        });
      }
      references.push(id);
    }
    threadIndex += 1;
  }

  // Fill Archive, Drafts, Trash, Junk and custom folders up to exact targetCount.
  for (const { folder, count } of folderQuotas) {
    for (let n = 0; n < count && result.length < targetCount; n += 1) {
      const sender = EXTENDED_SENDERS[(seq + n) % EXTENDED_SENDERS.length];
      const dayOffset = Math.min(360, 2 + Math.floor((n / Math.max(1, count)) * 340));
      const date = pickDate(dayOffset, n * 17);
      const id = `${name}-ext-${folder.replace(/[^a-z0-9]/gi, "-")}-${n}-${seq++}`;
      const isJunk = folder === "Junk";
      const isDraft = folder === "Drafts";
      const from = isDraft
        ? `"Alex Beispiel | Demo-Praxis" <${demoUser}>`
        : isJunk
          ? `"Gewinnzentrale Demo ${n + 1}" <promo${n + 1}@werbung-demo.example.test>`
          : `"${sender.name}" <${sender.email}>`;
      const subject = isJunk
        ? `SYNTHETISCHE WERBUNG: Exklusiv-Gutschein #${n + 1} nur heute`
        : isDraft
          ? `Entwurf: ${EXTENDED_TOPICS[n % EXTENDED_TOPICS.length]}`
          : `${folder}: ${EXTENDED_TOPICS[(seq + n) % EXTENDED_TOPICS.length]}`;
      const kind: MessageKind | undefined =
        folder === "Buchhaltung/2026"
          ? "invoice"
          : folder === "Projekte/Website" && n % 2 === 0
            ? "png-attachment"
            : folder === "Archive" && n % 5 === 0
              ? "dark-html"
              : undefined;
      const flags = isDraft ? ["\\Draft"] : isJunk ? (n % 2 === 0 ? [] : ["\\Seen"]) : ["\\Seen"];
      result.push({
        folder,
        date,
        flags,
        source: makeMessage({
          id,
          subject,
          from,
          date,
          kind,
          authResults: isJunk ? "fail" : sender.auth,
          text: isJunk
            ? "SYNTHETISCHE WERBUNG: Vollständig erfundene Demo-Spamnachricht ohne echte Links."
            : `Guten Tag,\n\n${EXTENDED_BODIES[n % EXTENDED_BODIES.length]}\n\n[Synthetische Demo-Nachricht für ${folder}]`
        })
      });
    }
  }
}

/** Stable bytes for a seed and anchor day. Pass --date YYYY-MM-DD to freeze screenshots. */
export function createSeed(name = "demo-praxis", anchor = new Date(), options?: SeedOptions): SeedMessage[] {
  let state = [...name].reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) >>> 0, 17);
  const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
  const today = new Date(`${anchor.toISOString().slice(0, 10)}T09:00:00.000Z`).getTime();
  const topics = ["Kontrolltermin für Familie Beispiel", "Rechnung für Handschuhe und Masken", "Rückfrage zur Zahnreinigung", "Website: neue Teamfotos", "Terminverschiebung am Donnerstag", "Praxispost im Oktober", "Einladung zur Teambesprechung", "Materialbestellung November", "English appointment request", "Angebot für Demo-Instrumente", "Vorsorge nach den Ferien", "Liefertermin bestätigen", "Danke für die Beratung", "Neue Öffnungszeiten", "Röntgentermin abstimmen", "Rechnungskopie erbeten", "Erinnerung an Prophylaxe", "Website: Kontaktformular", "Demo-Gewinn sofort abholen", "Termin für Erstgespräch", "Hygieneplan aktualisieren", "English follow-up", "Praxisurlaub planen", "Sonderangebot nur heute", "Kontrolle nächste Woche"];
  const people = ["Mira Beispiel", "Nora Muster", "Jona Testperson", "Elin Platzhalter", "Sam Beispiel", "Luca Muster", "Kim Testperson", "Robin Example"];
  const requests = [
    "Wir möchten Kontrolltermine für zwei Personen vereinbaren. Passt Dienstag um 10 Uhr?",
    "Anbei die synthetische Rechnung DEMO-2026-104 für Handschuhe und Masken, gesamt EUR 128,00. Bitte bei Rückfragen die Rechnungsnummer nennen.",
    "Wie lange dauert eine professionelle Zahnreinigung? Ich hätte nächste Woche vormittags Zeit.",
    "Im Anhang unserer Planung stehen neue Teamfotos für die Website. Können wir am Freitag einen Entwurf besprechen?",
    "Könnten wir meinen Termin am Donnerstag auf die kommende Woche verschieben? Dienstag oder Mittwoch passt gut.",
    "Die neue synthetische Praxispost ist da: Tipps für einen entspannten Praxisalltag und unsere Demo-Neuigkeiten.",
    "Hier die Kalendereinladung zu unserer Demo-Teambesprechung. Bitte den Termin kurz bestätigen.",
    "Bitte die Bestellung für Masken und Einmalbecher prüfen. Lieferung wäre in der nächsten Woche möglich.",
    "Could we arrange a check-up next week? Tuesday morning would be ideal. Thank you!",
    "Unser synthetisches Angebot für Demo-Instrumente liegt als PDF bei. Können Sie die gewünschten Mengen bestätigen?",
    "Nach den Ferien möchten wir wieder zur Vorsorge kommen. Haben Sie zwei aufeinanderfolgende Termine frei?",
    "Die bestellten Demo-Materialien können am Mittwoch zwischen 9 und 12 Uhr geliefert werden. Passt das?",
    "Vielen Dank für das freundliche Erstgespräch. Die Erklärung zum weiteren Ablauf hat mir sehr geholfen.",
    "Sind die neuen Öffnungszeiten ab November schon bestätigt? Ich möchte meinen nächsten Termin entsprechend planen.",
    "Zu meinem Kontrolltermin wurde eine Aufnahme vorgeschlagen. Können wir beides am selben Tag machen?",
    "Könnten Sie mir eine Kopie der synthetischen Demo-Rechnung vom letzten Monat schicken?",
    "Ich möchte einen Prophylaxetermin vereinbaren. Bevorzugt freitags am frühen Nachmittag.",
    "Das neue Kontaktformular ist im Demo-Entwurf fertig. Bitte Betreffauswahl und Bestätigungstext gegenlesen.",
    "SYNTHETISCHE WERBUNG: Ihr Demo-Gewinn wartet! Keine echten Links oder Angebote.",
    "Ich bin neu bei Demo-Praxis und möchte einen Termin für ein Erstgespräch. Was soll ich mitbringen?",
    "Der interne Demo-Hygieneplan wurde überarbeitet. Bitte die Materialliste vor unserer Besprechung prüfen.",
    "Hello team, thank you for confirming. Could you send me the appointment time once more?",
    "Bitte die geplanten Urlaubstage für die synthetische Praxisübersicht ergänzen. Wir stimmen die Vertretung morgen ab.",
    "SYNTHETISCHE WERBUNG: Sonderangebot nur heute! Dieses Angebot ist vollständig erfunden.",
    "Haben Sie nächste Woche noch einen Termin zur Kontrolle frei? Vormittags bin ich flexibel."
  ];
  const result: SeedMessage[] = [];
  const counts = [5, 4, 4, 3, 3, 3, 3, 3, 3, 3, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1, 1, 1, 1]; // 60 inbox, 25 threads
  topics.forEach((topic, thread) => {
    const person = thread === 8 || thread === 21 ? "Robin Example" : thread === 6 ? "Mira Beispiel" : people[thread % people.length];
    const senderName = thread === 1 || thread === 9 ? "Dentalbedarf Musterwolke" : thread === 5 ? "Praxispost Musterblatt" : person;
    const senderEmail = thread === 1 || thread === 9 ? "rechnung@musterwolke.example.test" : thread === 5 ? "redaktion@praxispost.example.test" : `${person.toLowerCase().replace(/ /g, ".")}@example.test`;
    const correspondent = `"${senderName}" <${senderEmail}>`;
    const references: string[] = [];
    const baseDay = Math.floor(thread * 57 / 24);
    for (let n = 0; n < counts[thread]; n++) {
      const id = `${name}-t${thread}-m${n}`;
      const date = new Date(today - Math.max(0, baseDay - n) * 86400000 + n * 600000 + Math.floor(random() * 300000));
      const kind = n === 0 ? thread === 1 || thread === 9 ? "invoice" : thread === 5 ? "newsletter" : thread === 6 ? "calendar" : undefined : undefined;
      const text = n ? `Guten Tag,\n\nvielen Dank für die Rückmeldung zu „${topic}“. Der vorgeschlagene Ablauf passt gut. Bitte kurz bestätigen.\n\nViele Grüße\n${senderName}\n[Synthetische Demo]` : `Guten Tag Demo-Praxis,\n\n${requests[thread]}\n\nViele Grüße\n${senderName}\n[Synthetische Demo-Nachricht]`;
      result.push({ folder: "INBOX", date, flags: [(thread + n) % 3 ? "\\Seen" : "", (thread + n) % 7 === 0 ? "\\Flagged" : ""].filter(Boolean), source: makeMessage({ id, subject: `${n ? "Re: " : ""}${topic}`, from: correspondent, date, references: [...references], kind, text }) });
      references.push(id);
    }
    if (thread < 15) {
      const date = new Date(today - Math.max(0, baseDay - counts[thread]) * 86400000 + counts[thread] * 600000);
      const member = thread % 2 ? "Toni Muster" : "Alex Beispiel";
      result.push({ folder: "Sent", date, flags: ["\\Seen"], source: makeMessage({ id: `${name}-sent${thread}`, subject: `Re: ${topic}`, from: `"${member} | Demo-Praxis" <demo@demo-praxis.test>`, to: correspondent, date, references: [...references], text: `Hallo,\n\n${member} hier. Wir haben Ihre Anfrage aufgenommen. Dienstag um 10 Uhr ist reserviert.\n\nBeste Grüße\n${member}\nDemo-Praxis – synthetische Zweierpraxis` }) });
    }
  });
  for (const [folder, count] of [["Drafts", 3], ["Archive", 4], ["Trash", 3], ["Junk", 2], ["Projekte/Website", 3]] as const) {
    for (let n = 0; n < count; n++) {
      const date = new Date(today - (n + 1) * 86400000);
      result.push({ folder, date, flags: [folder === "Drafts" ? "\\Draft" : "\\Seen"], source: makeMessage({ id: `${name}-${folder}-${n}`, date, subject: `${folder === "Drafts" ? "Entwurf" : folder === "Projekte/Website" ? "Website-Abstimmung" : "Praxisnotiz"}: ${["Angebot prüfen", "Nächste Schritte", "Freigabe erbeten", "Ablage"][n]}`, from: '"Alex Beispiel | Demo-Praxis" <demo@demo-praxis.test>', text: "Hallo Toni,\n\nbitte prüfe diese synthetische Praxisnotiz. Die nächsten Schritte besprechen wir morgen.\n\nAlex" }) });
    }
  }
  const targetCount = options?.count;
  if (targetCount && targetCount > result.length) {
    appendExtendedMessages(result, name, today, random, targetCount);
  }
  return result.sort((a, b) => a.date.getTime() - b.date.getTime());
}
