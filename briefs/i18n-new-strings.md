# New user-facing strings added after the i18n inventory (for slice 2+)

Inventory baseline: briefs/i18n-plan.md (wt-ui-shell @ ba9d34a). Strings introduced later, to be added to the catalogs:

| Branch / commit | File | String(s) |
|---|---|---|
| perf/settings-modal-lazy ddf5406 | app/components/MailClient.tsx (settings lazy overlay) | aria-label "Settings" |
| perf/admin-panel-lazy db595c5 | app/components/LazyDialogLoading.tsx | loading labels "Admin" and the mailbox ("Postfach anlegen") variant |
| feat/collab-ui-2b 7e1149a | app/components/shell/ShellSidebar.tsx, app/hooks/useMailboxSummaries.ts | "Unread", "Unread count unavailable", "{count} assigned to me", "{count} unassigned open", "Watcher: {state}", "—" |
| feat/i18n-infra 1d0e187 | messages/{de,en}.json | Settings.language.* (already in catalogs), Pwa.description |
| fix/graceful-shutdown bc2ddae | server logs only | none user-facing |

Open product decision: form of address (du/Sie) — orchestrator recommendation "du"; proceed with "du" unless the user objects.
