# Noctua – Kurzanleitung für den Haushalt

Für eure persönlichen und gemeinsamen Geschäftsmails. Du meldest dich mit deinem
persönlichen Benutzerkonto an und wählst danach ein Postfach. Jede Person verwendet
eigene Zugangsdaten, auch wenn ihr dieselben Mails bearbeitet.

Die Oberfläche ist derzeit Englisch. Beschriftungen stehen hier in Anführungszeichen;
daneben findest du die deutsche Erklärung. „(zu prüfen)“ kennzeichnet Funktionen oder
Abläufe, die in den geprüften Ständen nicht vollständig belegt sind.

## 1. Anmelden und den Zugang absichern

### Dein Konto mit Einladung anlegen

1. Lass dir vom Admin einen Einladungscode persönlich geben. Er gilt einmal, für
   deine persönliche E-Mail-Adresse und einen Tag lang.
2. Öffne Noctua im Browser und wähle „Sign up with an invite code“.
3. Trage „Invite code“, „Email“ und „Name“ ein. Verwende die Adresse aus der Einladung.
4. Wähle unter „App password“ dein eigenes Noctua-Passwort mit mindestens zehn Zeichen
   und wiederhole es unter „Confirm app password“. Dieses Passwort ist unabhängig
   vom technischen Passwort eines gemeinsamen Postfachs.
5. Wähle „Create account“. Falls du danach zur Anmeldung kommst, melde dich mit
   deiner Adresse und deinem neuen App-Passwort an.

### Pflicht: Authenticator und Backup-Codes einrichten

Bevor du Mails öffnen kannst, musst du die Zwei-Faktor-Anmeldung (2FA) einrichten.
Dafür brauchst du eine Authenticator-App, die zeitbasierte sechsstellige Codes
(TOTP) erzeugt.

1. Gib bei „Set up your authenticator“ unter „Current password“ dein App-Passwort ein
   und wähle „Start authenticator setup“.
2. Scanne den QR-Code mit deiner Authenticator-App. Alternativ überträgst du das
   „Setup secret“ manuell in die App.
3. Trage den aktuellen sechsstelligen „Authenticator code“ ein und wähle
   „Verify authenticator“.
4. Sichere die angezeigten Backup-Codes mit „Copy codes“ oder „Download codes“.
   Bewahre sie privat und unabhängig von deinem Telefon auf, etwa als Ausdruck an
   einem sicheren Ort. Jeder Code funktioniert nur einmal; die Liste wird nur
   einmal angezeigt.
5. Bestätige erst nach dem Sichern mit „I saved my backup codes“.

Wurde die Einrichtung unterbrochen, bestätige dein Passwort erneut und beginne neu.
Verwende dann den neu angezeigten QR-Code.

### Einen Passkey auf Telefon oder Desktop hinzufügen

Nach der Einrichtung kannst du „Add a passkey“ wählen oder zunächst mit
„Continue to Noctua“ weitergehen. Später findest du „Add passkey“ im Benutzermenü
unter „Profile & security“.

Vergib dort bei „New passkey name“ einen erkennbaren Namen, etwa „Mein Telefon“
oder „Mein Notebook“. Bestätige deine Identität im Dialog „Verify your identity“
und folge dem Systemdialog deines Geräts. Noctua unterstützt die Bestätigung mit
Geräte-PIN, Fingerabdruck oder Gesichtserkennung; die angebotene Auswahl hängt
von Gerät und Browser ab. Richte den Passkey auf dem Gerät ein, das du verwenden
möchtest. Die verpflichtende Authenticator-Einrichtung bleibt bestehen.

### Im Alltag anmelden

- **Mit Passkey:** Wähle „Sign in with a passkey“ und bestätige die Anmeldung im
  Systemdialog. Falls Noctua zusätzlich einen Code verlangt, schließe auch diesen
  Schritt ab.
- **Mit Passwort und Code:** Gib „Email“ und „App password“ ein, wähle „Sign in“,
  danach den aktuellen „Authenticator code“ und „Verify“.
