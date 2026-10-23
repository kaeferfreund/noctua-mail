import { afterEach, expect, test } from "bun:test";
import { cleanup, fireEvent, waitFor } from "@testing-library/react";
import { Theme } from "@radix-ui/themes";
import { I18nTestProvider, render } from "@/lib/i18n/testRender";
import AccountTabContent from "./tabs/AccountTabContent";
import SignaturesTabContent from "./tabs/SignaturesTabContent";
import CategorizationTabContent from "./tabs/CategorizationTabContent";
import RecipientAliasManager from "@/app/components/mailclient/RecipientAliasManager";
import AccountSettingsModal from "@/app/components/AccountSettingsModal";
import type { Account, AccountSettings, RecipientAlias } from "@/lib/data";

afterEach(cleanup);
const account: Account = {
  id: "synthetic", avatar: "", email: "mailbox@example.test", name: "Synthetic mailbox", accessRole: "manager", isOwner: true,
  imap: { host: "imap.example.test", port: 993, secure: true, user: "mailbox@example.test", password: "" },
  smtp: { host: "smtp.example.test", port: 465, secure: true, user: "mailbox@example.test", password: "" },
  settings: { signatures: [] }
};
const noop = () => {};
const de = (ui: React.ReactElement) => render(<I18nTestProvider locale="de"><Theme>{ui}</Theme></I18nTestProvider>);

test("account form renders German labels, probe result and actions", () => {
  const page = de(<AccountTabContent editingAccount={account} isExistingAccount imapDetecting={false} smtpDetecting
    imapProbe={{ tls: true, starttls: false }} smtpProbe={null} imapSecurity="tls" smtpSecurity="tls"
    onImapSecurityChange={noop} onSmtpSecurityChange={noop} onClose={noop} onSave={noop} onDelete={noop} canSave={false}
    onUpdateAccount={noop} onRunProbe={noop} />);
  for (const label of ["Name", "E-Mail", "IMAP-Server", "IMAP-Port", "IMAP-Benutzername", "IMAP-Passwort", "SMTP-Server", "SMTP-Port", "SMTP-Benutzername", "SMTP-Passwort"]) {
    expect(page.getByLabelText(label).tagName).toBe("INPUT");
  }
  expect(page.getAllByLabelText("Sicherheit")).toHaveLength(2);
  expect(page.getByText("TLS: Ja · STARTTLS: Nein")).toBeTruthy();
  expect(page.getByRole("button", { name: "Sicherheit erkennen" })).toBeTruthy();
  expect((page.getByRole("button", { name: "Wird erkannt …" }) as HTMLButtonElement).disabled).toBe(true);
  expect(page.getByRole("button", { name: "Postfach löschen" })).toBeTruthy();
  expect(page.getByRole("button", { name: "Schließen" })).toBeTruthy();
  expect((page.getByRole("button", { name: "Speichern" }) as HTMLButtonElement).disabled).toBe(true);
});

test("mailbox deletion confirmation is German and names the address", async () => {
  const page = de(<AccountSettingsModal editingAccount={account} isOpen manageTab="account" isExistingAccount
    onClose={noop} onTabChange={noop} onSave={noop} onDelete={noop} />);
  fireEvent.click(page.getByRole("button", { name: "Postfach löschen" }));
  const dialog = await page.findByRole("dialog", { name: "Postfach löschen" });
  expect(dialog.textContent).toContain("mailbox@example.test und die lokalen Daten endgültig löschen?");
});

test("signatures tab adds a German default name and keeps user content untouched", () => {
  let next: AccountSettings | null = null;
  const withSignature = { ...account, settings: { signatures: [{ id: "s1", name: "My signature", body: "Regards" }] } };
  const page = de(<SignaturesTabContent editingAccount={withSignature} isExistingAccount canSave={false}
    onUpdateSettings={settings => { next = settings; }} onClose={noop} onSave={noop} />);
  expect(page.getByText("Signaturen")).toBeTruthy();
  expect((page.getByLabelText("Name") as HTMLInputElement).value).toBe("My signature");
  expect((page.getByLabelText("Signaturtext") as HTMLTextAreaElement).value).toBe("Regards");
  expect(page.getByRole("button", { name: "Löschen" })).toBeTruthy();
  fireEvent.click(page.getByRole("button", { name: "Signatur hinzufügen" }));
  expect((next as AccountSettings | null)?.signatures?.at(-1)?.name).toBe("Neue Signatur");
});

test("recipient alias form validates and edits in German", () => {
  const aliases: RecipientAlias[] = [{ id: "a1", name: "Team", recipients: "One <one@example.test>" } as RecipientAlias];
  const page = de(<RecipientAliasManager aliases={aliases} resetKey="k" onCreateAlias={async () => aliases[0]}
    onUpdateAlias={async () => aliases[0]} onDeleteAlias={async () => {}} />);
  expect(page.getByText("Team")).toBeTruthy();
  fireEvent.click(page.getByRole("button", { name: /Neuer Alias/ }));
  expect(page.getByText("Empfänger-Alias erstellen")).toBeTruthy();
  expect(page.getByPlaceholderText("Name <mail@example.com>, Weitere Person <weitere@example.com>")).toBeTruthy();
  fireEvent.click(page.getByRole("button", { name: "Alias erstellen" }));
  expect(page.getByText("Name und Empfänger sind erforderlich.")).toBeTruthy();
  fireEvent.click(page.getByRole("button", { name: "Alias bearbeiten" }));
  expect(page.getByText("„Team“ bearbeiten")).toBeTruthy();
  expect(page.getByRole("button", { name: "Alias speichern" })).toBeTruthy();
});

test("categorization tab translates category codes and empty states", async () => {
  const snapshot = {
    model: null, categoryCounts: [{ category: "newsletter", count: 3 }, { category: "uncategorized", count: 1 }],
    manualCategorizedCount: 2, feedback: { totalEvents: 0, lastEventAt: null, transitions: [], recent: [] }
  };
  const page = de(<CategorizationTabContent accountId="synthetic" isActive isExistingAccount onClose={noop} onSave={noop}
    apiFetch={async () => new Response(JSON.stringify({ ok: true, snapshot }))} />);
  await waitFor(() => expect(page.getByText("Newsletter: 3")).toBeTruthy());
  expect(page.getByText("Ohne Kategorie: 1")).toBeTruthy();
  expect(page.getByText("Manuell zugewiesene Kategorien: 2")).toBeTruthy();
  expect(page.getByText("Gesamt: 0 · Zuletzt: Nie")).toBeTruthy();
  expect(page.getByText("Noch keine Rückmeldungen.")).toBeTruthy();
  expect(page.getByRole("button", { name: "Lernmodell zurücksetzen" })).toBeTruthy();
});
