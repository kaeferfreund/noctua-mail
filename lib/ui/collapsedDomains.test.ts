import { describe, expect, it } from "bun:test";
import { collapsedDomainsInSection, collapsedDomainsKey, parseCollapsedDomains, toggleCollapsedDomain } from "./collapsedDomains";

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

  it("toggles one section's domain and serialises sorted", () => {
    const once = toggleCollapsedDomain(new Set(["mine:b.example.test"]), "mine", "a.example.test");
    expect(once).toBe('["mine:a.example.test","mine:b.example.test"]');
    expect(toggleCollapsedDomain(parseCollapsedDomains(once), "mine", "b.example.test")).toBe('["mine:a.example.test"]');
    expect(toggleCollapsedDomain(new Set(), "shared", "")).toBe('["shared:"]');
  });

  it("keeps the same domain in Eigene and Geteilte apart", () => {
    const entries = parseCollapsedDomains(toggleCollapsedDomain(new Set(), "shared", "a.example.test"));
    expect([...collapsedDomainsInSection(entries, "shared")]).toEqual(["a.example.test"]);
    expect(collapsedDomainsInSection(entries, "mine").size).toBe(0);
  });

  it("treats a legacy bare domain as collapsed in both sections until one is toggled", () => {
    const legacy = parseCollapsedDomains('["a.example.test",""]');
    expect([...collapsedDomainsInSection(legacy, "mine")]).toEqual(["a.example.test", ""]);
    expect([...collapsedDomainsInSection(legacy, "shared")]).toEqual(["a.example.test", ""]);
    const expanded = parseCollapsedDomains(toggleCollapsedDomain(legacy, "mine", "a.example.test"));
    expect([...expanded]).toEqual(["mine:", "shared:", "shared:a.example.test"]);
    expect([...collapsedDomainsInSection(expanded, "mine")]).toEqual([""]);
    expect([...collapsedDomainsInSection(expanded, "shared")]).toEqual(["", "a.example.test"]);
  });
});