- **Mit Backup-Code:** Wähle bei der Code-Abfrage „Use a backup code“, gib einen
  unbenutzten Code ein und bestätige mit „Verify“.

Mit „Log out“ im Benutzermenü meldest du dich ab. Ein abgelaufener Zugang verlangt
eine erneute Anmeldung.

### Telefon verloren oder Authenticator nicht mehr verfügbar

1. Melde dich zunächst mit E-Mail-Adresse und App-Passwort an.
2. Wähle bei der Code-Abfrage „I lost my phone“. Gib einen unbenutzten Backup-Code
   ein und wähle „Verify“.
3. Gib im nächsten Schritt dein aktuelles Passwort und einen **anderen**, noch
   unbenutzten Code unter „Unused replacement backup code“ ein. Wähle
   „Replace authenticator“.
4. Richte die Authenticator-App auf dem Ersatzgerät mit dem neuen QR-Code ein,
   bestätige deren Code und sichere die neu angezeigten Backup-Codes.

Dieser geführte Weg verbraucht zwei verschiedene Backup-Codes. Wenn du bereits
angemeldet bist, erreichst du „Replace authenticator“ auch über „Profile & security“;
dort kannst du zur Bestätigung einen Passkey oder „Use an unused backup code“ nutzen.
Ein auf dem verlorenen Gerät gespeicherter Passkey lässt sich unter „Passkeys“ entfernen.

Fehlen dir alle brauchbaren Anmelde- und Wiederherstellungsmöglichkeiten, wende dich
persönlich an den Admin. Er kann nach Identitätsprüfung die 2FA zurücksetzen;
danach musst du einen neuen Authenticator einrichten. Ein Passwort-Reset allein
setzt die 2FA nicht zurück.

### Passwort vergessen

Bitte den Admin persönlich um einen Wiederherstellungslink. Er stellt einen
**einmaligen, 15 Minuten gültigen Link** aus und übergibt ihn dir persönlich –
**nie per E-Mail**.

Öffne den Link, fülle „New password“ und „Confirm new password“ aus und wähle
„Change password“. Über „Return to sign in“ meldest du dich mit dem neuen Passwort
und deinem bestehenden Authenticator oder Passkey an. Bisherige Sitzungen werden
widerrufen. Ist der Link abgelaufen oder verbraucht, brauchst du einen neuen vom
Admin. Kann die Seite das Ergebnis nicht bestätigen, versuche zuerst die Anmeldung
mit dem neuen Passwort oder bitte den Admin um Hilfe.

## 2. Postfächer auswählen und Rollen verstehen

In der Seitenleiste stehen eigene Postfächer unter „My mailboxes“ und gemeinsam
zugängliche unter „Shared mailboxes“. Tippe oder klicke auf das gewünschte Postfach;
sein Name und der aktuelle Ordner erscheinen oben. Es ist immer ein Postfach aktiv.
Die persönliche Anmeldung bleibt beim Wechsel dieselbe.

Deine Rolle gilt jeweils für ein bestimmtes Postfach:

- **Lesen („viewer“):** Du kannst Mails, Anhänge und den Zusammenarbeitsverlauf
  ansehen und die Suche nutzen, aber weder senden noch Zuständigkeit, Status oder
  Notizen ändern.
- **Bearbeiten („editor“):** Du kannst zusätzlich Mails senden, verschieben und
  bearbeiten sowie Zuständigkeit, Status und interne Notizen pflegen.
- **Verwalten („manager“):** Du kannst zusätzlich Postfacheinstellungen und
  Mitgliederrollen verwalten; das Löschen des Postfachs ist dem Eigentümer oder
  Admin vorbehalten.

Zähler neben Ordnern und Ansichten helfen beim Überblick. Bei den
Zusammenarbeitsansichten zählen sie passende Nachrichten, also nicht zwingend
eindeutige Vorgänge oder nur ungelesene Mails. Zusätzliche Zähler direkt an allen
Postfachzeilen, auch für gerade nicht geöffnete Postfächer, sind **(zu prüfen)**.

