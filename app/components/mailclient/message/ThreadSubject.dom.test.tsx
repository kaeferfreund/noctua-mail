import { afterEach, expect, it } from "bun:test";
import { cleanup, fireEvent, render } from "@testing-library/react";
import ThreadSubject from "./ThreadSubject";
afterEach(cleanup);
it("QA-005 keeps the full subject accessible and offers expansion and collapse", () => {
  const subject = "Synthetic long subject repeated for mobile reader space. ".repeat(4).trim();
  const page = render(<ThreadSubject subject={subject} />);
  const text = page.getByTitle(subject);
  expect(text.dataset.expanded).toBe("false");
  const button = page.getByRole("button", { name: "Expand subject" });
  expect(button.getAttribute("aria-controls")).toBe(text.id);
  fireEvent.click(button);
  expect(text.textContent).toBe(subject);
  expect(text.dataset.expanded).toBe("true");
  fireEvent.click(page.getByRole("button", { name: "Collapse subject" }));
  expect(text.dataset.expanded).toBe("false");
});
