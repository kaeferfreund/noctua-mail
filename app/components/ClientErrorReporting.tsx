"use client";

import { useEffect } from "react";
import { installClientErrorReporting } from "@/lib/ui/clientErrorReporter";

/** Reports uncaught errors and unhandled rejections of this tab to the server log. */
export default function ClientErrorReporting() {
  useEffect(() => installClientErrorReporting(), []);
  return null;
}
