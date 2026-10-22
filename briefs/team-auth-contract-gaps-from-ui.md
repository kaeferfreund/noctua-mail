# Contract gaps reported by the UI branches (for team-auth fix round 6 / integration)

Collected 2026-10-22 ~20:55 UTC from admin-ui-slice2a-r1 (feat/admin-ui 6a21154) and auth-ui-slice7-r1 (feat/auth-ui 19490f8). Base of both: 2458a09 (before fix round 5).

## From feat/admin-ui
1. Managers have no enabled-user directory to pick non-members for a shared mailbox (app/api/accounts/[accountId]/members/route.ts:10, app/api/admin/_auth.ts:10). Needed: a manager-accessible endpoint listing enabled users {id,name,email} (no roles, no security data) or an admin-only add flow accepted as the design.
2. Membership failures return message-only, no stable codes (members/[userId]/route.ts:18, admin/accounts/[accountId]/members/[userId]/route.ts:16). Needed: codes like owner_immutable, self_role, last_manager, target_disabled.
3. GET /api/admin/users mailbox DTO is actor-centric (fix round 5 P1 covers it) and exposes passkey counts only, no passkey ids/names → admin passkey removal cannot target a resource (app/api/admin/users/route.ts:55).
4. Invite history returns codes; legacy POST /api/admin/invites bypasses audit (fix round 5 P2); attempt limits (P3).
5. Audit paging is timestamp-exclusive and can skip entries sharing a boundary timestamp (app/api/admin/audit/route.ts:9, lib/db/adminAudit.ts:93). Needed: (createdAt,id) cursor.
6. Temporary proof hook app/hooks/useAdminProof.ts must be replaced by lib/authClient.ts reauth (slice 7) at integration.

## From feat/auth-ui
7. POST /api/accounts answered 503 auth_integration_pending on the base (app/api/_helpers/mailboxPatch.ts:37); slice 6 activates it → verify in auth-stage.
8. Browser harness lacked signup / session revoke / passkey rename dispatch (scripts/authBrowserServer.ts:59) → auth-stage extends it.
9. Browser runner hard-codes port 3784.
