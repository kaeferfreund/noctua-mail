"use client";

import { useCallback, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { getExceptionAccountId } from "./utils/clientHelpers";

type ApiErrorMessageParams = {
  setAuthState: (state: "unauth") => void;
  setReloginAccountId: (accountId: string) => void;
  setReloginDescription: (description: string) => void;
};

/** Resolve structured API errors at the UI boundary before generic diagnostics. */
export function useApiErrorMessage({ setAuthState, setReloginAccountId, setReloginDescription }: ApiErrorMessageParams) {
  const tn = useTranslations("Notifications");
  // Keep the resolver's identity locale-independent: the mount bootstrap effect
  // depends on it, and a UI language switch must not re-bootstrap the mailbox
  // (that unmounts the open composer). The latest translator is read at call time.
  const tnRef = useRef(tn);
  useEffect(() => { tnRef.current = tn; }, [tn]);
  return useCallback(async (res: Response) => {
    const responsePath = (() => {
      if (!res.url) return null;
      try {
        const url = new URL(res.url);
        return `${url.pathname}${url.search}`;
      } catch {
        return null;
      }
    })();
    const withRequestPath = (message: string) => {
      if (!responsePath) return message;
      const normalized = message.trim();
      if (!normalized) return message;
      const statusOnly = normalized === String(res.status);
      const statusPrefix = normalized.startsWith(`${res.status}`);
      const statusTextOnly =
        res.statusText && normalized.toLowerCase() === res.statusText.toLowerCase();
      const requestFailedOnly = normalized === `Request failed (${res.status})`;
      if (statusOnly || statusPrefix || statusTextOnly || requestFailedOnly) {
        return `${normalized} ${responsePath}`.trim();
      }
      return message;
    };
    try {
      const data = (await res.json()) as {
        message?: string;
        error?: string;
        stack?: string;
        details?: string;
        code?: string;
        accountId?: string;
        reauthRequired?: boolean;
        repairAllowed?: boolean;
      };
      const resolvedAccountId =
        data?.accountId?.trim() || getExceptionAccountId(responsePath ?? "") || "";
      if (data?.code === "folder_account_mismatch") return tnRef.current("folderAccountMismatch");
      if (data?.code === "mailbox_credentials_invalid") {
        if (data.repairAllowed && resolvedAccountId) {
          setReloginAccountId(resolvedAccountId); setReloginDescription("Repair the mailbox credentials to restore access.");
          return "Mailbox credentials need repair.";
        }
        setReloginAccountId("");
        return "Mailbox unavailable; contact a manager.";
      }
      // Personal auth 401 is logout. Form proof/permission failures use 403.
      if (res.status === 401 && !responsePath?.startsWith("/api/ba/")) setAuthState("unauth");
      const parts = [data?.message, data?.error, data?.details, data?.stack].filter(
        (value) => value && typeof value === "string"
      ) as string[];
      if (parts.length) return withRequestPath(parts.join("\n"));
    } catch {
      // ignore
    }
    try {
      const text = await res.text();
      if (text) return withRequestPath(text.slice(0, 2000));
    } catch {
      // ignore
    }
    return withRequestPath(`Request failed (${res.status})`);
  }, [setAuthState, setReloginAccountId, setReloginDescription]);
}
