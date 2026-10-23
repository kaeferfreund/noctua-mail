import { describe, expect, test } from "bun:test";
import { createShutdownCoordinator } from "./shutdown";

function fixture(deadlineMs = 1000) {
  const exits: number[] = [], logs: Array<[string, unknown]> = [];
  const coordinator = createShutdownCoordinator({ deadlineMs, exit: code => { exits.push(code); }, log: (message, details) => { logs.push([message, details]); } });
  return { coordinator, exits, logs };
}
describe("shutdown coordinator", () => {
  test("stops admission immediately, drains before closing, and exits zero once", async () => {
    const { coordinator: c, exits } = fixture();
    const order: string[] = [];
    let release!: () => void;
    const drained = new Promise<void>(resolve => { release = resolve; });
    c.add({ name: "watcher", phase: "stop", run: () => { order.push("stop"); } });
    c.add({ name: "workers", phase: "drain", run: async () => { order.push("drain"); await drained; order.push("drained"); } });
    c.add({ name: "db", phase: "close", run: () => { order.push("close"); } });
    const first = c.shutdown("SIGTERM");
    expect(c.stopping).toBe(true);
    expect(c.shutdown("SIGINT")).toBe(first);
    await Bun.sleep(1);
    expect(order).toEqual(["stop", "drain"]);
    expect(exits).toEqual([]);
    release(); await first;
    expect(order).toEqual(["stop", "drain", "drained", "close"]);
    expect(exits).toEqual([0]);
    await c.shutdown("SIGTERM"); expect(exits).toEqual([0]);
  });
  test("starts stop hooks together so a watcher can wait for a signalled worker", async () => {
    const { coordinator: c, exits } = fixture();
    let release!: () => void;
    const worker = new Promise<void>(resolve => { release = resolve; });
    c.add({ name: "watcher", phase: "stop", run: () => worker });
    c.add({ name: "workers", phase: "stop", run: () => { release(); } });
    await c.shutdown("SIGTERM"); expect(exits).toEqual([0]);
  });
  test("hook failures are logged and do not prevent later hooks or zero exit", async () => {
    const { coordinator: c, exits, logs } = fixture();
    let closed = false;
    c.add({ name: "broken", phase: "stop", run: () => { throw Error("synthetic failure"); } });
    c.add({ name: "rejected", phase: "drain", run: () => Promise.reject(Error("synthetic rejection")) });
    c.add({ name: "db", phase: "close", run: () => { closed = true; } });
    await c.shutdown("SIGTERM"); expect(closed).toBe(true); expect(exits).toEqual([0]);
    expect(logs.filter(([message]) => message === "[shutdown] hook failed")).toHaveLength(2);
  });
  test("deadline reports unfinished resources, exits zero and never closes DB under running work", async () => {
    const { coordinator: c, exits, logs } = fixture(20);
    let release!: () => void, closed = false;
    c.add({ name: "stalled-worker:123", phase: "drain", run: () => new Promise<void>(resolve => { release = resolve; }) });
    c.add({ name: "db", phase: "close", run: () => { closed = true; } });
    await c.shutdown("SIGTERM");
    expect(exits).toEqual([0]); expect(closed).toBe(false);
    expect(logs).toContainEqual(["[shutdown] deadline", { unfinished: ["stalled-worker:123"] }]);
    release(); await Bun.sleep(1);
    expect(closed).toBe(false); expect(exits).toEqual([0]);
  });
});
