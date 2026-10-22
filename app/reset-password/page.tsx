import type { Metadata } from "next";
import ResetPasswordForm from "@/app/components/auth/ResetPasswordForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Reset password · Noctua", referrer: "no-referrer", robots: { index: false, follow: false } };

// no-store/no-referrer response headers are owned by next.config.ts.
export default function ResetPasswordPage() {
  return <ResetPasswordForm />;
}
