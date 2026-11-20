import { describe, expect, it } from "bun:test";
import { senderIconsEnabled } from "./accountPrefs";

// SD46: the effective sender-icon choice used by the icon route and readers.
describe("senderIconsEnabled", () => {
  it("lets the user's own choice win over the mailbox default", () => {
    expect(senderIconsEnabled({ appearance: { senderIcons: true } }, { appearance: { senderIcons: false } })).toBe(false);
    expect(senderIconsEnabled({ appearance: { senderIcons: false } }, { appearance: { senderIcons: true } })).toBe(true);
  });

  it("falls back to the mailbox setting and then to on", () => {
    expect(senderIconsEnabled({ appearance: { senderIcons: false } }, {})).toBe(false);
    expect(senderIconsEnabled(undefined)).toBe(true);
  });
});