Bei „Choose a mailbox“ wählst du eines der angebotenen Postfächer. Bei
„No mailbox yet“ bitte den Admin um eine Mitgliedschaft; die Anmeldung war bereits
erfolgreich. „Retry“ lädt die Auswahl erneut. „Add a mailbox“ ist zwar sichtbar,
ersetzt aber keine Freigabe durch den Admin. Bei „Mailbox unavailable; contact a
manager“ wendest du dich an die Verwaltung dieses Postfachs.

## 3. Im gemeinsamen Postfach zusammenarbeiten

Ein Vorgang ist eine zusammengehörige Unterhaltung, auch „Thread“ genannt.
Zuständigkeit, Status und Notizen gehören zu diesem Vorgang im jeweiligen Postfach.
Beide Personen sehen denselben Stand. Änderungen erfordern mindestens „editor“.

### Zuständigkeit und Status setzen

1. Öffne den Vorgang.
2. Wähle oben bei „Assignee“ die zuständige Person: „Me“ bedeutet du selbst,
   ein Name die andere Person und „Unassigned“ keine Zuständigkeit.
3. Stelle bei „Thread status“ den passenden Arbeitsstand ein:

| Anzeige | Bedeutung für eure Arbeit |
| --- | --- |
| „Open“ | Offen: Es muss noch jemand übernehmen oder weiterarbeiten. |
| „In progress“ | In Bearbeitung: Eine Person kümmert sich darum. |
| „Waiting“ | Wartet: Zum Beispiel auf eine Antwort oder fehlende Unterlagen. |
| „Closed“ | Erledigt: Für euch ist aktuell nichts mehr zu tun. |

Die Auswahl wird direkt gespeichert. In der Nachrichtenliste zeigen Kürzel die
zuständige Person und farbige Markierungen den Status. Ein offener, nicht
zugewiesener Vorgang hat dort keine zusätzliche Markierung.

**Gelesen ist nicht erledigt.** Der Gelesen-Stand einer Mail ist im gemeinsamen
Postfach ebenfalls gemeinsam. Dass eine Person sie geöffnet hat, schließt den
Vorgang nicht ab. Setze „Closed“ bewusst, wenn die Arbeit erledigt ist.

### Interne Notiz und Aktivitätsverlauf

Wähle „Internal note“, schreibe die Information für die andere Person und wähle
„Add note“. Zum Beispiel: „Unterlagen angefragt; bitte bis Freitag abwarten.“
Markdown-Formatierung ist möglich.

**Interne Notizen werden nie als E-Mail gesendet.** Sie sind für die Mitglieder
dieses Postfachs sichtbar, nicht für externe Empfänger. Verwende für eine Antwort
an Kunden die Antwortfunktion der Mail.

Über den Notizzähler gelangst du zu „Notes & activity“ unter der Unterhaltung.
Dort siehst du Notizen, Verfasser und Zeit sowie Änderungen an Zuständigkeit und
Status und protokollierte Antworten. Eigene Notizen kannst du als „editor“ mit
„Delete“ löschen; „manager“ können auch andere Notizen löschen.

### Deine Arbeitsansichten

Unter „Views“ findest du für das aktive Postfach:

- **„Assigned to me“ – Mir zugewiesen:** Vorgänge in deiner Zuständigkeit.
- **„Unassigned“ – Nicht zugewiesen:** Vorgänge ohne zuständige Person.
- **„Open“ – Offen:** Alles, was noch nicht „Closed“ ist, einschließlich
  „In progress“ und „Waiting“.

Ein praktischer Ablauf: Übernimm einen Vorgang mit „Me“, setze „In progress“,
antworte und wähle danach „Waiting“ oder „Closed“. Halte eine Übergabe als interne
Notiz fest.

