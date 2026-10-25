import { describe, expect, test } from "bun:test";
import type { Account } from "@/lib/data";
import { MAILBOX_GROUPING_MIN, groupMailboxes, mailboxAvatarUrl, mailboxInitials, mailboxLabel, sortMailboxes } from "./types";

function account(overrides: Partial<Account> & { id: string }): Account {
  return {
    name: "",
    email: `${overrides.id}@example.com`,
    avatar: "",
    imap: { host: "imap.example.com", port: 993, secure: true, user: "", password: "" },
    smtp: { host: "smtp.example.com", port: 465, secure: true, user: "", password: "" },
    ...overrides
  };
}

describe("sortMailboxes", () => {
  test("keeps own and shared mailboxes in one list sorted by name, without mutating the input", () => {
    const first = { ...account({ id: "first", name: "Zulu" }), shared: true };
    const second = account({ id: "second" });
    const third = { ...account({ id: "third", name: "alpha" }), shared: true };
    const input = [first, second, third];
    expect(sortMailboxes(input).map((item) => item.id)).toEqual(["third", "second", "first"]);
    expect(input.map((item) => item.id)).toEqual(["first", "second", "third"]);
  });

  test("breaks name ties by e-mail, then id", () => {
    const b = account({ id: "b", name: "Team", email: "team@example.com" });
    const a = account({ id: "a", name: "team", email: "team@example.com" });
    const other = account({ id: "c", name: "Team", email: "office@example.com" });
    expect(sortMailboxes([b, a, other]).map((item) => item.id)).toEqual(["c", "a", "b"]);
  });
});

describe("mailboxInitials", () => {
  test("uses the first and last word of the name", () => {
    expect(mailboxInitials({ name: "Support Desk", email: "support@example.com" })).toBe("SD");
    expect(mailboxInitials({ name: "Ada Example Person", email: "" })).toBe("AP");
  });

  test("falls back to the first two letters of a single-word name", () => {
    expect(mailboxInitials({ name: "sales", email: "" })).toBe("SA");
  });

  test("falls back to the e-mail local part", () => {
    expect(mailboxInitials({ name: "  ", email: "billing@example.test" })).toBe("BI");
    expect(mailboxInitials({ name: "", email: "" })).toBe("?");
  });
});

describe("mailboxLabel", () => {
  test("prefers the trimmed name and falls back to the e-mail", () => {
    expect(mailboxLabel({ name: " Team ", email: "team@example.com" })).toBe("Team");
    expect(mailboxLabel({ name: "", email: "team@example.com" })).toBe("team@example.com");
  });
});

describe("mailboxAvatarUrl", () => {
  test("accepts image URLs and treats other stored values as no avatar", () => {
    expect(mailboxAvatarUrl({ avatar: "https://avatars.example.test/a.png" })).toBe("https://avatars.example.test/a.png");
    expect(mailboxAvatarUrl({ avatar: "/avatars/a.png" })).toBe("/avatars/a.png");
    expect(mailboxAvatarUrl({ avatar: "data:image/png;base64,AAAA" })).toBe("data:image/png;base64,AAAA");
    expect(mailboxAvatarUrl({ avatar: "NW" })).toBeNull();
    expect(mailboxAvatarUrl({ avatar: "" })).toBeNull();
  });
});

describe("groupMailboxes", () => {
  test("keeps six rows ungrouped and groups seven by normalized domain", () => {
    const accounts = Array.from({ length: 7 }, (_, i) => account({
      id: String(i), email: `box${i}@${i % 2 ? "Z.EXAMPLE" : "a.example"}`
    }));
    expect(MAILBOX_GROUPING_MIN).toBe(7);
    expect(groupMailboxes(accounts.slice(0, 6))[0].domain).toBeNull();
    const grouped = groupMailboxes(accounts);
    expect(grouped.map((group) => group.domain)).toEqual(["a.example", "z.example"]);
    expect(grouped[0].accounts.map((row) => row.id)).toEqual(["0", "2", "4", "6"]);
    expect(grouped[1].accounts.map((row) => row.id)).toEqual(["1", "3", "5"]);
  });
  test("handles empty sections", () => {
    expect(groupMailboxes([])).toEqual([{ domain: null, accounts: [] }]);
  });
});
