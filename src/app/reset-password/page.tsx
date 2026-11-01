import type { Metadata } from "next";
import AuthLayout from "@/components/auth/AuthLayout";
import ResetPasswordForm from "@/components/auth/ResetPasswordForm";

// The token is in the URL; keep it out of search engines and out of the Referer sent to other sites.
export const metadata: Metadata = { title: "Choose a new password", robots: { index: false }, referrer: "no-referrer" };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <AuthLayout title="New password">
      <ResetPasswordForm token={typeof token === "string" ? token : ""} />
    </AuthLayout>
  );
}