Eine automatische Warnung, dass die andere Person gerade antwortet
(„someone else is replying“), ist im geprüften Stand nicht nachweisbar **(zu prüfen)**.
Falls eine solche Warnung erscheint, stimmt euch vor dem Senden ab. Verlasse dich
bis zur Prüfung auf Zuständigkeit, Verlauf und persönliche Absprache, damit ihr
nicht doppelt antwortet.

## 4. Mails lesen, schreiben und wiederfinden

### Lesen, antworten und weiterleiten

Öffne eine Mail in der Liste. Auf einem großen Bildschirm steht sie neben der
Liste im Lesebereich. Für neue Nachrichten wählst du „Compose“.

- „Reply“ antwortet dem Absender.
- „Reply all“ antwortet allen vorgesehenen Beteiligten; kontrolliere die Empfänger.
- „Forward“ leitet die Mail weiter; trage den neuen Empfänger ein.

Prüfe vor „Send“ die Absenderzeile „From:“, die Empfänger unter „To:“, den Betreff
„Subject“ und die Anhänge. Mit „Show Cc and Bcc“ blendest du weitere Empfängerfelder
ein. Gerade bei mehreren Postfächern hilft die Absenderzeile, aus der richtigen
Adresse zu antworten.

### Anhänge

Empfangene Dateien findest du unter „Attachments“. Klicke auf die Datei für die
angebotene Vorschau oder nutze „Download attachment“ zum Herunterladen.
Beim Schreiben wählst du „Attach“, suchst die Datei aus und prüfst, ob sie in der
Anhangsliste steht. Warte, bis das Laden der Anhänge abgeschlossen ist, bevor du sendest.

### Ordner und Suche

Wähle Ordner in der Seitenleiste. Am Desktop kannst du Nachrichten zum Verschieben
auf einen Zielordner ziehen. Das Verschieben benötigt mindestens „editor“;
Ordner anlegen, umbenennen oder löschen benötigt „manager“.

Nutze das Suchfeld oben. Über „Search filters“ begrenzt du „Scope“ auf
„Current folder“ oder wählst „Everywhere“ für die Ordner des aktiven Postfachs.
„Everywhere“ durchsucht nicht automatisch eure anderen Postfächer. Für gesendete
Mails beachte die zusätzliche Option „Include …“ mit dem Namen des Gesendet-Ordners.
„Clear search“ entfernt die Suche. Mit „Check all folders for new mail“ neben
„Compose“ lässt du alle Ordner des aktiven Postfachs auf neue Mails prüfen.

### Wo ihr gesendete Antworten findet

Gesendete Mails liegen im **Gesendet-Ordner des jeweiligen Postfachs auf dem
Mailserver**, häufig „Sent“ genannt. Eine Antwort aus dem gemeinsamen Postfach ist
dort für euch beide sichtbar, unabhängig davon, wer sie gesendet hat. Schau vor
einer weiteren Antwort dort und im Verlauf nach.

Falls Noctua meldet „Email sent, but …“ und ein Problem mit der Gesendet-Kopie
beschreibt, **sende die Mail nicht erneut**: Sie wurde bereits versendet. Prüfe
den Gesendet-Ordner und bitte einen „manager“, die fehlende Kopie oder
Ordnerzuordnung zu klären.

## 5. Noctua auf dem Telefon verwenden

Du kannst Noctua im Browser öffnen und als Web-App (PWA) zum Startbildschirm
hinzufügen. Die folgenden Schritte sind allgemeine Browserwege; Installation und
vollständiger Ablauf auf euren konkreten iOS-/Android-Geräten sind **(zu prüfen)**.

- **iPhone/iPad:** Öffne Noctua in Safari, wähle im Teilen-Menü die Funktion zum
  Hinzufügen zum Home-Bildschirm und bestätige sie.
- **Android:** Öffne Noctua in Chrome und suche im Browsermenü nach der Funktion
  zum Installieren der App oder zum Hinzufügen zum Startbildschirm.

