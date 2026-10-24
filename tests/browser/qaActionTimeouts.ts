// Shared Playwright `use` budgets for the QA browser configs. Without them a click on a stale
// selector waits for the whole test timeout (up to 480 s) and cuts off the test's cleanup.
// Actions get more than the 20 s expect budget so a slow but healthy UI still passes under load;
// navigations get room for a cold dev-server compile.
export const qaActionTimeouts = { actionTimeout: 30_000, navigationTimeout: 120_000 } as const;
