import { describe, expect, test } from "bun:test";
import type { Account } from "../data";
import {
  mapAdminAuditRow,
  mapUserAccountLinkRow,
  mapUserRow,
  mergeAccount,
  parseUserAccountPrefs
} from "./rowParsers";

function buildAccount(overrides: Partial<Account> = {}): Account {
  return {
    id: "acc-row-parsers",
    name: "Shared Inbox",
    email: "team@example.test",
    avatar: "SI",
    ownerUserId: "owner-user",
    settings: { layout: { defaultView: "threads" } },
    imap: {
      host: "imap.example.test",
      port: 993,
      secure: true,
      user: "team@example.test",
      password: "stored-imap-secret"
    },
    smtp: {
      host: "smtp.example.test",
      port: 465,
      secure: true,
      user: "team@example.test",
      password: "stored-smtp-secret"
    },
    ...overrides
  };
}

// Simulates an unchecked JSON request body: it may carry any key.
function requestBody(value: Record<string, unknown>): Partial<Account> {
  return JSON.parse(JSON.stringify(value));
}

describe("mergeAccount whitelist", () => {
  test("never patches id, ownerUserId, dbPath or email from a body", () => {
    const current = buildAccount();
    const merged = mergeAccount(
      current,
      requestBody({
        id: "acc-other",
        ownerUserId: "attacker-user",
        dbPath: "/tmp/elsewhere.db",
        email: "victim@example.invalid",
        name: "Renamed"
      })
    );

    expect(merged.id).toBe("acc-row-parsers");
    expect(merged.ownerUserId).toBe("owner-user");
    expect(merged.email).toBe("team@example.test");
    expect(Object.keys(merged)).not.toContain("dbPath");
    expect(merged.name).toBe("Renamed");
  });

  test("drops keys that are not account fields", () => {
    const merged = mergeAccount(buildAccount(), requestBody({ isAdmin: true, accessRole: "manager" }));
    expect(merged).toEqual(buildAccount());
  });

  test("a blank imap or smtp password keeps the stored one", () => {
    const current = buildAccount();
    const merged = mergeAccount(
      current,
      requestBody({
        imap: { ...current.imap, password: "" },
        smtp: { ...current.smtp, password: "   " }
      })
    );
    expect(merged.imap.password).toBe("stored-imap-secret");
    expect(merged.smtp.password).toBe("stored-smtp-secret");
  });

  test("a non-blank password replaces the stored one", () => {
    const current = buildAccount();
    const merged = mergeAccount(
      current,
      requestBody({
        imap: { password: "new-imap-secret" },
        smtp: { password: "new-smtp-secret" }
      })
    );
    expect(merged.imap).toEqual({ ...current.imap, password: "new-imap-secret" });
    expect(merged.smtp).toEqual({ ...current.smtp, password: "new-smtp-secret" });
  });

  test("patches the connection fields that are present and keeps the rest", () => {
    const current = buildAccount();
    const merged = mergeAccount(
      current,
      requestBody({ imap: { host: "imap2.example.test", port: 143, secure: false } })
    );
    expect(merged.imap).toEqual({
      host: "imap2.example.test",
      port: 143,
      secure: false,
      user: "team@example.test",
      password: "stored-imap-secret"
    });
    expect(merged.smtp).toEqual(current.smtp);
  });

  test("patches name, avatar, settings and caldav", () => {
    const merged = mergeAccount(
      buildAccount(),
      requestBody({
        name: "Support",
        avatar: "SU",
        settings: { calendar: { weekStartsOn: "sunday" } },
        caldav: { url: "https://dav.example.test", user: "team", password: "dav-secret" }
      })
    );
    expect(merged.name).toBe("Support");
    expect(merged.avatar).toBe("SU");
    expect(merged.settings).toEqual({
      layout: { defaultView: "threads" },
      calendar: { weekStartsOn: "sunday" }
    });
    expect(merged.caldav).toEqual({
      url: "https://dav.example.test",
      user: "team",
      password: "dav-secret"
    });
  });
});

describe("mapUserRow", () => {
  test("maps the team columns and never carries a password hash", () => {
    const row = {
      id: "user-1",
      email: "person@example.test",
      name: "  Example Person ",
      role: "admin",
      createdAt: 1700000000000,
      hasPassword: 1,
      mustChangePassword: 1,
      disabledAt: 1700000001000,
      passwordHash: "$argon2id$must-not-leak"
    };
    const user = mapUserRow(row);
    expect(user).toEqual({
      id: "user-1",
      email: "person@example.test",
      name: "Example Person",
      role: "admin",
      createdAt: 1700000000000,
      hasPassword: true,
      mustChangePassword: true,
      disabledAt: 1700000001000
    });
    expect(JSON.stringify(user)).not.toContain("argon2id");
  });

  test("defaults for legacy rows", () => {
    expect(
      mapUserRow({ id: "user-2", email: "legacy@example.test", role: "user", createdAt: 1 })
    ).toEqual({
      id: "user-2",
      email: "legacy@example.test",
      role: "user",
      createdAt: 1,
      hasPassword: false,
      mustChangePassword: false,
      disabledAt: null
    });
  });
});

describe("mapUserAccountLinkRow", () => {
  test("keeps known roles and degrades unknown ones to viewer", () => {
    expect(
      mapUserAccountLinkRow({ userId: "u", accountId: "a", role: "editor", grantedAt: 5 })
    ).toEqual({ userId: "u", accountId: "a", role: "editor", grantedByUserId: null, grantedAt: 5 });
    expect(mapUserAccountLinkRow({ userId: "u", accountId: "a", role: "owner" }).role).toBe(
      "viewer"
    );
  });
});

describe("parseUserAccountPrefs", () => {
  test("parses stored objects and treats anything else as empty", () => {
    expect(parseUserAccountPrefs('{"layout":{"defaultView":"table"}}')).toEqual({
      layout: { defaultView: "table" }
    });
    expect(parseUserAccountPrefs(null)).toEqual({});
    expect(parseUserAccountPrefs("[1,2]")).toEqual({});
    expect(parseUserAccountPrefs("not json")).toEqual({});
  });
});

describe("mapAdminAuditRow", () => {
  test("parses the payload and keeps nulls", () => {
    expect(
      mapAdminAuditRow({
        id: "audit-1",
        actorUserId: "admin-user",
        action: "member.grant",
        targetUserId: "user-1",
        targetAccountId: null,
        payload: '{"role":"editor"}',
        createdAt: 42
      })
    ).toEqual({
      id: "audit-1",
      actorUserId: "admin-user",
      action: "member.grant",
      targetUserId: "user-1",
      targetAccountId: null,
      payload: { role: "editor" },
      createdAt: 42
    });
  });
});
