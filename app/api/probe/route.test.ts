import { describe, expect, test } from "bun:test";
import net from "node:net";
import { randomUUID } from "node:crypto";
import { POST } from "./route";
import { createAuthenticatedTestSession, getSharedTestAuthHarness } from "@/lib/testAuthHarness";
import { withDbWriteRetry } from "@/lib/dbWriteRetry";

describe("probe session gate", () => {
  test("unauthenticated and enrollment requests make zero connections; MFA probes forward refresh cookies", async () => {
    let connections = 0;
    const server = net.createServer(socket => { connections++; socket.destroy(); });
    await new Promise<void>(resolve => server.listen(0, resolve));
    try {
      const port = (server.address() as net.AddressInfo).port;
      const request = (cookie = "") => new Request("http://localhost:3000/api/probe", {
        method: "POST", headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ protocol: "imap", host: "localhost", port })
      });
      expect((await POST(request())).status).toBe(401);
      const h = await getSharedTestAuthHarness();
      const user = await h.createUser(`probe-setup-${randomUUID()}@example.test`);
      const setup = await h.signIn(user.email);
      await h.seedSessionSecurity(setup.session!.session.id, user.id, "setup");
      expect((await POST(request(setup.jar.header()))).status).toBe(403);
      await new Promise(resolve => setTimeout(resolve, 20));
      expect(connections).toBe(0);
      const f = await createAuthenticatedTestSession();
      await withDbWriteRetry("test.probeRefresh", () => f.master.prepare("UPDATE auth_session SET updatedAt=?,expiresAt=? WHERE id=?")
        .run(new Date(Date.now()-7200_000).toISOString(),new Date(Date.now()+79200_000).toISOString(),f.session.id));
      const response = await POST(request(f.jar.header()));
      expect(response.status).toBe(200);
      expect(connections).toBe(2);
      expect(response.headers.getSetCookie().length).toBeGreaterThan(0);
    } finally {
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }
  });
});
