import { expect, test } from "bun:test";
import { NextResponse } from "next/server";
import { AUTH_JSON_BODY_LIMIT, readAuthJson } from "./readAuthJson";

function streamed(chunks: Uint8Array[]) {
  let reads = 0;
  let cancelled = false;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      const chunk = chunks[reads++];
      if (chunk) controller.enqueue(chunk);
      else controller.close();
    },
    cancel() { cancelled = true; }
  }, { highWaterMark: 0 });
  return {
    request: new Request("http://localhost:3000", { method: "POST", body }),
    reads: () => reads, cancelled: () => cancelled
  };
}

test("bounded auth JSON cancels at the first overflow chunk without reading the tail", async () => {
  const f = streamed([new Uint8Array(AUTH_JSON_BODY_LIMIT).fill(32), new Uint8Array([32]), new Uint8Array(2 * 1024 * 1024)]);
  const result = await readAuthJson(f.request);
  expect(result).toBeInstanceOf(NextResponse);
  const response = result as NextResponse;
  expect(response.status).toBe(413);
  expect(await response.json()).toEqual({ ok: false, code: "payload_too_large" });
  expect(f.reads()).toBe(2);
  expect(f.cancelled()).toBe(true);
  expect(f.request.body!.locked).toBe(false);
});

test("bounded auth JSON counts UTF-8 bytes and handles a split multibyte sequence at the limit", async () => {
  const json = '"ä"';
  const bytes = new TextEncoder().encode(" ".repeat(AUTH_JSON_BODY_LIMIT - 4) + json);
  expect(bytes.byteLength).toBe(AUTH_JSON_BODY_LIMIT);
  const exact = streamed([bytes.subarray(0, bytes.length - 2), bytes.subarray(bytes.length - 2)]);
  expect(await readAuthJson(exact.request)).toBe("ä");
  expect(exact.cancelled()).toBe(false);
  const oversized = streamed([new Uint8Array([32]), bytes]);
  expect((await readAuthJson(oversized.request) as NextResponse).status).toBe(413);
  expect(oversized.cancelled()).toBe(true);
});

test("bounded auth JSON preserves BOM handling and malformed/empty JSON errors", async () => {
  expect(await readAuthJson(new Request("http://localhost:3000", { method: "POST", body: '\uFEFF{"ok":true}' }))).toEqual({ ok: true });
  for (const body of [undefined, "", "{", " ".repeat(AUTH_JSON_BODY_LIMIT)]) {
    await expect(readAuthJson(new Request("http://localhost:3000", { method: "POST", body }))).rejects.toBeInstanceOf(SyntaxError);
  }
});
