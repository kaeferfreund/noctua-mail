import { expect, test } from "bun:test";

// lib/testSetupDom.ts enables happy-dom's iframe page loading; child frames
// must still never fetch their src. The loopback server counts any request.
test("iframe src never triggers a network request in the DOM test run", async () => {
  let requests = 0;
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: () => { requests++; return new Response("<p>synthetic</p>", { headers: { "content-type": "text/html" } }); } });
  const outcomes: string[] = [];
  try {
    for (const src of [server.url.href, "https://iframe-probe.example.invalid/page"]) {
      const frame = document.createElement("iframe");
      const settled = new Promise<string>((resolve) => {
        frame.addEventListener("load", () => resolve("load"));
        frame.addEventListener("error", () => resolve("error"));
      });
      frame.src = src;
      document.body.append(frame);
      outcomes.push(`${await settled}:${frame.contentDocument?.body.innerHTML ?? ""}`);
      frame.remove();
    }
  } finally {
    await server.stop(true);
  }
  expect({ requests, outcomes }).toEqual({ requests: 0, outcomes: ["load:", "load:"] });
});
