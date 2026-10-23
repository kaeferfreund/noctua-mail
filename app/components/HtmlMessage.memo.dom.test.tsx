import { afterEach, describe, expect, test } from "bun:test";
import { cleanup } from "@testing-library/react";
import { render } from "@/lib/i18n/testRender";
import HtmlMessage from "./HtmlMessage";

afterEach(() => {
  cleanup();
});

describe("HtmlMessage sanitize memo", () => {
  test("sanitizes again only when the html input changes", () => {
    const calls: string[] = [];
    const sanitizeHtml = (input: string) => {
      calls.push(input);
      return `<p>safe:${input.length}</p>`;
    };

    const { rerender } = render(
      <HtmlMessage html="<p>Hello</p>" darkMode={false} fontScale={1} sanitizeHtml={sanitizeHtml} />
    );
    expect(calls).toEqual(["<p>Hello</p>"]);

    rerender(
      <HtmlMessage html="<p>Hello</p>" darkMode={true} fontScale={1.4} zoom={1.2} sanitizeHtml={sanitizeHtml} />
    );
    expect(calls).toEqual(["<p>Hello</p>"]);

    rerender(
      <HtmlMessage html="<p>Other</p>" darkMode={true} sanitizeHtml={sanitizeHtml} />
    );
    expect(calls).toEqual(["<p>Hello</p>", "<p>Other</p>"]);
  });
});
