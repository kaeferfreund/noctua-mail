import { expect, test } from "bun:test";
import { CLIENT_ERROR_LIMITS, clientErrorLocation, sanitizeClientErrorReport } from "./clientErrors";

test("a location keeps the path and parameter names, never the values of a search or deep link", () => {
  expect(clientErrorLocation("https://mail.example.test/?a=~qa&f=INBOX&m=~id&q=private%20search&q=again")).toEqual({ path: "/", queryKeys: ["a", "f", "m", "q"] });
  expect(clientErrorLocation("/message/window?id=synthetic")).toEqual({ path: "/message/window", queryKeys: ["id"] });
});

test("a report keeps only known, truncated fields", () => {
  const report = sanitizeClientErrorReport({
    source: "boundary", message: `TypeError: x\u0000${"m".repeat(5000)}`, stack: `at A\n\tat B${"s".repeat(9000)}`,
    digest: "d".repeat(100), path: "/?q=secret", queryKeys: ["a", "q", "bad key", 7, "x".repeat(40)],
    build: "b".repeat(300), userAgent: "Synthetic UA", standalone: true, cookie: "session=secret", body: "mail text"
  });
  expect(report).not.toBeNull();
  expect(Object.keys(report!).sort()).toEqual(["build", "digest", "message", "path", "queryKeys", "source", "stack", "standalone", "userAgent"]);
  expect(report!.message.startsWith("TypeError: xm")).toBe(true);
  expect(report!.message.length).toBe(CLIENT_ERROR_LIMITS.message);
  expect(report!.stack.startsWith("at A\n\tat B")).toBe(true);
  expect(report!.stack.length).toBe(CLIENT_ERROR_LIMITS.stack);
  expect(report!.digest.length).toBe(CLIENT_ERROR_LIMITS.digest);
  expect(report!.build.length).toBe(CLIENT_ERROR_LIMITS.build);
  expect(report!.path).toBe("/");
  expect(report!.queryKeys).toEqual(["a", "q"]);
  expect(report!.standalone).toBe(true);
  expect(JSON.stringify(report)).not.toContain("secret");
});

test("anything that is not a report is rejected", () => {
  for (const input of [null, "crash", [], {}, { source: "boundary" }, { source: "server", message: "x" }, { source: "error", message: 5 }]) {
    expect(sanitizeClientErrorReport(input)).toBeNull();
  }
  expect(sanitizeClientErrorReport({ source: "error", message: "x", standalone: "yes" })?.standalone).toBe(false);
});