Auf schmalen Bildschirmen siehst du jeweils eine Spalte: zuerst die Liste, nach dem
Antippen den Vorgang. Mit „Back“ oberhalb der Mail kommst du zur Liste zurück;
auch die Zurück-Navigation des Browsers wird unterstützt. Über „Toggle sidebar“
öffnest du die Postfach- und Ordnerauswahl, über die Lupe „Search messages“ die Suche.

Das Schreibfenster füllt den Bildschirm. Kontrolliere auch hier „From:“ und „To:“
vor dem Senden. Einstellungen öffnen sich ebenfalls bildschirmfüllend.

## 6. Einstellungen und persönliche Sicherheit

### Sicherheit für dein Benutzerkonto

Öffne unten in der Seitenleiste das Benutzermenü und „Profile & security“.
Diese Einstellungen gelten für deine Person über alle Postfächer hinweg und sind
auch ohne ausgewähltes Postfach erreichbar.

- **Passwort ändern:** Fülle unter „App password“ die Felder „New password“ und
  „Confirm new password“ aus und wähle „Change password“. Andere Sitzungen werden
  dabei abgemeldet.
- **Backup-Codes erneuern:** Wähle „Regenerate backup codes“. Sichere sofort die neue
  Liste; die alten Codes funktionieren danach nicht mehr.
- **Authenticator ersetzen:** „Replace authenticator“ startet die erneute
  Einrichtung und meldet andere Sitzungen ab.
- **Passkeys verwalten:** Unter „Passkeys“ kannst du mit „Add passkey“ weitere
  hinzufügen, mit „Rename passkey“ umbenennen und mit „Remove passkey“ entfernen.
- **Sitzungen beenden:** Unter „Sessions“ siehst du Geräte beziehungsweise Browser.
  „Revoke session“ beendet eine andere Sitzung, „Sign out other sessions“ alle
  anderen und „Sign out this session“ die aktuelle.

Sicherheitsänderungen verlangen im Dialog „Verify your identity“ eine frische
Bestätigung. Gib die angeforderten Daten ein oder wähle „Verify with a passkey“;
je nach Änderung wird zusätzlich das aktuelle Passwort verlangt. Bei
„Sign in again“ ist eine neue vollständige Anmeldung nötig.

### Persönliche Einstellungen je Postfach und Signatur

Wähle zuerst das Postfach, dann im Benutzermenü „Settings“ und „Preferences“.
Hier stellst du unter anderem Ansicht, Datumsformat, Benachrichtigungen und
„Default signature“ für dich in diesem Postfach ein. „Inherit mailbox default“
übernimmt den Postfachstandard, „No signature“ wählt keine Signatur.
Bestätige mit „Save preferences“. Deine Auswahl ändert nicht die persönlichen
Einstellungen der anderen Person.

Die automatische Übernahme der persönlichen Standardsignatur in neue Mails,
Antworten und Weiterleitungen ist im Zusammenspiel der geprüften Stände
**(zu prüfen)**. Kontrolliere die Signatur vor dem Senden; im Schreibfenster kannst
du über „Choose signature“ eine vorhandene auswählen. Die gemeinsamen
Signaturvorlagen verwaltet ein „manager“ unter „Signatures“ mit „Add signature“,
„Name“, „Signature text“ und „Save“.

Für helles oder dunkles Aussehen wählst du „Theme“ mit „Light“, „Dark“ oder
„System“. Am Desktop steht das Menü oben, mobil im Benutzermenü. Diese Wahl gilt
für dein Gerät; „System“ folgt dessen Darstellung.

## 7. Für den Admin

Öffne „Admin“ im Benutzermenü. Die globale Benutzerrolle „admin“ ist von den
Postfachrollen „viewer“, „editor“ und „manager“ getrennt; sie verschafft dir nicht
automatisch Zugriff auf alle Mails.

