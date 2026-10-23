import { expect, test } from "bun:test";

test("streams constructed during shutdown leave no subscriptions or fake timers", async () => {
  // Separate process: shutting down the process-global registry must not poison
  // other auth/stream tests sharing this Bun test process.
  const child = Bun.spawn([process.execPath, "--eval", `
    import {jest} from 'bun:test';
    import {createUserEventStream} from './lib/userEvents';
    import {registerAuthStream} from './lib/authStreams';
    import './lib/server/shutdown';
    await globalThis[Symbol.for('noctua.shutdown')].coordinator.shutdown('test', {exit:false,close:false});
    const identity={userId:'synthetic',sessionId:'synthetic',generation:1,authenticatedAt:Date.now(),expiresAt:Date.now()+60000};
    jest.useFakeTimers();
    let cleanups=0;
    const auth=registerAuthStream(identity,()=>{cleanups++});
    const reader=createUserEventStream(new Request('http://localhost/api/me/events'),identity).getReader();
    const done=(await reader.read()).done;
    const timers=jest.getTimerCount();
    const subscriptions=globalThis.__noctuaMailboxWatcherEvents.listenerCount('mailbox')+globalThis.__noctuaThreadCollabEvents.listenerCount('collab');
    jest.useRealTimers();
    console.log(JSON.stringify({done,timers,subscriptions,cleanups,closed:auth.closed}));
  `], { stdout: "pipe", stderr: "pipe" });
  const stdout = new Response(child.stdout).text(), stderr = new Response(child.stderr).text();
  expect(await child.exited).toBe(0);
  expect(await stderr).toBe("");
  expect(JSON.parse((await stdout).trim().split("\n").at(-1)!)).toEqual({ done: true, timers: 0, subscriptions: 0, cleanups: 1, closed: true });
});
