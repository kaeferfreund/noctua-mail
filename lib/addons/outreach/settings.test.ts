import { afterAll, beforeAll, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { outreachAddonEnabled, outreachPublicOrigin } from "./config";
import { closeOutreachDb, getOutreachDb, getOutreachDbPath, OUTREACH_SCHEMA_VERSION } from "./db";
import { mcpToolScope, MCP_TOOL_SCOPES } from "@/lib/mcpPermissions";
import { OUTREACH_MCP_TOOL_SCOPES } from "./mcpScopes";
import { getOutreachSettings, listOutreachSettings, normalizeOutreachSettingsPatch, OutreachSettingsError, saveOutreachSettings } from "./settings";

let dir = "";
const previousDataDir = process.env.NOCTUA_DATA_DIR;
beforeAll(() => {
  dir = mkdtempSync(path.join(tmpdir(), "outreach-settings-"));
  process.env.NOCTUA_DATA_DIR = dir;
});
afterAll(() => {
  closeOutreachDb();
  if (previousDataDir === undefined) delete process.env.NOCTUA_DATA_DIR; else process.env.NOCTUA_DATA_DIR = previousDataDir;
  rmSync(dir, { recursive: true, force: true });
});

test("the addon is off unless the flag is exactly 1", () => {
  expect(outreachAddonEnabled({})).toBe(false);
  expect(outreachAddonEnabled({ NOCTUA_ADDON_OUTREACH: "true" })).toBe(false);
  expect(outreachAddonEnabled({ NOCTUA_ADDON_OUTREACH: "1" })).toBe(true);
});

test("the tracking origin prefers its own variable and rejects non-http values", () => {
  expect(outreachPublicOrigin({})).toBeNull();
  expect(outreachPublicOrigin({ BETTER_AUTH_URL: "https://mail.example.test/app" })).toBe("https://mail.example.test");
  expect(outreachPublicOrigin({ NOCTUA_OUTREACH_PUBLIC_URL: "https://links.example.test", BETTER_AUTH_URL: "https://mail.example.test" })).toBe("https://links.example.test");
  expect(outreachPublicOrigin({ NOCTUA_OUTREACH_PUBLIC_URL: "javascript:alert(1)" })).toBeNull();
});

test("the addon database is its own file with its own schema version", async () => {
  const db = await getOutreachDb();
  expect(getOutreachDbPath()).toBe(path.join(dir, "db", "addons", "outreach.db"));
  expect(OUTREACH_SCHEMA_VERSION).toBe(4);
  expect((db.prepare("PRAGMA user_version").get() as { user_version: number }).user_version).toBe(OUTREACH_SCHEMA_VERSION);
  const tables = (db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all() as { name: string }[]).map(row => row.name);
  expect(tables).toEqual(["account_settings", "api_tokens", "campaigns", "contacts", "erased_addresses", "list_members", "lists", "sends",
    "sequence_enrollments", "sequence_steps", "sequences", "templates", "tracking_events", "tracking_links"]);
});

test("settings default to not activated and keep unpatched fields", async () => {
  expect(await getOutreachSettings("acc-a")).toMatchObject({ enabled: false, transport: "ses", trackMailDefault: false, ipRetentionDays: 90, updatedAt: null });
  await saveOutreachSettings("acc-a", { enabled: true, organizationName: "Example GmbH" }, "user-1", 1000);
  const saved = await saveOutreachSettings("acc-a", { trackMailDefault: true }, "user-1", 2000);
  expect(saved).toMatchObject({ enabled: true, organizationName: "Example GmbH", trackMailDefault: true, updatedAt: 2000 });
  expect(await listOutreachSettings(["acc-a", "acc-b"])).toHaveLength(1);
  expect(await listOutreachSettings([])).toEqual([]);
});

test("a settings patch is validated field by field", () => {
  expect(normalizeOutreachSettingsPatch({ transport: "mailbox-smtp", sendRatePerMinute: 10, senderIdentityId: null })).toEqual({ transport: "mailbox-smtp", sendRatePerMinute: 10, senderIdentityId: null });
  for (const bad of [null, [], { enabled: "yes" }, { transport: "sendmail" }, { ipRetentionDays: -1 }, { sendRatePerMinute: 0 }, { senderIdentityId: " " }]) {
    expect(() => normalizeOutreachSettingsPatch(bad)).toThrow(OutreachSettingsError);
  }
});

test("addon MCP tools are classified without touching the core allowlist", () => {
  for (const name of Object.keys(OUTREACH_MCP_TOOL_SCOPES)) expect(Object.hasOwn(MCP_TOOL_SCOPES, name)).toBe(false);
  expect(mcpToolScope("schedule_campaign")).toBe("send");
  expect(mcpToolScope("get_message_tracking")).toBe("read");
  expect(() => mcpToolScope("unknown_outreach_tool")).toThrow();
});
