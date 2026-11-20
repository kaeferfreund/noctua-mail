import { expect, test } from "bun:test";
import { reserveStreamSlot } from "./imapStreamRegistry";

const limits = { perUserMailbox: 2, perUser: 3, perMailbox: 3, total: 4 };

test("live stream admission is capped per user and mailbox, per user, per mailbox and in total", () => {
  const run = crypto.randomUUID();
  const [userA, userB, userC] = ["a", "b", "c"].map(name => `${name}-${run}`);
  const [box1, box2, box3] = ["1", "2", "3"].map(name => `box${name}-${run}`);
  const held: Array<() => void> = [];
  const take = (mailbox: string, user: string) => {
    const release = reserveStreamSlot(mailbox, user, limits);
    if (release) held.push(release);
    return release !== null;
  };
  try {
    expect([take(box1, userA), take(box1, userA)]).toEqual([true, true]);
    expect(take(box1, userA)).toBe(false); // per user and mailbox
    expect(take(box2, userA)).toBe(true);
    expect(take(box3, userA)).toBe(false); // per user
    expect(take(box1, userB)).toBe(true);
    expect(take(box1, userC)).toBe(false); // per mailbox
    expect(take(box3, userC)).toBe(false); // total
    // Releasing (twice is harmless) frees exactly one slot again.
    held[0]();
    held[0]();
    expect(take(box3, userC)).toBe(true);
    expect(take(box3, userB)).toBe(false);
  } finally {
    for (const release of held) release();
  }
  expect(take(box1, userA)).toBe(true);
  for (const release of held) release();
});
