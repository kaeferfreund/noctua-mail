import { expect, test } from "bun:test";
import { findSerializedSignatureBlock } from "./signatureHtmlTracking";
import { replaceSignatureBlock } from "@/lib/signatureTemplates";
test("tracks the first Lexical serialization without replacing edited or duplicate text", () => {
  const block = '<p dir="ltr"><span style="white-space: pre-wrap;">Regards,</span><br><span>Alex</span></p>';
  const html = `<p>Note</p>${block}`;
  expect(findSerializedSignatureBlock(html, "Regards,\nAlex")).toBe(block);
  expect(replaceSignatureBlock(html, block, "<p>Jo</p>", "")).toEqual({ body: "<p>Note</p><p>Jo</p>", conflict: false });
  expect(findSerializedSignatureBlock(html.replace("Alex", "Alex edited"), "Regards,\nAlex")).toBeUndefined();
  expect(findSerializedSignatureBlock(html + block, "Regards,\nAlex")).toBeUndefined();
});
