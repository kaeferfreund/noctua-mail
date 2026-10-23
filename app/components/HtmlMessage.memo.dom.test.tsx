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
    const sanitizeHtmlPair = (input: string) => {
      calls.push(input);
      const safe = `<p>safe:${input.length}</p>`;
      return { block: safe, allow: safe };
    };

    const { rerender } = render(
      <HtmlMessage html="<p>Hello</p>" darkMode={false} fontScale={1} sanitizeHtmlPair={sanitizeHtmlPair} />
    );
    expect(calls).toEqual(["<p>Hello</p>"]);

    rerender(
      <HtmlMessage html="<p>Hello</p>" darkMode={true} fontScale={1.4} zoom={1.2} sanitizeHtmlPair={sanitizeHtmlPair} />
    );
    expect(calls).toEqual(["<p>Hello</p>"]);

    rerender(
      <HtmlMessage html="<p>Other</p>" darkMode={true} sanitizeHtmlPair={sanitizeHtmlPair} />
    );
    expect(calls).toEqual(["<p>Hello</p>", "<p>Other</p>"]);
  });
});
