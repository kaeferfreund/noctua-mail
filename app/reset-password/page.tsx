import type { Metadata } from "next";
import ResetPasswordForm from "@/app/components/auth/ResetPasswordForm";
import { DEFAULT_APP_TITLE } from "@/lib/appBranding";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: `Reset password · ${DEFAULT_APP_TITLE}`, referrer: "no-referrer", robots: { index: false, follow: false } };

// no-store/no-referrer response headers are owned by next.config.ts.
export default function ResetPasswordPage() {
  return <ResetPasswordForm />;
}