- **Benutzer einladen:** Öffne „Invites“, fülle „Name“ und „Email“ aus, wähle bei
  „Invite role“ normalerweise „user“ und klicke „Issue targeted invite“. Kopiere
  den einmal angezeigten Code zur persönlichen Übergabe. Die eingeladene Person
  wählt ihr Passwort selbst und richtet 2FA ein.
- **Rolle oder Sperre ändern:** Unter „Users“ änderst du die globale „Role“.
  „Disable“ sperrt den Zugang und widerruft bestehende Sitzungen; „Enable“ erlaubt
  eine neue Anmeldung. Der letzte aktive Admin kann nicht entfernt werden.
- **Passwort wiederherstellen:** Wähle beim richtigen Benutzer „Recovery“.
  Bestätige die persönliche Identitätsprüfung und gib dein eigenes „Your app
  password“ sowie „Your current TOTP code“ ein. Kopiere den „One-time recovery
  link“ sofort und übergib ihn persönlich, nie per E-Mail. Er gilt einmal und
  15 Minuten; ein neuer Link ersetzt ältere Links.
- **Verlorene Faktoren:** „Reset MFA“ ist für den Fall vorgesehen, dass die Person
  ihren Authenticator nicht selbst ersetzen kann. Prüfe ihre Identität und
  bestätige mit deinen eigenen Zugangsdaten. Danach muss sie 2FA neu einrichten;
  das Passwort wird dadurch nicht geändert.
- **Postfach einrichten:** Öffne „Mailboxes“ → „Create mailbox“ und trage die
  vorhandenen IMAP-/SMTP-Zugangsdaten des Mailservers ein. Damit bindest du ein
  Postfach an Noctua an. Nach dem Anlegen hat es noch keine Mitglieder; füge sie
  anschließend über „Manage members“ hinzu.
- **Postfachrechte vergeben:** Wähle unter „Manage members“ bei „Add existing
  enabled user“ die Person, bei „New member role“ ihre Postfachrolle und dann
  „Add member“. Bestehende Rollen änderst du in der Tabelle; „Remove“ entzieht den
  Zugriff. Eigentümer und letzter aktiver „manager“ sind geschützt. Ein
  „manager“ kann bestehende Mitglieder auch unter „Settings“ → „Members“
  verwalten; für neue Mitglieder verweist die aktuelle Auswahl ohne
  Benutzerverzeichnis an den Admin.
- **Änderungen nachsehen:** Unter „Audit“ zeigt „Audit log“ Zeit, Aktion, handelnde
  Person und betroffenes Benutzerkonto beziehungsweise Postfach. „Load older
  entries“ lädt ältere Einträge. Dieses Protokoll ist von „Notes & activity“ eines
  einzelnen Mailvorgangs getrennt.

## 8. Was noch nicht geht

- **Von Alias-Adressen senden:** Für diesen Start noch nicht als verfügbar
  beschrieben; die Erweiterung ist vorgesehen, ihr Lieferstand ist **(zu prüfen)**.
  Verwende die in „From:“ angezeigte Postfachadresse. „Recipient Aliases“ ist keine
  Auswahl einer zusätzlichen Absenderadresse.
- **Deutsche Oberfläche:** Sie ist für später vorgesehen; Umsetzung und Termin
  sind **(zu prüfen)**. Bis dahin gelten die englischen Beschriftungen dieses
  Handbuchs.
- **Native Desktop-App:** Sie wird in diesem Fork nicht unterstützt. Am Computer
  verwendest du Noctua im Browser.

---

Stand: 22. Oktober 2026. Grundlage: Authentifizierung `6e480bf`, Administration
`6a21154`, Zusammenarbeit `1d0f0ce`, Oberfläche `20be988` sowie der Design-Brief
[TEAM-INBOX.md](../briefs/TEAM-INBOX.md), Abschnitte 1 und 7. Die Stände wurden im
Quelltext geprüft; eine gemeinsame Live-Installation und Geräteprüfung sind damit
nicht bestätigt.
