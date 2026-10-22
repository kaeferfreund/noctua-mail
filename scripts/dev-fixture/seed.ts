/** Entirely invented demo correspondence; no real patients or suppliers. */
export type SeedMessage = { folder: string; source: Buffer; flags: string[]; date: Date };
export const demoUser = "demo@monkeydent.test";
export const demoPass = "demo";
const encoded = (text: string) => `=?UTF-8?B?${Buffer.from(text).toString("base64")}?=`;
const base64 = (text: string | Buffer) => Buffer.from(text).toString("base64").match(/.{1,76}/g)?.join("\r\n") ?? "";

// A tiny valid one-page PDF, with byte offsets computed rather than a fake .pdf blob.
function invoicePdf() {
  const stream = "BT /F1 18 Tf 40 550 Td (MonkeyDent - SYNTHETIC invoice EUR 128.00) Tj " + Array.from({ length: 12 }, (_, i) => `0 -24 Td (Demo item ${i + 1}: practice materials - synthetic example only) Tj `).join("") + "ET";
  const objects = ["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>", "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 700 600] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>", "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>", `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, i) => { offsets.push(Buffer.byteLength(pdf)); pdf += `${i + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf);
}
export type MessageInput = { id: string; subject: string; from?: string; to?: string; text?: string; date?: Date; references?: string[]; kind?: "invoice" | "newsletter" | "calendar" };
export function makeMessage(input: MessageInput): Buffer {
  const date = input.date ?? new Date();
  const boundary = `fixture-${input.id.replace(/[^a-z0-9]/gi, "-")}`;
  const refs = input.references ?? [];
  const headers = [
    `Date: ${date.toUTCString()}`, `Message-ID: <${input.id}@monkeydent.test>`,
    `From: ${input.from ?? '"Mira Beispiel" <mira.beispiel@example.test>'}`,
    `To: ${input.to ?? '"MonkeyDent Team" <demo@monkeydent.test>'}`,
    `Subject: ${encoded(input.subject)}`, "MIME-Version: 1.0", "X-Fixture: synthetic",
    ...(refs.length ? [`In-Reply-To: <${refs.at(-1)}@monkeydent.test>`, `References: ${refs.map(id => `<${id}@monkeydent.test>`).join(" ")}`] : [])
  ];
  const text = input.text ?? "Guten Tag,\n\nwir möchten einen Termin zur Kontrolle vereinbaren. Passt Dienstag um 10 Uhr?\n\nViele Grüße\nMira Beispiel\n\n[Synthetische Demo-Nachricht]";
  const plain = `Content-Type: text/plain; charset=utf-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${base64(text)}\r\n`;
  if (!input.kind) return Buffer.from([...headers, "Content-Type: text/plain; charset=utf-8", "Content-Transfer-Encoding: base64", "", base64(text), ""].join("\r\n"));
  const part = (content: string) => `--${boundary}\r\n${content}`;
  let body = part(plain);
  if (input.kind === "invoice") body += part(`Content-Type: application/pdf; name="Rechnung-Demo.pdf"\r\nContent-Disposition: attachment; filename="Rechnung-Demo.pdf"\r\nContent-Transfer-Encoding: base64\r\n\r\n${base64(invoicePdf())}\r\n`);
  if (input.kind === "newsletter") {
    const alternative = `${boundary}-alt`;
    // Nested 1.1 / 1.2 sections exercise the same part addressing as real mail.
    body = part(`Content-Type: multipart/alternative; boundary="${alternative}"\r\n\r\n--${alternative}\r\n${plain}--${alternative}\r\nContent-Type: text/html; charset=utf-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${base64('<html><body style="font-family:sans-serif"><h1>MonkeyDent Praxispost</h1><img src="cid:demo-logo" alt="Demo Logo"><p>Neue Ideen für einen entspannten Praxisalltag.</p><p>Alle Inhalte sind synthetisch.</p></body></html>')}\r\n--${alternative}--\r\n`);
    body += part("Content-Type: image/png; name=demo-logo.png\r\nContent-Disposition: inline; filename=demo-logo.png\r\nContent-ID: <demo-logo>\r\nContent-Transfer-Encoding: base64\r\n\r\niVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=\r\n");
    headers.push("List-Unsubscribe: <mailto:unsubscribe@praxispost.example.test>");
  }
  if (input.kind === "calendar") {
    const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
    const start = new Date(date.getTime() + 7 * 86400000);
    const calendar = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//MonkeyDent//Synthetic Fixture//DE", "METHOD:REQUEST", "BEGIN:VEVENT", `UID:${input.id}@monkeydent.test`, `DTSTAMP:${stamp(date)}`, `DTSTART:${stamp(start)}`, `DTEND:${stamp(new Date(start.getTime() + 1800000))}`, "SUMMARY:MonkeyDent Demo-Termin", "ORGANIZER:mailto:mira.beispiel@example.test", "ATTENDEE;RSVP=TRUE:mailto:demo@monkeydent.test", "END:VEVENT", "END:VCALENDAR", ""].join("\r\n");
    body += part(`Content-Type: text/calendar; charset=utf-8; method=REQUEST; name="termin.ics"\r\nContent-Disposition: attachment; filename="termin.ics"\r\nContent-Transfer-Encoding: base64\r\n\r\n${base64(calendar)}\r\n`);
  }
  return Buffer.from([...headers, `Content-Type: multipart/${input.kind === "newsletter" ? "related" : "mixed"}; boundary="${boundary}"`, "", body + `--${boundary}--\r\n`].join("\r\n"));
}

/** Stable bytes for a seed and anchor day. Pass --date YYYY-MM-DD to freeze screenshots. */
export function createSeed(name = "monkeydent", anchor = new Date()): SeedMessage[] {
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
    "Ich bin neu bei MonkeyDent und möchte einen Termin für ein Erstgespräch. Was soll ich mitbringen?",
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
      const text = n ? `Guten Tag,\n\nvielen Dank für die Rückmeldung zu „${topic}“. Der vorgeschlagene Ablauf passt gut. Bitte kurz bestätigen.\n\nViele Grüße\n${senderName}\n[Synthetische Demo]` : `Guten Tag MonkeyDent,\n\n${requests[thread]}\n\nViele Grüße\n${senderName}\n[Synthetische Demo-Nachricht]`;
      result.push({ folder: "INBOX", date, flags: [(thread + n) % 3 ? "\\Seen" : "", (thread + n) % 7 === 0 ? "\\Flagged" : ""].filter(Boolean), source: makeMessage({ id, subject: `${n ? "Re: " : ""}${topic}`, from: correspondent, date, references: [...references], kind, text }) });
      references.push(id);
    }
    if (thread < 15) {
      const date = new Date(today - Math.max(0, baseDay - counts[thread]) * 86400000 + counts[thread] * 600000);
      const member = thread % 2 ? "Toni Muster" : "Alex Beispiel";
      result.push({ folder: "Sent", date, flags: ["\\Seen"], source: makeMessage({ id: `${name}-sent${thread}`, subject: `Re: ${topic}`, from: `"${member} | MonkeyDent" <demo@monkeydent.test>`, to: correspondent, date, references: [...references], text: `Hallo,\n\n${member} hier. Wir haben Ihre Anfrage aufgenommen. Dienstag um 10 Uhr ist reserviert.\n\nBeste Grüße\n${member}\nMonkeyDent – synthetische Zweierpraxis` }) });
    }
  });
  for (const [folder, count] of [["Drafts", 3], ["Archive", 4], ["Trash", 3], ["Junk", 2], ["Projekte/Website", 3]] as const) {
    for (let n = 0; n < count; n++) {
      const date = new Date(today - (n + 1) * 86400000);
      result.push({ folder, date, flags: [folder === "Drafts" ? "\\Draft" : "\\Seen"], source: makeMessage({ id: `${name}-${folder}-${n}`, date, subject: `${folder === "Drafts" ? "Entwurf" : folder === "Projekte/Website" ? "Website-Abstimmung" : "Praxisnotiz"}: ${["Angebot prüfen", "Nächste Schritte", "Freigabe erbeten", "Ablage"][n]}`, from: '"Alex Beispiel | MonkeyDent" <demo@monkeydent.test>', text: "Hallo Toni,\n\nbitte prüfe diese synthetische Praxisnotiz. Die nächsten Schritte besprechen wir morgen.\n\nAlex" }) });
    }
  }
  return result.sort((a, b) => a.date.getTime() - b.date.getTime());
}
