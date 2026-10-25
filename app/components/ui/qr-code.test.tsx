import { describe, expect, it } from "bun:test";
import { create } from "qrcode";
import { qrCodePath } from "./qr-code";

// Rebuild the module grid from the path and compare it with the encoder's matrix.
function modulesFromPath(d: string, size: number) {
  const grid = Array.from({ length: size }, () => Array<boolean>(size).fill(false));
  for (const [, x, y, w] of d.matchAll(/M(\d+) (\d+)h(\d+)v1h-\d+z/g)) for (let i = 0; i < Number(w); i++) grid[Number(y)][Number(x) + i] = true;
  return grid;
}

describe("qrCodePath", () => {
  it("draws exactly the dark modules with a four-module quiet zone", () => {
    const value = "https://mail.example.test/#invite=0d4c6f2e-8b1a-4c3d-9e2f-1a2b3c4d5e6f";
    const { modules } = create(value, { errorCorrectionLevel: "M" });
    const { size, d } = qrCodePath(value);
    expect(size).toBe(modules.size + 8);
    const grid = modulesFromPath(d, size);
    for (let row = 0; row < size; row++) for (let col = 0; col < size; col++) {
      const inside = row >= 4 && col >= 4 && row < size - 4 && col < size - 4;
      expect(grid[row][col]).toBe(inside ? Boolean(modules.get(row - 4, col - 4)) : false);
    }
  });
});
