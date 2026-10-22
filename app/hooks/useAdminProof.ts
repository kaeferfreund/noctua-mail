"use client";

import { useCallback } from "react";
import { adminRequest, jsonMutation, type AdminFetch } from "./useAdminApi";

// Integration seam for Slice 7's lib/authClient.ts. Grants remain in the calling
// operation's memory, are spent once, and are never persisted or put in URLs.
export function useAdminProof(request: AdminFetch = fetch) {
  return useCallback(async (currentPassword: string, totpCode: string) => {
    const result = await adminRequest<{ grant: string; ceremonyRequired: boolean }>(request, "/api/auth/reauth",
      jsonMutation("POST", { purpose: "admin.recovery", currentPassword, totpCode }));
    if (result.ceremonyRequired || !result.grant) throw new Error("Fresh password and TOTP verification is required.");
    return result.grant;
  }, [request]);
}
