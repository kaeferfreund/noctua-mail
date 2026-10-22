import { describe, expect, it } from "bun:test";
import { sanitizeHtmlForDisplay } from "./sanitize";
import { messageHtmlCsp, remoteContentSenderKey, senderAllowsRemoteContent } from "./remoteContent";

const remote = "https://images.example.test/photo.png";
const local = "/api/accounts/demo/messages/newsletter/attachments/logo";

describe("message HTML privacy", () => {
  it("blocks remote images and mixed srcsets while retaining dimensions and inline resources", () => {
    const out = sanitizeHtmlForDisplay(`<picture><source srcset="${remote} 2x"><img width="240" height="120" src="${remote}" srcset="cid:logo 1x, ${remote} 2x"></picture><img src="cid:logo"><img src="data:image/png;base64,AAA"><img src="${local}">`);
    expect(out).toContain(`data-remote-src="${remote}"`);
    expect(out).toContain('src="data:image/gif;base64,');
    expect(out).toContain('width="240"');
    expect(out).not.toMatch(/\ssrcset=/);
    expect(out).toContain('src="cid:logo"');
    expect(out).toContain('src="data:image/png;base64,AAA"');
    expect(out).toContain(`src="${local}"`);
  });

  it("retains inline-only srcsets, including data images", () => {
    const out = sanitizeHtmlForDisplay(`<picture><source srcset="data:image/png;base64,AAAA 1x, cid:logo 2x"><img srcset="data:image/png;base64,AAAA 1x, cid:logo 2x"></picture>`);
    expect(out).toContain('srcset="data:image/png;base64,AAAA 1x, cid:logo 2x"');
  });

  for (const value of [remote, "//images.example.test/p", " /pixel ", "HTTPS://images.example.test/p", "https:&#10;//images.example.test/p"]) {
    it(`blocks a resource URL ${value}`, () => {
      expect(sanitizeHtmlForDisplay(`<img src="${value}">`)).toContain('src="data:image/gif');
    });
  }

  for (const value of [
    `url(${remote})`, `URL( '${remote}' )`, `url(  "${remote}"  )`,
    String.raw`u\72l(https://images.example.test/p)`, String.raw`url(\68 ttps://images.example.test/p)`,
    `image-set("${remote}" 1x)`, `url(//images.example.test/p)`, `url(/pixel)`
  ]) {
    it(`filters CSS resource value ${value}`, () => {
      const input = `<style>.photo{background:${value};padding:12px}</style><p style='background:${value.replaceAll("'", "&apos;")};color:red'>Hello</p>`;
      for (const mode of ["block", "allow"] as const) {
        const out = sanitizeHtmlForDisplay(input, mode);
        expect(out).not.toContain("background:");
        expect(out).toContain("padding:12px");
        expect(out).toContain("color:red");
      }
    });
  }

  for (const directive of [
    `@import "${remote}";`, `@IMPORT url( '${remote}' ) screen;`,
    String.raw`@\69mport "https://images.example.test/p";`,
    `@import/* comment */url(${remote}) layer(theme);`
  ]) {
    it(`filters CSS directive ${directive}`, () => {
      for (const mode of ["block", "allow"] as const) {
        expect(sanitizeHtmlForDisplay(`<style>${directive}.ok{color:red}</style>`, mode)).not.toContain("images.example.test");
      }
    });
  }

  it("keeps local CSS images and strips media, embedded documents, forms and bases", () => {
    const out = sanitizeHtmlForDisplay(`<style>.logo{background:url("cid:logo")}.inline{background:url(data:image/png;base64,AAAA)}</style><base href="${remote}"><form action="${remote}"><input formaction="${remote}"></form><video poster="${remote}" src="${remote}"></video><audio src="${remote}"></audio><object data="${remote}"></object><embed src="${remote}">`);
    expect(out).toContain('url("cid:logo")');
    expect(out).toContain("url(data:image/png;base64,AAAA)");
    expect(out).not.toContain("images.example.test");
    expect(out).not.toMatch(/<(?:base|form|video|audio|object|embed)\b/);
  });

  it("removes all HTTP directives, handlers and scripts in either mode", () => {
    for (const mode of ["block", "allow"] as const) {
      for (const name of ["refresh", " ReFrEsH ", "content-security-policy", "set-cookie"]) {
        const out = sanitizeHtmlForDisplay(`<META HTTP-EQUIV = '${name}' content='0;url=${remote}'><img src='${remote}' onerror='alert(1)'><script>alert(1)</script>`, mode);
        expect(out).not.toContain("http-equiv");
        expect(out).not.toContain("onerror");
        expect(out).not.toContain("<script");
      }
    }
  });

  it("keeps sender metadata from overriding the viewer referrer policy", () => {
    for (const mode of ["block", "allow"] as const) {
      const out = sanitizeHtmlForDisplay('<META NAME=" ReFeRrEr " content="unsafe-url">', mode);
      expect(out).not.toContain("unsafe-url");
      expect(out.toLowerCase()).not.toContain("referrer");
    }
  });

  it("allows remote images only in the explicit allow mode, with no referrer", () => {
    const input = `<style>@import url('${remote}');.photo{background:url('${remote}')}</style><img src="${remote}" srcset="${remote} 2x">`;
    const out = sanitizeHtmlForDisplay(input, "allow");
    expect(out).not.toContain("@import");
    expect(out).not.toContain("background:");
    expect(out).toContain(`src="${remote}"`);
    expect(out).toContain(`srcset="${remote} 2x"`);
    expect(out).not.toContain("data-remote-src");
    expect(out).toContain('referrerpolicy="no-referrer"');
  });

  it("overrides image referrer policies and filters remote fonts and stylesheets in both modes", () => {
    for (const mode of ["block", "allow"] as const) {
      const out = sanitizeHtmlForDisplay(`<link rel="stylesheet" href="${remote}"><style>@font-face{font-family:Sender;src:url(${remote})}p{font-family:Sender}</style><img src="cid:logo" referrerpolicy="unsafe-url">`, mode);
      expect(out).not.toContain("images.example.test");
      expect(out).not.toContain("unsafe-url");
      expect(out).toContain('referrerpolicy="no-referrer"');
      expect(messageHtmlCsp(mode)).toContain("style-src 'unsafe-inline'; font-src 'self' data:;");
    }
  });

  const deceptiveFrom = '"Trusted <trusted@example.test>" <ACTUAL@EXAMPLE.TEST>';
  it("rejects sender permission for an address embedded in a quoted display name", () => {
    expect(senderAllowsRemoteContent({ remoteContent: { allowedSenders: { "trusted@example.test": true } } }, deceptiveFrom)).toBe(false);
  });

  it("matches sender permission for the real parsed From mailbox", () => {
    expect(remoteContentSenderKey(`  ${deceptiveFrom}  `)).toBe("actual@example.test");
    expect(senderAllowsRemoteContent({ remoteContent: { allowedSenders: { "actual@example.test": true } } }, deceptiveFrom)).toBe(true);
  });

  it("matches sender preferences by lower-cased address and keeps policies restrictive", () => {
    expect(senderAllowsRemoteContent({ remoteContent: { allowedSenders: { "sender@example.test": true } } }, "Synthetic <SENDER@EXAMPLE.TEST>")).toBe(true);
    expect(senderAllowsRemoteContent({}, "sender@example.test")).toBe(false);
    expect(messageHtmlCsp()).toContain("default-src 'none'");
    expect(messageHtmlCsp()).not.toContain("https:");
    expect(messageHtmlCsp("allow")).toContain("https: http:");
  });
});
