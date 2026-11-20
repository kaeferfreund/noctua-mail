import { describe, expect, test } from "bun:test";
import { buildAppContentSecurityPolicy, createCspNonce } from "./securityHeaders";

function directives(policy: string) {
  return new Map(policy.split(";").map((part) => {
    const [name, ...values] = part.trim().split(/\s+/);
    return [name, values] as const;
  }));
}

describe("app Content-Security-Policy", () => {
  test("allows scripts only by nonce and blocks plugins, base and framing", () => {
    const policy = directives(buildAppContentSecurityPolicy({ nonce: "c3ludGhldGljLW5vbmNl" }));
    expect(policy.get("script-src")).toEqual(["'self'", "'nonce-c3ludGhldGljLW5vbmNl'", "'strict-dynamic'"]);
    expect(policy.get("object-src")).toEqual(["'none'"]);
    expect(policy.get("base-uri")).toEqual(["'self'"]);
    expect(policy.get("form-action")).toEqual(["'self'"]);
    expect(policy.get("frame-ancestors")).toEqual(["'none'"]);
    expect(policy.get("default-src")).toEqual(["'self'"]);
    expect(policy.get("worker-src")).toEqual(["'self'"]);
    for (const [name, values] of policy) {
      if (name === "style-src") continue;
      expect({ name, inline: values.includes("'unsafe-inline'") }).toEqual({ name, inline: false });
      expect({ name, eval: values.includes("'unsafe-eval'") }).toEqual({ name, eval: false });
    }
  });

  test("adds eval for the development server only", () => {
    expect(buildAppContentSecurityPolicy({ nonce: "abc", dev: true })).toContain("'strict-dynamic' 'unsafe-eval';");
  });

  test("rejects a nonce that could add directives", () => {
    expect(() => buildAppContentSecurityPolicy({ nonce: "abc'; script-src *" })).toThrow();
    expect(() => buildAppContentSecurityPolicy({ nonce: "" })).toThrow();
  });

  test("creates fresh base64 nonces of 128 bits", () => {
    const nonces = new Set(Array.from({ length: 50 }, () => createCspNonce()));
    expect(nonces.size).toBe(50);
    for (const nonce of nonces) {
      expect(nonce).toMatch(/^[A-Za-z0-9+/]{22}==$/);
      expect(() => buildAppContentSecurityPolicy({ nonce })).not.toThrow();
    }
  });
});
