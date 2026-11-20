import { afterEach, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { refreshQueuedSubjects } from "./queue";
import { createQueueFixture, fixtureAccountId as accountId, fixtureStart } from "./queueTestFixture";

/** Queued rows show their step's new subject: only rows that were not attempted yet, rendered per recipient (synthetic data only). */

const databases: Database[] = [];
afterEach(() => { for (const db of databases.splice(0)) db.close(); });

function queuedRows() {
  const db = new Database(":memory:");
  databases.push(db);
  const fixture = createQueueFixture(db);
  for (const [contactId, firstName] of [["anna", "Anna"], ["ben", "Ben"], ["cara", "Cara"], ["dora", "Dora"]]) fixture.addContact(contactId, accountId, firstName);
  const sequence = fixture.sequence([{ subject: "Alt", text: "Eins" }, { subject: "Alt", text: "Zwei", delayMinutes: 60 }]);
  const [first, second] = sequence.steps;
  const insert = db.query(`INSERT INTO sends (id, accountId, kind, sequenceId, sequenceStepId, contactId, subject, status, attempts, queuedAt)
    VALUES (?, ?, 'sequence', ?, ?, ?, 'Alt', ?, ?, ?)`);
  const rows = {
    anna: [first.id, "anna", "queued", 0], ben: [first.id, "ben", "queued", 0],
    retried: [first.id, "cara", "queued", 1],
    // attempts 0 (as an imported or skipped row has it): only the status keeps it out.
    sent: [first.id, "dora", "sent", 0], otherStep: [second.id, "anna", "queued", 0]
  } as const;
  for (const [id, [stepId, contactId, status, attempts]] of Object.entries(rows)) insert.run(id, accountId, sequence.id, stepId, contactId, status, attempts, fixtureStart);
  const subjects = () => Object.fromEntries((db.query("SELECT id, subject FROM sends WHERE accountId = ? ORDER BY id").all(accountId) as Array<{ id: string; subject: string }>)
    .map(row => [row.id, row.subject]));
  const refresh = (subject: string) => refreshQueuedSubjects(db, accountId, sequence.id, [{ id: first.id, subject }], fixtureStart);
  return { subjects, refresh };
}

const untouched = { retried: "Alt", sent: "Alt", otherStep: "Alt" };

test("a subject with placeholders is rendered for each queued recipient of the step", () => {
  const { subjects, refresh } = queuedRows();
  refresh("Hallo {{ first_name }} von {{ organization.name }}");
  expect(subjects()).toEqual({ anna: "Hallo Anna von Verein", ben: "Hallo Ben von Verein", ...untouched });
});

test("a subject without placeholders is set on the step's queued rows that were not attempted", () => {
  const { subjects, refresh } = queuedRows();
  refresh("Neu");
  expect(subjects()).toEqual({ anna: "Neu", ben: "Neu", ...untouched });
});
