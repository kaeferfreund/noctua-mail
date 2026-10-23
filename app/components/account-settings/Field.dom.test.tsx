import { afterEach, expect, it } from "bun:test";
import { cleanup, render } from "@testing-library/react";
import { Flex, Switch, TextArea, Theme } from "@radix-ui/themes";
import { CreateMailbox } from "@/app/components/admin/AdminMailboxes";
import Field from "./Field";
afterEach(cleanup);
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
