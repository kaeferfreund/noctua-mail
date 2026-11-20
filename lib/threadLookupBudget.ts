/** Most thread/message ids one request-driven bulk thread lookup may name. */
export const THREAD_LOOKUP_MAX_SELECTORS = 5000;
/** MCP clients name threads one by one; a smaller selector cap suffices. */
export const MCP_THREAD_LOOKUP_MAX_SELECTORS = 200;

/** Output bound of a request-driven bulk thread lookup (REST, MCP). */
export type ThreadLookupBudget = {
  maxRows: number;
  /** Body and HTML body characters across all rows (full projection). */
  maxBodyChars?: number;
};

/** Budgets per projection: header rows are small, full rows carry bodies. */
export const THREAD_LOOKUP_BUDGETS: Record<"full" | "headers", ThreadLookupBudget> = {
  headers: { maxRows: 10_000 },
  full: { maxRows: 500, maxBodyChars: 16 * 1024 * 1024 }
};
