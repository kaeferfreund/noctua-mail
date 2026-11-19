import { expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import type { SequenceStep } from "../types";
import { enroll } from "./queue";
import { OutreachScheduler } from "./scheduler";
import { getSequence, saveSequence } from "./store";
import { createQueueFixture, fixtureAccountId as accountId, fixtureListId as listId, fixtureStart as start } from "./queueTestFixture";

const minute = 60_000;
const at = (minutes: number) => start + minutes * minute;

/** A live sequence A (1 min), B (2), C (3), D (4) and one contact that has received A and B and waits for C (due at minute 6). */
async function waitingForC(db: Database) {
  const f = createQueueFixture(db);
  const draft = f.sequence(["A", "B", "C", "D"].map((subject, index) => ({ subject, text: `Schritt ${subject}`, delayMinutes: index + 1 })));
  f.addContact("first");
  enroll(db, accountId, { listId, contactId: "first", at: start });
  const scheduler = new OutreachScheduler(f.deps);
  const runUntil = async (minutes: number) => {
    for (let t = f.now(); t <= at(minutes); t += minute) {
      f.time(t);
      await scheduler.tick();
    }
  };
  await runUntil(3);
  expect(f.sent()).toEqual(["A", "B"]);
  expect(f.enrollment("first")).toMatchObject({ status: "active", nextStepPosition: 2, nextSendAt: at(6) });
  const steps = getSequence(db, accountId, draft.id).steps;
  const step = (subject: string) => steps.find(item => item.subject === subject)!;
  const save = (next: SequenceStep[]) => saveSequence(db, accountId, { steps: next }, { id: draft.id });
  return { f, scheduler, runUntil, step, save, sequenceId: draft.id };
}

test("deleting an earlier step keeps the waiting contact on its step", async () => {
  const db = new Database(":memory:");
  try {
    const { f, runUntil, step, save } = await waitingForC(db);
    save([step("B"), step("C"), step("D")]);
    expect(f.enrollment("first")).toMatchObject({ nextStepPosition: 1, nextSendAt: at(6) });
    await runUntil(30);
    expect(f.sent()).toEqual(["A", "B", "C", "D"]);
    expect(f.enrollment("first")).toMatchObject({ status: "completed" });
  } finally {
    db.close();
  }
});

test("deleting the awaited step moves the contact to the next surviving step with that step's delay", async () => {
  const db = new Database(":memory:");
  try {
    const { f, runUntil, step, save } = await waitingForC(db);
    save([step("A"), step("B"), step("D")]);
    // B was accepted at minute 3, D waits 4 minutes.
    expect(f.enrollment("first")).toMatchObject({ status: "active", nextStepPosition: 2, nextSendAt: at(7) });
    await runUntil(30);
    expect(f.sent()).toEqual(["A", "B", "D"]);
  } finally {
    db.close();
  }
});

test("deleting every step the contact has not reached completes the enrollment", async () => {
  const db = new Database(":memory:");
  try {
    const { f, step, save } = await waitingForC(db);
    save([step("A"), step("B")]);
    expect(f.enrollment("first")).toMatchObject({ status: "completed", nextStepPosition: null, nextSendAt: null });
    expect(f.enrollment("first")?.finishedAt).toBeNumber();
  } finally {
    db.close();
  }
});

test("moving the awaited step up keeps the contact on it and skips steps already received", async () => {
  const db = new Database(":memory:");
  try {
    const { f, runUntil, step, save } = await waitingForC(db);
    save([step("C"), step("A"), step("B"), step("D")]);
    expect(f.enrollment("first")).toMatchObject({ nextStepPosition: 0, nextSendAt: at(6) });
    await runUntil(30);
    expect(f.sent()).toEqual(["A", "B", "C", "D"]);
  } finally {
    db.close();
  }
});

test("moving a step the contact has not received in front of its position sends it next", async () => {
  const db = new Database(":memory:");
  try {
    const { f, runUntil, step, save } = await waitingForC(db);
    save([step("A"), step("D"), step("B"), step("C")]);
    // D now comes first among the steps still ahead: B was accepted at minute 3, D waits 4 minutes.
    expect(f.enrollment("first")).toMatchObject({ nextStepPosition: 1, nextSendAt: at(7) });
    await runUntil(30);
    expect(f.sent()).toEqual(["A", "B", "D", "C"]);
  } finally {
    db.close();
  }
});

test("moving the awaited step down sends the steps that moved ahead of it first", async () => {
  const db = new Database(":memory:");
  try {
    const { f, runUntil, step, save } = await waitingForC(db);
    save([step("A"), step("B"), step("D"), step("C")]);
    expect(f.enrollment("first")).toMatchObject({ nextStepPosition: 2, nextSendAt: at(7) });
    await runUntil(30);
    expect(f.sent()).toEqual(["A", "B", "D", "C"]);
  } finally {
    db.close();
  }
});

test("inserting a step before the contact's position keeps it waiting for its step", async () => {
  const db = new Database(":memory:");
  try {
    const { f, runUntil, step, save } = await waitingForC(db);
    save([step("A"), step("B"), { subject: "X", text: "Neu", delayMinutes: 1 } as SequenceStep, step("C"), step("D")]);
    expect(f.enrollment("first")).toMatchObject({ nextStepPosition: 3, nextSendAt: at(6) });
    await runUntil(30);
    expect(f.sent()).toEqual(["A", "B", "C", "D"]);
  } finally {
    db.close();
  }
});

test("a delay edit is compared with the same step, also when the step moves in the same save", async () => {
  const db = new Database(":memory:");
  try {
    const { f, step, save } = await waitingForC(db);
    save([step("A"), { ...step("C"), delayMinutes: 10 }, step("B"), step("D")]);
    // The old code compared position 1 (B, 2 minutes) and shifted the wrong enrollments.
    expect(f.enrollment("first")).toMatchObject({ nextStepPosition: 1, nextSendAt: at(13) });
  } finally {
    db.close();
  }
});

test("disable, change the delay and enable again reschedules the waiting contact", async () => {
  const db = new Database(":memory:");
  try {
    const { f, runUntil, step, save } = await waitingForC(db);
    const others = (c: SequenceStep) => [step("A"), step("B"), c, step("D")];
    save(others({ ...step("C"), enabled: false }));
    save(others({ ...step("C"), enabled: false, delayMinutes: 60 }));
    save(others({ ...step("C"), enabled: true, delayMinutes: 60 }));
    expect(f.enrollment("first")).toMatchObject({ nextStepPosition: 2, nextSendAt: at(63) });
    await runUntil(62);
    expect(f.sent()).toEqual(["A", "B"]);
    await runUntil(63);
    expect(f.sent()).toEqual(["A", "B", "C"]);
  } finally {
    db.close();
  }
});

test("a step disabled during its retry back-off is sent after it is enabled again", async () => {
  const db = new Database(":memory:");
  try {
    const f = createQueueFixture(db);
    const draft = f.sequence([{ subject: "A", text: "Eins", delayMinutes: 1 }, { subject: "B", text: "Zwei", delayMinutes: 2 }]);
    const steps = draft.steps;
    f.addContact("first");
    enroll(db, accountId, { listId, contactId: "first", at: start });
    const send = f.deps.send;
    f.deps.send = async () => ({ status: "retry", reason: "smtp_before_data" });
    const scheduler = new OutreachScheduler(f.deps);
    f.time(at(1));
    await scheduler.tick();
    expect(f.sends()[0]).toMatchObject({ status: "queued", attempts: 1, sendAt: at(2) });
    f.deps.send = send;
    saveSequence(db, accountId, { steps: [{ ...steps[0], enabled: false }, steps[1]] }, { id: draft.id });
    f.time(at(1) + 30_000);
    await scheduler.tick();
    saveSequence(db, accountId, { steps }, { id: draft.id });
    for (const minutes of [2, 3, 4, 5]) {
      f.time(at(minutes));
      await scheduler.tick();
    }
    expect(f.sent()).toEqual(["A", "B"]);
  } finally {
    db.close();
  }
});

test("a send skipped because its step was disabled does not block the step for good", async () => {
  const db = new Database(":memory:");
  try {
    const f = createQueueFixture(db);
    const draft = f.sequence([
      { subject: "A", text: "Eins", delayMinutes: 1 }, { subject: "B", text: "Zwei", delayMinutes: 2 }, { subject: "C", text: "Drei", delayMinutes: 1 }
    ]);
    const [a, b, c] = draft.steps;
    f.addContact("first");
    enroll(db, accountId, { listId, contactId: "first", at: start });
    const send = f.deps.send;
    f.deps.send = async () => ({ status: "retry", reason: "smtp_before_data" });
    const scheduler = new OutreachScheduler(f.deps);
    f.time(at(1));
    await scheduler.tick();
    f.deps.send = send;
    // A stays disabled past its retry time: the contact moves on to B.
    saveSequence(db, accountId, { steps: [{ ...a, enabled: false }, b, c] }, { id: draft.id });
    f.time(at(2));
    await scheduler.tick();
    expect(f.sends()[0]).toMatchObject({ status: "skipped", error: "step_changed" });
    expect(f.sent()).toEqual(["B"]);
    // A is enabled again after the contact's position and is still due for this contact.
    saveSequence(db, accountId, { steps: [b, c, { ...a, enabled: true }] }, { id: draft.id });
    for (const minutes of [3, 4, 5]) {
      f.time(at(minutes));
      await scheduler.tick();
    }
    expect(f.sent()).toEqual(["B", "C", "A"]);
    expect(f.sends().map(row => row.status)).toEqual(["sent", "sent", "sent"]);
    expect(f.enrollment("first")).toMatchObject({ status: "completed" });
  } finally {
    db.close();
  }
});
