"use client";

import { useEffect, useState } from "react";
import { loadCurrentPushDeviceSettings, PUSH_DEVICE_CHANGED_EVENT } from "@/lib/push/client";
import type { PushDeviceSettings } from "@/lib/push/types";

/**
 * Push settings of this browser's device while signed in; null without a
 * registered device. Reloads when the notification settings change the device.
 */
export function useCurrentPushDeviceSettings(signedIn: boolean): PushDeviceSettings | null {
  const [settings, setSettings] = useState<PushDeviceSettings | null>(null);
  useEffect(() => {
    if (!signedIn) return;
    let active = true;
    let request = 0;
    const load = () => {
      const current = ++request;
      // No service worker, offline or signed out meanwhile: keep the previous value.
      void loadCurrentPushDeviceSettings().then(
        (next) => { if (active && current === request) setSettings(next); },
        () => {}
      );
    };
    load();
    window.addEventListener(PUSH_DEVICE_CHANGED_EVENT, load);
    return () => {
      active = false;
      window.removeEventListener(PUSH_DEVICE_CHANGED_EVENT, load);
    };
  }, [signedIn]);
  return signedIn ? settings : null;
}
