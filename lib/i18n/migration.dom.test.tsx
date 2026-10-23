import { afterEach, expect, it } from "bun:test";
import { cleanup, fireEvent } from "@testing-library/react";
import { render, I18nTestProvider } from "./testRender";
import StatusSelect from "@/app/components/collab/StatusSelect";
import InternalNoteComposer from "@/app/components/collab/InternalNoteComposer";
import ThreadCollaborationBar from "@/app/components/collab/ThreadCollaborationBar";
import type { ThreadCollabController } from "@/app/hooks/useThreadCollab";
import { AuthError } from "@/app/components/auth/AuthPrimitives";
import { AuthClientError } from "@/lib/authClient";

afterEach(cleanup);

it("switches status labels while preserving the underlying status code", () => {
  let selected = "";
  const tree = (locale: "de" | "en") => <I18nTestProvider locale={locale}><StatusSelect value="in_progress" onChange={value => { selected = value; }} /></I18nTestProvider>;
  const page = render(tree("en"));
  expect(page.getByRole("combobox", {name: "Thread status"}).textContent).toContain("In progress");
  page.rerender(tree("de"));
  const trigger = page.getByRole("combobox", {name: "Thread-Status"});
  expect(trigger.textContent).toContain("In Bearbeitung");
  fireEvent.click(trigger);
  fireEvent.click(page.getByRole("option", {name: "Abgeschlossen"}));
  expect(selected).toBe("closed");
});

it("retains user note content and relocalizes a failed-save notice after switching language", async () => {
  const tree = (locale: "de" | "en") => <I18nTestProvider locale={locale}><InternalNoteComposer body="Synthetic user note — do not translate" onBodyChange={() => {}} onSaved={() => {}} onSubmit={async () => false} /></I18nTestProvider>;
  const page = render(tree("en"));
  fireEvent.click(page.getByRole("button", {name: "Add note"}));
  await page.findByRole("alert");
  page.rerender(tree("de"));
  expect(page.getByRole("alert").textContent).toBe("Die Notiz konnte nicht gespeichert werden. Dein Text bleibt erhalten.");
  expect((page.getByRole("textbox") as HTMLTextAreaElement).value).toBe("Synthetic user note — do not translate");
});

it("renders singular/plural collaboration counts and translates an existing auth error", () => {
  const controller = {state: {commentCount: 1, status: "open", assigneeUserId: null}, members: [], me: null, readDenied: false, pending: false} as unknown as ThreadCollabController;
  const error = new AuthClientError(400, "INVALID_CODE");
  const tree = (locale: "de" | "en", count: number) => <I18nTestProvider locale={locale}><ThreadCollaborationBar collab={{...controller, state: {...controller.state!, commentCount: count}}} role="viewer" onNote={() => {}} onActivity={() => {}} /><AuthError error={error} /></I18nTestProvider>;
  const page = render(tree("en", 1));
  expect(page.getByRole("button", {name: "1 internal note"}).textContent).toBe("1 note");
  page.rerender(tree("de", 2));
  expect(page.getByRole("button", {name: "2 interne Notizen"}).textContent).toBe("2 Notizen");
  expect(page.getByRole("alert").textContent).toBe("Dieser Code ist falsch. Versuche einen neuen Code.");
});
