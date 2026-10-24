import { afterEach, expect, test } from "bun:test";
import { cleanup, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { render, I18nTestProvider } from "@/lib/i18n/testRender";
import type { CalendarReminder } from "@/lib/data";
import EventDialog from "./EventDialog";
import EventReminderDialog from "./EventReminderDialog";
import EventResponseDialog from "./EventResponseDialog";

afterEach(cleanup);

const german = { wrapper: ({ children }: { children: ReactNode }) => <I18nTestProvider locale="de">{children}</I18nTestProvider> };
const noop = () => {};

test("new and edit event dialogs render in German", () => {
  const view = render(<EventDialog open accountId="synthetic-account" onClose={noop} />, german);
  const dialog = screen.getByRole("dialog", { name: "Neuer Termin" });
  expect(within(dialog).getByPlaceholderText("Titel des Termins")).toBeTruthy();
  expect(within(dialog).getByText("Beschreibung")).toBeTruthy();
  expect(within(dialog).getByPlaceholderText("Beschreibung (optional)")).toBeTruthy();
  expect(within(dialog).getByRole("button", { name: "Abbrechen" })).toBeTruthy();
  expect(within(dialog).getByRole("button", { name: "Erstellen" })).toBeTruthy();
  view.unmount();

  render(<EventDialog open accountId="synthetic-account" onClose={noop}
    event={{ id: "synthetic-event", summary: "Synthetischer Termin", startAtMs: Date.UTC(2026, 9, 26, 9), sourceType: "local" }} />, german);
  const edit = screen.getByRole("dialog", { name: "Termin bearbeiten" });
  expect(within(edit).getByRole("button", { name: "Löschen" })).toBeTruthy();
  expect(within(edit).getByRole("button", { name: "Speichern" })).toBeTruthy();
});

test("reminder dialog renders in German with leads from the catalog", () => {
  const reminder = { id: "synthetic-reminder", leadMinutes: 120, leadLabel: "2 hours before" } as CalendarReminder;
  render(<EventReminderDialog open onOpenChange={noop} title="" existingReminder={reminder} leadOptionValue="60"
    onLeadOptionChange={noop} onSchedule={noop} savingReminder={false} />, german);
  const dialog = screen.getByRole("dialog", { name: "Erinnerung ändern" });
  expect(within(dialog).getByText("Kalendertermin")).toBeTruthy();
  expect(within(dialog).getByText("Aktuell: 2 Stunden vorher")).toBeTruthy();
  expect(within(dialog).getByText("Erinnere mich")).toBeTruthy();
  expect(within(dialog).getByRole("combobox").textContent).toBe("1 Stunde vorher");
  expect(within(dialog).getByRole("button", { name: "Abbrechen" })).toBeTruthy();
  expect(within(dialog).getByRole("button", { name: "Erinnerung aktualisieren" })).toBeTruthy();
});

test("response dialog renders in German, including the submit label per answer", () => {
  const props = {
    open: true, onOpenChange: noop, title: "", timeRange: "26.10.2026, 09:00–10:00",
    responseTargetLabel: "Dieser Termin: 26.10.2026, 09:00–10:00", organizer: "orga@example.test",
    onDraftPartstatChange: noop, draftScope: "series" as const, onDraftScopeChange: noop,
    canChooseOccurrenceScope: true, responseOccurrenceLabel: "Dieser Termin", sendReply: true,
    onSendReplyChange: noop, replyRequested: false, submittingResponse: false, onSubmit: noop,
    isReplyChoice: () => true
  };
  const view = render(<EventResponseDialog {...props} draftPartstat="ACCEPTED" />, german);
  const dialog = screen.getByRole("dialog", { name: "Auf Einladung antworten" });
  for (const text of ["Termin ohne Titel", "Organisator: orga@example.test", "Deine Antwort", "Gilt für",
    "Ganze Serie", "Organisator benachrichtigen", "Antwort per E-Mail senden",
    "Der Organisator hat keine Antwort angefordert. Du kannst trotzdem eine senden."]) {
    expect(within(dialog).getByText(text)).toBeTruthy();
  }
  for (const name of ["Zusagen", "Mit Vorbehalt", "Absagen", "Abbrechen", "Zusagen und Antwort senden"]) {
    expect(within(dialog).getByRole("button", { name })).toBeTruthy();
  }
  expect(within(dialog).getByRole("switch", { name: "Antwort an den Organisator senden" })).toBeTruthy();
  view.rerender(<EventResponseDialog {...props} draftPartstat="TENTATIVE" sendReply={false} />);
  expect(within(dialog).getByRole("button", { name: "Mit Vorbehalt zusagen, ohne Antwort zu senden" })).toBeTruthy();
});
