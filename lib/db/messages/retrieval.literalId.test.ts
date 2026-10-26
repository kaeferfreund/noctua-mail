import { expect, test } from "bun:test";
import { createCollabFixture } from "../../testThreadCollabHarness";
import { getMessageById } from "./retrieval";

test("Message-ID fallback treats LIKE metacharacters literally", async () => {
  const f = await createCollabFixture();
  await f.seed(f.message("<ordinary@example.test>"));
  for (const id of ["<%>", "<_>", "<\\>"]) {
    expect(await getMessageById(f.accountId, id)).toBeNull();
  }
  for (const fragment of ["literal%id", "literal_id", "literal\\id"]) {
    const message = f.message(`<prefix-${fragment}@example.test>`);
    await f.seed(message);
    expect((await getMessageById(f.accountId, `<${fragment}>`))?.id).toBe(message.id);
  }
});
