import { NextResponse } from "next/server";
import { requireActiveUserSession, withAuthResponse } from "@/lib/auth";
import { listAccessibleAccountsForUser } from "@/lib/accountAccess";
import { domainIconVersions, normalizeIconDomain } from "@/lib/domainIcons";
import { mailboxGroupDomain } from "@/lib/senderIdentity";

/**
 * Versions of the admin-uploaded icons for the domains of the caller's own
 * mailboxes, keyed like the sidebar groups them. The sidebar adds the
 * version to the icon URL so a new upload replaces a cached favicon at once.
 */
export async function GET(request: Request) {
  const session = await requireActiveUserSession(request);
  if (session instanceof NextResponse) return session;
  return withAuthResponse(session, async () => {
    const groups = new Map<string, string>();
    for (const { account } of await listAccessibleAccountsForUser(session.userId)) {
      const group = mailboxGroupDomain(account.email);
      const domain = normalizeIconDomain(group);
      if (group && domain) groups.set(group, domain);
    }
    const versions = await domainIconVersions(groups.values());
    const icons: Record<string, string> = {};
    for (const [group, domain] of groups) {
      const version = versions.get(domain);
      if (version) icons[group] = version;
    }
    return NextResponse.json({ ok: true, icons }, { headers: { "Cache-Control": "no-store" } });
  });
}
