import { randomUUID } from "crypto";
import { describe, expect, test } from "bun:test";
import type { Account, CalendarEvent } from "@/lib/data";
import { createAuthenticatedTestSession } from "@/lib/testAuthHarness";
import { dbModulePromise } from "@/lib/testDbHarness";

const { upsertAccount, upsertCalendarEvent, getCalendarEventById } = await dbModulePromise;
const { PUT } = await import("./route");
const { POST } = await import("../route");

const CALENDAR_URL = "https://caldav.example.test/cal/";

function buildAccount(accountId: string): Account {
  return {
    id: accountId,
    name: "Remote Linkage",
    email: "owner@example.test",
    avatar: "",
    imap: { host: "imap.example.test", port: 993, secure: true, user: "owner@example.test", password: "secret" },
    smtp: { host: "smtp.example.test", port: 465, secure: true, user: "owner@example.test", password: "secret" },
    caldav: { url: "https://caldav.example.test/", user: "owner@example.test", password: "secret" }
  };
}

function jsonRequest(url: string, method: string, cookie: string, body: unknown) {
  return new Request(url, {
    method,
    headers: { "content-type": "application/json", origin: "http://localhost:3000", cookie },
    body: JSON.stringify(body)
  });
}

const injected = { remoteHref: "https://attacker.example.test/collect.ics", remoteEtag: "attacker-etag" };

describe("calendar event writes keep the CalDAV linkage server-owned", () => {
  test("PUT and POST ignore remoteHref / remoteEtag from the request body", async () => {
    const accountId = `acc-linkage-${randomUUID()}`;
    await upsertAccount(buildAccount(accountId));
    const fixture = await createAuthenticatedTestSession(accountId);
    fixture.master.prepare("UPDATE user_accounts SET role='editor' WHERE userId=? AND accountId=?").run(fixture.user.id, accountId);
    const cookie = fixture.jar.header();
    const now = Date.UTC(2026, 0, 10, 9, 0, 0);
    const uid = `uid-${randomUUID()}@example.test`;
    const event: CalendarEvent = {
      id: `evt-${randomUUID()}`, accountId, calendarId: CALENDAR_URL, eventUid: uid, summary: "Synced",
      startAtMs: now, endAtMs: now + 1_800_000, allDay: false, sourceType: "caldav",
      remoteHref: `${CALENDAR_URL}${uid}.ics`, remoteEtag: "etag-1", createdAtMs: now, updatedAtMs: now
    };
    await upsertCalendarEvent(accountId, event);
    const base = `http://localhost/api/accounts/${accountId}/calendar/events`;

    const put = await PUT(jsonRequest(`${base}/${event.id}`, "PUT", cookie, { summary: "Edited", ...injected }),
      { params: Promise.resolve({ accountId, eventId: event.id }) });
    expect(put.status).toBe(200);
    expect(await getCalendarEventById(accountId, event.id)).toMatchObject({
      summary: "Edited", remoteHref: event.remoteHref, remoteEtag: "etag-1"
    });

    const repost = await POST(jsonRequest(base, "POST", cookie, { id: event.id, summary: "Reposted", startAtMs: now, sourceType: "caldav", ...injected }),
      { params: Promise.resolve({ accountId }) });
    expect(repost.status).toBe(200);
    expect(await getCalendarEventById(accountId, event.id)).toMatchObject({ remoteHref: event.remoteHref, remoteEtag: "etag-1" });

    const created = await POST(jsonRequest(base, "POST", cookie, { summary: "New", startAtMs: now, ...injected }),
      { params: Promise.resolve({ accountId }) });
    const createdBody = (await created.json()) as { event: CalendarEvent };
    const stored = await getCalendarEventById(accountId, createdBody.event.id);
    expect(stored?.remoteHref).toBeUndefined();
    expect(stored?.remoteEtag).toBeUndefined();
  });
});
