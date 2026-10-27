"use client";

import { useEffect } from "react";
import { installClientErrorReporting } from "@/lib/ui/clientErrorReporter";
import { installBlankScreenWatchdog } from "@/lib/ui/blankScreenWatchdog";

/** Reports uncaught errors, unhandled rejections and an app root that stays empty to the server log. */
export default function ClientErrorReporting() {
  useEffect(() => installClientErrorReporting(), []);
  useEffect(() => installBlankScreenWatchdog(), []);
  return null;
}
