import type { Metadata } from "next";
import Link from "next/link";
import AuthLayout from "@/components/auth/AuthLayout";
import UnsubscribeForm from "@/components/auth/UnsubscribeForm";
import { NOTIFICATION_LABELS } from "@/lib/notification-kinds";
import { readUnsubscribeToken } from "@/lib/unsubscribe-token";

export const metadata: Metadata = { title: "Unsubscribe", robots: { index: false }, referrer: "no-referrer" };

export default async function UnsubscribePage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { t } = await searchParams;
  const token = typeof t === "string" ? t : "";
  const parsed = readUnsubscribeToken(token);

  return (
    <AuthLayout title="Unsubscribe">
      {parsed ? (
        <UnsubscribeForm token={token} label={NOTIFICATION_LABELS[parsed.kind]} />
      ) : (
        <p className="form-error" role="alert">
          This unsubscribe link is not valid. You can switch notifications off on your <Link href="/profile">profile</Link>.
        </p>
      )}
    </AuthLayout>
  );
}
