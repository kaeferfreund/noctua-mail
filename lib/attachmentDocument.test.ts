import { describe, expect, test } from "bun:test";
import { attachmentContentDisposition, attachmentDocumentCsp, blobPreviewMimeType } from "./attachmentDocument";

describe("attachment document policy", () => {
  test("sandboxes every non-PDF type and forbids form submission", () => {
    for (const type of ["text/html", "TEXT/HTML; charset=utf-8", "image/svg+xml", "application/xhtml+xml",
      "text/xml", "application/xml", "image/png", "text/plain", "application/octet-stream", "", null, undefined]) {
      const policy = attachmentDocumentCsp(type).split(/;\s*/);
      expect({ type, sandbox: policy.includes("sandbox") }).toEqual({ type, sandbox: true });
      expect(policy).toContain("form-action 'none'");
      expect(policy).toContain("default-src 'none'");
      expect(policy).toContain("base-uri 'none'");
      expect(policy).toContain("frame-ancestors 'self'");
    }
  });

  test("keeps PDFs unsandboxed for the browser's viewer but still without forms", () => {
    const policy = attachmentDocumentCsp("application/pdf").split(/;\s*/);
    expect(policy).not.toContain("sandbox");
    expect(policy).toContain("form-action 'none'");
    expect(policy).toContain("default-src 'none'");
  });

  test("shows active types of browser-only attachments as text", () => {
    for (const type of ["text/html", "image/svg+xml", "application/xhtml+xml", "text/xml", "application/xml",
      "text/javascript", "application/octet-stream", "text/markdown", ""]) {
      expect({ type, preview: blobPreviewMimeType(type) }).toEqual({ type, preview: "text/plain;charset=utf-8" });
    }
    for (const type of ["image/png", "image/jpeg", "application/pdf", "text/plain;charset=iso-8859-1"]) {
      expect(blobPreviewMimeType(type)).toBe(type);
    }
  });

  test("keeps quotes, backslashes and RFC 5987 delimiters out of the file name values", () => {
    expect(attachmentContentDisposition("inline", 'a"; filename="evil.html')).toBe(
      "inline; filename=\"a_; filename=_evil.html\"; filename*=UTF-8''a%22%3B%20filename%3D%22evil.html"
    );
    expect(attachmentContentDisposition("attachment", "x\\y'(1)*.txt")).toBe(
      "attachment; filename=\"x_y'(1)*.txt\"; filename*=UTF-8''x%5Cy%27%281%29%2A.txt"
    );
    expect(attachmentContentDisposition("inline", "Bericht für Jörg.pdf")).toBe(
      "inline; filename=\"Bericht f_r J_rg.pdf\"; filename*=UTF-8''Bericht%20f%C3%BCr%20J%C3%B6rg.pdf"
    );
  });
});
