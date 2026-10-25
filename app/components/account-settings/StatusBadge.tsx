import type { ReactNode } from "react";
import { Badge } from "@/app/components/ui/badge";

/** Enabled/disabled account state in Settings and Admin tables: a dot and the wording. */
export default function StatusBadge({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  return <Badge variant="outline" className={enabled ? "font-normal" : "font-normal text-muted-foreground"}>
    <span aria-hidden="true" className={`size-1.5 rounded-full ${enabled ? "bg-emerald-500" : "bg-muted-foreground/60"}`} />{children}
  </Badge>;
}
