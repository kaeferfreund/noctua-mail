import { useMemo } from "react";
import { create } from "qrcode";
import { cn } from "cn";

// Four modules of light margin, as the QR spec requires for reliable scanning.
const QUIET_ZONE = 4;

/** One SVG path for the dark modules; horizontal runs are merged into one rectangle. */
export function qrCodePath(value: string): { size: number; d: string } {
  const { modules } = create(value, { errorCorrectionLevel: "M" });
  let d = "";
  for (let row = 0; row < modules.size; row++) {
    for (let col = 0; col < modules.size; col++) {
      if (!modules.get(row, col)) continue;
      const start = col;
      while (col + 1 < modules.size && modules.get(row, col + 1)) col++;
      d += `M${start + QUIET_ZONE} ${row + QUIET_ZONE}h${col - start + 1}v1h-${col - start + 1}z`;
    }
  }
  return { size: modules.size + 2 * QUIET_ZONE, d };
}

/** Inline SVG QR code; always dark on white so it scans in the dark theme too. */
export function QrCode({ value, label, className }: { value: string; label: string; className?: string }) {
  const { size, d } = useMemo(() => qrCodePath(value), [value]);
  return <svg data-slot="qr-code" role="img" aria-label={label} viewBox={`0 0 ${size} ${size}`} shapeRendering="crispEdges" className={cn("block", className)}>
    <rect width={size} height={size} fill="#fff" />
    <path d={d} fill="#000" />
  </svg>;
}
