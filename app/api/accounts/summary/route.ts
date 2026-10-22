import { createMailboxSummaryHandler } from "@/app/api/_helpers/mailboxSummary";
// Transitional selected-account summary. feat/collab-ui owns the canonical
// /api/me/mailboxes/summary route and assigned-to-me / unassigned-open counts
// over accessible accounts (v5 fit item 14 is not delivered by this route).
export const GET = createMailboxSummaryHandler();
