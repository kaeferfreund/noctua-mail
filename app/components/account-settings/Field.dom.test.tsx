import { afterEach, expect, it } from "bun:test";
import { cleanup } from "@testing-library/react";
import { render } from "@/lib/i18n/testRender";
import { Flex, Switch, TextArea, Theme } from "@radix-ui/themes";
import { CreateMailbox } from "@/app/components/admin/AdminMailboxes";
import Field from "./Field";
import { Slot } from "radix-ui";
import SettingsFrame, { SettingsTitle } from "@/app/components/shell/SettingsFrame";
import TranslationTabContent from "./tabs/TranslationTabContent";
import CalendarTabContent from "./tabs/CalendarTabContent";
import SignaturesTabContent from "./tabs/SignaturesTabContent";
import type { Account } from "@/lib/data";
import AccountReloginDialog from "@/app/components/mailclient/AccountReloginDialog";
afterEach(cleanup);
const account: Account = { id: "synthetic", name: "Synthetic", email: "synthetic@example.test", avatar: "", imap: { host: "", port: 993, secure: true, user: "", password: "" }, smtp: { host: "", port: 465, secure: true, user: "", password: "" }, settings: { signatures: [{ id: "synthetic-signature", name: "Synthetic signature", body: "Synthetic body" }] } };
it("QA-007 labels all ten Create mailbox inputs and both security selectors", async () => {
  const page = render(<Theme><CreateMailbox apiFetch={async () => new Response('{}')} onClose={() => {}} onCreated={() => {}} /></Theme>);
  await page.findByRole("dialog", { name: "Create mailbox" });
  for (const label of ["Name", "Email", "IMAP host", "IMAP port", "IMAP user", "IMAP password", "SMTP host", "SMTP port", "SMTP user", "SMTP password"]) {
    expect(page.getByLabelText(label).tagName).toBe("INPUT");
  }
  expect(page.getAllByLabelText("Security")).toHaveLength(2);
});
it("QA-007 labels textarea and wrapped switch consumers and describes hints separately", () => {
  const page = render(<Theme>
    <Field label="Signature text" hint="Synthetic signature hint"><TextArea /></Field>
    <Field label="Enable translation"><Flex><Switch /></Flex></Field>
  </Theme>);
  const textarea = page.getByLabelText("Signature text");
  expect(textarea.tagName).toBe("TEXTAREA");
  expect(document.getElementById(textarea.getAttribute("aria-describedby")!)?.textContent).toBe("Synthetic signature hint");
  expect(page.getByLabelText("Enable translation").getAttribute("role")).toBe("switch");
});

it("QA-103 preserves a single child through Flex asChild and Slottable while labelling nested controls", () => {
  const page = render(<Theme>
    <Field label="Single switch"><Flex asChild><label><Switch /></label></Flex></Field>
    <Field label="Slottable switch"><Flex asChild><Slot.Slottable><label><Switch key="slotted-switch" /></label></Slot.Slottable></Flex></Field>
  </Theme>);
  for (const label of ["Single switch", "Slottable switch"]) {
    expect(page.getByLabelText(label).getAttribute("role")).toBe("switch");
  }
});

it("QA-103 mounts Translation in the settings frame with all controls labelled", async () => {
  const page = render(<Theme><SettingsFrame open onClose={() => {}}>
    <SettingsTitle>Settings</SettingsTitle>
    <TranslationTabContent editingAccount={account}
      isExistingAccount canSave={false} onUpdateAccount={() => {}} onClose={() => {}} onSave={() => {}} />
  </SettingsFrame></Theme>);
  await page.findByRole("dialog", { name: "Settings" });
  expect(page.getByLabelText("API key").tagName).toBe("INPUT");
  expect(page.getByLabelText("Enable translation").getAttribute("role")).toBe("switch");
  expect(page.getByLabelText("Default target language").getAttribute("role")).toBe("combobox");
});


it("QA-103 preserves labels for every Calendar and Signatures Field consumer", () => {
  const props = { editingAccount: account, isExistingAccount: true, canSave: false, onClose: () => {}, onSave: () => {} };
  const calendar = render(<Theme><CalendarTabContent {...props} onUpdateAccount={() => {}} /></Theme>);
  for (const label of ["Week starts on", "Server URL", "Username", "Password", "Calendar Path", "Sync Interval"]) {
    expect(calendar.getByLabelText(label).matches("input,button")).toBe(true);
  }
  calendar.unmount();
  const signatures = render(<Theme><SignaturesTabContent {...props} onUpdateSettings={() => {}} /></Theme>);
  for (const label of ["Default signature", "Name", "Signature text"]) {
    expect(signatures.getByLabelText(label).matches("input,textarea,button")).toBe(true);
  }
});

it("QA-103 preserves the mailbox credential repair Field labels", async () => {
  const page = render(<Theme><AccountReloginDialog open account={{ ...account, accessRole: "manager" }} onOpenChange={() => {}} readErrorMessage={async () => ""} /></Theme>);
  await page.findByRole("dialog", { name: "Mailbox credentials required" });
  for (const label of ["IMAP user", "IMAP password"]) {
    const input = page.getByLabelText(label);
    expect(document.getElementById(input.getAttribute("aria-labelledby")!)?.textContent).toBe(label);
  }
});
