import { describe, expect, it } from "bun:test";
import { migrateCollapsedDomains, collapsedDomainsKey, parseCollapsedDomains, toggleCollapsedDomain } from "./collapsedDomains";

describe("collapsed sidebar domains", () => {
  it("keys the state per user", () => {
    expect(collapsedDomainsKey("user-1")).toBe("noctua:sidebarDomainsCollapsed:user-1");
    expect(collapsedDomainsKey("user-2")).not.toBe(collapsedDomainsKey("user-1"));
    expect(collapsedDomainsKey(null)).toBe("noctua:sidebarDomainsCollapsed:anonymous");
  });

  it("reads only a JSON array of entries", () => {
    expect([...parseCollapsedDomains('["a.example.test","b.example.test"]')]).toEqual(["a.example.test", "b.example.test"]);
    expect([...parseCollapsedDomains('["a.example.test",3,null]')]).toEqual(["a.example.test"]);
    for (const raw of [null, "", "{", '{"a.example.test":true}', '"a.example.test"']) {
      expect(parseCollapsedDomains(raw).size).toBe(0);
    }
  });

  it("toggles one domain and serialises sorted", () => {
    const once = toggleCollapsedDomain(new Set(["b.example.test"]), "a.example.test");
    expect(once).toBe('["a.example.test","b.example.test"]');
    expect(toggleCollapsedDomain(parseCollapsedDomains(once), "b.example.test")).toBe('["a.example.test"]');
    expect(toggleCollapsedDomain(new Set(), "")).toBe('[""]');
  });

  it("migrates section entries once, preserving collapsed domains without duplicates", () => {
    const raw = '["mine:a.example.test","shared:b.example.test","shared:a.example.test",""]';
    const migrated = migrateCollapsedDomains(raw);
    expect(migrated).toBe('["","a.example.test","b.example.test"]');
    expect(migrateCollapsedDomains(migrated)).toBeNull();
    expect([...parseCollapsedDomains(raw)]).toEqual(["a.example.test", "b.example.test", ""]);
    expect(toggleCollapsedDomain(parseCollapsedDomains(raw), "a.example.test")).toBe('["","b.example.test"]');
  });
});
