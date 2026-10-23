import { describe, expect, test } from "bun:test";
import { gunzipSync } from "node:zlib";
import { acceptsGzip, COMPRESSED_JSON_MIN_BYTES, compressedJsonResponse } from "./compressedJson";

function bigBody() {
  return {
    items: Array.from({ length: 200 }, (_, index) => ({
      id: `message-${index}`,
      subject: `Synthetic subject ${index}`,
      from: "alice@example.test"
    }))
  };
}

function requestWith(acceptEncoding?: string) {
  return new Request("http://localhost/api/test", {
    headers: acceptEncoding === undefined ? {} : { "accept-encoding": acceptEncoding }
  });
}

describe("acceptsGzip", () => {
  test("parses codings, wildcards and q-values", () => {
    expect(acceptsGzip(null)).toBe(false);
    expect(acceptsGzip("")).toBe(false);
    expect(acceptsGzip("identity")).toBe(false);
    expect(acceptsGzip("br, deflate")).toBe(false);
    expect(acceptsGzip("gzip")).toBe(true);
    expect(acceptsGzip("gzip, deflate, br, zstd")).toBe(true);
    expect(acceptsGzip(" GZIP ;q=0.5")).toBe(true);
    expect(acceptsGzip("x-gzip")).toBe(true);
    expect(acceptsGzip("gzip;q=0")).toBe(false);
    expect(acceptsGzip("gzip; q=0.000, br")).toBe(false);
    expect(acceptsGzip("gzip;q=invalid")).toBe(false);
    expect(acceptsGzip("*")).toBe(true);
    expect(acceptsGzip("*;q=0")).toBe(false);
    expect(acceptsGzip("gzip;q=0, *")).toBe(false);
    expect(acceptsGzip("*;q=0, gzip")).toBe(true);
  });
});

describe("compressedJsonResponse", () => {
  test("gzips a large body for a gzip-accepting client and round-trips", async () => {
    const body = bigBody();
    const json = JSON.stringify(body);
    expect(json.length).toBeGreaterThanOrEqual(COMPRESSED_JSON_MIN_BYTES);
    const response = compressedJsonResponse(requestWith("gzip, deflate, br"), body, {
      status: 201,
      headers: { "cache-control": "private, max-age=5", vary: "Cookie" }
    });
    expect(response.status).toBe(201);
    expect(response.headers.get("content-encoding")).toBe("gzip");
    expect(response.headers.get("content-type")).toBe("application/json");
    expect(response.headers.get("cache-control")).toBe("private, max-age=5");
    expect(response.headers.get("vary")).toBe("Cookie, Accept-Encoding");
    const bytes = new Uint8Array(await response.arrayBuffer());
    expect(bytes.byteLength).toBeLessThan(json.length / 4);
    expect(gunzipSync(bytes).toString("utf8")).toBe(json);
  });

  test("leaves small bodies and non-gzip clients uncompressed", async () => {
    const small = { ok: true, items: [] };
    for (const [request, body] of [
      [requestWith("gzip"), small],
      [requestWith(), bigBody()],
      [requestWith("gzip;q=0, br"), bigBody()]
    ] as const) {
      const response = compressedJsonResponse(request, body);
      expect(response.headers.get("content-encoding")).toBeNull();
      expect(response.headers.get("content-type")).toBe("application/json");
      expect(response.headers.get("vary")).toBe("Accept-Encoding");
      expect(await response.json()).toEqual(body);
    }
  });

  test("the threshold is the serialized byte size", () => {
    const at = (size: number) => compressedJsonResponse(requestWith("gzip"), "é".repeat(size));
    // "é" is two UTF-8 bytes; plus two quote bytes.
    const belowChars = (COMPRESSED_JSON_MIN_BYTES - 4) / 2;
    expect(at(belowChars).headers.get("content-encoding")).toBeNull();
    expect(at(belowChars + 1).headers.get("content-encoding")).toBe("gzip");
  });

  test("a fetch client decodes the gzip body transparently", async () => {
    const body = bigBody();
    const server = Bun.serve({
      port: 0,
      hostname: "127.0.0.1",
      fetch: (request) => compressedJsonResponse(request, body)
    });
    try {
      const response = await fetch(server.url, { headers: { "accept-encoding": "gzip" } });
      expect(response.headers.get("content-encoding")).toBe("gzip");
      expect(await response.json()).toEqual(body);
    } finally {
      await server.stop(true);
    }
  });
});
